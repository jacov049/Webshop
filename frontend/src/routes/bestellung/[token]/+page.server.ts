import { error } from '@sveltejs/kit';
import { serverApiGet } from '$lib/api.server';
import type { OrderStatusResponse } from '$lib/types';

export async function load({ params, fetch }) {
	try {
		const order = await serverApiGet<OrderStatusResponse>(`/api/orders/${params.token}`, fetch);
		return { order, token: params.token };
	} catch {
		throw error(404, 'Bestellung nicht gefunden.');
	}
}
