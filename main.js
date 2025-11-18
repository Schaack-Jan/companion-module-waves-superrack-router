const {InstanceBase, runEntrypoint, InstanceStatus} = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')
const superrackMidiMap = require('./superrack-midi-map.json')

class ModuleInstance extends InstanceBase {
    constructor(internal) {
        super(internal)
        this.state = {
            routingMatrix: {matrix: {}},
            rackMidiMap: {racks: {}},
            activeSourceIndex: null,
            activeSourceLabel: '',
            lastRoutedRacks: [],
            lastActionTimestamp: 0,
            failedStepsTotal: 0,
            sequenceRunning: false,
            maxRacks: 64,
            sequenceStartTs: 0,
            sequenceTimeoutMs: 1000,
        }
        this.logLevel = 'info'
        this._json = {routing: '', midi: ''}
    }

    async init(config) {
        this.config = config
        this._applyConfig()
        await this._loadAllJsonFromConfig()
        this.updateStatus(InstanceStatus.Ok)
        this.updateActions()
        this.updateFeedbacks()
        this.updateVariableDefinitions()
    }

    async destroy() {
        this.log('debug', 'destroy')
        // Keine eigene Schließung nötig, Connection wird von Companion verwaltet
    }

    async configUpdated(config) {
        this.config = config
        this._applyConfig()
        await this._loadAllJsonFromConfig()
        try {
            this.updateActions()
        } catch {
        }
        try {
            this.updateFeedbacks()
        } catch {
        }
        try {
            this.updateVariableDefinitions()
        } catch {
        }
    }

    getConfigFields() {
        const fields =  [
            {
                type: 'static-text',
                id: 'info_intro',
                label: 'Info',
                value:
                    'Dieses Modul eröffnet keine eigene MIDI-Verbindung. Lege zusätzlich eine Generic-MIDI Instanz an und verwende dort Aktionen (CC / Note / Program) mit den unten genannten Variablen.'
            },
            {
                type: 'dropdown',
                id: 'logLevel',
                label: 'Log Level',
                choices: [
                    {id: 'error', label: 'error'},
                    {id: 'warn', label: 'warn'},
                    {id: 'info', label: 'info'},
                    {id: 'debug', label: 'debug'},
                ],
                default: this.logLevel || 'info',
            },
            {
                type: 'dropdown',
                id: 'maxRacks',
                label: 'Rack Configuration',
                choices: [
                    {id: 64, label: '64'},
                    {id: 32, label: '32'},
                    {id: 16, label: '16'},
                    {id: 8, label: '8'},
                    {id: 4, label: '4'},
                ],
                default: this.state.maxRacks || 64,
            },
            {
                type: 'textinput',
                id: 'midiMap',
                label: 'superrack-midi-map.json',
                width: 12,
                default: this._json.midi ? this._json.midi : JSON.stringify(superrackMidiMap),
                multiline: true,
            },
        ]

        // Dynamisch Felder für Rack-Kanal-Indizes hinzufügen
        const maxRacks = parseInt(this.config?.maxRacks, 10) || this.state.maxRacks || 64
        for (let i = 1; i <= maxRacks; i++) {
            const key = `rack_channel_index_${i}`
            if (!this.config[key] || this.config[key] === '') {
                this.config[key] = `${i}`
            }

            fields.push({
                type: 'textinput',
                id: key,
                label: `Kanal Index für Rack ${i}`,
                width: 3,
                value: this.config?.[key] ?? `${i}`,
            })
        }

        return fields
    }

    _applyConfig() {
        this.logLevel = this.config?.logLevel || 'error'
        const mr = parseInt(this.config?.maxRacks, 10)
        if ([64, 32, 16, 8, 4].includes(mr)) this.state.maxRacks = mr

        if (this.config?.midiMap) {
            if (!this._json.midi) {
                this._json.midi = JSON.stringify(superrackMidiMap)
            } else {
                this._json.midi = this.config.midiMap
            }
        } else {
            this._json.midi = JSON.stringify(superrackMidiMap)
            this.config.midiMap = JSON.stringify(superrackMidiMap)
        }
    }

    _sendMidiStep(step) {
        // Statt direkt zu senden: Variablen setzen, von Generic-MIDI aus nutzbar
        const ch = step.channel
        let controller = ''
        let value = ''
        let status = ''
        if (step.type === 'cc') {
            status = 'cc'
            controller = String(step.controller)
            value = String(step.value)
        } else if (step.type === 'noteon') {
            status = 'noteon'
            controller = String(step.note)
            value = String(step.value)
        } else if (step.type === 'program') {
            status = 'program'
            controller = String(step.program)
            value = ''
        } else {
            this._log('warn', 'Unbekannter MIDI Typ', {type: step.type})
            return
        }
        this.setVariableValues({
            midi_last_type: status,
            midi_last_channel: ch,
            midi_last_controller: controller,
            midi_last_value: value,
            last_action_timestamp: Date.now()
        })
        this._log('debug', 'MIDI Step vorbereitet', {status, ch, controller, value})
        // Generic-MIDI Aktionen können jetzt die Variablen auslesen
    }

