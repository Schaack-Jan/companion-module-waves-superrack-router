// Waves SuperRack Router - Flattened entry point
const fs = require('fs')
const path = require('path')

const MAX_MIDI_STEPS_PER_RACK = 1000
const MAX_RACK_ID = 64

class WavesSuperRackRouterInstance {
  constructor(system) {
    this.module = system
    this.config = { midiDeviceId: '', debug: false }
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
    this._originalJsonText = { wing: '', routing: '', midi: '' }
    this.paths = {
      baseDir: this.module?.dataDir || path.resolve('.'),
      wing: 'wing-index-map.json',
      routing: 'routing-matrix.json',
      midi: 'superrack-midi-map.json',
    }
    this.logger = this._createLogger()
    this._init()
  }
  async _init() {
    this.logger.info('Init WavesSuperRackRouter')
    await this._loadAllJson()
    this._setupVariables()
    this._setupActions()
    this._setupFeedbacks()
    this._setupPresets()
  }
  _createLogger() {
    const inst = this
    return {
      _fmt(l,m,e){const ts=new Date().toISOString();let line=`[${ts}] [${l}] ${m}`;if(e){try{line+=' '+JSON.stringify(e)}catch{}}return line},
      info(m,e){console.log(this._fmt('INFO',m,e))},
      warn(m,e){console.warn(this._fmt('WARN',m,e))},
      error(m,e){console.error(this._fmt('ERROR',m,e))},
      debug(m,e){if(inst.config.debug) console.log(this._fmt('DEBUG',m,e))},
    }
  }
  async _loadAllJson(){await this._loadWingIndexMap();await this._loadRoutingMatrix();await this._loadRackMidiMap()}
  _readJsonFile(rel){const fp=path.isAbsolute(rel)?rel:path.join(this.paths.baseDir,rel);if(!fs.existsSync(fp)){this.logger.warn('Datei fehlt',{fp});return null}try{const txt=fs.readFileSync(fp,'utf8');return{json:JSON.parse(txt),text:txt}}catch(e){this.logger.error('Parse Fehler',{rel,error:e.message});return null}}
  _writeJsonFile(rel,obj){const fp=path.isAbsolute(rel)?rel:path.join(this.paths.baseDir,rel);try{fs.writeFileSync(fp,JSON.stringify(obj,null,2),'utf8');return true}catch(e){this.logger.error('Schreibfehler',{rel,error:e.message});return false}}
  async _loadWingIndexMap(){const r=this._readJsonFile(this.paths.wing);if(r&&this._validateWingIndexMap(r.json)){this.state.wingIndexMap=r.json;this._originalJsonText.wing=r.text}};
  async _loadRoutingMatrix(){const r=this._readJsonFile(this.paths.routing);if(r&&this._validateRoutingMatrix(r.json)){this.state.routingMatrix=r.json;this._originalJsonText.routing=r.text}};
  async _loadRackMidiMap(){const r=this._readJsonFile(this.paths.midi);if(r&&this._validateRackMidiMap(r.json)){this.state.rackMidiMap=r.json;this._originalJsonText.midi=r.text}};
  _validateWingIndexMap(o){if(!o||typeof o!=='object')return false;const{channels,buses,mains,matrices}=o; if(!Array.isArray(channels)||channels.length!==48)return false; if(!Array.isArray(buses)||buses.length!==16)return false; if(!Array.isArray(mains)||mains.length!==4)return false; if(!Array.isArray(matrices)||matrices.length!==8)return false; const used=new Set(); const chk=(arr,t)=>arr.every(e=>e&&typeof e.index==='number'&&e.type===t&&typeof e.label==='string'&&!used.has(e.index)&&used.add(e.index)); return chk(channels,'channel')&&chk(buses,'bus')&&chk(mains,'main')&&chk(matrices,'matrix')}
  _validateRoutingMatrix(o){if(!o||typeof o!=='object'||!o.matrix||typeof o.matrix!=='object')return false; for(const[k,v]of Object.entries(o.matrix)){if(!/^\d+$/.test(k))return false; if(!Array.isArray(v))return false; for(const rid of v){if(typeof rid!=='number'||rid<=0||rid>MAX_RACK_ID) return false}} return true}
  _validateRackMidiMap(o){if(!o||typeof o!=='object'||!o.racks) return false; for(const[ridStr,r]of Object.entries(o.racks)){if(!/^\d+$/.test(ridStr))return false; const rid=parseInt(ridStr,10); if(rid>MAX_RACK_ID) return false; if(!r||typeof r!=='object'||typeof r.name!=='string'||typeof r.enabled!=='boolean'||!Array.isArray(r.midiSteps)||r.midiSteps.length>MAX_MIDI_STEPS_PER_RACK) return false; for(const s of r.midiSteps){if(!s||typeof s!=='object')return false; if(!['cc','noteon','program'].includes(s.type))return false; if(typeof s.channel!=='number'||s.channel<1||s.channel>16)return false; if(typeof s.delay!=='number'||s.delay<0)return false; switch(s.type){case'cc': if(typeof s.controller!=='number'||s.controller<0||s.controller>127)return false; if(typeof s.value!=='number'||s.value<0||s.value>127)return false; break; case'noteon': if(typeof s.note!=='number'||s.note<0||s.note>127)return false; if(typeof s.value!=='number'||s.value<0||s.value>127)return false; break; case'program': if(typeof s.program!=='number'||s.program<0||s.program>127)return false; break; }}} return true}
  updateConfig(nc){this.config={...this.config,...nc}; this.logger.info('Config',this.config)}
  saveJsonFromUi(kind,text){try{const parsed=JSON.parse(text); let valid=false; if(kind==='wing')valid=this._validateWingIndexMap(parsed); else if(kind==='routing')valid=this._validateRoutingMatrix(parsed); else if(kind==='midi')valid=this._validateRackMidiMap(parsed); if(!valid) return false; this._writeJsonFile(this.paths[kind],parsed); this._originalJsonText[kind]=text; if(kind==='wing') this.state.wingIndexMap=parsed; else if(kind==='routing') this.state.routingMatrix=parsed; else if(kind==='midi') this.state.rackMidiMap=parsed; if(kind==='wing') this._setupActions(true); return true }catch(e){this.logger.error('UI JSON Fehler',{kind,error:e.message}); return false}}
  getStateSnapshot(){return JSON.parse(JSON.stringify({config:this.config,state:this.state}))}
  _setupVariables(){this.variablesDefinition=[{name:'active_source_index',label:'Aktive Quelle Index'},{name:'active_source_label',label:'Aktive Quelle Label'},{name:'last_routed_racks',label:'Zuletzt geroutete Rack IDs'},{name:'last_action_timestamp',label:'Letzter Action Zeitstempel (ms)'},{name:'failed_steps_total',label:'Anzahl fehlgeschlagene MIDI Steps gesamt'}]}
  _setVariable(n,v){this.logger.debug('Var',{n,v})}
  _updateVariables(){this._setVariable('active_source_index',this.state.activeSourceIndex??'');this._setVariable('active_source_label',this.state.activeSourceLabel??'');this._setVariable('last_routed_racks',this.state.lastRoutedRacks.join(','));this._setVariable('last_action_timestamp',this.state.lastActionTimestamp);this._setVariable('failed_steps_total',this.state.failedStepsTotal)}
  _setupActions(reload=false){const choices=this._buildSourceChoices(); this.actions={route_source:{name:'Route Quelle',options:[{id:'sourceIndex',type:'dropdown',label:'Wing Quelle',choices,default:choices[0]?.id}]},reload_json:{name:'Reload JSON'},empty_routing:{name:'Leere Routing Matrix'}}; if(reload) this.logger.info('Actions reloaded')}
  _buildSourceChoices(){const res=[]; const m=this.state.wingIndexMap; if(!m) return res; const push=(arr)=>{for(const e of arr) res.push({id:e.index,label:e.label})}; push(m.channels); push(m.buses); push(m.mains); push(m.matrices); return res}
  async executeAction(id,opt){if(id==='route_source'){await this._handleRouteSource(opt?.sourceIndex)} else if(id==='reload_json'){await this._reloadJsonAction()} else if(id==='empty_routing'){await this._emptyRoutingAction()} else this.logger.warn('Unbekannte Action',{id})}
  async _reloadJsonAction(){await this._loadAllJson(); this._setupActions(true)}
  async _emptyRoutingAction(){if(!this.state.routingMatrix) this.state.routingMatrix={matrix:{}}; else this.state.routingMatrix.matrix={}; this._writeJsonFile(this.paths.routing,this.state.routingMatrix)}
  async _handleRouteSource(src){if(src==null){this.logger.warn('Kein Source Index'); return} if(this.state.sequenceRunning){this.logger.warn('Sequenz läuft, verworfen'); return} const racks=(this.state.routingMatrix?.matrix||{})[String(src)]||[]; this.state.sequenceRunning=true; const label=this._lookupSourceLabel(src); this.state.activeSourceIndex=src; this.state.activeSourceLabel=label; this.state.lastRoutedRacks=racks.slice(); this.state.lastActionTimestamp=Date.now(); this._updateVariables(); for(const rid of racks) await this._executeRackSequence(rid); this.state.sequenceRunning=false }
  _lookupSourceLabel(idx){const m=this.state.wingIndexMap; if(!m) return ''; const f=(arr)=>arr.find(e=>e.index===idx); return f(m.channels)?.label||f(m.buses)?.label||f(m.mains)?.label||f(m.matrices)?.label||''}
  async _executeRackSequence(rid){const rack=this.state.rackMidiMap?.racks?.[rid]; if(!rack){this.logger.warn('Rack fehlt',{rid}); return} if(!rack.enabled){this.logger.debug('Rack disabled',{rid}); return} for(const step of rack.midiSteps){try{this._sendMidiStep(step)}catch(e){this.logger.error('Step Fehler',{rid,error:e.message}); this.state.failedStepsTotal++; this._updateVariables()} if(step.delay>0) await new Promise(r=>setTimeout(r,step.delay))}}
  _sendMidiStep(step){let bytes=[]; const ch=step.channel-1; switch(step.type){case'cc':bytes=[0xB0+ch,step.controller,step.value];break;case'noteon':bytes=[0x90+ch,step.note,step.value];break;case'program':bytes=[0xC0+ch,step.program];break;} if(!this.config.midiDeviceId){this.logger.warn('Kein MIDI Device, stumm'); return} this.logger.info('MIDI gesendet',{type:step.type}); this.logger.debug('RAW',{bytes})}
  _setupFeedbacks(){this.feedbacks={active_source:{name:'Aktive Quelle',options:[{id:'sourceIndex',type:'number',label:'Source Index'}]},rack_last_used:{name:'Rack zuletzt benutzt',options:[{id:'rackId',type:'number',label:'Rack ID'}]}}}
  evaluateFeedback(id,opt){if(id==='active_source') return opt.sourceIndex===this.state.activeSourceIndex; if(id==='rack_last_used') return this.state.lastRoutedRacks.includes(opt.rackId); return false}
  _setupPresets(){const choices=this._buildSourceChoices(); this.presets=[]; for(const c of choices){this.presets.push({type:'button',category:'Quellen',name:`Route ${c.label}`,style:{text:c.label,size:'auto',color:'white',bgcolor:'darkgrey'},actions:[{actionId:'route_source',options:{sourceIndex:c.id}}],feedbacks:[{feedbackId:'active_source',options:{sourceIndex:c.id},style:{bgcolor:'green',color:'white'}}]})} this.presets.push({type:'button',category:'System',name:'Reload JSON',style:{text:'Reload JSON',size:'auto',color:'white',bgcolor:'blue'},actions:[{actionId:'reload_json'}]}); this.presets.push({type:'button',category:'System',name:'Empty Routing',style:{text:'Empty Routing',size:'auto',color:'white',bgcolor:'orange'},actions:[{actionId:'empty_routing'}]})}
}

function init(system){return new WavesSuperRackRouterInstance(system)}
module.exports = { init }
