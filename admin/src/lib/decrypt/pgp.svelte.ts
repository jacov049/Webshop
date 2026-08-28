import * as openpgp from 'openpgp';

/**
 * Lokale PGP-Entschlüsselung im Admin-Panel.
 *
 * Der private Schlüssel wird pro Sitzung einmal (Key-Datei + Passphrase)
 * geladen, ausschließlich im Arbeitsspeicher des Browser-Tabs gehalten und
 * NIEMALS an das Backend gesendet oder in localStorage/IndexedDB
 * persistiert. Nach einem Reload oder "Sitzung sperren" muss er erneut
 * eingegeben werden (siehe Konzept Abschnitt 4).
 */

let decryptedKey: openpgp.PrivateKey | null = null;

class KeySessionStore {
	unlocked = $state(false);
  generation = $state(0);
}

export const keySession = new KeySessionStore();

export async function unlockPrivateKey(armoredKey: string, passphrase: string): Promise<void> {
	const key = await openpgp.readPrivateKey({ armoredKey });

	// Ein Schlüssel ohne Passphrase-Schutz liegt bereits entschlüsselt vor;
	// openpgp.decryptKey() würde darauf mit "Key packet is already
	// decrypted" fehlschlagen. Solche Schlüssel werden direkt übernommen
	// (nicht empfohlen, siehe docs/verschluesselung.md – aber das Panel
	// darf daran nicht scheitern).
	if (key.isDecrypted()) {
		decryptedKey = key;
	} else {
		if (!passphrase) throw new Error('Dieser Schlüssel ist passphrasegeschützt.');
		decryptedKey = await openpgp.decryptKey({ privateKey: key, passphrase });
	}

	keySession.generation++;
	keySession.unlocked = true;
}

export function lockPrivateKey(): void {
	decryptedKey = null;
	keySession.generation++;
	keySession.unlocked = false;
}

/** Entschlüsselt einen PGP-Blob und parst ihn als JSON. */
export async function decryptPayload<T = unknown>(armoredMessage: string): Promise<T> {
	if (!decryptedKey) throw new Error('Kein privater Schlüssel entsperrt.');
	const message = await openpgp.readMessage({ armoredMessage });
	const { data } = await openpgp.decrypt({
		message,
		decryptionKeys: decryptedKey,
		format: 'utf8'
	});
	return JSON.parse(data as string) as T;
}
