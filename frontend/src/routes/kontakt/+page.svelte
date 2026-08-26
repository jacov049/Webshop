<script lang="ts">
	import { encryptForOperator } from '$lib/crypto/pgp';
	import { apiPost } from '$lib/api';
	import Markdown from '$lib/components/Markdown.svelte';
	import type { SiteSettings } from '$lib/settings';

	let { data }: { data: { settings: SiteSettings } } = $props();

	let message = $state('');
	let orderNumber = $state('');
	let messengerId = $state('');
	let messengerType = $state<'threema' | 'signal'>('signal');

	let submitting = $state(false);
	let sent = $state(false);
	let errorMsg = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		submitting = true;
		errorMsg = '';
		try {
			const payload = {
				message,
				orderNumber: orderNumber || undefined,
				messenger: messengerId ? { type: messengerType, id: messengerId } : undefined
			};
			const encryptedPayload = await encryptForOperator(payload);
			await apiPost('/api/contact', { encryptedPayload });
			sent = true;
			message = '';
			orderNumber = '';
			messengerId = '';
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
		} finally {
			submitting = false;
		}
	}
</script>

<h1>Kontakt</h1>

<div class="muted">
	<Markdown source={data.settings.contact_intro_md} />
</div>

{#if sent}
	<p class="card">Danke, deine Nachricht wurde verschlüsselt übermittelt.</p>
{:else}
	<form onsubmit={submit} class="stack">
		<label>
			Nachricht
			<textarea required bind:value={message} rows="6"></textarea>
		</label>
		<label>
			Bestellnummer (optional)
			<input type="text" bind:value={orderNumber} />
		</label>
		<fieldset>
			<legend>Rückkanal (optional, für eine Antwort erforderlich)</legend>
			<label class="radio">
				<input type="radio" name="mt" value="signal" bind:group={messengerType} />
				Signal
			</label>
			<label class="radio">
				<input type="radio" name="mt" value="threema" bind:group={messengerType} />
				Threema
			</label>
			<input type="text" placeholder="Signal-/Threema-ID" bind:value={messengerId} />
		</fieldset>

		{#if errorMsg}
			<p class="error-text">{errorMsg}</p>
		{/if}

		<button type="submit" disabled={submitting}>
			{submitting ? 'Wird verschlüsselt & gesendet…' : 'Verschlüsselt senden'}
		</button>
	</form>
{/if}

<style>
	form {
		max-width: 480px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}

	fieldset {
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.radio {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
	}

	.radio input {
		width: auto;
	}
</style>
