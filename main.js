// Kopf von main.js (ersetzen / vor bestehendem Code einfügen)
console.info('[BOOT] Datei wird geladen')

function safeRequire(mod, stub) {
    try {
        const r = require(mod)
        console.info('[BOOT] require OK:', mod)
        return r
    } catch (e) {
        console.error('[BOOT][FATAL] require FEHLER:', mod, e)
        return stub
    }
}

function _mkdirSafe(p) {
    try {
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
    } catch (e) {
        console.error('[BOOT][FATAL] mkdir Fehler', p, e.message)
    }
}

const { InstanceBase, runEntrypoint, InstanceStatus } = safeRequire('@companion-module/base', {
    InstanceBase: class {},
    runEntrypoint: () => console.info('[BOOT] Stub runEntrypoint ausgeführt'),
    InstanceStatus: { Ok: 'ok', Error: 'error' },
})

// Ab hier wie zuvor:
const UpgradeScripts = safeRequire('./upgrades', {})
const UpdateActions = safeRequire('./actions', () => {})
const UpdateFeedbacks = safeRequire('./feedbacks', () => {})
const UpdateVariableDefinitions = safeRequire('./variables', () => {})

console.info('[BOOT] Nach allen requires')

process.on('uncaughtException', (e) => {
    console.error('[FATAL] UncaughtException', e)
})
process.on('unhandledRejection', (e) => {
    console.error('[FATAL] UnhandledRejection', e)
})
process.on('beforeExit', (code) => {
    console.error('[EXIT] beforeExit code', code)
})
process.on('exit', (code) => {
    console.error('[EXIT] exit code', code)
})
process.on('SIGINT', () => {
    console.error('[EXIT] SIGINT')
})

let EasyMidi = null
try { EasyMidi = require('easymidi') } catch { /* optional */ }

const FS_PERSIST = false

