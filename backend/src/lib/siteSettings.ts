/**
 * Redaktionell pflegbare Website-Inhalte.
 *
 * Alle hier definierten Schlüssel können im Admin-Panel bearbeitet werden
 * und werden öffentlich über GET /api/settings ausgeliefert. Die Defaults
 * dienen als Erstbefüllung (Migration) und als Fallback, falls ein
 * Schlüssel in der Datenbank fehlt.
 *
 * "*_md"-Felder werden im Frontend als (sicheres, escapendes) Markdown
 * gerendert – siehe frontend/src/lib/markdown.ts.
 */

export type SettingType = "text" | "markdown";

export interface SettingDefinition {
  key: string;
  label: string;
  type: SettingType;
  /** Gruppierung in der Admin-Oberfläche */
  group: string;
  /** Hilfetext im Admin-Panel */
  hint?: string;
  default: string;
}

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: "shop_name",
    label: "Name des Shops",
    type: "text",
    group: "Allgemein",
    hint: "Erscheint in der Kopfzeile und im Browser-Tab.",
    default: "CryptoShop"
  },
  {
    key: "shop_description",
    label: "Kurzbeschreibung (Meta-Description)",
    type: "text",
    group: "Allgemein",
    hint: "Kurzer Beschreibungstext für Suchmaschinen und Link-Vorschauen.",
    default: "Datensparsamer Webshop mit Ende-zu-Ende-Verschlüsselung und Krypto-Zahlung."
  },
  {
    key: "catalog_heading",
    label: "Überschrift der Startseite",
    type: "text",
    group: "Allgemein",
    default: "Artikel"
  },
  {
    key: "catalog_intro_md",
    label: "Einleitungstext der Startseite",
    type: "markdown",
    group: "Allgemein",
    hint: "Optional. Wird über dem Produktraster angezeigt.",
    default: ""
  },
  {
    key: "footer_note",
    label: "Fußzeilen-Hinweis",
    type: "text",
    group: "Allgemein",
    default: "Zahlung ausschließlich mit Bitcoin & Monero. Keine Tracker, keine Analytics."
  },
  {
    key: "checkout_notice_md",
    label: "Hinweis auf der Kassenseite",
    type: "markdown",
    group: "Bestellprozess",
    default:
      "Deine Angaben werden direkt in diesem Browser mit dem PGP-Schlüssel des Betreibers " +
      "verschlüsselt, bevor sie überhaupt gesendet werden. Der Server kann sie nicht lesen."
  },
  {
    key: "contact_intro_md",
    label: "Einleitungstext der Kontaktseite",
    type: "markdown",
    group: "Bestellprozess",
    default:
      "Deine Nachricht wird direkt in diesem Browser mit dem PGP-Schlüssel des Betreibers " +
      "verschlüsselt und ist nur für ihn lesbar. Es wird keine E-Mail-Adresse gespeichert – " +
      "für eine Rückmeldung gib bitte deine Threema- oder Signal-ID an. Die Antwort erfolgt " +
      "privat über den angegebenen Messenger, nicht über diese Website."
  },
  {
    key: "impressum_md",
    label: "Impressum",
    type: "markdown",
    group: "Rechtstexte",
    hint: "Pflichtangaben nach § 5 TMG / § 18 MStV. Erläuterungen: docs/impressum.md",
    default: `## Angaben gemäß § 5 TMG

[Name / Firma]
[Straße Hausnummer]
[PLZ Ort]
[Land]

## Kontakt

Kontaktaufnahme ausschließlich über das [Kontaktformular](/kontakt).

## Umsatzsteuer-ID

[USt-IdNr. gemäß § 27a UStG, sofern vorhanden]

## Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV

[Name, Anschrift wie oben]

## EU-Streitschlichtung

Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:
[https://ec.europa.eu/consumers/odr/](https://ec.europa.eu/consumers/odr/).
Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
Verbraucherschlichtungsstelle teilzunehmen. [Anpassen, falls abweichend.]

*Platzhalter – vor dem Live-Betrieb durch die tatsächlichen Angaben ersetzen.*`
  },
  {
    key: "datenschutz_md",
    label: "Datenschutzerklärung",
    type: "markdown",
    group: "Rechtstexte",
    hint: "Ausführliche Vorlage inkl. Rechtsgrundlagen: docs/datenschutz.md",
    default: `## Grundsatz: Datensparsamkeit

Dieser Shop erhebt keine Analytics- oder Tracking-Daten und bindet keine
Drittanbieter-Ressourcen (Fonts, Skripte, CDNs) ein. Es werden keine IP-Adressen
gespeichert oder geloggt.

## Bestelldaten

Name, Lieferadresse und Bestellinhalt werden vor dem Absenden direkt in deinem Browser
mit einem PGP-Schlüssel verschlüsselt, der ausschließlich dem Betreiber gehört. Der
Server speichert nur den verschlüsselten Blob und kann ihn technisch nicht lesen.
Aufbewahrung: 10 Jahre gemäß § 147 AO (steuerrechtliche Aufbewahrungspflicht für
Rechnungsdaten), danach automatisierte Löschung.

Zur Lagerverwaltung wird zusätzlich unverschlüsselt gespeichert, welche Artikel in
welcher Menge zu einer Bestellung gehören. Diese Angaben enthalten keinen Personenbezug.

## Zahlungsabwicklung

Zahlungen erfolgen ausschließlich über Bitcoin- und Monero-Netzwerke. Zur Prüfung des
Zahlungseingangs werden öffentliche Blockchain-Explorer bzw. Nodes Dritter abgefragt
(z.B. Blockstream Esplora für Bitcoin, ein öffentlicher Monero-Node) – hierbei erhält der
jeweilige Node-/API-Betreiber technisch bedingt Kenntnis von IP-Adresse und abgefragter
Zahlungsadresse.

## Kontaktanfragen

Nachrichten über das Kontaktformular werden ebenfalls clientseitig PGP-verschlüsselt.
Eine optional angegebene Threema-/Signal-ID dient ausschließlich der Rückmeldung durch
den Betreiber und wird nach Bearbeitung zeitnah gelöscht.

## Cookies

Es werden nur technisch notwendige Cookies gesetzt (Session-Cookie für das Admin-Panel,
CSRF-Schutz-Cookie). Keine Tracking- oder Marketing-Cookies.

## Deine Rechte

Da personenbezogene Bestelldaten ausschließlich verschlüsselt und ohne Klartextbezug zu
deiner Identität gespeichert werden, erfolgt die Wahrnehmung von Auskunfts-, Berichtigungs-
und Löschrechten (Art. 15 ff. DSGVO) über das [Kontaktformular](/kontakt) unter Angabe der
Bestellnummer.

*Platzhalter – vor dem Live-Betrieb rechtlich prüfen lassen.*`
  },
  {
    key: "widerruf_md",
    label: "Widerrufsbelehrung",
    type: "markdown",
    group: "Rechtstexte",
    hint: "Offene Punkte (u.a. Erstattung in Krypto): docs/widerruf.md",
    default: `## Widerrufsrecht

Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu
widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem du oder ein von
dir benannter Dritter, der nicht der Beförderer ist, die Waren in Besitz genommen hast.

Um dein Widerrufsrecht auszuüben, musst du uns über das [Kontaktformular](/kontakt) unter
Angabe deiner Bestellnummer mittels einer eindeutigen Erklärung über deinen Entschluss,
diesen Vertrag zu widerrufen, informieren.

## Folgen des Widerrufs

Im Falle eines wirksamen Widerrufs erstatten wir dir den gezahlten Betrag in der
ursprünglich verwendeten Kryptowährung. Aufgrund der Kursvolatilität von Bitcoin und
Monero erfolgt die Erstattung [in Höhe des ursprünglichen EUR-Gegenwerts / in Höhe des
ursprünglich gezahlten Krypto-Betrags — vor Live-Betrieb verbindlich festlegen].

Da Krypto-Zahlungen nicht rückbuchbar sind, teile uns bitte eine Empfangsadresse für die
Erstattung mit.

## Muster-Widerrufsformular

An [Name/Firma des Betreibers]:

Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über den Kauf der
folgenden Waren: __________

Bestellnummer: __________

Bestellt am: __________

*Platzhalter – vor dem Live-Betrieb rechtlich prüfen lassen.*`
  }
];

export const SETTING_KEYS = SETTING_DEFINITIONS.map((d) => d.key);

export const SETTING_DEFAULTS: Record<string, string> = Object.fromEntries(
  SETTING_DEFINITIONS.map((d) => [d.key, d.default])
);

/** Maximale Länge eines einzelnen Einstellungswerts (Schutz vor Speicher-Missbrauch). */
export const SETTING_MAX_LENGTH = 50_000;
