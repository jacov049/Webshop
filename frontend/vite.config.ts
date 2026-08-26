import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import type { KitConfig } from '@sveltejs/kit';
import { defineConfig } from 'vite';

// In Produktion läuft die API same-origin hinter Caddy ('self' genügt).
// Für die lokale Entwicklung darf zusätzlich der Backend-Dev-Server
// kontaktiert werden – PUBLIC_API_BASE_URL zeigt dann z.B. auf
// http://localhost:3000.
const devApiOrigin = process.env.PUBLIC_API_BASE_URL?.trim();
type CspSources = NonNullable<NonNullable<KitConfig['csp']>['directives']>['connect-src'];

const connectSrc = ['self', ...(devApiOrigin ? [devApiOrigin] : [])] as CspSources;

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// Strikte CSP ohne 'unsafe-inline'/CDN (Datensparsamkeitskonzept Abschnitt 8).
			// SvelteKit versieht seine eigenen Inline-Skripte/-Styles automatisch mit
			// Nonces (dynamisch gerenderte Seiten) bzw. Hashes (vorgerenderte Seiten).
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					// Svelte-Transitions erzeugen Inline-<style>-Elemente; siehe SvelteKit-Doku.
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:'],
					// Lokaler Dev-Backend-Port zusätzlich zu 'self' (Produktion: Backend
					// hinter Caddy unter demselben Origin, siehe infra/Caddyfile).
					'connect-src': connectSrc,
					'object-src': ['none'],
					'base-uri': ['none'],
					'frame-ancestors': ['none'],
					'form-action': ['self']
				}
			}
		})
	]
});
