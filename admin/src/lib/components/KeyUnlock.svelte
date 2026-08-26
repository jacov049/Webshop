<script lang="ts">
	import { keySession, unlockPrivateKey, lockPrivateKey } from '$lib/decrypt/pgp.svelte';

	let armoredKey = $state('');
	let passphrase = $state('');
	let error = $state('');
	let busy = $state(false);
	let showForm = $state(false);

	async function handleFile(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		armoredKey = await file.text();
	}

	async function unlock() {
		busy = true;
		error = '';
		try {
			await unlockPrivateKey(armoredKey, passphrase);
			armoredKey = '';
			passphrase = '';
			showForm = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Entsperren fehlgeschlagen.';
		} finally {
			busy = false;
		}
	}
</script>

<div class="key-unlock">
	{#if keySession.unlocked}
		<span class="badge status-paid">PGP-Schlüssel entsperrt</span>
		<button class="secondary" onclick={lockPrivateKey}>Sperren</button>
	{:else if showForm}
		<form onsubmit={(e) => (e.preventDefault(), unlock())} class="stack unlock-form">
			<label>
				Privater PGP-Schlüssel (.asc)
				<input type="file" accept=".asc,.pgp,.txt" onchange={handleFile} />
			</label>
			<textarea placeholder="…oder hier einfügen" bind:value={armoredKey} rows="4"></textarea>
			<label>
				Passphrase
				<input type="password" bind:value={passphrase} />
				<span class="muted hint">Leer lassen, falls der Schlüssel keine Passphrase hat.</span>
			</label>
			{#if error}
				<p class="error-text">{error}</p>
			{/if}
			<button type="submit" disabled={busy || !armoredKey}>
				{busy ? 'Entsperre…' : 'Entsperren'}
			</button>
		</form>
	{:else}
		<button class="secondary" onclick={() => (showForm = true)}>PGP-Schlüssel entsperren</button>
	{/if}
</div>

<style>
	.key-unlock {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.unlock-form {
		min-width: 280px;
	}

	.hint {
		font-size: 0.78rem;
	}
</style>
