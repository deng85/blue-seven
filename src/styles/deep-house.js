/* ================= Stil „Deep House“ ================= */
/* Baut aus einer beliebigen Akkordfolge einen ganzen Song mit Arrangement: Intro, Aufbau, Drop, Break,
   zweiter Aufbau, zweiter Drop, Outro. Die Akkordfolge läuft als Schleife durch alle Abschnitte.
   Der Stil kennt keinen Akkord-Generator. Er liest von der Folge nur key, mode, root, tones, duration und bass
   und bildet die Lage von Stabs und Pad selbst (F-D2a).
   Der Aufbau ist fest, gewürfelt wird nur die Percussion. Gleicher Zufall, gleicher Song. */

import {normalize} from '../core/params.js';
import {checkChords,SONG_FORMAT,SONG_VERSION} from '../core/format.js';
import {noteName} from '../core/notes.js';
import {createRng} from '../core/rng.js';

const BAR=4;
const KICK=36,RIM=37,CLAP=39,HAT=42,OHAT=46,SHAKER=70;

// Aufbau je Länge: [id, Name, Art, Takte]. Bei 122 BPM sind das etwa 3:25, 4:10 und 4:45 Minuten.
const FORMS={
  short:[['intro','Intro','intro',8],['build','Aufbau','build',8],['drop','Drop','drop',32],['break','Break','break',8],['build2','Aufbau 2','build',8],['drop2','Drop 2','drop2',32],['outro','Outro','outro',8]],
  medium:[['intro','Intro','intro',16],['build','Aufbau','build',8],['drop','Drop','drop',32],['break','Break','break',16],['build2','Aufbau 2','build',8],['drop2','Drop 2','drop2',32],['outro','Outro','outro',16]],
  long:[['intro','Intro','intro',16],['build','Aufbau','build',16],['drop','Drop','drop',32],['break','Break','break',16],['build2','Aufbau 2','build',16],['drop2','Drop 2','drop2',32],['outro','Outro','outro',16]]
};
// Welche Spur in welcher Art von Abschnitt spielt.
const PLAYS={
  kick:['intro','build','drop','drop2','outro'],
  clap:['build','drop','drop2'],
  hat:['intro','build','drop','drop2','outro'],
  ohat:['build','drop','drop2'],
  perc:['drop','drop2','outro'],
  bass:['drop','drop2'],
  stabs:['build','drop','break','drop2'],
  pad:['intro','build','break','drop2','outro']
};
// Filterfahrten: Grenzfrequenz am Anfang und am Ende jedes Abschnitts.
const SWEEP={
  stabs:{intro:[500,500],build:[600,7000],drop:[7000,7000],break:[1500,4000],drop2:[8000,8000],outro:[8000,700]},
  pad:{intro:[350,900],build:[900,3500],drop:[2500,2500],break:[1500,5000],drop2:[3000,3000],outro:[3000,400]}
};
// Stab-Rhythmen pro Takt: [Zeit in Vierteln, Dauer].
const STABS={
  classic:[[.75,.2],[1.5,.2],[2.75,.2],[3.5,.2]],
  offbeat:[[.5,.22],[1.5,.22],[2.5,.22],[3.5,.22]],
  sparse:[[0,.4],[2.5,.4]]
};

// Enge Lage um eine Mitte: jede Tonklasse des Akkords an die Stelle, die der Mitte am nächsten liegt.
// Bei mehr als vier Tönen fällt der Grundton weg, den spielt der Bass.
function voice(ch,center){
  let pcs=[...new Set(ch.tones.map(t=>((ch.root+t)%12+12)%12))];
  if(pcs.length>4)pcs=pcs.filter(pc=>pc!==ch.root%12);
  return pcs.map(pc=>{let m=pc+12*Math.round((center-pc)/12);return m;}).sort((a,b)=>a-b);
}
const bassOf=ch=>36+(ch.bass===undefined?ch.root:ch.bass)%12;
// Quinte (oder was der Akkord an ihrer Stelle hat) über dem Basston.
const fifthOf=ch=>bassOf(ch)+(ch.tones.find(t=>t%12>=6&&t%12<=8)||7)%12;

