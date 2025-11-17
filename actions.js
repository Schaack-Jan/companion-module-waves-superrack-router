module.exports = function (self) {
	const sourceChoices = self._buildSourceChoices ? self._buildSourceChoices() : []
	const rackChoices = self._buildRackChoices ? self._buildRackChoices() : []

	self.setActionDefinitions({
		route_source: {
			name: 'Route Quelle',
			options: [
				{ id: 'sourceIndex', type: 'dropdown', label: 'Quelle', choices: sourceChoices, default: sourceChoices[0]?.id },
			],
			callback: async (event) => {
				await self.routeSource(event.options.sourceIndex)
			},
		},
		route_rack: {
			name: 'Route einzelnes Rack',
			options: [
				{ id: 'rackId', type: 'dropdown', label: 'Rack', choices: rackChoices, default: rackChoices[0]?.id },
			],
			callback: async (event) => {
				await self.routeRack(event.options.rackId)
			},
		},
		reload_json: {
			name: 'Reload JSON Dateien',
			callback: async () => { await self._loadAllJson(); self.updateActions(); self._buildPresets() },
		},
		empty_routing: {
			name: 'Routing Matrix leeren',
			callback: async () => {
				self.state.routingMatrix = { matrix: {} }
				const p = self._dataDirPath(self.jsonFiles.routing)
				try { require('fs').writeFileSync(p, JSON.stringify(self.state.routingMatrix,null,2)) } catch {}
				self._log('info','Routing Matrix geleert')
			},
		},
		apply_json_wing: {
			name: 'Apply wing-index-map.json Text',
			callback: async () => { self.applyJson('wing', self._jsonCacheText.wing) },
		},
		apply_json_routing: {
			name: 'Apply routing-matrix.json Text',
			callback: async () => { self.applyJson('routing', self._jsonCacheText.routing) },
		},
		apply_json_midi: {
			name: 'Apply superrack-midi-map.json Text',
			callback: async () => { self.applyJson('midi', self._jsonCacheText.midi) },
		},
		reset_rack_steps: {
			name: 'Rack MIDI Steps leeren',
			options: [ { id: 'rackId', type: 'dropdown', label: 'Rack', choices: rackChoices, default: rackChoices[0]?.id } ],
			callback: async (event) => { self.resetRackSteps(event.options.rackId) },
		},
	})
}
