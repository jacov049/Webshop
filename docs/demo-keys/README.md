# Demo-Schlüsselpaar — NUR für lokale Entwicklung

`DEMO-private-key.asc` und der dazugehörige öffentliche Schlüssel unter
`frontend/static/pgp-public-key.asc` sind ein **Wegwerf-Schlüsselpaar**,
das ausschließlich zum lokalen Testen des Bestell-/Kontakt-Verschlüsselungsflusses
dient (Checkout verschlüsselt clientseitig → Admin-Panel entschlüsselt lokal).

**Vor dem produktiven Einsatz zwingend:**

1. Eigenes Schlüsselpaar erzeugen, z.B. `gpg --full-generate-key` (RSA 4096
   oder Curve25519, ohne Ablaufdatum oder mit definiertem Rotationsplan).
2. Den öffentlichen Schlüssel exportieren und
   `frontend/static/pgp-public-key.asc` ersetzen:
   `gpg --armor --export deine@adresse > frontend/static/pgp-public-key.asc`
3. Den privaten Schlüssel **niemals** in dieses Repository oder auf den
   Server legen. Er verbleibt ausschließlich auf dem Gerät des Betreibers
   (siehe Konzept Abschnitt 4), idealerweise passphrasegeschützt oder auf
   einem YubiKey/Hardware-Token.
4. `docs/demo-keys/` danach aus dem produktiven Deployment ausschließen
   bzw. löschen.
