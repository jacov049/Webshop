# Widerrufsbelehrung — Vorlage & offene Punkte

> Arbeitsvorlage. Der ausgelieferte Text liegt in
> `frontend/src/routes/widerruf/+page.svelte`. Muster nach
> Art. 246a § 1 Abs. 2 EGBGB i.V.m. Anlage 1 zu Art. 246a EGBGB.

## Offene Punkte, die vor Live-Betrieb zu klären sind

1. **Fristbeginn bei mehreren Artikeln in einer Bestellung**: regelmäßig
   ab Erhalt der letzten Teilsendung/des letzten Artikels.
2. **Erstattung in Kryptowährung**: Aufgrund der Kursvolatilität muss
   festgelegt werden, ob im Widerrufsfall
   - der ursprünglich gezahlte **Krypto-Betrag** zurückerstattet wird
     (Risiko für den Betreiber bei Kursanstieg zwischen Zahlung und
     Widerruf), oder
   - der **EUR-Gegenwert zum Zahlungszeitpunkt**, umgerechnet in Krypto
     zum Erstattungszeitpunkt (Risiko für den Kunden bei Kursverfall).

   Empfehlung für den Projektbericht: eine der beiden Varianten wählen,
   in der Widerrufsbelehrung **explizit** benennen (Transparenzgebot) und
   die Entscheidung begründen.
3. **Rückerstattungsadresse**: Da Bitcoin/Monero-Zahlungen nicht an die
   ursprüngliche Zahlungsadresse "zurückgeschickt" werden können (keine
   Rückbuchung wie bei Kartenzahlung), muss der Kunde im Widerrufsfall über
   das Kontaktformular eine Rückerstattungsadresse mitteilen.
4. **Ausschluss des Widerrufsrechts** bei versiegelten Waren, die aus
   Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe
   geeignet sind und deren Versiegelung nach der Lieferung entfernt wurde
   (§ 312g Abs. 2 Nr. 3 BGB) — nur relevant, falls entsprechende Artikel
   verkauft werden.
5. **Wertersatz** bei Prüfung der Ware über das zur Prüfung der
   Beschaffenheit, Eigenschaften und Funktionsweise notwendige Maß hinaus
   (§ 357a Abs. 1 BGB).

## Muster-Widerrufsformular

Siehe `frontend/src/routes/widerruf/+page.svelte` — Übermittlung
ausschließlich über das Kontaktformular (kein Klartext-E-Mail-Kanal, siehe
Datensparsamkeitskonzept).