const deepHouse={
  id:'deep-house',
  name:'Deep House',
  version:1,
  random:true,          // der Stil würfelt: „Song neu bauen“ ergibt eine andere Percussion
  params:[
    {id:'length',name:'Länge',type:'enum',default:'medium',
      options:[{value:'short',name:'Kurz'},{value:'medium',name:'Mittel'},{value:'long',name:'Lang'}]},
    {id:'energy',name:'Energie',type:'number',min:0,max:100,step:5,default:60,unit:'%'},
    {id:'stab',name:'Stab-Rhythmus',type:'enum',default:'classic',
      options:[{value:'classic',name:'Synkopiert'},{value:'offbeat',name:'Offbeat'},{value:'sparse',name:'Sparsam'}]},
    {id:'bars',name:'Akkordlänge',type:'enum',default:2,options:[{value:2,name:'Zwei Takte'},{value:1,name:'Ein Takt'}]}
  ],
  tempo:{default:122,min:116,max:128,swing:0},

  // progression: Akkordfolge im Format blueseven.chords. ctx: bpm, swing, rnd (für die Percussion), seed.
  generate(progression,params,ctx){
    const errors=checkChords(progression);
    if(errors.length)throw new Error('Deep House kann diese Akkordfolge nicht verwenden.\n  '+errors.join('\n  '));
    const p=normalize(deepHouse.params,params),c=ctx||{},tp=deepHouse.tempo,rnd=c.rnd||createRng(1),e=p.energy/100;
    const clamp=(v,lo,hi,def)=>typeof v==='number'&&Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):def;

    // Akkordschleife: jeder Akkord wird gestreckt, Reihenfolge und Töne bleiben (F-D2).
    const chords=progression.chords.map(ch=>Object.assign({},ch,{duration:ch.duration*p.bars}));
    const loop=chords.reduce((s,ch)=>s+ch.duration,0);
    const each=fn=>{let at=0;chords.forEach((ch,i)=>{fn(ch,at,i);at+=ch.duration;});};
    // Takte eines Akkords: [Beginn in der Schleife, Länge], der letzte ist gegebenenfalls kürzer.
    const bars=(ch,at)=>{const out=[];for(let s=0;s<ch.duration-1e-9;s+=BAR)out.push([at+s,Math.min(BAR,ch.duration-s)]);return out;};
    const byTime=(a,b)=>a.t-b.t||a.p-b.p;

    /* ---------- Patterns ---------- */
    const stabNotes=[],stabLong=[],padNotes=[],bassNotes=[];
    each((ch,at)=>{
      const hi=voice(ch,67),lo=voice(ch,60);
      lo.forEach((m,k)=>padNotes.push({t:at,d:ch.duration,p:m,v:.55,o:k*.012}));
      hi.forEach(m=>stabLong.push({t:at,d:Math.min(1.5,ch.duration),p:m,v:.9}));
      for(const [s,len] of bars(ch,at)){
        for(const [t,d] of STABS[p.stab])if(t<len)hi.forEach((m,k)=>stabNotes.push({t:s+t,d,p:m,v:k===hi.length-1?.8:.7}));
        // Bass zwischen den Kicks: Grundton auf den Offbeats, mit mehr Energie kommen Quinte und Oktave dazu.
        const low=bassOf(ch),line=[[.5,low,.9],[1.5,low,.8],[2.5,low,.9],[3.5,e>=.3?low+12:low,.75]];
        if(e>=.5)line.push([3.25,fifthOf(ch),.6]);
        if(e>=.8)line.push([1.75,low+12,.55]);
        for(const [t,m,v] of line)if(t<len)bassNotes.push({t:s+t,d:.3,p:m,v});
      }
    });
    const kick=[0,1,2,3].map(t=>({t,d:.25,p:KICK,v:1}));
    const clap=[1,3].map(t=>({t,d:.25,p:CLAP,v:.85}));
    const hat=[];
    for(let j=0;j<16;j++){
      if(e<.4&&j%2)continue;                       // wenig Energie: nur Achtel
      hat.push({t:j/4,d:.2,p:HAT,v:j%4===2?.6:j%2?.25:.4});
    }
    const ohat=[.5,1.5,2.5,3.5].map(t=>({t,d:.25,p:OHAT,v:.7}));
    // Percussion über zwei Takte: Shaker gewürfelt auf den Sechzehnteln zwischen den Schlägen, dazu ein fester Rim.
    const perc=[{t:1.75,d:.2,p:RIM,v:.6},{t:5.25,d:.2,p:RIM,v:.5},{t:7.5,d:.2,p:RIM,v:.6}];
    for(let j=0;j<32;j++)if(j%4&&rnd()<.15+e*.5)perc.push({t:j/4,d:.1,p:SHAKER,v:+(.35+rnd()*.4).toFixed(2)});
    // Übergang: Clap-Wirbel auf den letzten zwei Vierteln, lauter werdend.
    const fill=[];for(let j=0;j<8;j++)fill.push({t:2+j/4,d:.2,p:CLAP,v:+(.3+j*.08).toFixed(2)});

    const patterns={
      kick:{length:BAR,notes:kick},clap:{length:BAR,notes:clap},fill:{length:BAR,notes:fill},
      hat:{length:BAR,notes:hat},ohat:{length:BAR,notes:ohat},perc:{length:2*BAR,notes:perc.sort(byTime)},
      bass:{length:loop,notes:bassNotes.sort(byTime)},
      stabs:{length:loop,notes:stabNotes.sort(byTime)},stabsLong:{length:loop,notes:stabLong.sort(byTime)},
      pad:{length:loop,notes:padNotes.sort(byTime)},
      riser:{length:2*BAR,notes:[{t:0,d:2*BAR,p:60,v:1}]}
    };

    /* ---------- Arrangement ---------- */
    const sections=[],clips={kick:[],clap:[],hat:[],ohat:[],perc:[],bass:[],stabs:[],pad:[],riser:[]};
    const auto={stabs:[],pad:[]};
    let at=0;
    FORMS[p.length].forEach(([id,name,kind,n],i,all)=>{
      const length=n*BAR,next=all[i+1]&&all[i+1][2],lift=kind==='build'||kind==='break';   // vor Drop und Break-Ende
      sections.push({id,name,start:at,length});
      for(const tr in PLAYS){
        if(!PLAYS[tr].includes(kind))continue;
        if(tr==='perc'&&kind==='outro'&&e<.4)continue;
        // Im Aufbau setzt die Kick im letzten Takt aus, die Clap macht dort ihren Wirbel.
        const cut=kind==='build'&&(tr==='kick'||tr==='clap')?BAR:0;
        const pattern=tr==='stabs'&&kind==='break'?'stabsLong':tr;
        clips[tr].push({pattern,start:at,length:length-cut});
      }
      if(lift&&next){
        clips.clap.push({pattern:'fill',start:at+length-BAR,length:BAR});
        clips.riser.push({pattern:'riser',start:at+length-2*BAR,length:2*BAR});
      }
      for(const tr in auto){
        const [a,b]=SWEEP[tr][kind];
        auto[tr].push({t:at,v:a,curve:'step'},{t:at+length,v:b,curve:'exp'});
      }
      at+=length;
    });
    const length=at,key=progression.key,mode=progression.mode;

    const drum=(id,name,channel)=>({id,name,channel,instrument:{type:'drums',params:{level:1,kit:'house'}},clips:clips[id]});
    const duck=depth=>({id:'duck',type:'ducker',params:{source:'kick',depth,release:.22}});
    return {
      format:SONG_FORMAT,version:SONG_VERSION,
      meta:{
        title:`Deep House in ${noteName(key,key,mode)}-${mode==='dur'?'Dur':'Moll'}`,
        style:{id:deepHouse.id,version:deepHouse.version,params:p},
        seed:c.seed,
        chords:Object.assign({},progression,{chords})
      },
      tempo:{bpm:clamp(c.bpm,tp.min,tp.max,tp.default),swing:clamp(c.swing,0,100,tp.swing),beatsPerBar:BAR},
      length,
      loop:false,
      sections,
      patterns,
      tracks:[
        drum('kick','Kick','kick'),drum('clap','Clap','drums'),drum('hat','Hi-Hat','drums'),drum('ohat','Offene Hi-Hat','drums'),drum('perc','Percussion','drums'),
        {id:'bass',name:'Bass',channel:'bass',instrument:{type:'bass',params:{level:1}},clips:clips.bass},
        {id:'stabs',name:'Stabs',channel:'stabs',instrument:{type:'synth',params:{level:1,wave:'sawtooth',attack:.003,decay:.2,sustain:.05,release:.15,detune:14}},clips:clips.stabs},
        {id:'pad',name:'Pad',channel:'pad',instrument:{type:'synth',params:{level:1,wave:'sawtooth',attack:.6,decay:1.2,sustain:.8,release:1.2,detune:18}},clips:clips.pad},
        {id:'riser',name:'Rauschanstieg',channel:'fx',instrument:{type:'riser',params:{level:1}},clips:clips.riser}
      ],
      mixer:{
        channels:[
          {id:'kick',name:'Kick',gain:.55,pan:0,mute:false,solo:false,inserts:[],sends:[]},
          {id:'drums',name:'Drums',gain:.45,pan:0,mute:false,solo:false,inserts:[],sends:[{to:'hall',gain:.08}]},
          {id:'bass',name:'Bass',gain:.6,pan:0,mute:false,solo:false,inserts:[duck(.7)],sends:[]},
          {id:'stabs',name:'Stabs',gain:.65,pan:0,mute:false,solo:false,
            inserts:[{id:'lp',type:'filter',params:{mode:'lowpass',frequency:7000,q:1.2}},duck(.4)],
            sends:[{to:'echo',gain:.3},{to:'hall',gain:.22}]},
          {id:'pad',name:'Pad',gain:.8,pan:0,mute:false,solo:false,
            inserts:[{id:'lp',type:'filter',params:{mode:'lowpass',frequency:2500,q:.5}},duck(.6)],
            sends:[{to:'hall',gain:.35}]},
          {id:'fx',name:'Übergänge',gain:.35,pan:0,mute:false,solo:false,inserts:[],sends:[{to:'hall',gain:.3}]}
        ],
        returns:[
          {id:'hall',name:'Hall',gain:1,mute:false,inserts:[{id:'rev',type:'reverb',params:{seconds:2.4}}]},
          {id:'echo',name:'Echo',gain:1,mute:false,inserts:[{id:'dly',type:'delay',params:{time:'1/8p',feedback:.45,damp:2500,mix:1}}]}
        ],
        master:{gain:1,inserts:[{id:'comp',type:'compressor',params:{threshold:-14,knee:30,ratio:3}}]}
      },
      automation:[
        {target:'channel/stabs/insert/lp/frequency',points:auto.stabs},
        {target:'channel/pad/insert/lp/frequency',points:auto.pad}
      ]
    };
  }
};

export {deepHouse,voice};
