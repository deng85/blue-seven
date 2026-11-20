/* ================= Stil „Jazzy Beats“ ================= */
/* Baut aus einer beliebigen Akkordfolge einen Loop mit Rhodes, Bass und Drums, als Song-JSON.
   Noten, Längen und Anschläge entsprechen dem ursprünglichen Takt-Ablauf (scheduleBar im früheren sequencer.js,
   als Referenz in test/fixtures/legacy-bar.js).
   Der Stil kennt keinen Akkord-Generator. Er liest von der Folge nur key, mode, root, tones, duration,
   voicing und bass. */

import {normalize} from '../core/params.js';
import {checkChords,SONG_FORMAT,SONG_VERSION} from '../core/format.js';
import {noteName} from '../core/notes.js';
import {voiceChords} from '../core/voicing.js';
import {faderToGain} from '../core/gain.js';

const BAR=4;   // Viertel pro Takt

// Begleitmuster pro Takt: [Zeit in Vierteln, Dauer in Vierteln, Anschlag]
const COMP=[[0,1.3,.75],[1.5,.7,.52],[2.5,1.25,.66]];
const PAD_SPREAD=.016,COMP_SPREAD=.008;   // Sekunden zwischen den Akkordtönen, von unten nach oben

// Reihenfolge der Töne beim Brechen: einmal hinauf, dann zwischen dem zweiten und dem obersten Ton hin und her.
// Für vier Töne ergibt das 0,1,2,3,2,1,2,3 wie bisher.
function arpOrder(count,steps){
  const out=[];
  for(let k=0;k<count&&out.length<steps;k++)out.push(k);
  let k=count-1,dir=-1;
  while(out.length<steps){
    if(count<3){out.push(out.length%count);continue;}
    k+=dir;if(k<1){k=2;dir=1;}else if(k>count-1){k=count-2;dir=-1;}
    out.push(k);
  }
  return out;
}

// Abschnitte eines Akkords: Er wird in Takte zerlegt, der letzte Abschnitt ist gegebenenfalls kürzer.
function segments(duration){
  const out=[];
  for(let s=0;s<duration-1e-9;s+=BAR)out.push([s,Math.min(BAR,duration-s)]);
  return out;
}

const bassOf=c=>36+(c.bass===undefined?c.root:c.bass);

// Rhodes in einem Abschnitt der Länge len ab Position at.
function keys(notes,feel,at,len){
  const out=[],top=notes.length-1,add=(t,d,p,v,o)=>{if(t<len)out.push(o?{t:at+t,d,p,v,o}:{t:at+t,d,p,v});};
  if(feel==='pad'){
    const d=Math.max(len-.2,len/2);   // im vollen Takt 3,8 Viertel wie bisher
    notes.forEach((m,k)=>add(0,d,m,.6+(k===top?.1:0),k*PAD_SPREAD));
  }else if(feel==='comp'){
    COMP.forEach(([b,d,ve])=>notes.forEach((m,k)=>add(b,d,m,ve+(k===top?.08:0),k*COMP_SPREAD)));
  }else{
    arpOrder(notes.length,8).forEach((k,j)=>add(j/2,1.7,notes[k],j%2?.5:.7));
  }
  return out;
}
// Bass in einem Abschnitt: Grundton auf 1 und 2-und, eine halbe Zählzeit vor dem nächsten Abschnitt
// ein Durchgangston einen Halbton unter dessen Basston.
function bassLine(low,nextLow,at,len){
  const out=[],pass=len-.5;
  for(const [b,d,v] of [[0,2.2,.9],[2.5,.7,.7]])if(b===0||b<pass)out.push({t:at+b,d,p:low,v});
  if(pass>0)out.push({t:at+pass,d:.4,p:nextLow-1,v:.6});
  return out;
}
// Ein Takt Drums: Hi-Hat in Achteln, Kick auf 1 und 2-und, Rim auf 2 und 4 (General-MIDI-Nummern).
const KICK=36,RIM=37,HAT=42;
function drumBar(){
  const out=[];
  for(let j=0;j<8;j++)out.push({t:j/2,d:.25,p:HAT,v:j%2?.4:.7});
  out.push({t:0,d:.25,p:KICK,v:1},{t:2.5,d:.25,p:KICK,v:.75},{t:1,d:.25,p:RIM,v:.7},{t:3,d:.25,p:RIM,v:.8});
  return out.sort((a,b)=>a.t-b.t||a.p-b.p);
}

