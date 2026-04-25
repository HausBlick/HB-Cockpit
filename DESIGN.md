# DESIGN.md — HB Mieterportal

> Design-System und UI-Spezifikation. Verbindlich für alle Module und alle KI-Agenten.
> Stil-Referenz: **Meine Allianz App** + **Apple iOS Human Interface Guidelines** — clean, modern, großzügig, native App-Feeling.

---

## 0. Design-Philosophie

**Weniger ist mehr.** Jede Fläche, jeder Abstand und jedes Element muss seinen Platz rechtfertigen. Wenn ein Element entfernt werden kann, ohne dass Information verloren geht — entfernen.

**Großzügiger Weißraum.** Luft zwischen Elementen ist kein verschwendeter Platz, sondern ein Gestaltungsmittel. Er lenkt den Blick, schafft Hierarchie und vermittelt Ruhe. Im Zweifel: mehr Abstand, nicht weniger.

**Klarheit vor Dichte.** Informationsdichte ist kein Qualitätsmerkmal. Lieber weniger Inhalte pro Bildschirm mit klarer visueller Hierarchie als alles auf einmal zeigen. Progressive Disclosure: Detailinfos erst bei Bedarf aufklappen.

**Konsistenz schlägt Kreativität.** Jedes Modul sieht aus wie Teil derselben App. Keine Eigenkreationen, keine "schönen Ideen" die nur einmal vorkommen. Wenn ein Pattern existiert, wird es wiederverwendet.

**Inhalt führt, Chrome folgt.** Navigation, Rahmen und UI-Elemente treten hinter den Inhalt zurück. Der Nutzer soll Daten sehen, nicht Dekoration.

---

## 1. Farbpalette

### Kernfarben (Brand Guide)

| Token | Name | HEX | Verwendung |
|---|---|---|---|
| `hb-olive` | Olive | `#687451` | Primärfarbe. Logo, Buttons, aktive Navigation, Links, Rahmen, Akzente |
| `hb-offblack` | Off Black | `#373737` | Fließtexte, Überschriften, alle nicht-farbigen Textelemente |
| `hb-white` | White | `#FFFFFF` | Cards, Hintergrundflächen auf dunklen Bereichen, Textfarbe auf Olive/Dark |
| `hb-orange` | Signal Orange | `#EB762D` | Extreme Aufmerksamkeit, wichtige Warnungen. Sehr dosiert verwenden |
| `hb-gold-bold` | Bold Gold | `#C5A059` | Premium-Highlights, besondere CTAs, edle Kontraste |
| `hb-gold-soft` | Soft Gold | `#EEC981` | Sanfte Highlights, Störer, sekundäre Akzente |
| `hb-gray` | Light Grey | `#B4B4B4` | Dezente Hintergründe, Trennlinien, deaktivierte Elemente |
| `hb-ultralight` | Ultra Light Grey | `#F5F5F5` | App-Hintergrund, Input-Hintergründe, Sektions-Trenner |

### Semantische Farben (UI-Erweiterung)

| Token | Name | HEX | Verwendung |
|---|---|---|---|
| `hb-success` | Waldgrün | `#4A7C59` | Erfolg, Bestätigung, validiert, erledigt |
| `hb-error` | Ziegelrot | `#C4453E` | Fehler, destruktive Aktionen, Lösch-Buttons |

### Opacity-Varianten (für Badges, Hintergründe, Hover)

Abgeleitete Farben werden ausschließlich über Opacity erzeugt — keine zusätzlichen HEX-Werte.

| Anwendung | Regel | Beispiel |
|---|---|---|
| Badge-Hintergrund | Farbe mit 12% Opacity | `rgba(104,116,81, 0.12)` für Olive-Badge |
| Hover-State | Farbe mit 5–8% Opacity | `hover:bg-hb-olive/5` |
| Aktive Borders | Farbe mit 20% Opacity | `border: 1px solid rgba(104,116,81, 0.2)` |
| Focus-Ring | Farbe mit 10% Opacity | `box-shadow: 0 0 0 3px rgba(104,116,81, 0.1)` |
| Trennlinien in Listen | Olive mit 10% Opacity | `divide-hb-olive/10` |

