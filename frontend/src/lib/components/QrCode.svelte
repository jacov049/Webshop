<script lang="ts">
	import QRCode from 'qrcode';

	let { text }: { text: string } = $props();
	let dataUrl = $state('');

	$effect(() => {
		QRCode.toDataURL(text, { width: 260, margin: 1 }).then((url) => (dataUrl = url));
	});
</script>

{#if dataUrl}
	<img class="qr" src={dataUrl} alt="QR-Code für Zahlungsadresse" />
{/if}

<style>
	.qr {
		border-radius: var(--radius);
		background: #fff;
		padding: 0.75rem;
	}
</style>
