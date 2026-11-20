/* ================= Pegel ================= */
/* Die Regler der Oberfläche gehen von 0 bis 100. Im Song steht der lineare Pegel. Umgerechnet wird mit
   dem Exponenten 1,6, damit der Regler sich im unteren Bereich feiner anfühlt (wie bisher in audio.js). */
const faderToGain=v=>Math.pow(Math.min(100,Math.max(0,v))/100,1.6);
const gainToFader=g=>100*Math.pow(Math.max(0,g),1/1.6);

export {faderToGain,gainToFader};
