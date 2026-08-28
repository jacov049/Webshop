export interface Product {
	id: string;
	name: string;
	description: string | null;
	price_eur: string;
	stock: number;
	image_path: string | null;
}

export interface CartItem {
	productId: string;
	name: string;
	priceEur: number;
	quantity: number;
}

export type PaymentMethod = 'BTC' | 'XMR';

export type OrderStatus = 'pending' | 'confirming' | 'paid' | 'expired' | 'shipped' | 'cancelled';

export interface OrderStatusResponse {
	status: OrderStatus;
	confirmations: number;
	required_confirmations: number;
	payment_method: PaymentMethod;
	payment_address: string;
	amount_crypto: string;
	amount_eur: string;
	expires_at: string;
	created_at: string;
}

export interface CheckoutResponse {
	orderToken: string;
	paymentAddress: string;
	amountCrypto: string;
	amountEur: string;
	paymentMethod: PaymentMethod;
	expiresAt: string;
}
