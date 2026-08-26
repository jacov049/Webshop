import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/auth.ts";
import { requireCsrf } from "../../middleware/csrf.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { readSettings, writeSettings } from "../../services/settings.ts";
import { SETTING_DEFINITIONS, SETTING_MAX_LENGTH } from "../../lib/siteSettings.ts";

export const adminSettingsRouter = Router();
adminSettingsRouter.use(requireAdmin);

/** Aktuelle Werte + Feldbeschreibungen für das Admin-Formular. */
adminSettingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({
      values: await readSettings(),
      // Feldliste bewusst vom Backend geliefert, damit Admin-Panel und
      // Backend nie auseinanderlaufen (eine Quelle der Wahrheit).
      definitions: SETTING_DEFINITIONS.map(({ key, label, type, group, hint }) => ({
        key,
        label,
        type,
        group,
        hint
      }))
    });
  })
);

const updateSchema = z.record(z.string().max(SETTING_MAX_LENGTH));

adminSettingsRouter.put(
  "/",
  requireCsrf,
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Ungültige Anfrage.", details: parsed.error.flatten() });
    }
    // writeSettings filtert selbst gegen die Allowlist bekannter Schlüssel.
    await writeSettings(parsed.data);
    res.json({ values: await readSettings() });
  })
);
