module.exports = function (self) {
	self.setVariableDefinitions([
		{ variableId: 'last_routed_racks', name: 'Last routed Racks (IDs)' },
		{ variableId: 'last_action_timestamp', name: 'Last action timestamp (ms)' },
		{ variableId: 'failed_steps_total', name: 'Failed MIDI steps (total)' },
        { variableId: 'midi_last_type', name: 'Last MIDI type' },
        { variableId: 'midi_last_channel', name: 'Last MIDI channel' },
        { variableId: 'midi_last_controller', name: 'Last MIDI controller' },
        { variableId: 'midi_last_value', name: 'Last MIDI value' },
	])
}
