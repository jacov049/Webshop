import { apiGet, apiPost, ApiError } from '$lib/api';

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
		this.authenticated = false;
	}
}

export const auth = new AuthStore();
