/* ================= Module der App ================= */
/* Die eine Stelle, an der steht, welche Module die App anbietet. */
import {createRegistry} from '../core/registry.js';
import {jazzy} from '../chords/jazzy.js';
import {jazzyBeats} from '../styles/jazzy-beats.js';
import {deepHouse} from '../styles/deep-house.js';
import {rhodes} from '../instruments/rhodes.js';
import {bass} from '../instruments/bass.js';
import {drums} from '../instruments/drums.js';
import {synth} from '../instruments/synth.js';
import {riser} from '../instruments/riser.js';
import {filter} from '../effects/filter.js';
import {tremolo} from '../effects/tremolo.js';
import {reverb} from '../effects/reverb.js';
import {compressor} from '../effects/compressor.js';
import {delay} from '../effects/delay.js';
import {ducker} from '../effects/ducker.js';

const registry=createRegistry({
  chords:[jazzy],
  styles:[jazzyBeats,deepHouse],
  instruments:[rhodes,bass,drums,synth,riser],
  effects:[filter,tremolo,reverb,compressor,delay,ducker]
});

export {registry};
