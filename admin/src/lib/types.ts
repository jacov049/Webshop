export interface AdminProduct {
	id: string;
	name: string;
	description: string | null;
	price_eur: string;
	stock: number;
	image_path: string | null;
	active: boolean;
	created_at: string;
	updated_at: string;
}

export type OrderStatus = 'pending' | 'confirming' | 'paid' | 'expired' | 'shipped' | 'cancelled';

export interface AdminOrder {
	id: string;
	order_token: string;
	encrypted_payload: string; // weiterhin PGP-verschlüsselt, siehe decrypt/pgp.svelte.ts
	payment_method: 'BTC' | 'XMR';
	payment_address: string;
	amount_crypto: string;
	amount_eur: string;
	status: OrderStatus;
	confirmations: number;
	required_confirmations: number;
	created_at: string;
	expires_at: string;
}

export interface OrderPayload {
	name: string;
	address: { street: string; zip: string; city: string; country: string };
	note?: string;
	items: { productId: string; name: string; quantity: number }[];
}

export type ContactStatus = 'open' | 'answered';

export interface AdminContactRequest {
	id: string;
	encrypted_payload: string;
	status: ContactStatus;
	created_at: string;
	deletion_due: string | null;
}

export interface ContactPayload {
	message: string;
	orderNumber?: string;
	messenger?: { type: 'signal' | 'threema'; id: string };
}

export type SettingType = 'text' | 'markdown';

export interface SettingDefinition {
	key: string;
	label: string;
	type: SettingType;
	group: string;
	hint?: string;
}

export interface SettingsResponse {
	values: Record<string, string>;
	definitions: SettingDefinition[];
}
