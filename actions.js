module.exports = function (self) {
	const rackChoices = self._buildRackChoices ? self._buildRackChoices() : []
    const hotSnapshotChoices = self._buildHotSnapshotChoices ? self._buildHotSnapshotChoices() : []
    const hotPluginChoices = self._buildHotPluginChoices ? self._buildHotPluginChoices() : []

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
		},
        route_hot_snapshots: {
            name: 'Route einzelnen Hot Snapshot',
            options: [
                { id: 'snapshotId', type: 'dropdown', label: 'Hot Snapshot', choices: hotSnapshotChoices, default: hotSnapshotChoices[0]?.id },
            ],
            callback: async (event) => {
                await self.routeSnapshot(event.options.snapshotId)
            },
        },
        route_hot_plugins: {
            name: 'Route einzelnes Hot Plugin',
            options: [
                { id: 'pluginId', type: 'dropdown', label: 'Hot Plugin', choices: hotPluginChoices, default: hotPluginChoices[0]?.id },
            ],
            callback: async (event) => {
                await self.routePlugin(event.options.pluginId)
            },
        }
	})
}
