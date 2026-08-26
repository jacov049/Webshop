import { Router } from "express";
import { pool } from "../db/pool.ts";
import { asyncHandler } from "../lib/asyncHandler.ts";

export const productsRouter = Router();

productsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT id, name, description, price_eur, stock, image_path
     FROM products WHERE active = true ORDER BY created_at DESC`
    );
    res.json(rows);
  })
);

productsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, name, description, price_eur, stock, image_path
     FROM products WHERE id = $1 AND active = true`,
      [req.params.id]
    );
    const product = rows[0];
    if (!product) return res.status(404).json({ error: "Artikel nicht gefunden." });
    res.json(product);
  })
);
