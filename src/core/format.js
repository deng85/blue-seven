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

/* ---------- Song ---------- */
/* Das Song-Format (Abschnitt 9 im Pflichtenheft). Zeiten in Vierteln, Pegel linear. Kurzform:

     {format:'blueseven.song', version:1, meta:{…},
      tempo:{bpm, swing, beatsPerBar}, length, loop,
      sections:[{id, name, start, length}],
      patterns:{<id>:{length, notes:[{t, d, p, v, o}]}},
      tracks:[{id, name, channel, instrument:{type, params}, clips:[{pattern, start, length, transpose}]}],
      mixer:{channels:[…], returns:[…], master:{…}},
      automation:[{target, points:[{t, v, curve}]}]}                                                      */

const SONG_FORMAT='blueseven.song',SONG_VERSION=1;
const CURVES=['step','lin','exp'];
const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const isId=v=>typeof v==='string'&&/^[A-Za-z0-9][\w-]*$/.test(v);

// Prüft, ob eine Parameteradresse (Abschnitt 9.4) auf etwas zeigt, das es im Song gibt.
// Liefert null oder eine Fehlermeldung. Ob der Parameter selbst existiert, weiß erst das Modul.
function checkAddress(song,address){
  if(typeof address!=='string')return 'Die Adresse ist kein Text.';
  const a=address.split('/'),mx=song&&song.mixer||{};
  const find=(list,id)=>Array.isArray(list)?list.find(x=>x&&x.id===id):undefined;
  const insert=(owner,id,rest,label)=>{
    if(!find(owner.inserts,id))return `${label} hat keinen Effekt „${id}“.`;
    return rest.length===1&&rest[0]?null:`Nach dem Effekt „${id}“ muss genau ein Parametername stehen.`;
  };
  const bad=`Die Adresse „${address}“ gibt es nicht.`;
  if(a[0]==='tempo')return a.length===2&&(a[1]==='bpm'||a[1]==='swing')?null:bad;
  if(a[0]==='master'){
    const m=mx.master||{};
    if(a.length===2&&a[1]==='gain')return null;
    if(a[1]==='insert'&&a.length>=3)return insert(m,a[2],a.slice(3),'Die Summe');
    return bad;
  }
  if(a[0]==='channel'){
    const c=find(mx.channels,a[1]);if(!c)return `Es gibt keinen Kanal „${a[1]}“.`;
    if(a.length===3&&['gain','pan','mute','solo'].includes(a[2]))return null;
    if(a[2]==='send'&&a.length===4)return (c.sends||[]).some(x=>x&&x.to===a[3])?null:`Kanal „${a[1]}“ hat keinen Send auf „${a[3]}“.`;
    if(a[2]==='insert'&&a.length>=4)return insert(c,a[3],a.slice(4),`Kanal „${a[1]}“`);
    return bad;
  }
  if(a[0]==='return'){
    const r=find(mx.returns,a[1]);if(!r)return `Es gibt keine Effektspur „${a[1]}“.`;
    if(a.length===3&&(a[2]==='gain'||a[2]==='mute'))return null;
    if(a[2]==='insert'&&a.length>=4)return insert(r,a[3],a.slice(4),`Effektspur „${a[1]}“`);
    return bad;
  }
  if(a[0]==='track'){
    if(!find(song&&song.tracks,a[1]))return `Es gibt keine Spur „${a[1]}“.`;
    return a.length===4&&a[2]==='instrument'&&a[3]?null:bad;
  }
  return bad;
}

