// Waves SuperRack Router Companion Module Instance
// Hinweis: Dies ist eine strukturierte Implementierung basierend auf den spezifizierten Anforderungen.
// Companion-spezifische API-Aufrufe (setActionDefinitions, setFeedbackDefinitions, etc.) sind exemplarisch
// und müssen im echten Companion-Kontext ggf. angepasst werden.

const fs = require('fs')
const path = require('path')

const MAX_MIDI_STEPS_PER_RACK = 1000 // aus Spezifikation Punkt 10
const MAX_RACK_ID = 64 // aus Anforderung: insgesamt 64 Racks

class WavesSuperRackRouterInstance {
  constructor(module) {
    this.module = module
    this.config = {
      midiDeviceId: '',
      debug: false,
    }

    this.state = {
      wingIndexMap: null,
      routingMatrix: null,
      rackMidiMap: null,
      activeSourceIndex: null,
      activeSourceLabel: '',
      lastRoutedRacks: [],
      lastActionTimestamp: 0,
      failedStepsTotal: 0,
      sequenceRunning: false,
    }

    this._originalJsonText = {
      wing: '',
      routing: '',
      midi: '',
    }

    this.paths = {
      baseDir: this.module?.dataDir || path.resolve('.'),
      wing: 'wing-index-map.json',
      routing: 'routing-matrix.json',
      midi: 'superrack-midi-map.json',
    }

    this.logger = this._createLogger()

    this._init()
  }

  // ------------------------- Initialisierung -------------------------
  async _init() {
    this.logger.info('Initialisierung startet')
    await this._loadAllJson()
    this._setupVariables()
    this._setupActions()
    this._setupFeedbacks()
    this._setupPresets()
    this.logger.info('Initialisierung abgeschlossen')
  }

  // ------------------------- Logger -------------------------
  _createLogger() {
    const instance = this
    return {
      _fmt(level, msg, extra) {
        const ts = new Date().toISOString()
        let line = `[${ts}] [${level}] ${msg}`
        if (extra) {
          try { line += ' ' + JSON.stringify(extra) } catch { /* ignore */ }
        }
        return line
      },
      info(msg, extra) { console.log(this._fmt('INFO', msg, extra)) },
      warn(msg, extra) { console.warn(this._fmt('WARN', msg, extra)) },
      error(msg, extra) { console.error(this._fmt('ERROR', msg, extra)) },
      debug(msg, extra) {
        if (instance.config.debug) console.log(this._fmt('DEBUG', msg, extra))
      },
    }
  }

  // ------------------------- JSON Laden & Validierung -------------------------
  async _loadAllJson() {
    await this._loadWingIndexMap()
    await this._loadRoutingMatrix()
    await this._loadRackMidiMap()
  }

  _readJsonFile(relPath) {
    const filePath = path.isAbsolute(relPath) ? relPath : path.join(this.paths.baseDir, relPath)
    if (!fs.existsSync(filePath)) {
      this.logger.warn(`Datei nicht gefunden: ${filePath}`)
      return null
    }
    try {
      const txt = fs.readFileSync(filePath, 'utf8')
      return { json: JSON.parse(txt), text: txt }
    } catch (e) {
      this.logger.error('JSON Lesen/Parse Fehler', { file: relPath, error: e.message })
      return null
    }
  }

  _writeJsonFile(relPath, obj) {
    const filePath = path.isAbsolute(relPath) ? relPath : path.join(this.paths.baseDir, relPath)
    try {
      const txt = JSON.stringify(obj, null, 2)
      fs.writeFileSync(filePath, txt, 'utf8')
      return true
    } catch (e) {
      this.logger.error('JSON Schreibfehler', { file: relPath, error: e.message })
      return false
    }
  }

  async _loadWingIndexMap() {
    const res = this._readJsonFile(this.paths.wing)
    if (!res) return
    if (this._validateWingIndexMap(res.json)) {
      this.state.wingIndexMap = res.json
      this._originalJsonText.wing = res.text
      this.logger.info('wing-index-map geladen & validiert')
    } else {
      this.logger.error('wing-index-map ungültig – Ladefehler')
    }
  }

  async _loadRoutingMatrix() {
    const res = this._readJsonFile(this.paths.routing)
    if (!res) return
    if (this._validateRoutingMatrix(res.json)) {
      this.state.routingMatrix = res.json
      this._originalJsonText.routing = res.text
      this.logger.info('routing-matrix geladen & validiert')
    } else {
      this.logger.error('routing-matrix ungültig – Ladefehler')
    }
  }

