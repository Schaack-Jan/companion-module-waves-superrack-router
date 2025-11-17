const { combineRgb } = require('@companion-module/base')

module.exports = async function (self) {
	self.setFeedbackDefinitions({
		active_source: {
			name: 'Aktive Quelle',
			type: 'boolean',
			label: 'Aktive Quelle',
			options: [ { id: 'sourceIndex', type: 'number', label: 'Source Index' } ],
			defaultStyle: { bgcolor: combineRgb(0, 100, 0), color: combineRgb(255,255,255) },
			callback: (fb) => fb.options.sourceIndex === self.state.activeSourceIndex,
		},
		rack_last_used: {
			name: 'Rack zuletzt benutzt',
			type: 'boolean',
			label: 'Rack zuletzt benutzt',
			options: [ { id: 'rackId', type: 'number', label: 'Rack ID' } ],
			defaultStyle: { bgcolor: combineRgb(80, 0, 80), color: combineRgb(255,255,255) },
			callback: (fb) => self.state.lastRoutedRacks.includes(fb.options.rackId),
		},
		sequence_running: {
			name: 'Sequenz läuft',
			type: 'boolean',
			label: 'Sequenz läuft',
			options: [],
			defaultStyle: { bgcolor: combineRgb(200, 120, 0), color: combineRgb(0,0,0) },
			callback: () => self.state.sequenceRunning === true,
		},
	})
}
