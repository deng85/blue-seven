/* ================= Oberfläche ================= */
function buildKeys(){
  const W=10,H=46,white=[0,2,4,5,7,9,11];let wi=0,ws='',bs='';
  for(let m=36;m<=79;m++){
    if(white.includes(m%12)){ws+=`<rect class="w" id="k${m}" x="${wi*W+.5}" y="0" width="${W-1}" height="${H}" rx="1"/>`;wi++;}
    else bs+=`<rect class="b" id="k${m}" x="${wi*W-3}" y="0" width="6" height="${H*.6}" rx="1"/>`;
  }
  const k=$('keys');k.setAttribute('viewBox',`0 0 ${wi*W} ${H}`);k.innerHTML=ws+bs;
}
function showNotes(i){
  document.querySelectorAll('#keys .on,#keys .bass').forEach(e=>e.classList.remove('on','bass'));
  const v=voiced[i];if(!v)return;
  v.notes.forEach(m=>{const e=$('k'+m);if(e)e.classList.add('on');});
  const b=$('k'+v.bass);if(b)b.classList.add('bass');
}
function setActive(i){
  active=i;
  document.querySelectorAll('.tile').forEach((t,j)=>t.classList.toggle('on',j===i));
  showNotes(i<0?0:i);
}
function seg(id,val){document.querySelectorAll('#'+id+' button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===String(val))));}
function render(){
  const tiles=$('tiles');tiles.style.gridTemplateColumns=`repeat(${S.n},minmax(0,1fr))`;
  tiles.innerHTML=voiced.map((v,i)=>`<div class="slot">
    <button class="tile" data-i="${i}" aria-label="${v.name.root}${v.name.suf} anhören"><span class="rn">${v.rn}</span><span class="root">${v.name.root}</span><span class="suf">${v.name.suf}</span></button>
    <button class="lock" data-i="${i}" aria-pressed="${!!S.locks[i]}">${S.locks[i]?'Gehalten':'Halten'}</button></div>`).join('');
  setActive(playing?active:-1);
  $('status').innerHTML=`${keyName()}<br>${S.bpm} BPM`;
  seg('segN',S.n);seg('segMode',S.mode);seg('segFeel',S.feel);seg('segNine',S.nine);
  document.querySelectorAll('#keys12 button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.v===S.key)));
  for(const id of ['spice','bpm','swing','volR','volB','volD'])$(id).value=S[id];
  $('spiceOut').textContent=S.spice===0?'pur':S.spice+' %';
  $('bpmOut').textContent=S.bpm+' BPM';$('swingOut').textContent=S.swing+' %';
  $('volROut').textContent=S.volR;$('volBOut').textContent=S.volB;$('volDOut').textContent=S.volD;
  $('back').disabled=!hist.length;
  renderFavs();
}
function renderFavs(){
  const el=$('favs');
  if(!favs.length){el.innerHTML='<p class="hint">Noch nichts gemerkt. Das Herz unten rechts legt die aktuelle Folge hier ab.</p>';return;}
  el.innerHTML=favs.map((f,i)=>{
    const kn=(useSharps(f.key,f.mode)?NOTE_SHARP:NOTE_FLAT)[f.key]+(f.mode==='dur'?'-Dur':'-Moll');
    const names=f.loop.map(id=>{const c=chordName(byId(f.mode,id),f.key,f.mode,S.nine);return c.root+c.suf;}).join(' · ');
    return `<div class="fav"><button class="load" data-i="${i}"><b>${kn}</b>${names}</button><button class="del" data-i="${i}" aria-label="Folge ${i+1} löschen">×</button></div>`;
  }).join('');
}

