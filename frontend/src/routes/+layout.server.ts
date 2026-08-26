import { serverApiGet } from '$lib/api.server';
import { SETTING_FALLBACKS, type SiteSettings } from '$lib/settings';

/**
 * Redaktionelle Inhalte (Shopname, Rechtstexte, ...) einmal zentral laden
 * und über `data` an alle Seiten weiterreichen. Fällt der Backend-Abruf
 * aus, greifen die Fallback-Texte, damit die Seite nutzbar bleibt.
 */
export async function load({ fetch }) {
	try {
		const settings = await serverApiGet<SiteSettings>('/api/settings', fetch);
		return { settings: { ...SETTING_FALLBACKS, ...settings } };
	} catch {
		return { settings: SETTING_FALLBACKS };
	}
}
