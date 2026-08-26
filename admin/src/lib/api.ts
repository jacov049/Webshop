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

export class ApiError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

/**
 * Wird bei HTTP 401 aufgerufen, damit das Panel bei abgelaufener Sitzung
 * zurück auf den Login springt statt stumm leere Listen zu zeigen.
 * Setzt der Auth-Store beim Initialisieren (vermeidet zyklische Imports).
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
	onUnauthorized = handler;
}

function reportStatus(status: number) {
	if (status === 401) onUnauthorized?.();
}

export async function apiGet<T>(path: string): Promise<T> {
	const res = await fetch(`${PUBLIC_API_BASE_URL}${path}`, { credentials: 'include' });
	if (!res.ok) {
		reportStatus(res.status);
		throw new ApiError(res.status, await parseError(res));
	}
	return (await res.json()) as T;
}

async function withCsrf(path: string, method: string, body?: unknown): Promise<Response> {
	const token = await ensureCsrfToken();
	return fetch(`${PUBLIC_API_BASE_URL}${path}`, {
		method,
		credentials: 'include',
		headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
	const res = await withCsrf(path, 'POST', body);
	if (!res.ok) {
		reportStatus(res.status);
		throw new ApiError(res.status, await parseError(res));
	}
	return (await res.json()) as T;
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
	const res = await withCsrf(path, 'PUT', body);
	if (!res.ok) {
		reportStatus(res.status);
		throw new ApiError(res.status, await parseError(res));
	}
	return (await res.json()) as T;
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
	const res = await withCsrf(path, 'PATCH', body);
	if (!res.ok) {
		reportStatus(res.status);
		throw new ApiError(res.status, await parseError(res));
	}
	return (await res.json()) as T;
}

export async function apiDelete<T>(path: string): Promise<T> {
	const res = await withCsrf(path, 'DELETE');
	if (!res.ok) {
		reportStatus(res.status);
		throw new ApiError(res.status, await parseError(res));
	}
	return (await res.json()) as T;
}
