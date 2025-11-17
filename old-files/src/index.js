const { WavesSuperRackRouterInstance } = require('./instance')

// Companion entry point
function init(system) {
  return new WavesSuperRackRouterInstance(system)
}

module.exports = { init }