### Verbotene Farben

Tailwind-Utility-Farben (`red-500`, `blue-600`, `green-400` etc.) dürfen **nicht** verwendet werden. Alle Farben kommen aus der Palette oben. Einzige Ausnahme: `gray-50` und `gray-100` als strukturelle Hilfstöne für Tailwind-Kompatibilität (Hover-States, Zebra-Stripes).

---

## 2. Typografie

**Schriftfamilie:** Inter (Google Fonts)
**Geladene Gewichte:** 300 (Light), 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold), 800 (ExtraBold)

### Typografie-Skala

Apple-Prinzip: Deutliche Größensprünge zwischen den Ebenen — der Nutzer erkennt die Hierarchie sofort, ohne auf Farbe oder Gewicht achten zu müssen.

| Element | Größe | Gewicht | Farbe | Tailwind |
|---|---|---|---|---|
| Seiten-Titel (H1) | 28px | Bold 700 | hb-offblack | `text-[28px] font-bold` |
| Card-Titel (H2) | 18px | SemiBold 600 | hb-offblack | `text-lg font-semibold` |
| Abschnitt-Titel (H3) | 16px | SemiBold 600 | hb-offblack | `text-base font-semibold` |
| Fließtext | 15px | Regular 400 | hb-offblack | `text-[15px]` |
| Hilfstext / Labels | 12px | Medium 500 | hb-gray | `text-xs font-medium text-hb-gray` |
| Nav-Section-Titel | 10px | ExtraBold 800 | hb-gray | `text-[10px] uppercase tracking-widest font-extrabold` |
| KPI-Zahl (Dashboard) | 32px | Bold 700 | hb-offblack | `text-[32px] font-bold` |
| KPI-Label | 12px | Medium 500 | hb-gray | `text-xs font-medium text-hb-gray` |

### Typografie-Regeln

- **Kein Uppercase** außer bei Nav-Section-Titeln und Badge-Labels
- **Zeilenhöhe:** 1.5 für Fließtext, 1.2 für Überschriften
- **Maximale Breite:** Fließtext nie breiter als `max-w-prose` (65ch) auf Desktop

---

## 3. Abstände & Spacing

### Spacing-Skala (strikte 8px-Vielfache, Apple HIG)

| Token | Wert | Verwendung |
|---|---|---|
| `xs` | 4px | Inline-Gaps (Icon ↔ Label), Badge-Padding vertikal |
| `sm` | 8px | Padding in kompakten Elementen, Gaps in Listen |
| `base` | 16px | Card-Padding Mobile, Content-Padding horizontal, Button-Padding |
| `lg` | 24px | Card-Padding Desktop, Abstände zwischen Sektionen/Cards |
| `xl` | 32px | Seiten-Padding Top, Abstände zwischen Hauptbereichen |
| `2xl` | 48px | Großzügige Trenner zwischen Seitenabschnitten (Apple-Stil) |

### Spacing-Regeln

- **Mobile Content-Padding:** `px-4` (16px) links/rechts — nie weniger
- **Card-Innenabstand:** `p-4` (16px) auf Mobile, `p-5` (20px) auf Desktop
- **Abstand zwischen Cards:** `gap-4` (16px) auf Mobile, `gap-6` (24px) auf Desktop
- **Kein Spacing-Wildwuchs:** Nur Werte aus der Skala verwenden. Kein `p-7`, kein `p-3.5`, kein `gap-[13px]`
- **Im Zweifel großzügiger.** Apple gibt Elementen deutlich mehr Luft als typische Web-UIs. Lieber `gap-6` als `gap-4` wenn der Inhalt es zulässt

---

## 4. Border-Radien

Hierarchisch abgestuft — größere Elemente bekommen größere Radien.

| Element | Radius | Tailwind |
|---|---|---|
| Cards, Modals, Bottom Sheets | 16px | `rounded-2xl` |
| Buttons, Inputs, Selects, Textareas | 12px | `rounded-xl` |
| Badges, Chips, Tags | 8px | `rounded-lg` |
| Avatare, Profilbilder | 50% | `rounded-full` |
| Checkboxen | 4px | `rounded` |

