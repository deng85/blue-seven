/* ================= Formate prüfen ================= */
/* Das Format für Akkordfolgen ist die Schnittstelle zwischen Akkord-Generatoren und Stilen:

     {format:'blueseven.chords', version:1, key:0, mode:'dur',
      generator:{id:'jazzy', version:1, params:{…}},          // optional, Herkunft
      chords:[{root:0, tones:[0,4,7,11,14], duration:4,       // Pflicht
               voicing:[57,60,64,67], bass:0,                 // optional, Vorschlag für die Lage
               label:{roman:'I', root:'C', suffix:'maj9'},    // optional, nur Anzeige
               source:{…}}]}                                  // optional, versteht nur der Generator

   Musikalisch zählen nur key, mode, root, tones, duration, voicing und bass. */

import {MODES} from './notes.js';

const CHORDS_FORMAT='blueseven.chords',CHORDS_VERSION=1;
const isInt=v=>Number.isInteger(v);
const isPc=v=>isInt(v)&&v>=0&&v<=11;
const isMidi=v=>isInt(v)&&v>=0&&v<=127;
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);

// Prüft eine Akkordfolge. Liefert eine Liste verständlicher Fehler, leer heißt in Ordnung.
function checkChords(p){
  if(!isObj(p))return ['Die Akkordfolge ist kein Objekt.'];
  const errors=[];
  if(p.format!==CHORDS_FORMAT)errors.push(`Das Feld format muss „${CHORDS_FORMAT}“ sein.`);
  if(!isInt(p.version)||p.version<1)errors.push('Das Feld version muss eine ganze Zahl ab 1 sein.');
  else if(p.version>CHORDS_VERSION)errors.push(`Die Akkordfolge hat Version ${p.version}, diese App versteht nur bis Version ${CHORDS_VERSION}.`);
  if(!isPc(p.key))errors.push('Das Feld key muss eine Tonklasse von 0 bis 11 sein.');
  if(!MODES.includes(p.mode))errors.push(`Das Feld mode muss eines von ${MODES.join(', ')} sein.`);
  if(p.generator!==undefined&&(!isObj(p.generator)||typeof p.generator.id!=='string'))errors.push('Das Feld generator braucht eine id.');
  if(!Array.isArray(p.chords)||!p.chords.length){errors.push('Das Feld chords muss eine Liste mit mindestens einem Akkord sein.');return errors;}
  p.chords.forEach((c,i)=>{
    const err=msg=>errors.push(`Akkord ${i+1}: ${msg}`);
    if(!isObj(c)){err('ist kein Objekt.');return;}
    if(!isPc(c.root))err('root muss eine Tonklasse von 0 bis 11 sein.');
    if(!Array.isArray(c.tones)||c.tones.length<2||!c.tones.every(t=>isInt(t)&&t>=0&&t<=24))err('tones muss eine Liste aus mindestens zwei Halbtonabständen von 0 bis 24 sein.');
    else{
      if(c.tones[0]!==0)err('tones muss mit 0 für den Grundton beginnen.');
      if(c.tones.some((t,j)=>j>0&&t<=c.tones[j-1]))err('tones muss aufsteigend und ohne Wiederholung sein.');
    }
    if(typeof c.duration!=='number'||!Number.isFinite(c.duration)||c.duration<=0)err('duration muss eine Länge in Vierteln größer als 0 sein.');
    if(c.voicing!==undefined){
      if(!Array.isArray(c.voicing)||c.voicing.length<3||!c.voicing.every(isMidi))err('voicing muss eine Liste aus mindestens drei MIDI-Noten sein.');
      else{
        if(c.voicing.some((m,j)=>j>0&&m<=c.voicing[j-1]))err('voicing muss aufsteigend sein, tiefste Note zuerst.');
        if(isPc(c.root)&&Array.isArray(c.tones)){
          const allowed=c.tones.map(t=>(c.root+t)%12),odd=c.voicing.find(m=>!allowed.includes(m%12));
          if(odd!==undefined)err(`voicing enthält mit ${odd} einen Ton, der nicht zu root und tones gehört.`);
        }
      }
    }
    if(c.bass!==undefined&&!isPc(c.bass))err('bass muss eine Tonklasse von 0 bis 11 sein.');
    if(c.label!==undefined&&!isObj(c.label))err('label muss ein Objekt sein.');
  });
  return errors;
}

export {CHORDS_FORMAT,CHORDS_VERSION,checkChords};
