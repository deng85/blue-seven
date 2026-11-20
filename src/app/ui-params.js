/* ================= Regler aus Parameterbeschreibungen ================= */
/* Baut für einen Parameter (Abschnitt core/params.js) das passende Bedienelement und liest es wieder aus.
   Stilparameter und Effektparameter benutzen dieselben Bausteine. */
import {normalizeValue} from '../core/params.js';

const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const POS=1000;   // Auflösung eines Reglers mit Kurve exp

// Zahl mit Komma und höchstens zwei Nachkommastellen.
function num(v){
  const a=Math.abs(v),d=a>=100?0:a>=10?1:2;
  return String(+v.toFixed(d)).replace('.',',');
}
// Wert eines Parameters für die Anzeige.
function formatValue(p,v){
  if(p.type==='enum'){const o=p.options.find(x=>x.value===v);return o?o.name:String(v);}
  if(p.type==='bool')return v?'An':'Aus';
  if(p.unit==='Hz'&&v>=1000)return num(v/1000)+' kHz';
  return num(v)+(p.unit?' '+p.unit:'');
}
// Stellung eines Schiebereglers zu einem Wert und zurück.
const toPos=(p,v)=>p.curve==='exp'?Math.round(POS*Math.log(v/p.min)/Math.log(p.max/p.min)):v;
const fromPos=(p,x)=>normalizeValue(p,p.curve==='exp'?p.min*Math.pow(p.max/p.min,x/POS):x);

// HTML für einen Parameter. id muss auf der Seite eindeutig sein, attrs sind zusätzliche Attribute
// (zum Beispiel data-addr), die auf dem Bedienelement landen.
function controlHtml(p,value,id,attrs){
  const v=normalizeValue(p,value),extra=attrs||'';
  if(p.type==='number'){
    const exp=p.curve==='exp',step=exp?1:(p.step||(p.max-p.min)/200);
    return `<div class="row"><div class="lab"><label for="${id}">${esc(p.name)}</label><output>${esc(formatValue(p,v))}</output></div>`+
      `<input type="range" id="${id}" min="${exp?0:p.min}" max="${exp?POS:p.max}" step="${step}" value="${toPos(p,v)}"${p.live===false?' data-live="0"':''} ${extra}></div>`;
  }
  if(p.type==='enum')return `<div class="row"><div class="lab"><span>${esc(p.name)}</span></div><div class="seg" id="${id}" ${extra}>`+
    p.options.map((o,i)=>`<button data-i="${i}" aria-pressed="${o.value===v}">${esc(o.name)}</button>`).join('')+'</div></div>';
  return `<div class="row"><div class="lab"><span>${esc(p.name)}</span></div><button class="tog" id="${id}" aria-pressed="${!!v}" ${extra}>${v?'An':'Aus'}</button></div>`;
}
// Liest den Wert nach einer Bedienung. el ist der Schieberegler oder der angetippte Knopf.
// Bringt auch die Anzeige auf den neuen Stand.
function readControl(p,el){
  if(p.type==='number'){
    const v=fromPos(p,+el.value),out=el.closest('.row').querySelector('output');
    if(out)out.textContent=formatValue(p,v);
    return v;
  }
  if(p.type==='enum'){
    const o=p.options[+el.dataset.i];
    el.parentNode.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));
    return o.value;
  }
  const v=el.getAttribute('aria-pressed')!=='true';
  el.setAttribute('aria-pressed',String(v));el.textContent=v?'An':'Aus';
  return v;
}

export {esc,num,formatValue,controlHtml,readControl};
