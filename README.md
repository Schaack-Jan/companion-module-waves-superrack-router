# Waves SuperRack Router Companion Modul

Dieses Modul ermöglicht das Routing von WING Quellen zu Waves SuperRack Racks über definierte MIDI-Sequenzen.

## Funktionen
- Quellen (Channel/Bus/Main/Matrix) auswählen und zu konfigurierten Racks routen
- MIDI Sequenzen: CC, Note On, Program Change (reihenfolge, delay pro Schritt)
- Editierbare JSON Dateien im Companion dataDir:
  - `wing-index-map.json` (Struktur der Quellen, Felder: id,index,type,label)
  - `routing-matrix.json` (matrix: { <sourceIndex>: [rackIds...] })
  - `superrack-midi-map.json` (racks: { rackId: { name, enabled, midiSteps: [] } })
- Actions: route_source, route_rack, reload_json, empty_routing, apply_json_*, reset_rack_steps
- Feedbacks: active_source, rack_last_used, sequence_running
- Variablen: active_source_index, active_source_label, last_routed_racks, last_action_timestamp, failed_steps_total
- Presets: Auto Generated für Quellen, Racks und Systemfunktionen

## JSON Validierung
- Rack MIDI Steps max 1000 Einträge
- Keine doppelten Rack IDs pro Quelle in routing-matrix
- MIDI Werte innerhalb 0–127, Kanal 1–16
- Programm-Change optionales Feld `value` wird nur geloggt

## Sequenz Ablauf
- Quelle routen: alle Ziel-Racks nacheinander ausgeführt
- Timeout: 1000ms (sofortiger Abbruch mit Fehlzählung) ab Start der Sequenz
- Delay wird nach jedem gesendeten MIDI Schritt angewendet
- Neue Routing Action während laufender Sequenz wird verworfen (Warn-Log)

## Konfiguration
- Log Level (error/warn/info/debug)
- Max Racks (64/32/16/8/4) beeinflusst Validierung
- MIDI Output Name (Text Name des vorhandenen Geräts)
- JSON Textareas (Änderungen + separate Apply Action)

Siehe `HELP.md` für weitere Hinweise.

See [HELP.md](./companion/HELP.md) and [LICENSE](./LICENSE)
