import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 wartet bei async Route-Handlern NICHT automatisch auf das
 * zurückgegebene Promise — eine unbehandelte Ablehnung (z.B. ein DB-Fehler,
 * ein fehlgeschlagener externer API-Call) würde sonst zu einer
 * "unhandled promise rejection" und damit zum Absturz des gesamten
 * Node-Prozesses führen (DoS-Risiko). Dieser Wrapper leitet Fehler
 * stattdessen an `next()` und damit an den zentralen Error-Handler in
 * index.ts weiter.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
