<script lang="ts">
	import { onMount } from 'svelte';
	import { apiGet, apiPost, apiPut, apiDelete } from '$lib/api';
	import type { AdminProduct } from '$lib/types';

	let products = $state<AdminProduct[]>([]);
	let loading = $state(true);
	let editingId = $state<string | null>(null);
	let showForm = $state(false);

	let name = $state('');
	let description = $state('');
	let priceEur = $state(0);
	let stock = $state(0);
	let active = $state(true);
	let imageDataUrl = $state<string | undefined>(undefined);
	let saving = $state(false);
	let formError = $state('');

	async function load() {
		loading = true;
		try {
			products = await apiGet<AdminProduct[]>('/admin/products');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function resetForm() {
		editingId = null;
		name = '';
		description = '';
		priceEur = 0;
		stock = 0;
		active = true;
		imageDataUrl = undefined;
		formError = '';
	}

	function startCreate() {
		resetForm();
		showForm = true;
	}

	function startEdit(p: AdminProduct) {
		editingId = p.id;
		name = p.name;
		description = p.description ?? '';
		priceEur = Number(p.price_eur);
		stock = p.stock;
		active = p.active;
		imageDataUrl = undefined;
		showForm = true;
	}

	function handleFile(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => (imageDataUrl = reader.result as string);
		reader.readAsDataURL(file);
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		saving = true;
		formError = '';
		try {
			const body = { name, description, priceEur, stock, active, imageDataUrl };
			if (editingId) {
				await apiPut(`/admin/products/${editingId}`, body);
			} else {
				await apiPost('/admin/products', body);
			}
			showForm = false;
			resetForm();
			await load();
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Speichern fehlgeschlagen.';
		} finally {
			saving = false;
		}
	}

	async function remove(id: string) {
		if (!confirm('Artikel wirklich löschen?')) return;
		await apiDelete(`/admin/products/${id}`);
		await load();
	}
</script>

<h1>Artikel</h1>

<button onclick={startCreate}>Neuer Artikel</button>

{#if showForm}
	<form onsubmit={submit} class="card stack form">
		<label>
			Name
			<input type="text" required bind:value={name} />
		</label>
		<label>
			Beschreibung
			<textarea bind:value={description} rows="4"></textarea>
		</label>
		<div class="row">
			<label>
				Preis (EUR)
				<input type="number" step="0.01" min="0" required bind:value={priceEur} />
			</label>
			<label>
				Lagerbestand
				<input type="number" step="1" min="0" required bind:value={stock} />
			</label>
		</div>
		<label class="checkbox">
			<input type="checkbox" bind:checked={active} />
			Aktiv (im Shop sichtbar)
		</label>
		<label>
			Bild
			<input type="file" accept="image/png,image/jpeg,image/webp" onchange={handleFile} />
		</label>
		{#if formError}
			<p class="error-text">{formError}</p>
		{/if}
		<div class="row">
			<button type="submit" disabled={saving}>{saving ? 'Speichere…' : 'Speichern'}</button>
			<button type="button" class="secondary" onclick={() => (showForm = false)}>Abbrechen</button
			>
		</div>
	</form>
{/if}

{#if loading}
	<p class="muted">Lade…</p>
{:else}
	<div class="stack list">
		{#each products as p (p.id)}
			<div class="card row product">
				<div>
					<strong>{p.name}</strong>
					<span class="muted">— {Number(p.price_eur).toFixed(2)} € · Bestand {p.stock}</span>
					{#if !p.active}<span class="badge status-cancelled">inaktiv</span>{/if}
				</div>
				<div class="row">
					<button class="secondary" onclick={() => startEdit(p)}>Bearbeiten</button>
					<button class="secondary" onclick={() => remove(p.id)}>Löschen</button>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.form {
		max-width: 480px;
		margin: 1.25rem 0;
	}

	.row {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.row label {
		flex: 1;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}

	.checkbox {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
	}

	.checkbox input {
		width: auto;
	}

	.list {
		margin-top: 1.25rem;
	}

	.product {
		justify-content: space-between;
	}
</style>
