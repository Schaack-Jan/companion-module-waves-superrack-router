module.exports = function (self) {
	self.setVariableDefinitions([
		{ variableId: 'active_source_index', name: 'Aktive Quelle Index' },
		{ variableId: 'active_source_label', name: 'Aktive Quelle Label' },
		{ variableId: 'last_routed_racks', name: 'Zuletzt geroutete Racks (IDs)' },
		{ variableId: 'last_action_timestamp', name: 'Letzter Action Zeitstempel (ms)' },
		{ variableId: 'failed_steps_total', name: 'Fehlgeschlagene MIDI Steps Gesamt' },
        { variableId: 'midi_last_type', name: 'Letzter MIDI Typ' },
        { variableId: 'midi_last_channel', name: 'Letzter MIDI Kanal' },
        { variableId: 'midi_last_data1', name: 'Letztes Data1' },
        { variableId: 'midi_last_data2', name: 'Letztes Data2' },
	])
}
