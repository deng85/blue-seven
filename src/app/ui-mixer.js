/* ================= Mixer in der Oberfläche ================= */
/* Zeigt den Mixer des aktuellen Songs: pro Kanal Lautstärke, Mute und Solo, dazu aufklappbar Panorama, Sends
   und Effekte. Effektspuren und Summe genauso. Alles entsteht aus dem Song und aus den Parameterbeschreibungen
   der Effekte, es gibt keine festen Regler für bestimmte Kanäle.
   Jedes Bedienelement trägt die Adresse seines Werts (Abschnitt 9.4), zum Beispiel channel/rhodes/gain. */
import {$} from './state.js';
import {registry} from './modules.js';
import {esc,controlHtml,readControl} from './ui-params.js';
import {normalize} from '../core/params.js';
import {faderToGain,gainToFader} from '../core/gain.js';

const fmtPan=v=>{const n=Math.round(v*100);return n===0?'Mitte':n<0?`${-n} links`:`${n} rechts`;};
const slug=a=>'mx-'+a.replace(/[^A-Za-z0-9]+/g,'-');

function slider(label,addr,kind,min,max,value,text){
  const id=slug(addr);
  return `<div class="row"><div class="lab"><label for="${id}">${esc(label)}</label><output>${esc(text)}</output></div>`+
    `<input type="range" id="${id}" min="${min}" max="${max}" step="1" value="${value}" data-addr="${esc(addr)}" data-kind="${kind}"></div>`;
}
const toggle=(label,addr,on,aria)=>`<button class="tog" data-addr="${esc(addr)}" aria-pressed="${!!on}"${aria?` aria-label="${esc(aria)}"`:''}>${esc(label)}</button>`;

