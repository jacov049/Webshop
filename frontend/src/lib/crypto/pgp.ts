import * as openpgp from 'openpgp';

let cachedPublicKey: openpgp.Key | null = null;

/**
 * Lädt den öffentlichen PGP-Key des Betreibers statisch vom eigenen Server
 * (kein CDN, kein Server-Roundtrip zum Backend nötig – siehe Konzept
 * Abschnitt 4). Die Datei liegt unter /static/pgp-public-key.asc.
 */
async function loadPublicKey(): Promise<openpgp.Key> {
	if (cachedPublicKey) return cachedPublicKey;
	const res = await fetch('/pgp-public-key.asc');
	if (!res.ok) throw new Error('PGP-Public-Key konnte nicht geladen werden.');
	const armoredKey = await res.text();
	cachedPublicKey = await openpgp.readKey({ armoredKey });
	return cachedPublicKey;
}

/**
 * Verschlüsselt beliebige Daten (z.B. Bestellformular) direkt im Browser
 * mit dem öffentlichen PGP-Key des Betreibers. Das Ergebnis ist ein
 * ASCII-armored PGP-Message-Blob, der als einziger Träger der
 * personenbezogenen Daten an das Backend gesendet wird. Das Backend
 * besitzt keinen privaten Schlüssel und kann diesen Inhalt nie einsehen.
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
