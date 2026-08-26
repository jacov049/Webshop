import { Router } from "express";
import { eurToBtc, eurToXmr } from "../services/payment/rates.ts";
import { asyncHandler } from "../lib/asyncHandler.ts";

export const ratesRouter = Router();

/** Öffentliche Live-Kurse für die Preisanzeige (EUR -> BTC/XMR). */
ratesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [btc, xmr] = await Promise.all([eurToBtc(1), eurToXmr(1)]);
    res.json({ btcPerEur: btc, xmrPerEur: xmr });
  })
);