class ModuleInstance extends InstanceBase {
    constructor(internal) {
        super(internal)
        this.state = {
            wingIndexMap: null,
            routingMatrix: { matrix: {} },
            rackMidiMap: { racks: {} },
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
        this.midiOutputName = ''
        this.midiOut = null
        this._jsonCacheText = { wing: '', routing: '', midi: '' }
    }

    async init(config) {
        this.config = config
        this._applyConfig()
        await this._loadAllJsonFromConfig()
        this._openMidi()
        this.updateStatus(InstanceStatus.Ok)
        try { this.updateActions() } catch {}
        try { this.updateFeedbacks() } catch {}
        try { this.updateVariableDefinitions() } catch {}
        try { this._buildPresets() } catch {}
    }

	// When module gets deleted
	async destroy() {
		this.log('debug', 'destroy')
		if (this.midiOut) {
			try { this.midiOut.close() } catch {}
			this.midiOut = null
		}
	}

    async configUpdated(config) {
        this.config = config
        this._applyConfig()
        await this._loadAllJsonFromConfig()
        this._openMidi()
        try { this.updateActions() } catch {}
        try { this.updateFeedbacks() } catch {}
        try { this.updateVariableDefinitions() } catch {}
        try { this._buildPresets() } catch {}
    }

	// Return config fields for web config
    getConfigFields() {
        return [
            { type: 'static-text', id: 'info', label: 'Info', value: 'Schreibloser Modus – Daten nur in diesen Feldern persistent.' },
            {
                type: 'dropdown',
                id: 'logLevel',
                label: 'Log Level',
                choices: [
                    { id: 'error', label: 'error' },
                    { id: 'warn', label: 'warn' },
                    { id: 'info', label: 'info' },
                    { id: 'debug', label: 'debug' },
                ],
                default: 'info',
            },
            {
                type: 'dropdown',
                id: 'maxRacks',
                label: 'Max Racks',
                choices: [
                    { id: 64, label: '64' },
                    { id: 32, label: '32' },
                    { id: 16, label: '16' },
                    { id: 8, label: '8' },
                    { id: 4, label: '4' },
                ],
                default: 64,
            },
            { type: 'textinput', id: 'midiOutput', label: 'MIDI Output Name', width: 8 },
            { type: 'textinput', id: 'wingJsonText', label: 'wing-index-map.json', width: 12, default: this._jsonCacheText.wing || '', multiline: true },
            { type: 'textinput', id: 'routingJsonText', label: 'routing-matrix.json', width: 12, default: this._jsonCacheText.routing || '', multiline: true },
            { type: 'textinput', id: 'midiJsonText', label: 'superrack-midi-map.json', width: 12, default: this._jsonCacheText.midi || '', multiline: true },
        ]
    }

    _applyConfig() {
        this.logLevel = this.config?.logLevel || 'info'
        const mr = parseInt(this.config?.maxRacks, 10)
        if ([64, 32, 16, 8, 4].includes(mr)) this.state.maxRacks = mr
        this.midiOutputName = this.config?.midiOutput || ''
        if (this.config?.wingJsonText) this._jsonCacheText.wing = this.config.wingJsonText
        if (this.config?.routingJsonText) this._jsonCacheText.routing = this.config.routingJsonText
        if (this.config?.midiJsonText) this._jsonCacheText.midi = this.config.midiJsonText
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
        this._parseJsonField('wing', this._validateWingIndexMap, { channels: [], buses: [], mains: [], matrices: [] })
        this._parseJsonField('routing', this._validateRoutingMatrix, { matrix: {} })
        this._parseJsonField('midi', this._validateRackMidiMap, { racks: {} })
    }

    _parseJsonField(kind, validateFn, defaults) {
        const raw = this._jsonCacheText[kind] || ''
        let parsed = defaults
        if (raw.trim()) {
            try {
                const j = JSON.parse(raw)
                if (validateFn(j)) parsed = j
            } catch {}
        }
        if (kind === 'wing') this.state.wingIndexMap = parsed
        else if (kind === 'routing') this.state.routingMatrix = parsed
        else if (kind === 'midi') this.state.rackMidiMap = parsed
    }

    applyJson(kind, text) {
        try {
            const obj = JSON.parse(text)
            let valid = false
            if (kind === 'wing') valid = this._validateWingIndexMap(obj)
            else if (kind === 'routing') valid = this._validateRoutingMatrix(obj)
            else if (kind === 'midi') valid = this._validateRackMidiMap(obj)
            if (!valid) { this._log('warn', 'Apply JSON ungültig', { kind }); return false }

            if (kind === 'wing') this.state.wingIndexMap = obj
            else if (kind === 'routing') this.state.routingMatrix = obj
            else if (kind === 'midi') this.state.rackMidiMap = obj

            this._jsonCacheText[kind] = text
            if (this.config) {
                if (kind === 'wing') this.config.wingJsonText = text
                else if (kind === 'routing') this.config.routingJsonText = text
                else if (kind === 'midi') this.config.midiJsonText = text
                if (typeof this.saveConfig === 'function') { try { this.saveConfig() } catch {} }
            }
            this._log('info', 'JSON angewendet', { kind })
            if (kind === 'wing') { this.updateActions(); this._buildPresets() }
            return true
        } catch (e) {
            this._log('error', 'Apply JSON Fehler', { kind, error: e.message })
            return false
        }
    }

    resetRackSteps(rackId) {
        const rack = this.state.rackMidiMap?.racks?.[rackId]
        if (!rack) { this._log('warn', 'resetRackSteps Rack nicht gefunden', { rackId }); return }
        rack.midiSteps = []
        this._jsonCacheText.midi = JSON.stringify(this.state.rackMidiMap, null, 2)
        if (this.config) {
            this.config.midiJsonText = this._jsonCacheText.midi
            if (typeof this.saveConfig === 'function') { try { this.saveConfig() } catch {} }
        }
        this._log('info', 'Rack Steps geleert', { rackId })
    }

	async _loadAllJson() {
		await this._loadJson('wing', (j)=> this._validateWingIndexMap(j))
		await this._loadJson('routing', (j)=> this._validateRoutingMatrix(j))
		await this._loadJson('midi', (j)=> this._validateRackMidiMap(j))
	}
    async _loadJson(kind, validateFn) {
        try {
            const p = this._dataDirPath(this.jsonFiles[kind])
            if (!fs.existsSync(p)) {
                let def
                if (kind === 'wing') def = { channels: [], buses: [], mains: [], matrices: [] }
                else if (kind === 'routing') def = { matrix: {} }
                else if (kind === 'midi') def = { racks: {} }
            }

            let raw

            let json

            if (validateFn(json)) {
                if (kind === 'wing') this.state.wingIndexMap = json
                else if (kind === 'routing') this.state.routingMatrix = json
                else if (kind === 'midi') this.state.rackMidiMap = json
                this._jsonCacheText[kind] = raw
                this._log('info', 'JSON geladen', { kind })
            } else {
                this._log('warn', 'JSON ungültig', { kind })
            }
        } catch (e) {
            this._log('error', 'Load JSON Fehler', { kind, error: e.message })
        }
    }
	_validateWingIndexMap(obj) {
		if (!obj) return false
		if (!Array.isArray(obj.channels)||!Array.isArray(obj.buses)||!Array.isArray(obj.mains)||!Array.isArray(obj.matrices)) return false
		const used = new Set()
		const checkArr = (arr)=> arr.every(e=> e && typeof e.index==='number' && typeof e.label==='string' && !used.has(e.index) && used.add(e.index))
		return checkArr(obj.channels)&&checkArr(obj.buses)&&checkArr(obj.mains)&&checkArr(obj.matrices)
	}
	_validateRoutingMatrix(obj) {
		if (!obj||typeof obj!=='object'||!obj.matrix||typeof obj.matrix!=='object') return false
		for (const [k,v] of Object.entries(obj.matrix)) {
			if (!/^\d+$/.test(k)) return false
			if (!Array.isArray(v)) return false
			const seen = new Set()
			for (const r of v) { if (typeof r!=='number'||r<1||r>this.state.maxRacks||seen.has(r)) return false; seen.add(r) }
		}
		return true
	}
	_validateRackMidiMap(obj) {
		if (!obj||typeof obj!=='object'||!obj.racks) return false
		for (const [rackId,rack] of Object.entries(obj.racks)) {
			if (!/^\d+$/.test(rackId)) return false
			if (!rack||typeof rack!=='object'||typeof rack.name!=='string'||typeof rack.enabled!=='boolean'||!Array.isArray(rack.midiSteps)) return false
			if (rack.midiSteps.length>1000) return false
			for (const step of rack.midiSteps) {
				if (!['cc','noteon','program'].includes(step.type)) return false
				if (typeof step.channel!=='number'||step.channel<1||step.channel>16) return false
				if (typeof step.delay!=='number'||step.delay<0) return false
				if (step.type==='cc') { if (typeof step.controller!=='number'||step.controller<0||step.controller>127) return false; if (typeof step.value!=='number'||step.value<0||step.value>127) return false }
				if (step.type==='noteon') { if (typeof step.note!=='number'||step.note<0||step.note>127) return false; if (typeof step.value!=='number'||step.value<0||step.value>127) return false }
				if (step.type==='program') { if (typeof step.program!=='number'||step.program<0||step.program>127) return false }
			}
		}
		return true
	}

	updateActions() { UpdateActions(this) }
	updateFeedbacks() { UpdateFeedbacks(this) }
	updateVariableDefinitions() { UpdateVariableDefinitions(this) }

	_updateVariables() {
		this.setVariableValues({
			active_source_index: this.state.activeSourceIndex ?? '',
			active_source_label: this.state.activeSourceLabel ?? '',
			last_routed_racks: this.state.lastRoutedRacks.join(','),
			last_action_timestamp: this.state.lastActionTimestamp,
			failed_steps_total: this.state.failedStepsTotal,
		})
	}
	_buildSourceChoices() {
		const res = []
		const m = this.state.wingIndexMap
		if (!m) return res
		const pushArr = (arr)=> { for (const e of arr) res.push({ id: e.index, label: e.label }) }
		pushArr(m.channels); pushArr(m.buses); pushArr(m.mains); pushArr(m.matrices)
		return res
	}
	_buildRackChoices() {
		const racks = this.state.rackMidiMap?.racks || {}
		return Object.keys(racks).map(r=> ({ id: parseInt(r,10), label: `Rack ${r}` }))
	}
	_lookupSourceLabel(index) {
		const m = this.state.wingIndexMap; if (!m) return ''
		const find = (arr)=> arr.find(e=> e.index===index)
		return find(m.channels)?.label || find(m.buses)?.label || find(m.mains)?.label || find(m.matrices)?.label || ''
	}
	async routeSource(sourceIndex) {
		if (sourceIndex == null) { this._log('warn','routeSource ohne Index'); return }
		if (this.state.sequenceRunning) { this._log('warn','Sequenz läuft – neue Source verworfen',{sourceIndex}); return }
		const matrix = this.state.routingMatrix?.matrix || {}
		const rackIds = matrix[String(sourceIndex)] || []
		this.state.sequenceRunning = true
		this.state.sequenceStartTs = Date.now()
		this.state.activeSourceIndex = sourceIndex
		this.state.activeSourceLabel = this._lookupSourceLabel(sourceIndex)
		this.state.lastRoutedRacks = rackIds.slice()
		this.state.lastActionTimestamp = Date.now()
		this._updateVariables()
		this._log('info','Route Source gestartet',{sourceIndex,rackIds})
		let aborted = false
		for (const rackId of rackIds) {
			if (Date.now() - this.state.sequenceStartTs > this.state.sequenceTimeoutMs) { aborted = true; break }
			await this._executeRackSequence(rackId)
		}
		if (aborted) { this._log('error','Sequenz Timeout – abgebrochen'); this.state.failedStepsTotal++; this._updateVariables() }
		this.state.sequenceRunning = false
		if (!aborted) this._log('info','Route Source abgeschlossen',{sourceIndex})
	}
	async routeRack(rackId) {
		if (rackId == null) { this._log('warn','routeRack ohne RackId'); return }
		if (this.state.sequenceRunning) { this._log('warn','Sequenz läuft – Rack verworfen',{rackId}); return }
		this.state.sequenceRunning = true
		this.state.sequenceStartTs = Date.now()
		this.state.lastRoutedRacks = [rackId]
		this.state.lastActionTimestamp = Date.now()
		this._updateVariables()
		await this._executeRackSequence(rackId)
		this.state.sequenceRunning = false
		this._log('info','routeRack fertig',{rackId})
	}
	async _executeRackSequence(rackId) {
		const rack = this.state.rackMidiMap?.racks?.[rackId]
		if (!rack) { this._log('warn','Rack nicht gefunden',{rackId}); return }
		if (!rack.enabled) { this._log('debug','Rack disabled',{rackId}); return }
		this._log('info','Rack Sequenz start',{rackId, steps: rack.midiSteps.length})
		for (const step of rack.midiSteps) {
			if (Date.now() - this.state.sequenceStartTs > this.state.sequenceTimeoutMs) { this._log('error','Timeout während Rack Sequenz',{rackId}); this.state.failedStepsTotal++; this._updateVariables(); return }
			try { this._sendMidiStep(step) } catch(e) { this._log('error','MIDI Step Fehler',{rackId,error:e.message}); this.state.failedStepsTotal++; this._updateVariables() }
			if (step.delay>0) await new Promise(res=> setTimeout(res, step.delay))
		}
		this._log('info','Rack Sequenz Ende',{rackId})
	}
	_sendMidiStep(step) {
		if (!this.midiOut) { this._log('warn','Kein MIDI Output geöffnet – Step stumm',{step}) ; return }
		const ch = step.channel - 1
		let bytes
		if (step.type==='cc') bytes = [0xB0 + ch, step.controller, step.value]
		else if (step.type==='noteon') bytes = [0x90 + ch, step.note, step.value]
		else if (step.type==='program') bytes = [0xC0 + ch, step.program]
		if (step.type==='program' && step.value !== undefined) this._log('debug','Program value vorhanden',{value: step.value})
		try {
			if (step.type==='cc') this.midiOut.send('cc', { channel: ch, controller: step.controller, value: step.value })
			else if (step.type==='noteon') this.midiOut.send('noteon', { channel: ch, note: step.note, velocity: step.value })
			else if (step.type==='program') this.midiOut.send('program', { channel: ch, number: step.program })
			this._log('debug','MIDI gesendet',{type: step.type, bytes})
		} catch(e) { throw e }
	}
	_openMidi() {
		if (!EasyMidi) { this._log('warn','easymidi nicht verfügbar'); return }
		if (this.midiOut) { try { this.midiOut.close() } catch{} this.midiOut = null }
		if (!this.midiOutputName) return
		try { this.midiOut = new EasyMidi.Output(this.midiOutputName, false); this._log('info','MIDI Output geöffnet',{name:this.midiOutputName}) } catch(e) { this._log('error','MIDI Output Fehler',{error:e.message}) }
	}

	_buildPresets() {
		const presets = []
		const srcChoices = this._buildSourceChoices()
		for (const c of srcChoices) {
			presets.push({
				type: 'button', category: 'Quellen', name: `Route ${c.label}`,
				style: { text: c.label, size: 'auto', color: 'white', bgcolor: 'darkgrey' },
				actions: [{ actionId: 'route_source', options: { sourceIndex: c.id } }],
				feedbacks: [{ feedbackId: 'active_source', options: { sourceIndex: c.id }, style: { bgcolor: 'green', color: 'white' } }],
			})
		}
		presets.push({ type: 'button', category: 'System', name: 'Reload JSON', style: { text: 'Reload JSON', size: 'auto', color: 'white', bgcolor: 'blue' }, actions: [{ actionId: 'reload_json' }] })
		presets.push({ type: 'button', category: 'System', name: 'Empty Routing', style: { text: 'Empty Routing', size: 'auto', color: 'white', bgcolor: 'orange' }, actions: [{ actionId: 'empty_routing' }] })
		const rackChoices = this._buildRackChoices()
		for (const r of rackChoices) {
			presets.push({ type: 'button', category: 'Racks', name: `Rack ${r.id}`, style: { text: `Rack ${r.id}`, size: 'auto', color: 'white', bgcolor: 'darkgrey' }, actions: [{ actionId: 'route_rack', options: { rackId: r.id } }], feedbacks: [{ feedbackId: 'rack_last_used', options: { rackId: r.id }, style: { bgcolor: 'purple', color: 'white' } }] })
		}
		this.setPresetDefinitions(presets)
	}
}

console.info('[BOOT] runEntrypoint vor Aufruf')
try {
    runEntrypoint(ModuleInstance, UpgradeScripts)
    console.info('[BOOT] runEntrypoint aufgerufen')
} catch (e) {
    console.error('[BOOT][FATAL] runEntrypoint Fehler', e)
}
