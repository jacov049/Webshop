import type { Handle } from '@sveltejs/kit';

/**
 * Zusätzliche Sicherheits-Header für alle ausgelieferten Seiten (Defense in
 * Depth zusätzlich zur Reverse-Proxy-Konfiguration in infra/Caddyfile).
 * Die Content-Security-Policy selbst wird bereits von SvelteKit gesetzt
 * (siehe kit.csp in vite.config.ts, inkl. automatischer Nonces/Hashes).
 */
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'no-referrer');
	response.headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
	response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
	return response;
};
