// Ein nachgebauter AudioContext für Tests in Node. Er erzeugt keinen Ton, merkt sich aber alles, was die Engine
// mit ihm macht: welche Knoten angelegt und wie sie verbunden werden, alle Aufrufe auf AudioParams und wann
// Quellen starten und stoppen. Die Zeit (currentTime) stellt der Test selbst weiter.

class FakeParam {
  constructor(ctx, value) { this.ctx = ctx; this.value = value; this.calls = []; this.inputs = []; }
  log(name, args) { this.calls.push([name, ...args]); return this; }
  setValueAtTime(v, t) { return this.log('set', [v, t]); }
  linearRampToValueAtTime(v, t) { return this.log('linear', [v, t]); }
  exponentialRampToValueAtTime(v, t) { return this.log('exp', [v, t]); }
  setTargetAtTime(v, t, c) { return this.log('target', [v, t, c]); }
  cancelScheduledValues(t) { return this.log('cancel', [t]); }
  // Der Wert, auf den der Parameter am Ende hinläuft: der letzte Zielwert, sonst value.
  final() {
    for (let i = this.calls.length - 1; i >= 0; i--) if (this.calls[i][0] !== 'cancel') return this.calls[i][1];
    return this.value;
  }
}

class FakeNode {
  constructor(ctx, kind) { this.ctx = ctx; this.kind = kind; this.outputs = []; this.disconnected = false; ctx.nodes.push(this); }
  connect(dest) {
    if (!dest || !(dest instanceof FakeNode || dest instanceof FakeParam)) throw new Error(`${this.kind}.connect: kein Knoten`);
    this.outputs.push(dest);
    if (dest instanceof FakeParam) dest.inputs.push(this);
    return dest;
  }
  disconnect() { this.outputs = []; this.disconnected = true; }
}
class FakeSource extends FakeNode {
  start(t, offset) {
    if (this.startTime !== undefined) throw new Error(`${this.kind}: start zweimal`);
    this.startTime = t === undefined ? this.ctx.currentTime : t;
    this.ctx.events.push({ kind: this.kind, node: this, t: this.startTime, offset });
  }
  stop(t) {
    if (this.startTime === undefined) throw new Error(`${this.kind}: stop vor start`);
    this.stopTime = t === undefined ? this.ctx.currentTime : t;
    this.stops = (this.stops || 0) + 1;
  }
}

class FakeAudioContext {
  constructor(opts) {
    this.options = opts; this.currentTime = 0; this.sampleRate = 48000; this.state = 'suspended';
    this.outputLatency = 0; this.baseLatency = 0;
    this.nodes = []; this.events = [];
    this.destination = new FakeNode(this, 'destination');
    FakeAudioContext.instances.push(this);
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  createGain() { const n = new FakeNode(this, 'gain'); n.gain = new FakeParam(this, 1); return n; }
  createBiquadFilter() {
    const n = new FakeNode(this, 'filter'); n.type = 'lowpass';
    n.frequency = new FakeParam(this, 350); n.Q = new FakeParam(this, 1); return n;
  }
  createStereoPanner() { const n = new FakeNode(this, 'panner'); n.pan = new FakeParam(this, 0); return n; }
  createConvolver() { const n = new FakeNode(this, 'convolver'); n.buffer = null; return n; }
  createDynamicsCompressor() {
    const n = new FakeNode(this, 'compressor');
    n.threshold = new FakeParam(this, -24); n.knee = new FakeParam(this, 30); n.ratio = new FakeParam(this, 12); return n;
  }
  createDelay() { const n = new FakeNode(this, 'delay'); n.delayTime = new FakeParam(this, 0); return n; }
  createOscillator() {
    const n = new FakeSource(this, 'osc'); n.type = 'sine';
    n.frequency = new FakeParam(this, 440); n.detune = new FakeParam(this, 0); return n;
  }
  createBufferSource() { const n = new FakeSource(this, 'buffer'); n.buffer = null; return n; }
  createBuffer(channels, length, sampleRate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, getChannelData: c => data[c] };
  }
}
FakeAudioContext.instances = [];

// Zeitgeber zum Weiterstellen von Hand: Intervalle und Timeouts laufen erst, wenn der Test advance() aufruft.
function createClock(ctxRef) {
  let id = 0, now = 0;
  const jobs = new Map();
  const clock = {
    setInterval: (f, ms) => { jobs.set(++id, { f, ms, at: now + ms, every: true }); return id; },
    clearInterval: i => jobs.delete(i),
    setTimeout: (f, ms) => { jobs.set(++id, { f, ms, at: now + ms, every: false }); return id; },
    clearTimeout: i => jobs.delete(i),
    // Stellt Uhr und currentTime um ms weiter und lässt alles laufen, was dabei fällig wird.
    advance(ms) {
      const end = now + ms;
      for (;;) {
        let next = null;
        for (const [k, j] of jobs) if (j.at <= end && (!next || j.at < next[1].at)) next = [k, j];
        if (!next) break;
        const [k, j] = next;
        now = j.at; if (ctxRef()) ctxRef().currentTime = now / 1000;
        if (j.every) j.at += j.ms; else jobs.delete(k);
        j.f();
      }
      now = end; if (ctxRef()) ctxRef().currentTime = now / 1000;
    },
    pending: () => jobs.size,
  };
  return clock;
}

// Summe der Verstärkung über alle Wege von node bis zum Knoten to (Standard: der Ausgang). Gain-Knoten zählen
// mit ihrem Endwert, alle anderen Knoten mit 1. Wege durch Knoten einer Art aus skip zählen nicht mit, zum
// Beispiel 'convolver' für den Weg ohne Hall. Verbindungen auf AudioParams sind Modulation und zählen nicht.
function pathGain(node, to = null, skip = [], seen = new Set()) {
  if (to ? node === to : node.kind === 'destination') return 1;
  if (skip.includes(node.kind)) return 0;
  if (seen.has(node)) throw new Error('Schleife im Signalweg');
  const own = node.kind === 'gain' ? node.gain.final() : 1;
  let sum = 0;
  for (const o of node.outputs) if (o instanceof FakeNode) sum += pathGain(o, to, skip, new Set([...seen, node]));
  return own * sum;
}

export { FakeAudioContext, FakeParam, FakeNode, createClock, pathGain };
