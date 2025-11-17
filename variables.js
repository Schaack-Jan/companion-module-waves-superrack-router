module.exports = function (self) {
	self.setVariableDefinitions([
		{ variableId: 'active_source_index', name: 'Aktive Quelle Index' },
		{ variableId: 'active_source_label', name: 'Aktive Quelle Label' },
		{ variableId: 'last_routed_racks', name: 'Zuletzt geroutete Racks (IDs)' },
		{ variableId: 'last_action_timestamp', name: 'Letzter Action Zeitstempel (ms)' },
		{ variableId: 'failed_steps_total', name: 'Fehlgeschlagene MIDI Steps Gesamt' },
	])
}
