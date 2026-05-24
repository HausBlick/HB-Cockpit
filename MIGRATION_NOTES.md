# Migration: Neue Doku-Architektur (24.05.2026)

Diese Notiz erklärt dir, was du im Repo tun musst, um die neue Doku-Struktur zu aktivieren.

---

## Was sich ändert

**Alt (3 Dateien):**
- CLAUDE.md (1.182 Zeilen, alles drin)
- GEMINI.md (mit Validierungs-Tasks am Ende)
- BRIEFING.md (kaum noch genutzt, archiviert)

**Neu (4 Dateien):**
- CLAUDE.md (schlank, ~200 Zeilen, statisch)
- GEMINI.md (ohne Validierungs-Tasks)
- STATUS.md (NEU – aktuelle Bugs & Live-Gang-Checkliste, nur Niko pflegt)
- CHANGELOG.md (NEU – komplette Phasen-Historie ausgelagert)

---

## Schritt-für-Schritt

### 1. Backup machen
```bash
cd /pfad/zum/HB-Cockpit
git checkout main
git pull
git checkout -b doku-aufraeumung
cp CLAUDE.md CLAUDE.md.backup
cp GEMINI.md GEMINI.md.backup
```

### 2. Alte Dateien ersetzen
Lege die 4 neuen Dateien (CLAUDE.md, GEMINI.md, STATUS.md, CHANGELOG.md) ins Repo-Root. Die alten werden überschrieben (CLAUDE.md, GEMINI.md) bzw. neu angelegt (STATUS.md, CHANGELOG.md).

### 3. BRIEFING.md endgültig archivieren
Falls noch nicht passiert:
```bash
mkdir -p docs/archive
git mv BRIEFING.md docs/archive/BRIEFING_legacy.md 2>/dev/null || true
```

### 4. Commit
```bash
git add CLAUDE.md GEMINI.md STATUS.md CHANGELOG.md docs/archive/
git commit -m "docs: Doku-Architektur auf 4-Dateien-Struktur umgestellt

- CLAUDE.md radikal gekürzt (1.182 → ~200 Zeilen), statische Anweisung
- STATUS.md neu: aktuelle Bugs & Live-Gang-Checkliste, NUR Niko pflegt
- CHANGELOG.md neu: komplette Phasen-Historie ausgelagert
- GEMINI.md: Validierungs-Tasks entfernt, Hinweis auf neue Struktur
- BRIEFING.md nach docs/archive/ verschoben
- Definition of Done in CLAUDE.md ergänzt"
```

### 5. Backup-Dateien löschen
```bash
rm CLAUDE.md.backup GEMINI.md.backup
```

### 6. Merge auf main
```bash
git checkout main
git merge doku-aufraeumung
git push
```

---

## Übergabe-Prompt für Claude Code / Cowork

**Kopier das in die nächste Session mit Claude Code oder Cowork – BEVOR du irgendeine andere Aufgabe gibst:**

```
WICHTIGE INFO: Die Doku-Architektur des Projekts wurde am 24.05.2026 umgestellt.

ÄNDERUNGEN:
- CLAUDE.md wurde radikal gekürzt (von 1.182 auf ~200 Zeilen). Sie ist jetzt eine statische Anweisungs-Datei mit Architektur, Konventionen und Definition of Done.
- NEUE Datei STATUS.md im Repo-Root: enthält aktuelle Bugs, Blocker und Live-Gang-Checkliste. NUR Niko pflegt diese Datei. Du darfst sie lesen, aber NIEMALS editieren.
- NEUE Datei CHANGELOG.md im Repo-Root: enthält die komplette Phasen-Historie aus der alten CLAUDE.md. Append-only. Du darfst nach erfolgreichem Commit oben einen neuen Eintrag anhängen.
- GEMINI.md ist nahezu unverändert, nur die Validierungs-Tasks wurden entfernt (gehören jetzt in STATUS.md).
- BRIEFING.md ist nach docs/archive/ verschoben und wird nicht mehr aktiv genutzt.

DEFINITION OF DONE (neu in CLAUDE.md Abschnitt 1):
Eine Aufgabe ist NICHT erledigt, nur weil der Code läuft. Eine Aufgabe ist erst erledigt, wenn:
1. Code läuft (kein Build-/Lint-Error)
2. Niko hat das Feature manuell im laufenden System verifiziert
3. Edge Cases sind benannt
4. Commit existiert mit aussagekräftiger Message
5. CHANGELOG.md ist ergänzt im selben Commit
6. STATUS.md-Eintrag von Niko auf "erledigt" gesetzt

Du darfst Aufgaben NIEMALS selbständig als ✅ markieren. Selbstbericht über Faktisches ist erlaubt (welche Datei du geändert hast), Selbstbericht über Qualität nicht (funktioniert / ist fertig).

BITTE LIES JETZT ZUERST:
1. CLAUDE.md komplett
2. STATUS.md komplett
3. Bestätige mir kurz, dass du die neue Struktur verstanden hast.

Danach gehen wir die offenen Punkte aus STATUS.md durch.
```

---

## Nach der Umstellung

Sobald die 4 Dateien im Repo liegen und der Übergabe-Prompt einmal in Claude Code / Cowork eingegeben wurde, arbeitest du wie folgt:

- **Bugs ansprechen:** Verweise auf STATUS.md-Punkt (z.B. "Lass uns B1 angehen")
- **Nach erledigter Aufgabe:** Du markierst in STATUS.md den Punkt als erledigt, Claude Code ergänzt CHANGELOG.md im Commit
- **Neue Bugs:** Du trägst sie in STATUS.md ein
- **Strategische Erweiterungen:** Gemini bekommt Auftrag, ergänzt GEMINI.md
