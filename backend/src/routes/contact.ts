import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.ts";
import { logger } from "../lib/logger.ts";
import { env } from "../lib/env.ts";
import { requireCsrf } from "../middleware/csrf.ts";
import { rateLimit } from "../middleware/rateLimit.ts";
import { asyncHandler } from "../lib/asyncHandler.ts";
import { encryptAtRest } from "../services/crypto/atRest.ts";

export const contactRouter = Router();

const PGP_MESSAGE_RE = /^-----BEGIN PGP MESSAGE-----[\s\S]+-----END PGP MESSAGE-----\s*$/;

const contactSchema = z.object({
  // Enthält Nachricht + optionale Bestellnummer + Threema-/Signal-ID,
  // bereits clientseitig PGP-verschlüsselt. Kein Klartext-Kontaktkanal
  // (z.B. E-Mail-Adresse) wird serverseitig gespeichert.
  encryptedPayload: z.string().min(1).max(10_000).regex(PGP_MESSAGE_RE, "Kein gültiger PGP-Blob.")
});

contactRouter.post(
  "/",
  rateLimit({ windowMs: 60_000, max: 5 }),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Ungültige Anfrage.", details: parsed.error.flatten() });
    }

    const deletionDue = new Date(Date.now() + env.CONTACT_RETENTION_DAYS * 86_400_000);

    try {
      await pool.query(
        `INSERT INTO contact_requests (encrypted_payload, deletion_due) VALUES ($1, $2)`,
        [encryptAtRest(parsed.data.encryptedPayload), deletionDue]
      );
      res.status(201).json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Kontaktanfrage fehlgeschlagen");
      res.status(500).json({ error: "Kontaktanfrage konnte nicht gespeichert werden." });
    }
  })
);