### Tailwind-Konfiguration (Override)

```javascript
borderRadius: {
    'lg': '8px',
    'xl': '12px',
    '2xl': '16px'
}
```

---

## 5. Schatten & Elevation

Schatten erzeugen räumliche Hierarchie. Angelehnt an iOS: weicher Blur, moderate Opacity, leicht sichtbar aber nie aufdringlich.

| Stufe | Wert | Verwendung |
|---|---|---|
| `shadow-soft` | `0 2px 8px rgba(0,0,0,0.08)` | Cards (Standard), ruhende Elemente |
| `shadow-md` | `0 4px 16px rgba(0,0,0,0.10)` | Dropdowns, schwebende Elemente, Cards bei Hover |
| `shadow-lg` | `0 8px 32px rgba(0,0,0,0.14)` | Modals, Bottom Sheets |
| Kein Schatten | — | Buttons, Badges, Inputs (diese nutzen Borders statt Schatten) |

**Wichtig:** Die alten Schatten mit 3% Opacity waren praktisch unsichtbar. Die neuen Werte sind iOS-typisch: sanft, aber wahrnehmbar. Die Cards sollen leicht "schweben" und sich vom `hb-ultralight`-Hintergrund abheben.

---

## 6. Komponenten

### 6.1 Buttons

| Typ | Styles | Verwendung |
|---|---|---|
| **Primary** | `bg-hb-olive text-white rounded-xl font-semibold px-6 py-3` | Hauptaktionen (Speichern, Erstellen) |
| **Secondary** | `bg-hb-ultralight text-hb-offblack rounded-xl font-semibold px-6 py-3 border border-hb-gray/30` | Nebenaktionen (Abbrechen, Zurück) |
| **Danger** | `text-hb-error rounded-xl font-semibold px-6 py-3` | Destruktive Aktionen (Löschen) |
| **Ghost** | `text-hb-olive font-semibold px-3 py-1.5` | Inline-Aktionen (Bearbeiten, Mehr) |

**Hover:** Primary bekommt `bg-[#555f42]` + `transform: translateY(-1px)`. Alle anderen: 5% Opacity-Background der jeweiligen Textfarbe.
**Disabled:** `opacity-50 pointer-events-none cursor-not-allowed`
**Touch-Target:** Mindestens `min-h-[44px] min-w-[44px]` — auch wenn der sichtbare Button kleiner ist.

### 6.2 Cards

```css
.card {
    background: white;
    border-radius: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(104, 116, 81, 0.12);
    overflow: hidden;
}
```

**Apple-Prinzip:** Der Schatten allein erzeugt die Tiefe — die Border ist nur ein dezenter Hinweis, kein tragendes Element. Daher Opacity der Border von 20% auf 12% reduziert.

- **Card-Titelleisten:** `bg-hb-olive text-white text-sm font-bold p-4`. Plus-Buttons in der Titelleiste: `bg-white text-hb-olive rounded-lg`
- **Card-Body:** `p-4` (Mobile) / `p-5` (Desktop)
- **Auf Mobile:** Cards gehen immer full-width (kein seitlicher Margin, nur `px-4` vom Content-Container)

### 6.3 Inputs & Formulare

```css
input, select, textarea {
    background: #F5F5F5;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 10px 16px;
    font-size: 14px;
    height: 44px;            /* Touch-Target */
    transition: all 0.2s;
}
input:focus, select:focus, textarea:focus {
    background: white;
    border-color: #687451;
    box-shadow: 0 0 0 3px rgba(104, 116, 81, 0.1);
}
```

- **Labels:** Über dem Input, `text-xs font-medium text-hb-gray mb-1`
- **Textarea:** `min-height: 80px`, `height: auto`
- **Checkbox:** `accent-color: #687451`, Größe `1.2rem`
- **Toggle Switch:** Track 44×24px, Thumb 20px, olive wenn aktiv

### 6.4 Badges & Status

