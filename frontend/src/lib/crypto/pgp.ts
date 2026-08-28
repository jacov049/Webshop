import { dev } from '$app/environment';
import * as openpgp from 'openpgp';
import { env } from '$env/dynamic/public';

let cachedPublicKey: openpgp.Key | null = null;

function normalizeFingerprint(value: string): string {
	return value.replace(/[^0-9a-f]/gi, '').toLowerCase();
}

/**
 * Lädt den öffentlichen PGP-Key des Betreibers vom eigenen Origin und prüft
 * ihn gegen einen separat konfigurierten Fingerprint. Damit führt ein
 * versehentlich oder manipuliert ausgelieferter anderer Key nicht still zu
 * Bestellungen, die der Betreiber später nicht entschlüsseln kann.
 */
async function loadPublicKey(): Promise<openpgp.Key> {
	if (cachedPublicKey) return cachedPublicKey;

	const expected = normalizeFingerprint(env.PUBLIC_PGP_PUBLIC_KEY_FINGERPRINT ?? '');
	if (!expected) {
		throw new Error('PGP-Public-Key-Fingerprint ist nicht konfiguriert.');
	}

	const res = await fetch('/pgp-public-key.asc', {
		cache: 'no-store',
		credentials: 'same-origin'
	});
	if (!res.ok) throw new Error('PGP-Public-Key konnte nicht geladen werden.');

	const armoredKey = await res.text();
	const key = await openpgp.readKey({ armoredKey });
	const actual = normalizeFingerprint(key.getFingerprint());
  // The matching private key is public in docs/demo-keys: never accept it in production.
  if (!dev && actual === 'ebf9e2ebf87aa0505a05fda6ff6e432a41a2100b') {
    throw new Error('Der öffentliche Demo-Schlüssel darf nicht produktiv verwendet werden.');
  }

	if (actual !== expected) {
		throw new Error('PGP-Public-Key stimmt nicht mit dem konfigurierten Fingerprint überein.');
	}

	cachedPublicKey = key;
	return key;
}

/**
 * Verschlüsselt die personenbezogenen Bestelldaten direkt im Browser mit
 * dem gepinnten öffentlichen Betreiber-Key. Der Blob ist verschlüsselt und
 * integritätsgeschützt, aber nicht vom Kunden digital signiert.
 */
export async function encryptForOperator(data: unknown): Promise<string> {
	const publicKey = await loadPublicKey();
	const message = await openpgp.createMessage({ text: JSON.stringify(data) });
	const encrypted = await openpgp.encrypt({
		message,
		encryptionKeys: publicKey,
		format: 'armored'
	});
	return encrypted as string;
}
