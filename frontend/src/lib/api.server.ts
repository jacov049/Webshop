import { env } from '$env/dynamic/private';
import { PUBLIC_API_BASE_URL } from '$env/static/public';

/**
 * API-Client für `load`-Funktionen, die auf dem Server laufen.
 *
 * Relative URLs sind serverseitig nicht auflösbar, und der Umweg über die
 * öffentliche Domain würde im Docker-Netz DNS-Hairpin voraussetzen.
 * Deshalb zeigt API_INTERNAL_URL direkt auf den Backend-Container
 * (z.B. http://backend:3000, siehe infra/docker-compose.yml).
 */
const baseUrl = env.API_INTERNAL_URL || PUBLIC_API_BASE_URL || 'http://localhost:3000';

type FetchFn = typeof globalThis.fetch;

export async function serverApiGet<T>(path: string, fetchFn: FetchFn): Promise<T> {
	const res = await fetchFn(`${baseUrl}${path}`);
	if (!res.ok) throw new Error(`Backend antwortete mit HTTP ${res.status}`);
	return (await res.json()) as T;
}
