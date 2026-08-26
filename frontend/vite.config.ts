import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

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
					'connect-src': ['self', 'http://localhost:3000'],
					'object-src': ['none'],
					'base-uri': ['none'],
					'frame-ancestors': ['none'],
					'form-action': ['self']
				}
			}
		})
	]
});
