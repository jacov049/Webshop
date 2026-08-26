import { error } from '@sveltejs/kit';
import { serverApiGet } from '$lib/api.server';
import type { Product } from '$lib/types';

interface Rates {
	btcPerEur: number;
	xmrPerEur: number;
}

export async function load({ params, fetch }) {
	let product: Product;
	try {
		product = await serverApiGet<Product>(`/api/products/${params.id}`, fetch);
	} catch {
		throw error(404, 'Artikel nicht gefunden.');
	}
	// Kurse sind optional – ohne sie wird nur der EUR-Preis angezeigt.
	const rates = await serverApiGet<Rates>('/api/rates', fetch).catch(() => null);
	return { product, rates };
}
