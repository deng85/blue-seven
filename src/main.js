/* ================= Bedienung ================= */
function bind(){
  $('keys12').innerHTML=['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B'].map((n,i)=>`<button data-v="${i}">${n}</button>`).join('');
  $('tiles').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;const i=+b.dataset.i;
    if(b.classList.contains('lock')){S.locks[i]=!S.locks[i];render();save();}
    else if(!playing)audition(i);
  });
  $('play').addEventListener('click',()=>playing?stop():start());
  $('gen').addEventListener('click',()=>{pushHist();newLoop();});
  $('back').addEventListener('click',()=>{
    const h=hist.pop();if(!h)return;
    S.key=h.key;S.mode=h.mode;S.n=h.n;S.loop=h.loop;S.locks=Array(S.n).fill(false);revoice();render();save();
  });
  $('fav').addEventListener('click',()=>{
    const f={key:S.key,mode:S.mode,loop:S.loop.slice()},same=x=>x.key===f.key&&x.mode===f.mode&&x.loop.join()===f.loop.join();
    if(!favs.some(same)){favs.unshift(f);if(favs.length>24)favs.pop();}
    renderFavs();save();$('hint').textContent='Gemerkt. Die Folge liegt unten bei den gemerkten Folgen.';
  });
  $('favs').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;const i=+b.dataset.i;
    if(b.classList.contains('del'))favs.splice(i,1);
    else{const f=favs[i];pushHist();S.key=f.key;S.mode=f.mode;S.n=f.loop.length;S.loop=f.loop.slice();S.locks=Array(S.n).fill(false);revoice();}
    render();save();
  });
  $('segN').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||+b.dataset.v===S.n)return;
    pushHist();S.n=+b.dataset.v;S.loop=S.loop.slice(0,S.n);S.locks=Array.from({length:S.n},(_,i)=>!!S.locks[i]&&!!S.loop[i]);newLoop();});
  $('segMode').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.dataset.v===S.mode)return;
    pushHist();S.mode=b.dataset.v;S.loop=[];S.locks=Array(S.n).fill(false);newLoop();});
  $('segFeel').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.feel=b.dataset.v;render();save();});
  $('segNine').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.nine=+b.dataset.v;revoice();render();save();});
  $('keys12').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.key=+b.dataset.v;revoice();render();save();});
  for(const id of ['spice','bpm','swing','volR','volB','volD'])$(id).addEventListener('input',e=>{S[id]=+e.target.value;setVols();render();save();});
}
function boot(d){
  load(d);buildKeys();bind();
  if(S.loop.length){revoice();render();}else newLoop();
}
if(window.claude&&window.claude.hot){
  window.claude.hot.snapshot&&window.claude.hot.snapshot(()=>({S,favs}));
  window.claude.hot.ready?window.claude.hot.ready(boot):boot(window.claude.hot.data||{});
}else boot({});
