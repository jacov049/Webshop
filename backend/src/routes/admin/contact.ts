import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool.ts";
import { requireAdmin } from "../../middleware/auth.ts";
import { requireCsrf } from "../../middleware/csrf.ts";
import { decryptAtRest } from "../../services/crypto/atRest.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";

export const adminContactRouter = Router();
adminContactRouter.use(requireAdmin);

adminContactRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;
    const { rows } = await pool.query(
      `SELECT id, encrypted_payload, status, created_at, deletion_due
     FROM contact_requests
     WHERE $1::text IS NULL OR status = $1
     ORDER BY created_at DESC
     LIMIT 200`,
      [statusFilter ?? null]
    );
    const requests = rows.map((row) => ({
      ...row,
      encrypted_payload: decryptAtRest(row.encrypted_payload)
    }));
    res.json(requests);
  })
);

const statusSchema = z.object({ status: z.enum(["open", "answered"]) });

adminContactRouter.patch(
  "/:id/status",
  requireCsrf,
  asyncHandler(async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Ungültiger Status." });
    // Bei "answered": kurze Nachfrist statt sofortiger Löschung (Konzept Abschnitt 9)
    const deletionDue = parsed.data.status === "answered" ? new Date(Date.now() + 7 * 86_400_000) : null;
    const result = await pool.query(
      `UPDATE contact_requests SET status = $1, deletion_due = COALESCE($2, deletion_due) WHERE id = $3`,
      [parsed.data.status, deletionDue, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Anfrage nicht gefunden." });
    res.json({ ok: true });
  })
);
