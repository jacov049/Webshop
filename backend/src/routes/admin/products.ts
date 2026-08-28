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

const uploadJson = express.json({ limit: "16mb" });
const UPLOAD_DIR = path.resolve("uploads/products");
const MAX_INPUT_PIXELS = 40_000_000;
await mkdir(UPLOAD_DIR, { recursive: true });

const idSchema = z.string().uuid();
const productSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(""),
  priceEur: z.number().finite().nonnegative(),
  stock: z.number().int().nonnegative(),
  active: z.boolean().optional().default(true),
  imageDataUrl: z.string().max(15_000_000).optional()
});

function localImagePath(publicPath: string): string {
  return path.join(UPLOAD_DIR, path.basename(publicPath));
}

async function deleteStoredImage(publicPath: string | null | undefined) {
  if (!publicPath) return;
  await unlink(localImagePath(publicPath)).catch((err: NodeJS.ErrnoException) => {
    if (err.code !== "ENOENT") logger.warn({ err }, "Artikelbild konnte nicht gelöscht werden");
  });
}

async function storeImage(dataUrl: string): Promise<string> {
  const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Ungültiges Bildformat.");

  const buffer = Buffer.from(match[2] ?? "", "base64");
  if (buffer.length === 0) throw new Error("Leeres Bild.");

  const filename = `${randomUUID()}.webp`;
  const outPath = path.join(UPLOAD_DIR, filename);
  try {
    await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outPath);
  } catch (err) {
    await unlink(outPath).catch(() => {});
    throw err;
  }
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
  requireCsrf,
  uploadJson,
  asyncHandler(async (req, res) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Ungültige Anfrage.", details: parsed.error.flatten() });
    }
    const data = parsed.data;

    let imagePath: string | null = null;
    try {
      if (data.imageDataUrl) imagePath = await storeImage(data.imageDataUrl);
      const { rows } = await pool.query(
        `INSERT INTO products (name, description, price_eur, stock, image_path, active)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [data.name, data.description, data.priceEur, data.stock, imagePath, data.active]
      );
      res.status(201).json({ id: rows[0]?.id });
    } catch (err) {
      await deleteStoredImage(imagePath);
      logger.warn({ err }, "Artikel konnte nicht angelegt werden");
      res.status(400).json({ error: "Artikel oder Bild konnte nicht verarbeitet werden." });
    }
  })
);

adminProductsRouter.put(
  "/:id",
  uploadJson,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: "Ungültige Artikel-ID." });

    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Ungültige Anfrage.", details: parsed.error.flatten() });
    }
    const data = parsed.data;

    const existing = await pool.query<{ image_path: string | null }>(
      `SELECT image_path FROM products WHERE id = $1`,
      [id.data]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: "Artikel nicht gefunden." });

    const oldImagePath = existing.rows[0]?.image_path ?? null;
    let newImagePath: string | undefined;
    try {
      if (data.imageDataUrl) newImagePath = await storeImage(data.imageDataUrl);

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
        [data.name, data.description, data.priceEur, data.stock, newImagePath, data.active, id.data]
      );
    } catch (err) {
      await deleteStoredImage(newImagePath);
      logger.warn({ err }, "Artikel-Aktualisierung fehlgeschlagen");
      return res.status(400).json({ error: "Artikel oder Bild konnte nicht verarbeitet werden." });
    }

    if (newImagePath && oldImagePath && oldImagePath !== newImagePath) {
      await deleteStoredImage(oldImagePath);
    }
    res.json({ ok: true });
  })
);

adminProductsRouter.delete(
  "/:id",
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: "Ungültige Artikel-ID." });

    const { rows } = await pool.query<{ image_path: string | null }>(
      `DELETE FROM products WHERE id = $1 RETURNING image_path`,
      [id.data]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Artikel nicht gefunden." });

    await deleteStoredImage(rows[0]?.image_path);
    res.json({ ok: true });
  })
);
