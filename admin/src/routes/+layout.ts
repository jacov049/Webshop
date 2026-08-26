// Admin-Panel als reine SPA ausliefern: kein SSR, da alle Inhalte ohnehin
// hinter dem Login liegen und die PGP-Entschlüsselung ausschließlich
// clientseitig im Browser stattfinden darf (privater Schlüssel verlässt
// nie das Gerät des Betreibers, siehe Konzept Abschnitt 4).
export const ssr = false;
