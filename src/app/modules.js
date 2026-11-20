/* ================= Module der App ================= */
/* Die eine Stelle, an der steht, welche Module die App anbietet. */
import {createRegistry} from '../core/registry.js';
import {jazzy} from '../chords/jazzy.js';
import {jazzyBeats} from '../styles/jazzy-beats.js';

const registry=createRegistry({
  chords:[jazzy],
  styles:[jazzyBeats]
});

export {registry};
