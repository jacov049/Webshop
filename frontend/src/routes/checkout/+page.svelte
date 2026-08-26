<script lang="ts">
	import { goto } from '$app/navigation';
	import { cart } from '$lib/stores/cart.svelte';
	import { encryptForOperator } from '$lib/crypto/pgp';
	import { apiPost } from '$lib/api';
	import Markdown from '$lib/components/Markdown.svelte';
	import type { CheckoutResponse, PaymentMethod } from '$lib/types';
	import type { SiteSettings } from '$lib/settings';

	let { data }: { data: { settings: SiteSettings } } = $props();

	let name = $state('');
	let street = $state('');
	let zip = $state('');
	let city = $state('');
	let country = $state('Deutschland');
	let note = $state('');
	let paymentMethod = $state<PaymentMethod>('BTC');

	let submitting = $state(false);
	let errorMsg = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (cart.items.length === 0) return;
		submitting = true;
		errorMsg = '';
		try {
			const payload = {
				name,
				address: { street, zip, city, country },
				note: note || undefined,
				items: cart.items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity }))
			};
			const encryptedPayload = await encryptForOperator(payload);

			const result = await apiPost<CheckoutResponse>('/api/checkout', {
				encryptedPayload,
				paymentMethod,
				items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
			});

			cart.clear();
			await goto(`/bestellung/${result.orderToken}`);
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
		} finally {
			submitting = false;
		}
	}
</script>

<h1>Kasse</h1>

{#if cart.items.length === 0}
	<p class="muted">Dein Warenkorb ist leer.</p>
{:else}
	<div class="muted">
		<Markdown source={data.settings.checkout_notice_md} />
	</div>

	<form onsubmit={submit} class="stack">
		<label>
			Name
			<input type="text" required bind:value={name} autocomplete="name" />
		</label>
		<label>
			Straße &amp; Hausnummer
			<input type="text" required bind:value={street} autocomplete="street-address" />
		</label>
		<div class="row">
			<label>
				PLZ
				<input type="text" required bind:value={zip} autocomplete="postal-code" />
			</label>
			<label>
				Ort
				<input type="text" required bind:value={city} autocomplete="address-level2" />
			</label>
		</div>
		<label>
			Land
			<input type="text" required bind:value={country} autocomplete="country-name" />
		</label>
		<label>
			Anmerkung (optional)
			<textarea bind:value={note} rows="3"></textarea>
		</label>

		<fieldset>
			<legend>Zahlungsmethode</legend>
			<label class="radio">
				<input type="radio" name="pm" value="BTC" bind:group={paymentMethod} />
				Bitcoin (on-chain)
			</label>
			<label class="radio">
				<input type="radio" name="pm" value="XMR" bind:group={paymentMethod} />
				Monero
			</label>
		</fieldset>

		{#if errorMsg}
			<p class="error-text">{errorMsg}</p>
		{/if}

		<button type="submit" disabled={submitting}>
			{submitting ? 'Wird verschlüsselt & gesendet…' : 'Kostenpflichtig bestellen'}
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

	.row {
		display: flex;
		gap: 1rem;
	}

	.row label {
		flex: 1;
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
