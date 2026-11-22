/* ================= Song ohne Echtzeit rechnen ================= */
/* Für den WAV-Export (F-U12). Es gibt keinen zweiten Klangweg: Eine eigene Engine spielt den Song in einen
   OfflineAudioContext, mit denselben Instrumenten, Effekten und demselben Ablauf wie bei der Wiedergabe.
   Der Zeitgeber der Engine wird dabei von Hand weitergestellt: Die Rechnung hält alle 0,2 s an, die Engine
   plant die nächsten Takte, dann geht es weiter. */
import {createEngine,START_DELAY} from './engine.js';

const STEP=.2,MAX_TAIL=10;

// Rechnet den Song einmal von vorn bis hinten. Der Song sollte loop:false haben, sonst läuft er bis zum Ende
// der Rechnung weiter. opts: OfflineAudioContext (Klasse), sampleRate, tail (Ausklang mitrechnen),
// onProgress(Anteil 0 bis 1), cancelled() (true bricht ab).
// Liefert {buffer, lead, body, sampleRate, warnings}: Der Song liegt im Puffer ab Sample lead und ist body
// Samples lang, dahinter steht mit tail der Ausklang. Fehler tragen code 'unsupported', 'memory' oder 'cancelled'.
function renderAudio(registry,song,opts){
  const fail=(code,text)=>{const e=new Error(text);e.code=code;return e;};
  return new Promise((resolve,reject)=>{
    const OAC=opts.OfflineAudioContext,sr=opts.sampleRate||44100;
    const lead=Math.round(START_DELAY*sr),body=Math.round(song.length*60/song.tempo.bpm*sr);
    const frames=lead+body+(opts.tail?Math.round(MAX_TAIL*sr):0),total=frames/sr;
    if(!OAC||typeof OAC.prototype.suspend!=='function'){reject(fail('unsupported','Dieser Browser kann Songs nicht ohne Echtzeit rechnen.'));return;}
    let oc;
    try{oc=new OAC(2,frames,sr);}
    catch(e){reject(fail('memory','Für so eine lange Datei reicht der Speicher nicht.'));return;}
    let tick=null;
    const warnings=[];
    const engine=createEngine(registry,{
      AudioContext:function(){return oc;},
      setInterval:f=>{tick=f;return 1;},clearInterval:()=>{tick=null;},
      setTimeout:()=>0,clearTimeout:()=>{}
    });
    engine.on('warning',m=>warnings.push(m));
    try{engine.init();engine.load(song);engine.play();}
    catch(e){reject(e);return;}
    let stopped=false;
    const step=t=>{
      if(t>=total-1e-6)return;
      oc.suspend(t).then(()=>{
        if(stopped)return;
        if(opts.cancelled&&opts.cancelled()){stopped=true;reject(fail('cancelled','Abgebrochen.'));return;}
        if(tick)tick();
        if(opts.onProgress)opts.onProgress(t/total);
        step(t+STEP);
        oc.resume();
      },reject);
    };
    step(STEP);
    oc.startRendering().then(buffer=>resolve({buffer,lead,body,sampleRate:sr,warnings}),
      e=>reject(fail('memory','Die Rechnung ist gescheitert, vermutlich reicht der Speicher nicht: '+e.message)));
  });
}

export {renderAudio,MAX_TAIL};