  async _loadRackMidiMap() {
    const res = this._readJsonFile(this.paths.midi)
    if (!res) return
    if (this._validateRackMidiMap(res.json)) {
      this.state.rackMidiMap = res.json
      this._originalJsonText.midi = res.text
      this.logger.info('superrack-midi-map geladen & validiert')
    } else {
      this.logger.error('superrack-midi-map ungültig – Ladefehler')
    }
  }

  _validateWingIndexMap(obj) {
    if (!obj || typeof obj !== 'object') return false
    const { channels, buses, mains, matrices } = obj
    if (!Array.isArray(channels) || channels.length !== 48) return false
    if (!Array.isArray(buses) || buses.length !== 16) return false
    if (!Array.isArray(mains) || mains.length !== 4) return false
    if (!Array.isArray(matrices) || matrices.length !== 8) return false
    const used = new Set()
    const check = (arr, type) => arr.every(e => e && typeof e.index === 'number' && e.type === type && typeof e.label === 'string' && !used.has(e.index) && used.add(e.index))
    if (!check(channels, 'channel')) return false
    if (!check(buses, 'bus')) return false
    if (!check(mains, 'main')) return false
    if (!check(matrices, 'matrix')) return false
    return true
  }

  _validateRoutingMatrix(obj) {
    if (!obj || typeof obj !== 'object') return false
    if (!obj.matrix || typeof obj.matrix !== 'object') return false
    for (const [k, v] of Object.entries(obj.matrix)) {
      if (!/^\d+$/.test(k)) return false
      if (!Array.isArray(v)) return false
      for (const rackId of v) {
        if (typeof rackId !== 'number' || rackId <= 0 || rackId > MAX_RACK_ID) return false
      }
    }
    return true
  }

  _validateRackMidiMap(obj) {
    if (!obj || typeof obj !== 'object') return false
    if (!obj.racks || typeof obj.racks !== 'object') return false
    for (const [rackIdStr, rack] of Object.entries(obj.racks)) {
      if (!/^\d+$/.test(rackIdStr)) return false
      if (!rack || typeof rack !== 'object') return false
      if (typeof rack.name !== 'string') return false
      if (typeof rack.enabled !== 'boolean') return false
      if (!Array.isArray(rack.midiSteps)) return false
      if (rack.midiSteps.length > MAX_MIDI_STEPS_PER_RACK) return false
      for (const step of rack.midiSteps) {
        if (!step || typeof step !== 'object') return false
        if (!['cc', 'noteon', 'program'].includes(step.type)) return false
        if (typeof step.channel !== 'number' || step.channel < 1 || step.channel > 16) return false
        if (typeof step.delay !== 'number' || step.delay < 0) return false
        switch (step.type) {
          case 'cc':
            if (typeof step.controller !== 'number' || step.controller < 0 || step.controller > 127) return false
            if (typeof step.value !== 'number' || step.value < 0 || step.value > 127) return false
            break
          case 'noteon':
            if (typeof step.note !== 'number' || step.note < 0 || step.note > 127) return false
            if (typeof step.value !== 'number' || step.value < 0 || step.value > 127) return false
            break
          case 'program':
            if (typeof step.program !== 'number' || step.program < 0 || step.program > 127) return false
            // value optional / ignoriert
            break
        }
      }
    }
    return true
  }

  // ------------------------- Config / UI Hooks (exemplarisch) -------------------------
  updateConfig(newConfig) {
    // Erwartet { midiDeviceId, debug }
    this.config = { ...this.config, ...newConfig }
    this.logger.info('Config aktualisiert', this.config)
  }

  // Autosave JSON Textareas (exemplarische Methode)
  saveJsonFromUi(kind, newText) {
    // kind: 'wing' | 'routing' | 'midi'
    try {
      const parsed = JSON.parse(newText)
      let valid = false
      if (kind === 'wing') valid = this._validateWingIndexMap(parsed)
      else if (kind === 'routing') valid = this._validateRoutingMatrix(parsed)
      else if (kind === 'midi') valid = this._validateRackMidiMap(parsed)
      if (!valid) return false
      // Schreiben & Übernehmen
      const rel = this.paths[kind]
      this._writeJsonFile(rel, parsed)
      this._originalJsonText[kind] = newText
      if (kind === 'wing') this.state.wingIndexMap = parsed
      else if (kind === 'routing') this.state.routingMatrix = parsed
      else if (kind === 'midi') this.state.rackMidiMap = parsed
      this.logger.info(`${kind} JSON gespeichert`)
      // Nach Änderung ggf. Actions neu generieren (Quellenliste)
      if (kind === 'wing') this._setupActions(true)
    } catch (e) {
      // Revert
      this.logger.error('JSON UI Änderung verworfen', { kind, error: e.message })
      return false
    }
    return true
  }

