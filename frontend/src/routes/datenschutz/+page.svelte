<h1>Datenschutzerklärung</h1>

<div class="stack">
	<p class="muted">
		Platzhalter-Zusammenfassung des tatsächlichen Datensparsamkeitskonzepts dieses Shops. Eine
		vollständige, rechtlich geprüfte Fassung gehört vor Live-Betrieb in
		<code>docs/datenschutz.md</code> und muss die konkreten Verarbeitungen (Rechtsgrundlage nach
		Art. 6 DSGVO, Empfänger, Speicherdauer) benennen.
	</p>

	<section class="card">
		<h2>Grundsatz: Datensparsamkeit</h2>
		<p>
			Dieser Shop erhebt keine Analytics- oder Tracking-Daten und bindet keine
			Drittanbieter-Ressourcen (Fonts, Skripte, CDNs) ein. Es werden keine IP-Adressen
			gespeichert oder geloggt.
		</p>
	</section>

	<section class="card">
		<h2>Bestelldaten</h2>
		<p>
			Name, Lieferadresse und Bestellinhalt werden vor dem Absenden direkt in deinem Browser
			mit einem PGP-Schlüssel verschlüsselt, der ausschließlich dem Betreiber gehört. Der
			Server speichert nur den verschlüsselten Blob und kann ihn technisch nicht lesen.
			Aufbewahrung: 10 Jahre gemäß § 147 AO (steuerrechtliche Aufbewahrungspflicht für
			Rechnungsdaten), danach automatisierte Löschung.
		</p>
	</section>

	<section class="card">
		<h2>Zahlungsabwicklung</h2>
		<p>
			Zahlungen erfolgen ausschließlich über Bitcoin- und Monero-Netzwerke. Zur Prüfung des
			Zahlungseingangs werden öffentliche Blockchain-Explorer bzw. Nodes Dritter abgefragt
			(z.B. Blockstream Esplora für Bitcoin, ein öffentlicher Monero-Node) – hierbei erhält der
			jeweilige Node-/API-Betreiber technisch bedingt Kenntnis von IP-Adresse und abgefragter
			Zahlungsadresse. Details und Abwägung siehe Projektkonzept, Abschnitt 5.
		</p>
	</section>

	<section class="card">
		<h2>Kontaktanfragen</h2>
		<p>
			Nachrichten über das Kontaktformular werden ebenfalls clientseitig PGP-verschlüsselt.
			Eine optional angegebene Threema-/Signal-ID dient ausschließlich der Rückmeldung durch
			den Betreiber und wird nach Bearbeitung zeitnah gelöscht.
		</p>
	</section>

	<section class="card">
		<h2>Cookies</h2>
		<p>
			Es werden nur technisch notwendige Cookies gesetzt (Session-Cookie für das Admin-Panel,
			CSRF-Schutz-Cookie). Keine Tracking- oder Marketing-Cookies.
		</p>
	</section>

	<section class="card">
		<h2>Deine Rechte</h2>
		<p>
			Da personenbezogene Bestelldaten ausschließlich verschlüsselt und ohne Klartextbezug zu
			deiner Identität gespeichert werden, erfolgt die Wahrnehmung von Auskunfts-, Berichtigungs-
			und Löschrechten (Art. 15 ff. DSGVO) über das <a href="/kontakt">Kontaktformular</a> unter
			Angabe der Bestellnummer.
		</p>
	</section>
</div>
