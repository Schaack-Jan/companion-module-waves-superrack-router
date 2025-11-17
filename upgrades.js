module.exports = [
	/*
	 * Place your upgrade scripts here
	 * Remember that once it has been added it cannot be removed!
	 */
	// function (context, props) {
	// 	return {
	// 		updatedConfig: null,
	// 		updatedActions: [],
	// 		updatedFeedbacks: [],
	// 	}
	// },
	// Upgrade to 0.1.1: migrate demo host/port config to new fields if present
	function (context, props) {
		const cfg = { ...props.config }
		let changed = false
		if (!cfg.logLevel) { cfg.logLevel = 'info'; changed = true }
		if (!cfg.maxRacks) { cfg.maxRacks = 64; changed = true }
		if (cfg.host || cfg.port) { // old demo fields
			delete cfg.host; delete cfg.port; changed = true
		}
		return {
			updatedConfig: changed ? cfg : null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
	},
]