  getStateSnapshot() {
    return JSON.parse(JSON.stringify({
      config: this.config,
      state: this.state,
    }))
  }

  // ------------------------- Variables -------------------------
  _setupVariables() {
    // Exemplarisch – Companion API abhängig
    this.variablesDefinition = [
      { name: 'active_source_index', label: 'Aktive Quelle Index' },
      { name: 'active_source_label', label: 'Aktive Quelle Label' },
      { name: 'last_routed_racks', label: 'Zuletzt geroutete Rack IDs' },
      { name: 'last_action_timestamp', label: 'Letzter Action Zeitstempel (ms)' },
      { name: 'failed_steps_total', label: 'Anzahl fehlgeschlagene MIDI Steps gesamt' },
    ]
  }

  _setVariable(name, value) {
    // Placeholder für Companion API
    this.logger.debug('Variable gesetzt', { name, value })
  }

  _updateVariables() {
    this._setVariable('active_source_index', this.state.activeSourceIndex ?? '')
    this._setVariable('active_source_label', this.state.activeSourceLabel ?? '')
    this._setVariable('last_routed_racks', this.state.lastRoutedRacks.join(','))
    this._setVariable('last_action_timestamp', this.state.lastActionTimestamp)
    this._setVariable('failed_steps_total', this.state.failedStepsTotal)
  }

  // ------------------------- Actions -------------------------
  _setupActions(reload = false) {
    const choices = this._buildSourceChoices()
    this.actions = {
      route_source: {
        name: 'Route Quelle',
        options: [
          {
            id: 'sourceIndex',
            type: 'dropdown',
            label: 'Wing Quelle',
            choices,
            default: choices[0]?.id,
          },
        ],
      },
      reload_json: { name: 'Reload JSON' },
      empty_routing: { name: 'Leere Routing Matrix' },
    }
    if (reload) this.logger.info('Actions neu erstellt (wegen Wing-Map Änderung)')
  }

  _buildSourceChoices() {
    const res = []
    const map = this.state.wingIndexMap
    if (!map) return res
    const pushArr = (arr) => {
      for (const e of arr) {
        res.push({ id: e.index, label: e.label })
      }
    }
    pushArr(map.channels)
    pushArr(map.buses)
    pushArr(map.mains)
    pushArr(map.matrices)
    return res
  }

  async executeAction(actionId, options) {
    if (actionId === 'route_source') {
      const src = options?.sourceIndex
      await this._handleRouteSource(src)
    } else if (actionId === 'reload_json') {
      await this._reloadJsonAction()
    } else if (actionId === 'empty_routing') {
      await this._emptyRoutingAction()
    } else {
      this.logger.warn('Unbekannte Action', { actionId })
    }
  }

  async _reloadJsonAction() {
    this.logger.info('Reload JSON gestartet')
    await this._loadAllJson()
    this._setupActions(true)
    this.logger.info('Reload JSON abgeschlossen')
  }

  async _emptyRoutingAction() {
    this.logger.info('Leere Routing Matrix Action')
    if (!this.state.routingMatrix) {
      this.state.routingMatrix = { matrix: {} }
    } else {
      this.state.routingMatrix.matrix = {}
    }
    this._writeJsonFile(this.paths.routing, this.state.routingMatrix)
    this.logger.info('Routing Matrix geleert & gespeichert')
  }

  async _handleRouteSource(sourceIndex) {
    if (sourceIndex == null) {
      this.logger.warn('Route Source: Kein Index')
      return
    }
    if (this.state.sequenceRunning) {
      this.logger.warn('Sequenz läuft bereits – neue Anfrage verworfen')
      return
    }
    const matrix = this.state.routingMatrix?.matrix || {}
    const rackIds = matrix[String(sourceIndex)] || []
    this.logger.info('Route Source gestartet', { sourceIndex, rackIds })
    this.state.sequenceRunning = true
    const label = this._lookupSourceLabel(sourceIndex)
    this.state.activeSourceIndex = sourceIndex
    this.state.activeSourceLabel = label
    this.state.lastRoutedRacks = rackIds.slice()
    this.state.lastActionTimestamp = Date.now()
    this._updateVariables()

    for (const rackId of rackIds) {
      await this._executeRackSequence(rackId)
    }

    this.state.sequenceRunning = false
    this.logger.info('Route Source abgeschlossen', { sourceIndex })
  }

