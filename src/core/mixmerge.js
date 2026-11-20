/* ================= Mixer-Einstellungen übernehmen ================= */
/* Wird der Inhalt eines Songs neu erzeugt, sollen die Einstellungen des Nutzers bleiben (F-P9).
   mergeMixer nimmt den frisch erzeugten Mixer und trägt die Werte aus dem bisherigen ein. Zugeordnet wird
   über die IDs von Kanälen, Effektspuren, Inserts und Sends. Was es im neuen Mixer nicht gibt, entfällt,
   was im bisherigen fehlt oder unbrauchbar ist, behält den Wert des neuen. */

const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const byId=(list,id)=>Array.isArray(list)?list.find(x=>isObj(x)&&x.id===id):undefined;

function carry(to,from,numbers,bools){
  for(const k of numbers)if(typeof from[k]==='number'&&Number.isFinite(from[k]))to[k]=from[k];
  for(const k of bools)if(typeof from[k]==='boolean')to[k]=from[k];
}
// Inserts: nur bei gleicher ID und gleichem Effekttyp.
function carryInserts(to,from){
  for(const x of to||[]){
    const y=byId(from,x.id);
    if(!y||y.type!==x.type)continue;
    carry(x,y,[],['bypass']);
    if(isObj(y.params))x.params=Object.assign({},x.params,y.params);
  }
}

function mergeMixer(fresh,user){
  const out=JSON.parse(JSON.stringify(fresh));
  if(!isObj(user))return out;
  for(const ch of out.channels||[]){
    const u=byId(user.channels,ch.id);if(!u)continue;
    carry(ch,u,['gain','pan'],['mute','solo']);
    for(const s of ch.sends||[]){
      const us=Array.isArray(u.sends)?u.sends.find(x=>isObj(x)&&x.to===s.to):undefined;
      if(us)carry(s,us,['gain'],[]);
    }
    carryInserts(ch.inserts,u.inserts);
  }
  for(const r of out.returns||[]){
    const u=byId(user.returns,r.id);if(!u)continue;
    carry(r,u,['gain'],['mute']);
    carryInserts(r.inserts,u.inserts);
  }
  if(isObj(user.master)&&isObj(out.master)){
    carry(out.master,user.master,['gain'],[]);
    carryInserts(out.master.inserts,user.master.inserts);
  }
  return out;
}

export {mergeMixer};
