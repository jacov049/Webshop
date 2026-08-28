/**
 * Redaktionell pflegbare Website-Inhalte.
 *
 * Alle hier definierten Schlüssel können im Admin-Panel bearbeitet werden
 * und werden öffentlich über GET /api/settings ausgeliefert. Die Defaults
 * dienen als Erstbefüllung und Fallback. Rechtstexte sind Arbeitsvorlagen
 * und müssen vor Live-Betrieb an den konkreten Betreiber angepasst werden.
 */

export type SettingType = "text" | "markdown";

export interface SettingDefinition {
  key: string;
  label: string;
  type: SettingType;
  group: string;
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
      "verschlüsselt und ist nur für ihn lesbar. Es wird keine E-Mail-Adresse im Kontaktformular " +
      "gespeichert – für eine Rückmeldung gib bitte deine Threema- oder Signal-ID an."
  },
  {
    key: "impressum_md",
    label: "Impressum",
    type: "markdown",
    group: "Rechtstexte",
    hint: "Pflichtangaben nach § 5 DDG; Erläuterungen: docs/impressum.md",
    default: `## Angaben gemäß § 5 DDG

[Name / Firma]
[Straße Hausnummer]
[PLZ Ort]
[Land]

## Kontakt

E-Mail: [pflichtige Kontakt-E-Mail-Adresse]
Zusätzliche Kontaktmöglichkeit: [Kontaktformular](/kontakt)

## Register / Aufsicht

[Register und Registernummer, soweit einschlägig]
[Zuständige Aufsichtsbehörde, soweit einschlägig]

## Umsatzsteuer-/Wirtschafts-ID

[USt-IdNr. bzw. Wirtschafts-Identifikationsnummer, soweit vorhanden und anzugeben]

## Verantwortlich für journalistisch-redaktionelle Inhalte

[Name und Anschrift nach § 18 Abs. 2 MStV, soweit einschlägig]

## Verbraucherschlichtung

[Erklärung zur Teilnahmebereitschaft/-pflicht an einem Verbraucherschlichtungsverfahren, soweit einschlägig.]

Die frühere EU-Online-Streitbeilegungsplattform (OS/ODR) ist seit 20. Juli 2025 eingestellt und wird hier deshalb nicht mehr verlinkt.

*Platzhalter – vor dem Live-Betrieb durch die tatsächlichen Angaben ersetzen und rechtlich prüfen.*`
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
in den eigenen Access-Logs gespeichert.

## Bestelldaten

Name, Lieferadresse und persönliche Notizen werden vor dem Absenden direkt in deinem Browser
mit einem PGP-Schlüssel verschlüsselt. Der Server speichert nur den verschlüsselten Blob
und besitzt nicht den privaten PGP-Schlüssel.

Die operative Speicherdauer wird über DATA_RETENTION_DAYS gesteuert. Der technische
Standardwert von 14 Tagen ist nur für Entwicklung/Demo gedacht und muss vor produktivem
Warenverkauf mit steuer- und handelsrechtlichen Aufbewahrungspflichten abgestimmt werden.
Offene und noch nicht versendete bezahlte Bestellungen bleiben bis zur Klärung erhalten.
Abgelaufene oder stornierte Bestellungen werden erst nach Bestandsfreigabe gelöscht.

Zur Lagerverwaltung wird zusätzlich gespeichert, welche Artikel mit Namen, Einzelpreis und Menge zu einer
Bestellung gehören. Diese Angaben enthalten für sich genommen keinen Namen oder keine
Lieferadresse.

## Zahlungsabwicklung

Zahlungen erfolgen über Bitcoin- und Monero-Netzwerke. Zur Prüfung des Zahlungseingangs
werden konfigurierte Blockchain-Explorer bzw. Nodes abgefragt. Der jeweilige Betreiber
dieser Infrastruktur erhält technisch bedingt die IP-Adresse des Shop-Servers und die
abgefragten Blockchain-Daten.

## Kontaktanfragen

Nachrichten über das Kontaktformular werden clientseitig PGP-verschlüsselt. Eine optional
angegebene Messenger-ID dient der Rückmeldung durch den Betreiber.

## Cookies

Es werden nur technisch notwendige Cookies gesetzt (Admin-Session und CSRF-Schutz).
Keine Tracking- oder Marketing-Cookies.

## Deine Rechte

Auskunfts-, Berichtigungs- und Löschrechte (Art. 15 ff. DSGVO) können über die im
Impressum angegebene Kontaktmöglichkeit bzw. das Kontaktformular geltend gemacht werden.
Für die Zuordnung zu einer Bestellung kann der Bestell-Token erforderlich sein.

*Arbeitsvorlage – vor dem Live-Betrieb rechtlich prüfen und an die tatsächliche Verarbeitung anpassen.*`
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

Um dein Widerrufsrecht auszuüben, musst du uns über die im Impressum angegebene
Kontaktmöglichkeit mittels einer eindeutigen Erklärung über deinen Entschluss informieren.

## Folgen des Widerrufs

Die konkrete Rückzahlungsabwicklung bei Kryptowährungszahlungen muss vor Live-Betrieb
rechtlich und technisch verbindlich festgelegt werden. Insbesondere darf die Vorlage
nicht offenlassen, ob der ursprüngliche Krypto-Betrag oder ein EUR-Gegenwert maßgeblich ist.

## Muster-Widerrufsformular

An [Name/Firma des Betreibers]:

Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über den Kauf der
folgenden Waren: __________

Bestellnummer: __________
Bestellt am: __________

*Arbeitsvorlage – vor dem Live-Betrieb rechtlich prüfen.*`
  }
];

export const SETTING_KEYS = SETTING_DEFINITIONS.map((d) => d.key);

export const SETTING_DEFAULTS: Record<string, string> = Object.fromEntries(
  SETTING_DEFINITIONS.map((d) => [d.key, d.default])
);

export const SETTING_MAX_LENGTH = 50_000;
