import { apiGet } from '$lib/api';
import type { Product } from '$lib/types';

export async function load() {
	try {
		const products = await apiGet<Product[]>('/api/products');
		return { products };
	} catch {
		return { products: [] as Product[] };
	}
}