| Status | Hintergrund | Textfarbe | Klasse |
|---|---|---|---|
| Offen / Aktion nötig | `rgba(235,118,45, 0.12)` | `#c4601e` | `.ts-offen` |
| In Bearbeitung | `rgba(104,116,81, 0.12)` | `#687451` | `.ts-bearbeitung` |
| Wartet | `rgba(235,118,45, 0.18)` | `#a34e18` | `.ts-warte` |
| Erledigt | `rgba(74,124,89, 0.12)` | `#4A7C59` | `.ts-erledigt` |
| Inaktiv / Neutral | `#f3f4f6` | `#9ca3af` | — |

Badge-Padding: `px-2.5 py-0.5`, Schrift: `text-xs font-semibold`, Radius: `rounded-lg` (8px).

### 6.5 Tabellen

**Desktop:** Klassische Tabelle mit Zeilen.
- Header: `bg-gray-50 text-xs font-bold text-hb-gray` (kein Uppercase)
- Zeilen: `divide-y divide-hb-olive/10`
- Hover: `hover:bg-hb-ultralight`

**Mobile (< 768px):** Tabellen werden automatisch in gestapelte Cards umgewandelt (`.rtable`-Pattern).
- Jede Zeile wird eine Card: `bg-white rounded-2xl p-4 mb-3 border border-hb-olive/15`
- `<thead>` wird versteckt
- `<td>` wird Flex-Row mit `data-label` als Pseudo-Element (grau, uppercase, 11px)
- Action-Spalten bekommen volle Breite mit Trennlinie darüber

### 6.6 Toast-Nachrichten

- Position: `bottom-20` (über Bottom-Nav) auf Mobile, `bottom-6 right-6` auf Desktop
- Styles: `bg-hb-offblack text-white rounded-xl px-4 py-3 shadow-lg`
- Auto-Dismiss nach 4 Sekunden
- Fehler-Toasts: `bg-hb-error text-white`
- Erfolg-Toasts: `bg-hb-success text-white`

---

## 7. Mobile-First Patterns

> Das Portal soll sich wie eine native App anfühlen — nicht wie eine geschrumpfte Desktop-Seite.
> Referenz: Meine Allianz App. Clean, großzügig, eine Spalte, klare Hierarchie.

### 7.1 Layout-Architektur

```
┌─────────────────────────────┐
│  Header (sticky, 56px)      │  ← Logo + Role-Label (Mobile)
├─────────────────────────────┤
│                             │
│  Content-Area               │  ← Einziger Scroll-Container
│  (flex-1, overflow-y-auto)  │     auf der Seite
│                             │
├─────────────────────────────┤
│  Bottom-Nav (56px, fixed)   │  ← 5 Items, immer sichtbar
└─────────────────────────────┘
```

- **Body:** `h-screen overflow-hidden` (kein Body-Scroll!)
- **Main:** `flex-1 min-h-0 overflow-hidden`
- **Content-Area:** `flex-1 min-h-0 overflow-y-auto` — der **einzige** Scroll-Container
- **Kein doppeltes Scrolling.** Nie `overflow-y-auto` auf Body, Main oder verschachtelte Container

### 7.2 Bottom Navigation

- **Items:** 5 Stück, rollenbasiert (admin: Home/Tickets/News/Dokumente/Mehr)
- **Höhe:** 56px + Safe-Area-Inset (`padding-bottom: env(safe-area-inset-bottom)`)
- **Active State:** Textfarbe `hb-olive` + Dot-Indikator (4px Kreis unter dem Icon)
- **Inactive:** `text-gray-400`
- **Icon-Größe:** 24px (Active: `font-weight: 600` für optisch dickeren Strich)
- **Kein Hamburger-Menü** auf Mobile — Bottom-Nav ersetzt es komplett
- **"Mehr"-Item** öffnet Sidebar als Slide-In von links

### 7.3 Modals & Bottom Sheets

- **Desktop:** Zentriertes Modal mit Overlay, `scale-in` Animation
- **Mobile:** Bottom Sheet von unten, `rounded-t-2xl`, `max-h-[85vh]`, Swipe-Down-to-Dismiss (Threshold 80px)
- **Drag-Indikator:** Oberer Griff-Balken (5px Höhe, 36px Breite, `rounded-full bg-gray-300 mx-auto mt-2`) — wie bei iOS-Sheets
- **Nie** ein zentriertes Desktop-Modal auf Mobile anzeigen
- **Overlay:** `bg-black/40`, klickbar zum Schließen

