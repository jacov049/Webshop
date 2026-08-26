import { serverApiGet } from '$lib/api.server';
import type { Product } from '$lib/types';

export async function load({ fetch }) {
	try {
		return { products: await serverApiGet<Product[]>('/api/products', fetch), loadError: false };
	} catch {
		return { products: [] as Product[], loadError: true };
	}
}
