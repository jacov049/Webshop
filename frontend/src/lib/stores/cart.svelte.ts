import { browser } from '$app/environment';
import type { CartItem } from '$lib/types';

const STORAGE_KEY = 'cryptoshop_cart_v1';

/**
 * Warenkorb: lebt ausschließlich im localStorage des Browsers (kein
 * Server-Roundtrip, keine Cookies, keine personenbezogenen Daten –
 * nur Artikel-IDs und Mengen, siehe Datensparsamkeitskonzept).
 */
function loadInitial(): CartItem[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as CartItem[]) : [];
	} catch {
		return [];
	}
}

class CartStore {
	items = $state<CartItem[]>(loadInitial());

	constructor() {
		if (browser) {
			$effect.root(() => {
				$effect(() => {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
				});
			});
		}
	}

	add(item: Omit<CartItem, 'quantity'>, quantity = 1) {
		const existing = this.items.find((i) => i.productId === item.productId);
		if (existing) {
			existing.quantity += quantity;
		} else {
			this.items.push({ ...item, quantity });
		}
	}

	updateQuantity(productId: string, quantity: number) {
		if (quantity <= 0) return this.remove(productId);
		const item = this.items.find((i) => i.productId === productId);
		if (item) item.quantity = quantity;
	}

	remove(productId: string) {
		this.items = this.items.filter((i) => i.productId !== productId);
	}

	clear() {
		this.items = [];
	}

	get totalEur(): number {
		return this.items.reduce((sum, i) => sum + i.priceEur * i.quantity, 0);
	}

	get totalItems(): number {
		return this.items.reduce((sum, i) => sum + i.quantity, 0);
	}
}

export const cart = new CartStore();