### 7.4 Dashboard-Aufbau (Mobile)

Allianz-Stil: Vertikale Scroll-Liste aus eigenständigen Cards.

```
┌─────────────────────────┐
│  "Hallo, Niko"          │  ← Begrüßung + Datum
│  Verwalter              │
├─────────────────────────┤
│  ┌─────────────────────┐│
│  │ KPI-Card (2er-Grid) ││  ← 2×2 kompakte Kennzahlen
│  │  12     3           ││
│  │ Tickets  Freigaben  ││
│  └─────────────────────┘│
│  ┌─────────────────────┐│
│  │ Offene Tickets      ││  ← Action-Card mit Liste
│  │  • Heizung WE03     ││
│  │  • Wasserschaden     ││
│  └─────────────────────┘│
│  ┌─────────────────────┐│
│  │ Neueste Dokumente   ││  ← Info-Card
│  │  • JAB 2025.pdf     ││
│  └─────────────────────┘│
│         ...              │
└─────────────────────────┘
```

- **Keine Desktop-Grids** auf Mobile — strikt eine Spalte
- **KPIs:** Maximal 2×2 Grid (nicht 4 nebeneinander)
- **Cards sind eigenständig:** Jede Card hat einen Titel, Inhalt und ggf. eine Aktion. Keine verschachtelten Cards

### 7.5 Skeleton Loading

Ladezeiten werden mit Shimmer-Platzhaltern überbrückt, nie mit Spinning-Kreisen.

```css
.skeleton {
    background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: sk-shimmer 1.5s ease-in-out infinite;
    border-radius: 16px;
}
```

Skeleton-Typen: `list` (Avatar + Textzeilen), `cards` (Block-Platzhalter), `table` (Header + Zeilen).

### 7.6 Touch-Targets

**Minimum 44×44px** für alle interaktiven Elemente. Das betrifft:
- Buttons: `min-h-[44px]` auch bei kleinen Buttons
- Links in Listen: `py-3` statt `py-1`
- Icon-Buttons: `p-3` Padding um das Icon
- Formular-Elemente: Input-Höhe 44px

### 7.7 Segmented Controls (Apple-Stil)

Für Filter und Tab-Leisten auf Mobile: Horizontal scrollbare Pill-Buttons statt klassischer Tabs.

```css
.segment-bar {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;       /* Firefox */
    padding: 4px;
}
.segment-bar::-webkit-scrollbar { display: none; }
.segment-item {
    white-space: nowrap;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--hb-offblack);
    background: transparent;
}
.segment-item.active {
    background: var(--hb-olive);
    color: white;
}
```

Verwenden für: Ticket-Status-Filter, Dokument-Kategorien, Finanz-Tabs auf Mobile. Auf Desktop können klassische Tabs bleiben.

### 7.8 Overflow-Prävention

**Kein horizontaler Overflow.** Inhalte dürfen nie über den Bildschirmrand hinausragen.

- Alle Container: `max-w-full overflow-x-hidden`
- Texte die überlaufen könnten: `truncate` oder `break-words`
- Tabellen auf Mobile: `.rtable`-Pattern statt horizontalem Scroll
- Bilder/Embeds: `max-w-full` + `object-contain`
- **Kein seitliches Scrollen** — wenn etwas nicht passt, wird es umgebrochen oder in eine Card umgewandelt

---

## 8. Responsive Breakpoints

| Breakpoint | Präfix | Verhalten |
|---|---|---|
| < 768px | (default) | **Mobile.** 1 Spalte, Bottom-Nav, Bottom Sheets, Cards full-width |
| ≥ 768px | `md:` | **Desktop.** Sidebar-Navigation, zentrierte Modals, Multi-Column-Layouts möglich |

- **Mobile First:** Alle Styles sind standardmäßig für Mobile. Desktop-Overrides mit `md:`
- **Kein Tablet-Breakpoint.** Tablets bekommen die Desktop-Ansicht (Sidebar)
- **Sidebar:** `w-72`, auf Mobile per Transform versteckt (`-translate-x-full`), auf Desktop immer sichtbar

