import { apiGet, apiPost, ApiError, setUnauthorizedHandler } from '$lib/api';
import { lockPrivateKey } from '$lib/decrypt/pgp.svelte';

class AuthStore {
	checked = $state(false);
	authenticated = $state(false);

	async check() {
		try {
			await apiGet('/admin/auth/me');
			this.authenticated = true;
		} catch {
			this.authenticated = false;
		} finally {
			this.checked = true;
		}
	}

	async login(username: string, password: string, totpCode: string) {
		await apiPost('/admin/auth/login', { username, password, totpCode });
		this.authenticated = true;
	}

	async logout() {
		try {
			await apiPost('/admin/auth/logout');
		} catch (err) {
			if (!(err instanceof ApiError)) throw err;
		}
		this.endSession();
	}

	/**
	 * Beendet die Sitzung lokal. Der entschlüsselte PGP-Schlüssel wird
	 * dabei immer aus dem Speicher entfernt, damit er nach einem
	 * Sitzungsende nicht im Tab liegen bleibt.
	 */
	endSession() {
		this.authenticated = false;
		lockPrivateKey();
	}
}

export const auth = new AuthStore();

// Läuft die Server-Sitzung ab, springt das Panel automatisch zurück
// auf den Login-Bildschirm.
setUnauthorizedHandler(() => auth.endSession());
