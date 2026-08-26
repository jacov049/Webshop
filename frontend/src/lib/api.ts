import { PUBLIC_API_BASE_URL } from '$env/static/public';

let csrfToken: string | null = null;

async function ensureCsrfToken(): Promise<string> {
	if (csrfToken) return csrfToken;
	const res = await fetch(`${PUBLIC_API_BASE_URL}/api/csrf`, { credentials: 'include' });
	if (!res.ok) throw new Error('CSRF-Token konnte nicht geladen werden.');
	const body = (await res.json()) as { csrfToken: string };
	csrfToken = body.csrfToken;
	return csrfToken;
}

async function parseError(res: Response): Promise<string> {
	try {
		const body = (await res.json()) as { error?: string };
		return body.error ?? `Fehler (HTTP ${res.status})`;
	} catch {
		return `Fehler (HTTP ${res.status})`;
	}
}

export async function apiGet<T>(path: string): Promise<T> {
	const res = await fetch(`${PUBLIC_API_BASE_URL}${path}`, { credentials: 'include' });
	if (!res.ok) throw new Error(await parseError(res));
	return (await res.json()) as T;
}

/** POST mit automatischem CSRF-Double-Submit-Token (siehe backend/src/middleware/csrf.ts). */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
	const token = await ensureCsrfToken();
	const res = await fetch(`${PUBLIC_API_BASE_URL}${path}`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error(await parseError(res));
	return (await res.json()) as T;
}