  _lookupSourceLabel(index) {
    const m = this.state.wingIndexMap
    if (!m) return ''
    const find = (arr) => arr.find(e => e.index === index)
    return (
      find(m.channels)?.label ||
      find(m.buses)?.label ||
      find(m.mains)?.label ||
      find(m.matrices)?.label ||
      ''
    )
  }

  async _executeRackSequence(rackId) {
    const rack = this.state.rackMidiMap?.racks?.[rackId]
    if (!rack) {
      this.logger.warn('Rack nicht gefunden', { rackId })
      return
    }
    if (!rack.enabled) {
      this.logger.debug('Rack disabled – übersprungen', { rackId })
      return
    }
    this.logger.info('Starte Rack Sequenz', { rackId, steps: rack.midiSteps.length })
    for (const step of rack.midiSteps) {
      try {
        this._sendMidiStep(step)
      } catch (e) {
        this.logger.error('MIDI Step Fehler', { rackId, error: e.message })
        this.state.failedStepsTotal++
        this._updateVariables()
      }
      // Delay nach dem Senden
      if (step.delay > 0) await this._wait(step.delay)
    }
    this.logger.info('Rack Sequenz fertig', { rackId })
  }

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  _sendMidiStep(step) {
    // Placeholder: tatsächliche MIDI-sende-API muss in Companion genutzt werden
    let bytes = []
    const ch = step.channel - 1
    switch (step.type) {
      case 'cc':
        bytes = [0xB0 + ch, step.controller, step.value]
        break
      case 'noteon':
        bytes = [0x90 + ch, step.note, step.value]
        break
      case 'program':
        bytes = [0xC0 + ch, step.program]
        break
    }
    if (!this.config.midiDeviceId) {
      // Fallback stumm (laut Spezifikation) & UI Fehler (hier nur Log)
      this.logger.warn('Kein MIDI Gerät konfiguriert – Step stumm', { step })
      return
    }
    // Senden (hier nur Simulation)
    this.logger.info('MIDI Step gesendet', { type: step.type })
    this.logger.debug('MIDI Raw', { bytes })
  }

  // ------------------------- Feedbacks -------------------------
  _setupFeedbacks() {
    // Exemplarische Definition
    this.feedbacks = {
      active_source: {
        name: 'Aktive Quelle',
        description: 'Färbt Button für aktive Quelle',
        options: [
          { id: 'sourceIndex', type: 'number', label: 'Source Index' },
        ],
      },
      rack_last_used: {
        name: 'Rack zuletzt benutzt',
        description: 'Zeigt ob Rack in letzter Sequenz enthalten war',
        options: [
          { id: 'rackId', type: 'number', label: 'Rack ID' },
        ],
      },
    }
  }

  evaluateFeedback(id, options) {
    if (id === 'active_source') {
      return options.sourceIndex === this.state.activeSourceIndex
    } else if (id === 'rack_last_used') {
      return this.state.lastRoutedRacks.includes(options.rackId)
    }
    return false
  }

  // ------------------------- Presets -------------------------
  _setupPresets() {
    const sourceChoices = this._buildSourceChoices()
    this.presets = []
    // Quelle Buttons
    for (const c of sourceChoices) {
      this.presets.push({
        type: 'button',
        category: 'Quellen',
        name: `Route ${c.label}`,
        style: {
          text: c.label,
          size: 'auto',
          color: 'white',
          bgcolor: 'darkgrey',
        },
        actions: [
          { actionId: 'route_source', options: { sourceIndex: c.id } },
        ],
        feedbacks: [
          { feedbackId: 'active_source', options: { sourceIndex: c.id }, style: { bgcolor: 'green', color: 'white' } },
        ],
      })
    }
    // Reload JSON Button
    this.presets.push({
      type: 'button',
      category: 'System',
      name: 'Reload JSON',
      style: { text: 'Reload JSON', size: 'auto', color: 'white', bgcolor: 'blue' },
      actions: [ { actionId: 'reload_json' } ],
    })
    // Leeres Routing Button
    this.presets.push({
      type: 'button',
      category: 'System',
      name: 'Empty Routing',
      style: { text: 'Empty Routing', size: 'auto', color: 'white', bgcolor: 'orange' },
      actions: [ { actionId: 'empty_routing' } ],
    })
  }
}

module.exports = { WavesSuperRackRouterInstance }
