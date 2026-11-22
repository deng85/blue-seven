/* ================= WAV-Datei ================= */
/* Macht aus gerechnetem Ton eine WAV-Datei: Stereo oder Mono, 16 Bit, ohne Kompression. Reine Rechnung auf
   Zahlenfeldern, läuft in Node und wird dort getestet. */

const SILENT=.001;   // −60 dB: Darunter gilt der Ausklang als verklungen

// Wo die Datei endet, als Nummer des ersten Samples, das nicht mehr dazugehört. channels sind die Kanäle als
// Float32Array, body ist das Ende des letzten Takts. Mit tail läuft die Datei weiter, bis kein Kanal mehr
// lauter als −60 dB ist, sonst endet sie genau bei body.
function audioEnd(channels,body,tail){
  const len=channels[0].length;
  if(!tail)return Math.min(body,len);
  let end=len;
  while(end>body&&channels.every(c=>Math.abs(c[end-1])<SILENT))end--;
  return end;
}
// Schreibt die Samples von start bis end als WAV. fade: so viele Samples am Ende werden ausgeblendet, damit ein
// Ausklang, der an der Obergrenze endet, nicht knackt. Liefert einen ArrayBuffer.
function encodeWav(channels,sampleRate,start,end,fade){
  const ch=channels.length,from=start||0,to=end===undefined?channels[0].length:end,n=Math.max(0,to-from),f=Math.min(fade||0,n);
  const bytes=n*ch*2,buf=new ArrayBuffer(44+bytes),v=new DataView(buf);
  const str=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  str(0,'RIFF');v.setUint32(4,36+bytes,true);str(8,'WAVE');
  str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,ch,true);
  v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*ch*2,true);v.setUint16(32,ch*2,true);v.setUint16(34,16,true);
  str(36,'data');v.setUint32(40,bytes,true);
  const out=new Int16Array(buf,44,n*ch);
  for(let i=0;i<n;i++){
    const g=i>=n-f?(n-i)/f:1;
    for(let c=0;c<ch;c++){
      const x=Math.max(-1,Math.min(1,channels[c][from+i]*g));
      out[i*ch+c]=Math.round(x<0?x*32768:x*32767);
    }
  }
  return buf;
}
// Größe der Datei in Bytes für eine Dauer in Sekunden.
const wavBytes=(seconds,sampleRate,channels)=>44+Math.round(seconds*sampleRate)*channels*2;

export {audioEnd,encodeWav,wavBytes};
