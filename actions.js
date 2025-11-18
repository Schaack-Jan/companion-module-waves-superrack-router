module.exports = function (self) {
	const sourceChoices = self._buildSourceChoices ? self._buildSourceChoices() : []
	const rackChoices = self._buildRackChoices ? self._buildRackChoices() : []

	self.setActionDefinitions({
		route_rack: {
			name: 'Route einzelnes Rack',
			options: [
				{ id: 'rackId', type: 'dropdown', label: 'Rack', choices: rackChoices, default: rackChoices[0]?.id },
			],
			callback: async (event) => {
				await self.routeRack(event.options.rackId)
			},
		},
		empty_routing: {
			name: 'Routing Matrix leeren',
			callback: async () => {
				self.state.routingMatrix = { matrix: {} }
				const p = self._dataDirPath(self.jsonFiles.routing)
				try { require('fs').writeFileSync(p, JSON.stringify(self.state.routingMatrix,null,2)) } catch {}
				self._log('info','Routing Matrix geleert')
			},
		}
	})
}
