import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import type { KitConfig } from '@sveltejs/kit';
import { defineConfig } from 'vite';

// Produktion: Admin-API liegt same-origin unter derselben Domain wie das
// SPA (siehe infra/Caddyfile), 'self' genügt. Lokal zeigt
// PUBLIC_API_BASE_URL auf den Backend-Dev-Server.
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
			// Admin-Panel ist eine reine SPA (siehe Architekturdiagramm, Konzept
			// Abschnitt 2): statisches Bundle, ausgeliefert vom Reverse Proxy,
			// kein eigener Node-Prozess nötig. SPA-Fallback auf index.html, da
			// alle Routen clientseitig hinter dem Login gerendert werden.
			adapter: adapter({
				fallback: 'index.html',
				pages: 'build',
				assets: 'build'
			}),
			// Strikte CSP wie im Kunden-Shop (frontend/vite.config.ts).
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:'],
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
