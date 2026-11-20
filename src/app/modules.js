/* ================= Module der App ================= */
/* Die eine Stelle, an der steht, welche Module die App anbietet. */
import {createRegistry} from '../core/registry.js';
import {jazzy} from '../chords/jazzy.js';

const registry=createRegistry({
  chords:[jazzy]
});

export {registry};
