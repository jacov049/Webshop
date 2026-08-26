import { error } from '@sveltejs/kit';
import { apiGet } from '$lib/api';
import type { OrderStatusResponse } from '$lib/types';

export async function load({ params }) {
	try {
		const order = await apiGet<OrderStatusResponse>(`/api/orders/${params.token}`);
		return { order, token: params.token };
	} catch {
		throw error(404, 'Bestellung nicht gefunden.');
	}
}
