<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';

	let username = $state('');
	let password = $state('');
	let totpCode = $state('');
	let busy = $state(false);
	let error = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		error = '';
		try {
			await auth.login(username, password, totpCode);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.';
		} finally {
			busy = false;
		}
	}
</script>

<div class="login-wrap">
	<form onsubmit={submit} class="card stack">
		<h1>CryptoShop Admin</h1>
		<label>
			Benutzername
			<input type="text" required bind:value={username} autocomplete="username" />
		</label>
		<label>
			Passwort
			<input type="password" required bind:value={password} autocomplete="current-password" />
		</label>
		<label>
			TOTP-Code
			<input
				type="text"
				required
				inputmode="numeric"
				pattern="[0-9]{6}"
				maxlength="6"
				bind:value={totpCode}
				autocomplete="one-time-code"
			/>
		</label>
		{#if error}
			<p class="error-text">{error}</p>
		{/if}
		<button type="submit" disabled={busy}>{busy ? 'Prüfe…' : 'Anmelden'}</button>
	</form>
</div>

<style>
	.login-wrap {
		display: flex;
		justify-content: center;
		padding-top: 4rem;
	}

	form {
		width: 320px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}
</style>
