import { randomUUID } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import express, { Router } from "express";
import { z } from "zod";
import sharp from "sharp";
import { pool } from "../../db/pool.ts";
import { requireAdmin } from "../../middleware/auth.ts";
import { requireCsrf } from "../../middleware/csrf.ts";
import { logger } from "../../lib/logger.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";

export const adminProductsRouter = Router();
adminProductsRouter.use(requireAdmin);

// Bilder kommen als Data-URL im JSON-Body; hier gezielt ein größeres
// Limit als das globale 64kb (siehe index.ts). Gilt nur für diese bereits
// authentifizierte Route.
const uploadJson = express.json({ limit: "16mb" });

const UPLOAD_DIR = path.resolve("uploads/products");
await mkdir(UPLOAD_DIR, { recursive: true });

const productSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(""),
  priceEur: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
  active: z.boolean().optional().default(true),
  // optionales Bild als Data-URL (data:image/...;base64,...), wird
  // serverseitig auf ein sicheres Format/Größe normalisiert (sharp).
  imageDataUrl: z.string().max(15_000_000).optional()
});

async function storeImage(dataUrl: string): Promise<string> {
  const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Ungültiges Bildformat.");
  const buffer = Buffer.from(match[2] ?? "", "base64");
  const filename = `${randomUUID()}.webp`;
  const outPath = path.join(UPLOAD_DIR, filename);
  await sharp(buffer)
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(outPath);
  return `/uploads/products/${filename}`;
}

adminProductsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT id, name, description, price_eur, stock, image_path, active, created_at, updated_at
     FROM products ORDER BY created_at DESC`
    );
    res.json(rows);
  })
);

adminProductsRouter.post(
  "/",
  uploadJson,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Ungültige Anfrage.", details: parsed.error.flatten() });
    }
    const data = parsed.data;

    let imagePath: string | null = null;
    try {
      if (data.imageDataUrl) imagePath = await storeImage(data.imageDataUrl);
    } catch (err) {
      logger.warn({ err }, "Bild-Upload fehlgeschlagen");
      return res.status(400).json({ error: "Bild konnte nicht verarbeitet werden." });
    }

    const { rows } = await pool.query(
      `INSERT INTO products (name, description, price_eur, stock, image_path, active)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [data.name, data.description, data.priceEur, data.stock, imagePath, data.active]
    );
    res.status(201).json({ id: rows[0]?.id });
  })
);

adminProductsRouter.put(
  "/:id",
  uploadJson,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Ungültige Anfrage.", details: parsed.error.flatten() });
    }
    const data = parsed.data;

    const existing = await pool.query(`SELECT image_path FROM products WHERE id = $1`, [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "Artikel nicht gefunden." });

    let imagePath: string | undefined;
    if (data.imageDataUrl) {
      try {
        imagePath = await storeImage(data.imageDataUrl);
        const oldPath = existing.rows[0].image_path as string | null;
        // Nur den Dateinamen verwenden und fest im Upload-Verzeichnis
        // auflösen, damit ein manipulierter DB-Wert nie außerhalb davon
        // löschen kann.
        if (oldPath) await unlink(path.join(UPLOAD_DIR, path.basename(oldPath))).catch(() => {});
      } catch (err) {
        logger.warn({ err }, "Bild-Upload fehlgeschlagen");
        return res.status(400).json({ error: "Bild konnte nicht verarbeitet werden." });
      }
    }

    await pool.query(
      `UPDATE products SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       price_eur = COALESCE($3, price_eur),
       stock = COALESCE($4, stock),
       image_path = COALESCE($5, image_path),
       active = COALESCE($6, active),
       updated_at = now()
     WHERE id = $7`,
      [data.name, data.description, data.priceEur, data.stock, imagePath, data.active, req.params.id]
    );
    res.json({ ok: true });
  })
);

adminProductsRouter.delete(
  "/:id",
  requireCsrf,
  asyncHandler(async (req, res) => {
    await pool.query(`DELETE FROM products WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  })
);