// Mixer wie im früheren Signalweg (audio.js bis Phase 2).
function mixer(){
  return {
    channels:[
      {id:'rhodes',name:'Rhodes',gain:faderToGain(80),pan:0,mute:false,solo:false,
        inserts:[{id:'lp',type:'filter',params:{mode:'lowpass',frequency:3600,q:.3}},
                 {id:'trem',type:'tremolo',params:{rate:4.4,depth:.45}}],
        sends:[{to:'hall',gain:.24}]},
      {id:'bass',name:'Bass',gain:faderToGain(60),pan:0,mute:false,solo:false,inserts:[],sends:[]},
      {id:'drums',name:'Drums',gain:faderToGain(45),pan:0,mute:false,solo:false,inserts:[],sends:[{to:'hall',gain:.06}]}
    ],
    returns:[{id:'hall',name:'Hall',gain:1,mute:false,inserts:[{id:'rev',type:'reverb',params:{seconds:1.5}}]}],
    master:{gain:1,inserts:[{id:'comp',type:'compressor',params:{threshold:-16,ratio:4}}]}
  };
}

const clamp=(v,lo,hi,def)=>typeof v==='number'&&Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):def;

const jazzyBeats={
  id:'jazzy-beats',
  name:'Jazzy Beats',
  version:1,
  params:[
    {id:'feel',name:'Spielweise',type:'enum',default:'comp',
      options:[{value:'pad',name:'Liegend'},{value:'comp',name:'Comping'},{value:'arp',name:'Gebrochen'}]}
  ],
  tempo:{default:84,min:56,max:132,swing:55},

  // progression: Akkordfolge im Format blueseven.chords. ctx: bpm, swing (0 bis 100), rnd (hier nicht gebraucht).
  generate(progression,params,ctx){
    const errors=checkChords(progression);
    if(errors.length)throw new Error('Jazzy Beats kann diese Akkordfolge nicht verwenden.\n  '+errors.join('\n  '));
    const p=normalize(jazzyBeats.params,params),c=ctx||{},tp=jazzyBeats.tempo;
    const chords=progression.chords;
    // Lage: die vom Akkord-Generator, sonst eine eigene für die ganze Folge.
    const voicings=chords.every(ch=>Array.isArray(ch.voicing))?chords.map(ch=>ch.voicing):voiceChords(chords);

    const keyNotes=[],bassNotes=[];let at=0;
    chords.forEach((ch,i)=>{
      const segs=segments(ch.duration),next=chords[(i+1)%chords.length];
      segs.forEach(([s,len],j)=>{
        keyNotes.push(...keys(voicings[i],p.feel,at+s,len));
        // Im letzten Abschnitt führt der Durchgangston zum nächsten Akkord, sonst zurück zum eigenen Grundton.
        bassNotes.push(...bassLine(bassOf(ch),bassOf(j===segs.length-1?next:ch),at+s,len));
      });
      at+=ch.duration;
    });
    const length=at,key=progression.key,mode=progression.mode;
    const byTime=(a,b)=>a.t-b.t||a.p-b.p;

    return {
      format:SONG_FORMAT,version:SONG_VERSION,
      meta:{
        title:`Jazzy Beats in ${noteName(key,key,mode)}-${mode==='dur'?'Dur':'Moll'}`,
        style:{id:jazzyBeats.id,version:jazzyBeats.version,params:p},
        chords:progression
      },
      tempo:{bpm:clamp(c.bpm,tp.min,tp.max,tp.default),swing:clamp(c.swing,0,100,tp.swing),beatsPerBar:BAR},
      length,
      loop:true,
      sections:[{id:'loop',name:'Loop',start:0,length}],
      patterns:{
        keys:{length,notes:keyNotes.sort(byTime)},
        bass:{length,notes:bassNotes.sort(byTime)},
        drums:{length:BAR,notes:drumBar()}
      },
      tracks:[
        {id:'rhodes',name:'Rhodes',channel:'rhodes',instrument:{type:'rhodes',params:{level:1.1}},clips:[{pattern:'keys',start:0,length}]},
        {id:'bass',name:'Bass',channel:'bass',instrument:{type:'bass',params:{level:1}},clips:[{pattern:'bass',start:0,length}]},
        {id:'drums',name:'Drums',channel:'drums',instrument:{type:'drums',params:{level:.9}},clips:[{pattern:'drums',start:0,length}]}
      ],
      mixer:mixer(),
      automation:[]
    };
  }
};

export {jazzyBeats,arpOrder};