    _shouldLog(level) {
        const order = ['error', 'warn', 'info', 'debug']
        return order.indexOf(level) <= order.indexOf(this.logLevel)
    }

    _log(level, msg, data) {
        if (!this._shouldLog(level)) return
        const line = `[${level.toUpperCase()}] ${msg}` + (data ? ` ${JSON.stringify(data)}` : '')
        this.log(level === 'debug' ? 'debug' : level, line)
    }

    async _loadAllJsonFromConfig() {
        this._parseJsonField('routing', this._validateRoutingMatrix, {matrix: {}})
        this._parseJsonField('midi', this._validateRackMidiMap, {racks: {}})
    }

    _parseJsonField(kind, validateFn, defaults) {
        const raw = this._json[kind] || ''
        let parsed = defaults
        if (raw.trim()) {
            try {
                const j = JSON.parse(raw)
                if (validateFn(j)) parsed = j
            } catch {
            }
        }
        if (kind === 'routing') this.state.routingMatrix = parsed
        else if (kind === 'midi') this.state.rackMidiMap = parsed
    }

    _validateRoutingMatrix(obj) {
        if (!obj || typeof obj !== 'object' || !obj.matrix || typeof obj.matrix !== 'object') return false
        for (const [k, v] of Object.entries(obj.matrix)) {
            if (!/^\d+$/.test(k)) return false
            if (!Array.isArray(v)) return false
            const seen = new Set()
            for (const r of v) {
                if (typeof r !== 'number' || r < 1 || r > this.state.maxRacks || seen.has(r)) return false;
                seen.add(r)
            }
        }
        return true
    }

    _validateRackMidiMap(obj) {
        if (!obj || typeof obj !== 'object' || !obj.racks) return false
        for (const [rackId, rack] of Object.entries(obj.racks)) {
            if (!/^\d+$/.test(rackId)) return false
            if (!rack || typeof rack !== 'object' || typeof rack.name !== 'string' || typeof rack.enabled !== 'boolean' || !Array.isArray(rack.midiSteps)) return false
            if (rack.midiSteps.length > 1000) return false
            for (const step of rack.midiSteps) {
                if (!['cc', 'noteon', 'program'].includes(step.type)) return false
                if (typeof step.channel !== 'number' || step.channel < 1 || step.channel > 16) return false
                if (typeof step.delay !== 'number' || step.delay < 0) return false
                if (step.type === 'cc') {
                    if (typeof step.controller !== 'number' || step.controller < 0 || step.controller > 127) return false;
                    if (typeof step.value !== 'number' || step.value < 0 || step.value > 127) return false
                }
                if (step.type === 'noteon') {
                    if (typeof step.note !== 'number' || step.note < 0 || step.note > 127) return false;
                    if (typeof step.value !== 'number' || step.value < 0 || step.value > 127) return false
                }
                if (step.type === 'program') {
                    if (typeof step.program !== 'number' || step.program < 0 || step.program > 127) return false
                }
            }
        }
        return true
    }

    updateActions() {
        UpdateActions(this)
    }

    updateFeedbacks() {
        UpdateFeedbacks(this)
    }

    updateVariableDefinitions() {
        UpdateVariableDefinitions(this)
    }

    _updateVariables() {
        this.setVariableValues({
            active_source_index: this.state.activeSourceIndex ?? '',
            active_source_label: this.state.activeSourceLabel ?? '',
            last_routed_racks: this.state.lastRoutedRacks.join(','),
            last_action_timestamp: this.state.lastActionTimestamp,
            failed_steps_total: this.state.failedStepsTotal,
        })
    }

    _buildHotSnapshotChoices() {
        const racks = this.state.rackMidiMap?.racks || {}

        let firstSteps = []
        for (const rackId in racks) {
            const steps = racks[rackId]?.midiSteps
            if (Array.isArray(steps) && steps.length > 0) {
                firstSteps.push({
                    ...steps[0],
                })
            }
        }

        firstSteps = firstSteps.filter(
            (step, index, self) =>
                index === self.findIndex((s) => (s.channel === step.channel && s.controller === step.controller))
        )

        return firstSteps.map(function (step, index) {
            let label = 'Hot Snapshot - ' + (step.controller + 1)

            return {
                id: index,
                label: label,
                midi: step
            }
        })
    }

