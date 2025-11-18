# Companion Module – Waves SuperRack Router

This Companion module allows routing of mixer sources to Waves SuperRack racks and triggers rack-specific MIDI sequences. It is designed for use with the Bitfocus Companion platform.

## Features

- **Source-to-Rack Mapping:** Map mixer source indices to one or more SuperRack rack IDs using JSON configuration.
- **MIDI Control:** Send customizable MIDI sequences (CC, Note On, Program Change) per rack, with optional delays.
- **Actions:** Route a source, reload JSON configuration, set empty routing.
- **Feedbacks:** Indicate the currently active source and the last used rack.
- **Variables:** Expose variables such as `active_source_index`, `active_source_label`, `last_routed_racks`, `last_action_timestamp`, and `failed_steps_total` for use in Companion.
- **Presets:** Automatically generated buttons for each source, reload, and empty routing.
- **JSON Edit UI:** Edit mapping files directly in the Companion UI with autosave and error revert.
- **Debug Logging:** Output detailed logs, including raw MIDI bytes, for troubleshooting.

## Configuration Files

- `superrack-midi-map.json`: Defines MIDI messages for each rack.

## File Overview

- `actions.js`: Implements Companion actions.
- `feedbacks.js`: Implements Companion feedbacks.
- `main.js`: Module initialization, configuration loading, and core logic.
- `variables.js`: Defines and updates module variables.
- `upgrades.js`: Handles configuration migrations.
- `companion/HELP.md`: Additional help for Companion users.
- `companion/manifest.json`: Module metadata for Companion.

## Usage

1. **Install the module** in Bitfocus Companion.
2. **Configure mappings** in `superrack-midi-map.json` via the Companion UI.
3. **Assign actions and feedbacks** to buttons as needed.
4. **Monitor variables and feedbacks** for real-time status.

## Development

- Node.js based, uses standard Companion module structure.
- Edit JSON files for custom mappings.
- Debug output available in the Companion log.

## License

See `LICENSE` for details.