---

## 9. Mobile-Prioritäten nach Rolle

### Tenant & Owner (Priorität 1 — Pixel-perfekt)

Diese Nutzer verwenden das Portal primär mobil. Ihr Dashboard muss sich wie eine native App anfühlen.

- Dashboard: Begrüßung + KPI-Cards + Action-Liste
- Tickets: Erstellen, Chat, Status einsehen
- Dokumente: Ansehen, Herunterladen
- News: Schwarzes Brett lesen
- Profil: Kontodaten, Benachrichtigungen

### Admin & Manager — Dashboard (Priorität 1)

Das Dashboard mit KPIs, Quick-Actions und Übersicht muss auch mobil clean funktionieren.

### Admin & Manager — Experten-Tools (Priorität 2 — funktionsfähig)

Finanzen, ETV, Zeiterfassung: Müssen auf Mobile erreichbar und benutzbar sein, aber der optimale Arbeitsplatz ist Desktop. Keine Sackgassen — alles ist erreichbar. Komplexe Tabellen werden via `.rtable` in Cards umgewandelt. Formulare funktionieren, sind aber nicht für Mobile optimiert.

---

## 10. Animationen & Übergänge

Apple-Prinzip: Animationen fühlen sich physisch an — leichtes Beschleunigen, weiches Auslaufen. Nie abrupt, nie verspielt.

| Element | Eigenschaft | Dauer | Easing |
|---|---|---|---|
| Buttons (Hover) | transform, background | 200ms | `ease` |
| Buttons (Tap-Feedback) | transform, opacity | 100ms | `ease-out` |
| Navigation (Sidebar) | transform | 300ms | `cubic-bezier(0.25, 1, 0.5, 1)` |
| Modals (Desktop) | transform, opacity | 250ms | `cubic-bezier(0.25, 1, 0.5, 1)` |
| Bottom Sheets | transform | 300ms | `cubic-bezier(0.25, 1, 0.5, 1)` |
| Dropdowns | opacity, transform | 200ms | `cubic-bezier(0.25, 1, 0.5, 1)` |
| Skeleton Shimmer | background-position | 1500ms | `ease-in-out` |

`cubic-bezier(0.25, 1, 0.5, 1)` ist der Apple-Standard-Easing: schnell rein, sanft raus. Für alle Slide/Scale-Animationen verwenden.

- **Tap-Feedback (Mobile):** Aktive Buttons kurz auf `scale(0.97) opacity(0.7)` — fühlt sich an wie ein physischer Druck
- **Alle Animationen** respektieren `prefers-reduced-motion: reduce` → auf `transition: none` setzen
- **Keine** Animationen die > 300ms dauern (Ausnahme: Skeleton Shimmer)
- **Swipe-Gesten:** Passive touch-Listeners, Threshold 80px für Dismiss

---

## 11. Verbindliche Regeln

1. **Keine Fremdfarben.** Nur die Palette aus §1. Kein `text-red-500`, kein `bg-blue-100`
2. **Keine Fremd-Radien.** Nur 4px / 8px / 12px / 16px / 50% wie in §4
3. **Mobile First.** Alle CSS-Regeln defaulten auf Mobile, Desktop ist der Override (`md:`)
4. **Kein horizontaler Overflow.** Wenn Inhalt nicht passt: umbrechen, kürzen oder Pattern wechseln
5. **Touch-Targets 44px.** Jedes interaktive Element — ohne Ausnahme
6. **Eine Spalte auf Mobile.** Kein Grid, kein Flex-Row (Ausnahme: KPI-Cards als 2×2)
7. **Content-Area ist der einzige Scroll-Container.** Nie `overflow-y-auto` auf Body oder Main
8. **Skeleton statt Spinner.** Ladezeiten werden mit Shimmer-Platzhaltern überbrückt
9. **Bottom Sheet statt Modal** auf Mobile. Keine zentrierten Popups
10. **Konsistenz-Zwang.** Alle Module nutzen exakt dieselbe Formensprache — keine Modul-spezifischen Styles