// Prüft einen Song. Liefert eine Liste verständlicher Fehler, leer heißt in Ordnung.
// Geprüft werden Aufbau, Wertebereiche und Verweise. Ob es Instrument- und Effekttypen gibt, prüft erst die Engine.
function checkSong(song){
  if(!isObj(song))return ['Der Song ist kein Objekt.'];
  const errors=[],err=m=>errors.push(m);
  if(song.format!==SONG_FORMAT)err(`Das Feld format muss „${SONG_FORMAT}“ sein.`);
  if(!isInt(song.version)||song.version<1)err('Das Feld version muss eine ganze Zahl ab 1 sein.');
  else if(song.version>SONG_VERSION)err(`Der Song hat Version ${song.version}, diese App versteht nur bis Version ${SONG_VERSION}.`);
  if(song.meta!==undefined&&!isObj(song.meta))err('Das Feld meta muss ein Objekt sein.');

  const t=song.tempo;
  if(!isObj(t))err('Das Feld tempo fehlt.');
  else{
    if(!isNum(t.bpm)||t.bpm<20||t.bpm>400)err('tempo.bpm muss zwischen 20 und 400 liegen.');
    if(!isNum(t.swing)||t.swing<0||t.swing>100)err('tempo.swing muss zwischen 0 und 100 liegen.');
    if(!isInt(t.beatsPerBar)||t.beatsPerBar<1)err('tempo.beatsPerBar muss eine ganze Zahl ab 1 sein.');
  }
  const len=song.length,lenOk=isNum(len)&&len>0;
  if(!lenOk)err('Das Feld length muss eine Länge in Vierteln größer als 0 sein.');
  if(typeof song.loop!=='boolean')err('Das Feld loop muss true oder false sein.');

  // Abschnitte: lückenlos, ohne Überlappung, vom Anfang bis zum Ende.
  if(!Array.isArray(song.sections)||!song.sections.length)err('Das Feld sections muss eine Liste mit mindestens einem Abschnitt sein.');
  else{
    let at=0;const ids=[];
    song.sections.forEach((x,i)=>{
      const where=`Abschnitt ${i+1}`;
      if(!isObj(x)){err(`${where} ist kein Objekt.`);return;}
      if(!isId(x.id))err(`${where} braucht eine id.`);else if(ids.includes(x.id))err(`Abschnitt „${x.id}“ kommt doppelt vor.`);else ids.push(x.id);
      if(typeof x.name!=='string'||!x.name)err(`${where} braucht einen Namen.`);
      if(!isNum(x.start)||!isNum(x.length)||x.length<=0){err(`${where} braucht start und eine length größer als 0.`);return;}
      if(Math.abs(x.start-at)>1e-9)err(`${where} beginnt bei ${x.start}, erwartet ist ${at}. Abschnitte müssen lückenlos aufeinander folgen.`);
      at=x.start+x.length;
    });
    if(lenOk&&!errors.some(m=>m.startsWith('Abschnitt'))&&Math.abs(at-len)>1e-9)err(`Die Abschnitte enden bei ${at}, der Song aber bei ${len}.`);
  }

  // Patterns
  const patterns=isObj(song.patterns)?song.patterns:null;
  if(!patterns)err('Das Feld patterns muss ein Objekt sein.');
  else for(const id in patterns){
    const pt=patterns[id],where=`Pattern „${id}“`;
    if(!isId(id))err(`${where}: Der Name darf nur Buchstaben, Ziffern, - und _ enthalten.`);
    if(!isObj(pt)){err(`${where} ist kein Objekt.`);continue;}
    if(!isNum(pt.length)||pt.length<=0)err(`${where} braucht eine length größer als 0.`);
    if(!Array.isArray(pt.notes)){err(`${where} braucht eine Liste notes.`);continue;}
    pt.notes.forEach((n,i)=>{
      const w=`${where}, Note ${i+1}`;
      if(!isObj(n)){err(`${w} ist kein Objekt.`);return;}
      if(!isNum(n.t)||n.t<0)err(`${w}: t muss eine Zeit ab 0 sein.`);
      else if(isNum(pt.length)&&n.t>=pt.length)err(`${w}: t=${n.t} liegt hinter dem Ende des Patterns (${pt.length}).`);
      if(!isNum(n.d)||n.d<=0)err(`${w}: d muss eine Dauer größer als 0 sein.`);
      if(!isMidi(n.p))err(`${w}: p muss eine MIDI-Note von 0 bis 127 sein.`);
      if(!isNum(n.v)||n.v<0||n.v>1)err(`${w}: v muss zwischen 0 und 1 liegen.`);
      if(n.o!==undefined&&(!isNum(n.o)||Math.abs(n.o)>1))err(`${w}: o muss ein Versatz in Sekunden zwischen -1 und 1 sein.`);
    });
  }

  // Mixer
  const mx=song.mixer,chIds=[],retIds=[];
  const chain=(list,where)=>{
    if(!Array.isArray(list)){err(`${where}: inserts muss eine Liste sein.`);return;}
    const ids=[];
    list.forEach((x,i)=>{
      if(!isObj(x)){err(`${where}, Effekt ${i+1} ist kein Objekt.`);return;}
      if(!isId(x.id))err(`${where}, Effekt ${i+1} braucht eine id.`);else if(ids.includes(x.id))err(`${where}: Effekt „${x.id}“ kommt doppelt vor.`);else ids.push(x.id);
      if(typeof x.type!=='string'||!x.type)err(`${where}, Effekt „${x.id}“ braucht einen type.`);
      if(x.params!==undefined&&!isObj(x.params))err(`${where}, Effekt „${x.id}“: params muss ein Objekt sein.`);
      if(x.bypass!==undefined&&typeof x.bypass!=='boolean')err(`${where}, Effekt „${x.id}“: bypass muss true oder false sein.`);
    });
  };
  const level=(x,where)=>{if(!isNum(x.gain)||x.gain<0||x.gain>4)err(`${where}: gain muss zwischen 0 und 4 liegen.`);};
  const flag=(x,k,where)=>{if(typeof x[k]!=='boolean')err(`${where}: ${k} muss true oder false sein.`);};
  if(!isObj(mx))err('Das Feld mixer fehlt.');
  else{
    if(!Array.isArray(mx.returns))err('mixer.returns muss eine Liste sein.');
    else mx.returns.forEach((r,i)=>{
      if(!isObj(r)||!isId(r.id)){err(`Effektspur ${i+1} braucht eine id.`);return;}
      const where=`Effektspur „${r.id}“`;
      if(retIds.includes(r.id))err(`${where} kommt doppelt vor.`);else retIds.push(r.id);
      if(typeof r.name!=='string'||!r.name)err(`${where} braucht einen Namen.`);
      level(r,where);flag(r,'mute',where);chain(r.inserts,where);
    });
    if(!Array.isArray(mx.channels)||!mx.channels.length)err('mixer.channels muss eine Liste mit mindestens einem Kanal sein.');
    else mx.channels.forEach((c,i)=>{
      if(!isObj(c)||!isId(c.id)){err(`Kanal ${i+1} braucht eine id.`);return;}
      const where=`Kanal „${c.id}“`;
      if(chIds.includes(c.id))err(`${where} kommt doppelt vor.`);else chIds.push(c.id);
      if(retIds.includes(c.id))err(`${where} heißt wie eine Effektspur.`);
      if(typeof c.name!=='string'||!c.name)err(`${where} braucht einen Namen.`);
      level(c,where);flag(c,'mute',where);flag(c,'solo',where);
      if(!isNum(c.pan)||c.pan<-1||c.pan>1)err(`${where}: pan muss zwischen -1 und 1 liegen.`);
      chain(c.inserts,where);
      if(!Array.isArray(c.sends))err(`${where}: sends muss eine Liste sein.`);
      else c.sends.forEach(x=>{
        if(!isObj(x)||!retIds.includes(x.to))err(`${where} hat einen Send auf die unbekannte Effektspur „${x&&x.to}“.`);
        else if(!isNum(x.gain)||x.gain<0||x.gain>4)err(`${where}: Send auf „${x.to}“ braucht gain zwischen 0 und 4.`);
      });
    });
    if(!isObj(mx.master))err('mixer.master fehlt.');
    else{level(mx.master,'Summe');chain(mx.master.inserts,'Summe');}
  }

  // Spuren
  if(!Array.isArray(song.tracks))err('Das Feld tracks muss eine Liste sein.');
  else{
    const ids=[];
    song.tracks.forEach((tr,i)=>{
      if(!isObj(tr)||!isId(tr.id)){err(`Spur ${i+1} braucht eine id.`);return;}
      const where=`Spur „${tr.id}“`;
      if(ids.includes(tr.id))err(`${where} kommt doppelt vor.`);else ids.push(tr.id);
      if(typeof tr.name!=='string'||!tr.name)err(`${where} braucht einen Namen.`);
      if(isObj(mx)&&!chIds.includes(tr.channel))err(`${where} spielt in den unbekannten Kanal „${tr.channel}“.`);
      if(!isObj(tr.instrument)||typeof tr.instrument.type!=='string'||!tr.instrument.type)err(`${where} braucht ein instrument mit type.`);
      else if(tr.instrument.params!==undefined&&!isObj(tr.instrument.params))err(`${where}: instrument.params muss ein Objekt sein.`);
      if(!Array.isArray(tr.clips)){err(`${where} braucht eine Liste clips.`);return;}
      tr.clips.forEach((c,j)=>{
        const w=`${where}, Clip ${j+1}`;
        if(!isObj(c)){err(`${w} ist kein Objekt.`);return;}
        if(patterns&&!(typeof c.pattern==='string'&&Object.prototype.hasOwnProperty.call(patterns,c.pattern)))err(`${w} verweist auf das unbekannte Pattern „${c.pattern}“.`);
        if(!isNum(c.start)||c.start<0||!isNum(c.length)||c.length<=0)err(`${w} braucht start ab 0 und eine length größer als 0.`);
        else if(lenOk&&c.start+c.length>len+1e-9)err(`${w} endet bei ${c.start+c.length}, hinter dem Ende des Songs (${len}).`);
        if(c.transpose!==undefined&&(!isInt(c.transpose)||Math.abs(c.transpose)>48))err(`${w}: transpose muss eine ganze Zahl von -48 bis 48 sein.`);
      });
    });
  }

  // Automation
  if(song.automation!==undefined){
    if(!Array.isArray(song.automation))err('Das Feld automation muss eine Liste sein.');
    else song.automation.forEach((a,i)=>{
      const where=`Automation ${i+1}`;
      if(!isObj(a)){err(`${where} ist kein Objekt.`);return;}
      const bad=checkAddress(song,a.target);if(bad)err(`${where}: ${bad}`);
      if(!Array.isArray(a.points)||!a.points.length){err(`${where} braucht mindestens einen Stützpunkt.`);return;}
      a.points.forEach((p,j)=>{
        const w=`${where}, Stützpunkt ${j+1}`;
        if(!isObj(p)||!isNum(p.t)||p.t<0||!isNum(p.v)){err(`${w} braucht t ab 0 und einen Wert v.`);return;}
        if(j>0&&isObj(a.points[j-1])&&p.t<a.points[j-1].t)err(`${w} liegt vor dem vorherigen. Stützpunkte müssen nach Zeit sortiert sein.`);
        if(p.curve!==undefined&&!CURVES.includes(p.curve))err(`${w}: curve muss eines von ${CURVES.join(', ')} sein.`);
      });
    });
  }
  return errors;
}

export {CHORDS_FORMAT,CHORDS_VERSION,checkChords,SONG_FORMAT,SONG_VERSION,checkSong,checkAddress};
