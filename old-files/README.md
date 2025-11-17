# Companion Module – Waves SuperRack Router

Dieses Modul ermöglicht Routing von Behringer WING Quellen zu Waves SuperRack Racks und triggert pro Rack definierte MIDI-Sequenzen.

## Features
- Mapping: Wing Source Index -> Liste SuperRack Rack IDs
- MIDI Steps pro Rack (CC, Note On, Program Change) mit Delay nach dem Senden
- Actions: Route Source, Reload JSON, Leeres Routing setzen
- Feedbacks: Aktive Quelle, Rack zuletzt benutzt
- Variablen: active_source_index, active_source_label, last_routed_racks, last_action_timestamp, failed_steps_total
- Presets: Buttons pro Quelle, Reload JSON, Leeres Routing
- JSON Edit UI mit Autosave & Revert bei Fehlern
- Debug Logging inkl. Roh-MIDI Bytes

## JSON Dateien
1. wing-index-map.json
2. routing-matrix.json
3. superrack-midi-map.json

## Entwicklung
Noch in Arbeit – siehe Source.