// Schaubild eines Effekts, wenn sein Modul eines beschreibt (graph). Bisher: Kennlinie des Kompressors,
// Eingangspegel nach rechts, Ausgangspegel nach oben, gestrichelt die Linie ohne Kompression.
function graphSvg(mod,params){
  const g=mod.graph(normalize(mod.params||[],params)),W=240,H=150,L=30,B=18,w=W-L-4,h=H-B-4,span=g.max-g.min;
  const X=v=>L+(v-g.min)/span*w,Y=v=>4+h-(Math.max(g.min,v)-g.min)/span*h,f=n=>n.toFixed(1);
  let grid='';
  for(let v=g.min;v<=g.max;v+=20)grid+=`<line class="grid" x1="${f(X(v))}" y1="4" x2="${f(X(v))}" y2="${4+h}"/><line class="grid" x1="${L}" y1="${f(Y(v))}" x2="${L+w}" y2="${f(Y(v))}"/>`+
    `<text x="${f(X(v))}" y="${H-5}" text-anchor="middle">${v}</text><text x="${L-4}" y="${f(Y(v)+3)}" text-anchor="end">${v}</text>`;
  const marks=g.marks.map(m=>`<line class="mark" x1="${f(X(m.x))}" y1="4" x2="${f(X(m.x))}" y2="${4+h}"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kennlinie: ${esc(g.marks.map(m=>m.name+' bei '+Math.round(m.x)+' dB').join(', '))}, ${esc(g.note)}">${grid}${marks}`+
    `<line class="unity" x1="${L}" y1="${4+h}" x2="${L+w}" y2="4"/><polyline class="curve" points="${g.points.map(([a,b])=>f(X(a))+','+f(Y(b))).join(' ')}"/></svg>`+
    `<p class="hint">Eingang nach rechts, Ausgang nach oben, in dB. ${esc(g.note)}.</p>`;
}
function insertHtml(base,x){
  const mod=registry.get('effects',x.type),addr=`${base}/insert/${x.id}`;
  if(!mod)return `<div class="fx"><div class="fx-head"><span>${esc(x.type)}</span></div><p class="hint">Diesen Effekt gibt es in dieser Version nicht. Er wird übersprungen.</p></div>`;
  const params=(mod.params||[]).map(p=>controlHtml(p,(x.params||{})[p.id],slug(`${addr}/${p.id}`),
    `data-addr="${esc(addr+'/'+p.id)}" data-kind="param" data-fx="${esc(x.type)}" data-param="${esc(p.id)}"`)).join('');
  return `<div class="fx"><div class="fx-head"><span>${esc(mod.name)}</span>`+
    `<button class="tog" data-addr="${esc(addr)}/bypass" data-kind="bypass" aria-pressed="${!x.bypass}" aria-label="${esc(mod.name)} ein- oder ausschalten">${x.bypass?'Aus':'An'}</button>`+
    `<button class="mini" data-reset="${esc(addr)}" aria-label="${esc(mod.name)} zurücksetzen">Zurück</button></div>`+
    (mod.graph?`<div class="graph" data-graph="${esc(addr)}">${graphSvg(mod,x.params)}</div>`:'')+`${params}</div>`;
}
function stripHtml(kind,o,mx,open){
  const base=kind==='master'?'master':`${kind}/${o.id}`,isCh=kind==='channel';
  const name=kind==='master'?'Summe':o.name||o.id,fader=Math.round(gainToFader(o.gain));
  const head=`<div class="strip-head"><span class="strip-name">${esc(name)}</span>`+
    (kind==='master'?'':toggle('Mute',base+'/mute',o.mute,name+' stumm'))+(isCh?toggle('Solo',base+'/solo',o.solo,name+' allein hören'):'')+'</div>';
  let detail='';
  if(isCh){
    detail+=slider('Panorama',base+'/pan','pan',-100,100,Math.round(o.pan*100),fmtPan(o.pan));
    for(const s of o.sends||[]){
      const r=(mx.returns||[]).find(x=>x.id===s.to);
      detail+=slider(`Anteil auf ${r?r.name:s.to}`,`${base}/send/${s.to}`,'send',0,100,Math.round(s.gain*100),Math.round(s.gain*100)+' %');
    }
  }
  detail+=(o.inserts||[]).map(x=>insertHtml(base,x)).join('');
  const what=[isCh?'Panorama':'',isCh&&(o.sends||[]).length?'Sends':'',(o.inserts||[]).length?'Effekte':''].filter(Boolean).join(', ')||'Mehr';
  return `<div class="strip">${head}${slider('Lautstärke',base+'/gain','fader',0,100,fader,String(fader))}`+
    `<details data-id="${esc(base)}"${open.has(base)?' open':''}><summary>${what}</summary><div class="strip-detail">${detail}`+
    `<button class="mini wide" data-reset="${esc(base)}">${kind==='master'?'Summe':kind==='return'?'Effektspur':'Kanal'} zurücksetzen</button></div></details></div>`;
}

// Zeichnet den Mixer neu. Aufgeklappte Details bleiben aufgeklappt.
function renderMixer(song){
  const el=$('mixer');
  if(!song){el.innerHTML='';return;}
  const open=new Set([...el.querySelectorAll('details[open]')].map(d=>d.dataset.id)),mx=song.mixer;
  el.innerHTML=mx.channels.map(c=>stripHtml('channel',c,mx,open)).join('')+
    (mx.returns.length?'<h3>Effektspuren</h3>'+mx.returns.map(r=>stripHtml('return',r,mx,open)).join(''):'')+
    '<h3>Summe</h3>'+stripHtml('master',mx.master,mx,open);
}

// Zeichnet das Schaubild des Effekts neu, zu dem die Adresse eines Parameters gehört.
function updateGraph(address,song){
  const m=address.match(/^(.*\/insert\/[^/]+)\//),box=m&&$('mixer').querySelector(`[data-graph="${m[1]}"]`);
  if(!box||!song)return;
  const a=m[1].split('/'),mx=song.mixer,find=(l,id)=>(l||[]).find(x=>x.id===id);
  const owner=a[0]==='master'?mx.master:find(a[0]==='channel'?mx.channels:mx.returns,a[1]),x=owner&&find(owner.inserts,a[a.length-1]);
  const mod=x&&registry.get('effects',x.type);
  if(mod&&mod.graph)box.innerHTML=graphSvg(mod,x.params);
}

// Verbindet die Bedienelemente. on.set(adresse, wert) setzt einen Wert, on.song() liefert den aktuellen Song, on.reset(pfad) stellt die
// Standardwerte des Stils wieder her (Kanal, Effektspur, Summe oder ein einzelner Effekt).
function bindMixer(on){
  const el=$('mixer');
  const spec=t=>(registry.get('effects',t.dataset.fx).params||[]).find(p=>p.id===t.dataset.param);
  function fromSlider(t){
    const out=t.closest('.row').querySelector('output'),x=+t.value,k=t.dataset.kind;
    if(k==='param')return readControl(spec(t),t);
    if(k==='fader'){out.textContent=String(x);return faderToGain(x);}
    if(k==='pan'){out.textContent=fmtPan(x/100);return x/100;}
    out.textContent=x+' %';return x/100;
  }
  // Schieberegler wirken beim Ziehen. Ausnahme sind Parameter mit live:false, die erst beim Loslassen gelten.
  el.addEventListener('input',e=>{
    const t=e.target;if(!t.dataset.addr)return;
    const v=fromSlider(t);
    if(t.dataset.live!=='0'){on.set(t.dataset.addr,v);if(t.dataset.kind==='param')updateGraph(t.dataset.addr,on.song());}
  });
  el.addEventListener('change',e=>{const t=e.target;if(t.dataset.addr&&t.dataset.live==='0')on.set(t.dataset.addr,fromSlider(t));});
  el.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.reset){on.reset(b.dataset.reset);return;}
    const seg=b.closest('.seg[data-addr]');
    if(seg){on.set(seg.dataset.addr,readControl(spec(seg),b));return;}
    if(!b.dataset.addr)return;
    if(b.dataset.kind==='param'){on.set(b.dataset.addr,readControl(spec(b),b));return;}
    const pressed=b.getAttribute('aria-pressed')!=='true';
    b.setAttribute('aria-pressed',String(pressed));
    if(b.dataset.kind==='bypass'){b.textContent=pressed?'An':'Aus';on.set(b.dataset.addr,!pressed);}
    else on.set(b.dataset.addr,pressed);
  });
}

export {renderMixer,bindMixer};
