const { combineRgb } = require('@companion-module/base')

module.exports = async function (self) {
	self.setFeedbackDefinitions({
		active_source: {
			name: 'active source',
			type: 'boolean',
			label: 'active source',
			options: [{ id: 'sourceIndex', type: 'number', label: 'Source Index' }],
			defaultStyle: { bgcolor: combineRgb(0, 100, 0), color: combineRgb(255, 255, 255) },
			callback: (fb) => fb.options.sourceIndex === self.state.activeSourceIndex,
		},
		rack_last_used: {
			name: 'last used rack',
			type: 'boolean',
			label: 'last used rack',
			options: [{ id: 'rackId', type: 'number', label: 'Rack ID' }],
			defaultStyle: { bgcolor: combineRgb(80, 0, 80), color: combineRgb(255, 255, 255) },
			callback: (fb) => self.state.lastRoutedRacks.includes(fb.options.rackId),
		},
		sequence_running: {
			name: 'sequence running',
			type: 'boolean',
			label: 'sequence running',
			options: [],
			defaultStyle: { bgcolor: combineRgb(200, 120, 0), color: combineRgb(0, 0, 0) },
			callback: () => self.state.sequenceRunning === true,
		},
	})
}
