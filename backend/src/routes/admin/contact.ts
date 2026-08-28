import { readPage, pageResult } from "../../lib/pagination.ts";
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
    let page;
    try { page = readPage(req.query); } catch { return res.status(400).json({ error: "Ungültige Seitenauswahl" }); }
    const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;
    const { rows } = await pool.query(
      `SELECT id, encrypted_payload, status, created_at, deletion_due
     FROM contact_requests
     WHERE ($1::text IS NULL OR status = $1)
       AND ($2::timestamptz IS NULL OR (created_at, id) < ($2::timestamptz, $3::uuid))
     ORDER BY created_at DESC, id DESC
     LIMIT $4`,
      [statusFilter ?? null, page.at, page.id, page.limit + 1]
    );
    const requests = rows.map((row) => ({
      ...row,
      encrypted_payload: decryptAtRest(row.encrypted_payload)
    }));
    res.json(pageResult(requests, page.limit));
  })
);

const statusSchema = z.object({ status: z.enum(["open", "answered"]) });

adminContactRouter.patch(
  "/:id/status",
  requireCsrf,
  asyncHandler(async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Ungültiger Status." });
    // Bei "answered": kurze Nachfrist statt sofortiger Löschung (Konzept
    // Abschnitt 9). LEAST() stellt sicher, dass die Nachfrist die
    // reguläre Aufbewahrungsfrist nie verlängert, sondern nur verkürzt.
    const deletionDue = parsed.data.status === "answered" ? new Date(Date.now() + 7 * 86_400_000) : null;
    const result = await pool.query(
      `UPDATE contact_requests
          SET status = $1,
              deletion_due = LEAST(COALESCE($2::timestamptz, deletion_due), deletion_due)
        WHERE id = $3`,
      [parsed.data.status, deletionDue, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Anfrage nicht gefunden." });
    res.json({ ok: true });
  })
);
