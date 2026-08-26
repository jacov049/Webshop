<script lang="ts">
	import { decryptPayload, keySession } from '$lib/decrypt/pgp.svelte';
	import { apiPatch } from '$lib/api';
	import type { AdminContactRequest, ContactPayload } from '$lib/types';

	let { request }: { request: AdminContactRequest } = $props();

	let decrypted = $state<ContactPayload | null>(null);
	let decryptError = $state('');
	let decrypting = $state(false);
	let busy = $state(false);

	async function decrypt() {
		decrypting = true;
		decryptError = '';
		try {
			decrypted = await decryptPayload<ContactPayload>(request.encrypted_payload);
		} catch (err) {
			decryptError = err instanceof Error ? err.message : 'Entschlüsselung fehlgeschlagen.';
		} finally {
			decrypting = false;
		}
	}

	async function markAnswered() {
		busy = true;
		try {
			await apiPatch(`/admin/contact/${request.id}/status`, { status: 'answered' });
			request.status = 'answered';
		} finally {
			busy = false;
		}
	}
</script>

<div class="card contact-row">
	<div class="row header">
		<span class="muted">{new Date(request.created_at).toLocaleString('de-DE')}</span>
		<span class="badge status-{request.status === 'open' ? 'pending' : 'paid'}">{request.status}</span>
	</div>

	{#if !decrypted}
		<div class="row">
			<button class="secondary" onclick={decrypt} disabled={decrypting || !keySession.unlocked}>
				{decrypting ? 'Entschlüssele…' : 'Entschlüsseln'}
			</button>
			{#if !keySession.unlocked}
				<span class="muted">PGP-Schlüssel oben entsperren</span>
			{/if}
		</div>
	{:else}
		<div class="decrypted stack">
			<p>{decrypted.message}</p>
			{#if decrypted.orderNumber}
				<p class="muted">Bestellnummer: {decrypted.orderNumber}</p>
			{/if}
			{#if decrypted.messenger}
				<p class="muted">
					Rückkanal: {decrypted.messenger.type} — <code>{decrypted.messenger.id}</code>
				</p>
			{/if}
		</div>
	{/if}

	{#if decryptError}
		<p class="error-text">{decryptError}</p>
	{/if}

	{#if request.status === 'open'}
		<button class="secondary" onclick={markAnswered} disabled={busy}>Als beantwortet markieren</button>
	{/if}
</div>

<style>
	.contact-row {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.header {
		justify-content: space-between;
	}

	.decrypted {
		border-top: 1px solid var(--color-border);
		padding-top: 0.6rem;
	}
</style>