    _buildHotPluginChoices() {
        const racks = this.state.rackMidiMap?.racks || {}

        let firstSteps = []
        for (const rackId in racks) {
            const steps = racks[rackId]?.midiSteps
            if (Array.isArray(steps) && steps.length > 0) {
                firstSteps.push({
                    ...steps[1],
                })
            }
        }

        firstSteps = firstSteps.filter(
            (step, index, self) =>
                index === self.findIndex((s) => (s.channel === step.channel && s.controller === step.controller))
        )

        return firstSteps.map(function (step, index) {
            let label = 'Hot Plugin - ' + (step.controller + 1)

            return {
                id: index,
                label: label,
                midi: step
            }
        })
    }

    _buildRackChoices() {
        const racks = this.state.rackMidiMap?.racks || {}
        return Object.keys(racks).map(r => ({id: parseInt(r, 10), label: `Rack ${r}`}))
    }

    async routeSource(sourceIndex) {
        if (sourceIndex == null) {
            this._log('warn', 'routeSource ohne Index');
            return
        }
        if (this.state.sequenceRunning) {
            this._log('warn', 'Sequenz läuft – neue Source verworfen', {sourceIndex});
            return
        }
        const matrix = this.state.routingMatrix?.matrix || {}
        const rackIds = matrix[String(sourceIndex)] || []
        this.state.sequenceRunning = true
        this.state.sequenceStartTs = Date.now()
        this.state.activeSourceIndex = sourceIndex
        this.state.activeSourceLabel = this._lookupSourceLabel(sourceIndex)
        this.state.lastRoutedRacks = rackIds.slice()
        this.state.lastActionTimestamp = Date.now()
        this._updateVariables()
        this._log('info', 'Route Source gestartet', {sourceIndex, rackIds})
        let aborted = false
        for (const rackId of rackIds) {
            if (Date.now() - this.state.sequenceStartTs > this.state.sequenceTimeoutMs) {
                aborted = true;
                break
            }
            await this._executeRackSequence(rackId)
        }
        if (aborted) {
            this._log('error', 'Sequenz Timeout – abgebrochen');
            this.state.failedStepsTotal++;
            this._updateVariables()
        }
        this.state.sequenceRunning = false
        if (!aborted) this._log('info', 'Route Source abgeschlossen', {sourceIndex})
    }

    async routeRack(rackId) {
        if (rackId == null) {
            this._log('warn', 'routeRack ohne RackId');
            return
        }
        if (this.state.sequenceRunning) {
            this._log('warn', 'Sequenz läuft – Rack verworfen', {rackId});
            return
        }
        this.state.sequenceRunning = true
        this.state.sequenceStartTs = Date.now()
        this.state.lastRoutedRacks = [rackId]
        this._updateVariables()
        await this._executeRackSequence(rackId)
        this.state.sequenceRunning = false
        this._log('info', 'routeRack fertig', {rackId})
    }

    async routeSnapshot(snapshotId) {
        const hotSnapshots = this._buildHotSnapshotChoices()
        const snapshot = hotSnapshots.find(s => s.id === snapshotId)
        if (!snapshot) {
            this._log('warn', 'Hot Snapshot nicht gefunden', {snapshotId});
            return
        }
        this._sendMidiStep(snapshot.midi)
        this._log('info', 'Hot Snapshot ausführen', {snapshotId, midi: snapshot.midi})
    }

    async routePlugin(pluginId) {
        const hotPlugins = this._buildHotPluginChoices()
        const plugin = hotPlugins.find(s => s.id === pluginId)
        if (!plugin) {
            this._log('warn', 'Hot Snapshot nicht gefunden', {pluginId});
            return
        }
        this._sendMidiStep(plugin.midi)
        this._log('info', 'Hot Plugin ausführen', {pluginId, midi: plugin.midi})
    }

    async _executeRackSequence(rackId) {
        const rack = this.state.rackMidiMap?.racks?.[rackId]
        if (!rack) {
            this._log('warn', 'Rack nicht gefunden', {rackId});
            return
        }
        if (!rack.enabled) {
            this._log('debug', 'Rack disabled', {rackId});
            return
        }
        this._log('info', 'Rack Sequenz start', {rackId, steps: rack.midiSteps.length})
        for (const step of rack.midiSteps) {
            if (Date.now() - this.state.sequenceStartTs > this.state.sequenceTimeoutMs) {
                this._log('error', 'Timeout während Rack Sequenz', {rackId});
                this.state.failedStepsTotal++;
                this._updateVariables();
                return
            }
            try {
                this._sendMidiStep(step)
            } catch (e) {
                this._log('error', 'MIDI Step Fehler', {rackId, error: e.message});
                this.state.failedStepsTotal++;
                this._updateVariables()
            }
            if (step.delay > 0) await new Promise(res => setTimeout(res, step.delay))
        }
        this._log('info', 'Rack Sequenz Ende', {rackId})
    }
}

try {
    runEntrypoint(ModuleInstance, UpgradeScripts)
} catch (e) {
    console.error('[BOOT][FATAL] runEntrypoint Fehler', e)
}
