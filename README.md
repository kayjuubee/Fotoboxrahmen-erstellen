# Fotoboxrahmen erstellen

## Windows: direkt herunterladen

**[Rahmenstudio.exe herunterladen](https://github.com/kayjuubee/Fotoboxrahmen-erstellen/raw/refs/heads/main/Rahmenstudio.exe)**

Die fertige EXE liegt zusätzlich direkt im Repository. Alternativ „Code → Download ZIP“ verwenden, alles entpacken und `Rahmenstudio.exe` im Projektordner doppelklicken. Dafür ist kein GitHub-Release erforderlich. Windows 10/11 (64 Bit); die EXE ist unsigniert.

Deutschsprachiger Browser-Editor mit Formatwahl, Referenzbildern, OpenAI-Bilderstellung und PNG-Export. Python 3.10 oder neuer genügt; keine zusätzlichen Pakete nötig.

## Start

```sh
cd /workspace/Fotoboxrahmen-erstellen
python3 server.py
```

Die Anwendung läuft auf Port 8000 (änderbar über `PORT`). Für den lokalen Gebrauch im Browser `http://localhost:8000` öffnen. Auf einem extern zugänglichen Server muss vor einer Freigabe eine Zugangskontrolle vorgeschaltet werden, damit Dritte den kostenpflichtigen KI-Endpunkt nicht nutzen können.

## Zwei Erstellungsvarianten

Im Bereich „Dein Design“ unter „Erstellungsvariante“ wählen:

- **Mit API:** Rahmen direkt im Programm erstellen lassen. Benötigt API-Schlüssel und separates OpenAI-API-Guthaben.
- **Ohne API · manuell mit ChatGPT:** Wunschbeschreibung eingeben, Format und Hintergrund wählen, dann „Anweisung für ChatGPT kopieren“. „ChatGPT öffnen“ öffnet die normale ChatGPT-Website, wo die Anmeldung wie gewohnt erfolgt. Gewählten Hintergrund über „Gewählten Hintergrund speichern“ herunterladen und dort als erstes Bild zusammen mit den weiteren Referenzbildern selbst anhängen. Die erzeugte Grafik herunterladen und über „Fertiges Rahmenbild importieren“ zurück ins Rahmenstudio laden. Es werden in diesem Modus keine Bilderstellungsanfragen an die API gesendet. Die Bildfunktionen und Nutzungslimits des eigenen ChatGPT-Kontos gelten weiterhin.

Der Import ist in beiden Modi verfügbar und unterstützt PNG, JPG und WebP bis 20 MB bzw. 32 Megapixel. Importierte Rahmen werden auf das gewählte Format zugeschnitten; der mittlere Fotobereich wird gemäß den Exporteinstellungen ausgespart. Die gewohnte Vorschau mit Hintergrund und Personen sowie beide PNG-Exporte bleiben verfügbar. Weder ChatGPT-Anmeldung noch Text oder Bilder werden automatisch von der Anwendung an die ChatGPT-Website übertragen.

Vor dem Wechsel zur aktualisierten Windows-EXE im alten Rahmenstudio „Programm beenden“ wählen. Dann die neue EXE starten, damit nicht die alte Anwendung weiterläuft.

## Bilderstellung

`OPENAI_API_KEY` sicher als Umgebungsvariable des Serverprozesses setzen und den Server neu starten. Schlüssel niemals in Browsercode oder Git speichern. Eine bestehende ChatGPT-Anmeldung bzw. ein ChatGPT-Abonnement ersetzt keinen API-Zugang; API-Bilder werden separat berechnet. Ohne Schlüssel funktionieren Vorschau, Farben, Formate und PNG-Download; die KI-Funktion zeigt einen Einrichtungshinweis.

Der Server nutzt das OpenAI-Modell `gpt-image-1` über die Images-API. Referenzbilder werden erst bei Klick auf „Mit KI gestalten“ an OpenAI übertragen, nicht dauerhaft auf dem Server gespeichert. Die erzeugte Grafik wird auf das gewünschte Seitenverhältnis zugeschnitten und auf die Exportmaße skaliert; sie wird nicht nativ in 3600 × 2400 generiert. Wichtige Motive sollten deshalb am Rand liegen. Der Fotobereich überdeckt die Mitte.

Standard: 3600 × 2400 Pixel, Rahmenanteil 12,5 % der Gesamtfläche. Der mittige Fotobereich übernimmt das Seitenverhältnis des Gesamtbildes. Vorschau-Beschriftungen erscheinen nicht im Export. Optional bleibt der Fotobereich im PNG transparent. Der Download verwendet den im Browser eingestellten Downloadordner; eine Webseite kann den Ordner nicht eigenständig festlegen.

## Hintergründe und Personen

Unter „Hintergrund & Personen“ mehrere eigene Hintergründe importieren und per Vorschaubild auswählen. Drei einfache Farbverläufe stehen zum Ausprobieren bereit. Der gewählte Hintergrund wird bei der KI-Erstellung als erste Referenz mitgeschickt; die Anweisung stimmt Farben, Licht und Stimmung des neuen Rahmens darauf ab. Bis zu vier zusätzliche Designreferenzen bleiben möglich.

Personenbilder lassen sich zusätzlich importieren, einzeln auswählen, skalieren und horizontal/vertikal verschieben. Freigestellte PNGs bewahren die Transparenz; JPGs behalten ihren eigenen Hintergrund. Es gibt keine automatische Freistellung. Alternativ können zwei stilisierte Personensilhouetten eingeblendet werden. Personen werden ausschließlich für die lokale Vorschau verwendet und nicht an OpenAI gesendet.

Eigene Hintergründe und Personen werden mit maximal 1600 Pixeln an der längsten Seite in IndexedDB gespeichert (höchstens 20 Bilder je Kategorie, maximal 5 MB pro Upload). Sie bleiben in diesem Browser und unter derselben Website-Adresse nach dem Neuladen verfügbar. Sie werden nicht serverseitig gespeichert oder zwischen Geräten synchronisiert; beim Löschen der Browserdaten gehen sie verloren. Originale daher separat behalten. Ein Wechsel des Hintergrunds erzeugt den Rahmen nicht automatisch neu: dafür erneut „Mit KI gestalten“ klicken.

„Rahmen als PNG“ exportiert ausschließlich den Rahmen; der Fotobereich ist standardmäßig transparent. „Gesamtvorschau als PNG“ exportiert die aktuell sichtbare Zusammenstellung aus Hintergrund, Personen und darüberliegendem Rahmen. Die Vorschau lässt sich über das Häkchen „Hintergrund in der Vorschau anzeigen“ ein- und ausblenden.

## Prüfungen

```sh
python3 -m py_compile server.py
node --check static/app.js
```

Nach dem Start: `GET /api/status` prüft, ob ein API-Schlüssel vorhanden ist. Eine tatsächliche KI-Erstellung benötigt einen gültigen Schlüssel, Modellzugriff und API-Guthaben.

## Windows-Anwendung

`dist/Rahmenstudio.exe` ist eine eigenständige Anwendung für Windows 10/11 (64 Bit). Herunterladen und doppelklicken: Sie öffnet den Editor im Standardbrowser. Python, Go oder eine zusätzliche Installation sind auf dem Ziel-PC nicht nötig. Die EXE ist nicht digital signiert.

Unter „API-Einstellungen“ kann ein OpenAI-API-Schlüssel ausschließlich für die aktuelle Programmsitzung hinterlegt werden. Er wird nicht auf Festplatte gespeichert. „Programm beenden“ beendet den lokalen Server; nur den Browser-Tab zu schließen beendet ihn nicht. Ein erneuter Doppelklick öffnet die laufende Anwendung wieder. Die Anwendung verwendet ausschließlich die lokale Adresse 127.0.0.1 und standardmäßig Port 18765. Dieser feste Port erhält die Browser-Bildbibliothek bei späteren Starts. Die Bibliothek der Cloud-Entwicklung wird nicht automatisch auf den Windows-PC übertragen.

Zum erneuten Bauen mit Go 1.24+: `powershell -ExecutionPolicy Bypass -File .\build-windows.ps1`. Alternativ auf Linux: `GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags='-s -w -H=windowsgui' -o dist/Rahmenstudio.exe .`. Der Go-Server bettet alle Dateien aus `static/` ein; nach Änderungen muss die EXE neu gebaut werden. Tests: `go test ./...`. Die Windows-EXE wurde auf Linux cross-kompiliert; ein Start unter Windows muss noch geprüft werden.

## Download über GitHub

Veröffentlichte Windows-Versionen stehen unter https://github.com/kayjuubee/Fotoboxrahmen-erstellen/releases bereit. Dort `Rahmenstudio-Windows.zip` herunterladen, entpacken und `Rahmenstudio.exe` starten. Diese Adresse enthält erst nach einem erfolgreichen Release einen Download.

Der Workflow `.github/workflows/windows-release.yml` baut und testet die Anwendung auf einem Windows-Runner. Ein Tag wie `v0.1.0` veröffentlicht anschließend EXE, ZIP und SHA-256-Prüfsumme als GitHub-Release. Ein manueller Start unter „Actions → Windows EXE und Release“ erzeugt herunterladbare Build-Artefakte ohne Release. API-Schlüssel werden weder für den Build noch für die Tests benötigt und dürfen nicht im Repository gespeichert werden.
