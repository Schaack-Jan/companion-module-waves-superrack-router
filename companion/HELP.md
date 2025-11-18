## Prerequisites

To use this module, the **"Generic: MIDI"** module must be installed.

## Waves Configuration

Waves does not natively support selecting racks via MIDI. Therefore, a workaround is required:

- For **Rack 1**, set a plugin from Rack 1 as a Hot Plugin. Repeat this for each rack.
- If all Hot Plugins are already assigned, create a **Snapshot** that only stores the Hot Plugins.
- Save this Snapshot as a **Hot Snapshot**.

Once all Hot Snapshots and Hot Plugins exist, configure the MIDI settings:

- Use the helper buttons **"route single Hot Snapshot"** and **"route single Hot Plugin"** to assign MIDI calls.
- When all Hot Snapshots and Hot Plugins can be triggered via MIDI, you can proceed to map the racks to the channel ID in the connection.

## Default Routing

By default, all channels are routed 1:1 to racks. This means that channel 1 is mapped to rack 1, channel 2 to rack 2, and so on, unless a custom mapping is configured.

## Automatic Rack Selection

For racks to be selected automatically, you need to set up a trigger that listens for changes to the variable `$(superrack-router:last_action_timestamp)`.
When this variable changes, a MIDI CC message must be sent with the following data:

- **Channel:** `$(superrack-router:midi_last_channel)`
- **Controller:** `$(superrack-router:midi_last_controller)`
- **Value:** `$(superrack-router:midi_last_value)`
- **Use Variables:** Yes

## Sending MIDI Calls to Waves

Once this trigger is set, MIDI calls can be sent to Waves.
To automatically open the currently selected channel from the mixing console in Waves, set up a trigger that receives the channel index from the console and passes it to the **"trigger channel"** action.
Variables in this trigger are parsed automatically.