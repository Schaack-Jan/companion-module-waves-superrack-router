module.exports = function (self) {
	const rackChoices = self._buildRackChoices ? self._buildRackChoices() : []
    const hotSnapshotChoices = self._buildHotSnapshotChoices ? self._buildHotSnapshotChoices() : []
    const hotPluginChoices = self._buildHotPluginChoices ? self._buildHotPluginChoices() : []

	self.setActionDefinitions({
		route_rack: {
			name: 'Call rack',
			options: [
				{ id: 'rackId', type: 'dropdown', label: 'Rack', choices: rackChoices, default: rackChoices[0]?.id },
			],
			callback: async (event) => {
				await self.routeRack(event.options.rackId)
			},
		},
        route_hot_snapshots: {
            name: 'route single Hot Snapshot',
            options: [
                { id: 'snapshotId', type: 'dropdown', label: 'Hot Snapshot', choices: hotSnapshotChoices, default: hotSnapshotChoices[0]?.id },
            ],
            callback: async (event) => {
                await self.routeSnapshot(event.options.snapshotId)
            },
        },
        route_hot_plugins: {
            name: 'route single Hot Plugin',
            options: [
                { id: 'pluginId', type: 'dropdown', label: 'Hot Plugin', choices: hotPluginChoices, default: hotPluginChoices[0]?.id },
            ],
            callback: async (event) => {
                await self.routePlugin(event.options.pluginId)
            },
        },
        trigger_channel: {
            name: 'trigger channel',
            options: [
                {
                    id: 'channelIndex',
                    type: 'textinput',
                    label: 'Kanal Index',
                    default: '',
                },
            ],
            callback: async (event) => {
                const channelIndexRaw = event.options.channelIndex
                const channelIndex = await self.parseVariablesInString(channelIndexRaw)

                let foundRackId = null
                const maxRacks = parseInt(self.config?.maxRacks, 10) || self.state.maxRacks || 64
                for (let i = 1; i <= maxRacks; i++) {
                    if (self.config?.[`rack_channel_index_${i}`] === channelIndex) {
                        foundRackId = i
                        break
                    }
                }

                if (foundRackId) {
                    await self.routeRack(foundRackId)
                } else {
                    self._log('warn', `found no rack for channel index ${channelIndex}`)
                }
            }
        },
	})
}
