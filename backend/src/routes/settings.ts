import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.ts";
import { readSettings } from "../services/settings.ts";

export const settingsRouter = Router();

/**
 * Öffentliche Website-Inhalte (Shopname, Rechtstexte, ...).
 * Alle Werte sind ohnehin für Besucher sichtbar – keine Authentifizierung
 * nötig, keine personenbezogenen Daten enthalten.
 */
settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await readSettings());
  })
);
