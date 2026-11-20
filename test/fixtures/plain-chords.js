// Ein zweiter, bewusst schlichter Akkord-Generator. Er beweist, dass die Schnittstelle nicht auf Jazzy
// zugeschnitten ist: Dreiklänge statt Septakkorde, ungleiche Längen, keine Lage, keine Beschriftung, kein update.
// Er gehört nur zu den Tests und steht nicht in der App.
const SCALE = { dur: [0, 2, 4, 5, 7, 9, 11], moll: [0, 2, 3, 5, 7, 8, 10] };
const CADENCES = [[0, 3, 4, 0], [0, 5, 3, 4], [0, 4, 5, 3], [1, 4, 0]];

const plain = {
  id: 'plain',
  name: 'Schlicht',
  version: 1,
  params: [{ id: 'long', name: 'Langer Schluss', type: 'bool', default: false }],
  generate(params, ctx) {
    const scale = SCALE[ctx.mode], degrees = CADENCES[Math.floor(ctx.rnd() * CADENCES.length)];
    return {
      format: 'blueseven.chords', version: 1, key: ctx.key, mode: ctx.mode,
      generator: { id: 'plain', version: 1, params },
      chords: degrees.map((d, i) => {
        const third = (scale[(d + 2) % 7] - scale[d] + 12) % 12, fifth = (scale[(d + 4) % 7] - scale[d] + 12) % 12;
        return { root: (ctx.key + scale[d]) % 12, tones: [0, third, fifth], duration: params.long && i === degrees.length - 1 ? 8 : 4 };
      }),
    };
  },
};

export { plain };
