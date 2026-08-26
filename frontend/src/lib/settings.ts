/**
 * Im Admin-Panel pflegbare Website-Inhalte.
 * Die maßgebliche Liste inkl. Defaults liegt im Backend
 * (backend/src/lib/siteSettings.ts) und wird über /api/settings geliefert.
 * Die Werte hier dienen nur als Notfall-Fallback, falls das Backend
 * nicht erreichbar ist.
 */
export interface SiteSettings {
	shop_name: string;
	shop_description: string;
	catalog_heading: string;
	catalog_intro_md: string;
	footer_note: string;
	checkout_notice_md: string;
	contact_intro_md: string;
	impressum_md: string;
	datenschutz_md: string;
	widerruf_md: string;
}

export const SETTING_FALLBACKS: SiteSettings = {
	shop_name: 'CryptoShop',
	shop_description:
		'Datensparsamer Webshop mit Ende-zu-Ende-Verschlüsselung und Krypto-Zahlung.',
	catalog_heading: 'Artikel',
	catalog_intro_md: '',
	footer_note: 'Zahlung ausschließlich mit Bitcoin & Monero. Keine Tracker, keine Analytics.',
	checkout_notice_md:
		'Deine Angaben werden direkt in diesem Browser mit dem PGP-Schlüssel des Betreibers verschlüsselt, bevor sie überhaupt gesendet werden. Der Server kann sie nicht lesen.',
	contact_intro_md:
		'Deine Nachricht wird direkt in diesem Browser mit dem PGP-Schlüssel des Betreibers verschlüsselt und ist nur für ihn lesbar.',
	impressum_md: 'Impressum ist derzeit nicht verfügbar.',
	datenschutz_md: 'Datenschutzerklärung ist derzeit nicht verfügbar.',
	widerruf_md: 'Widerrufsbelehrung ist derzeit nicht verfügbar.'
};
