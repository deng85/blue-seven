/* ================= Zufall mit Startwert ================= */
/* Gleicher Startwert, gleiche Zahlenfolge. Damit lassen sich Folgen und Songs reproduzieren und testen. */

// Liefert eine Funktion wie Math.random (Werte von 0 bis unter 1), Verfahren: mulberry32.
function createRng(seed){
  let a=seed>>>0;
  return ()=>{
    a|=0;a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
// Ein frischer Startwert, zum Beispiel für einen neuen Song. Er wird im Song gespeichert.
function randomSeed(rnd){return Math.floor((rnd||Math.random)()*4294967296);}

export {createRng,randomSeed};
