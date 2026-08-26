import { error } from '@sveltejs/kit';
import { apiGet } from '$lib/api';
import type { Product } from '$lib/types';

interface Rates {
	btcPerEur: number;
	xmrPerEur: number;
}

export async function load({ params }) {
	let product: Product;
	try {
		product = await apiGet<Product>(`/api/products/${params.id}`);
	} catch {
		throw error(404, 'Artikel nicht gefunden.');
	}
	const rates = await apiGet<Rates>('/api/rates').catch(() => null);
	return { product, rates };
}
