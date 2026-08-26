<script lang="ts">
	import { onMount } from 'svelte';
	import { apiGet, apiPut } from '$lib/api';
	import type { SettingDefinition, SettingsResponse } from '$lib/types';

	let definitions = $state<SettingDefinition[]>([]);
	let values = $state<Record<string, string>>({});
	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');
	let savedAt = $state<Date | null>(null);

	// Gruppen in der Reihenfolge, in der sie vom Backend kommen.
	const groups = $derived([...new Set(definitions.map((d) => d.group))]);

	async function load() {
		loading = true;
		error = '';
		try {
			const data = await apiGet<SettingsResponse>('/admin/settings');
			definitions = data.definitions;
			values = { ...data.values };
		} catch (err) {
			error = err instanceof Error ? err.message : 'Laden fehlgeschlagen.';
		} finally {
			loading = false;
		}
	}

	onMount(load);

	async function save(e: SubmitEvent) {
		e.preventDefault();
		saving = true;
		error = '';
		try {
			const result = await apiPut<SettingsResponse>('/admin/settings', values);
			values = { ...result.values };
			savedAt = new Date();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Speichern fehlgeschlagen.';
		} finally {
			saving = false;
		}
	}
</script>

<h1>Einstellungen</h1>
<p class="muted">
	Alle Texte der öffentlichen Website. Felder vom Typ Markdown unterstützen Überschriften
	(<code>##</code>), Listen (<code>-</code>), <code>**fett**</code>, <code>*kursiv*</code> und
	Links <code>[Text](/ziel)</code>. HTML wird bewusst nicht interpretiert.
</p>

{#if loading}
	<p class="muted">Lade…</p>
{:else}
	<form onsubmit={save} class="stack">
		{#each groups as group (group)}
			<section class="card stack">
				<h2>{group}</h2>
				{#each definitions.filter((d) => d.group === group) as def (def.key)}
					<label>
						<span class="field-label">{def.label}</span>
						{#if def.hint}
							<span class="muted hint">{def.hint}</span>
						{/if}
						{#if def.type === 'markdown'}
							<textarea bind:value={values[def.key]} rows="12"></textarea>
						{:else}
							<input type="text" bind:value={values[def.key]} />
						{/if}
					</label>
				{/each}
			</section>
		{/each}

		{#if error}
			<p class="error-text">{error}</p>
		{/if}

		<div class="actions">
			<button type="submit" disabled={saving}>{saving ? 'Speichere…' : 'Speichern'}</button>
			<button type="button" class="secondary" onclick={load} disabled={saving}>Zurücksetzen</button>
			{#if savedAt}
				<span class="muted">Gespeichert um {savedAt.toLocaleTimeString('de-DE')}</span>
			{/if}
		</div>
	</form>
{/if}

<style>
	form {
		max-width: 760px;
	}

	h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.field-label {
		font-size: 0.9rem;
	}

	.hint {
		font-size: 0.8rem;
	}

	textarea {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.85rem;
		line-height: 1.5;
		resize: vertical;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		position: sticky;
		bottom: 0;
		background: var(--color-bg);
		padding: 0.75rem 0;
		border-top: 1px solid var(--color-border);
	}
</style>
