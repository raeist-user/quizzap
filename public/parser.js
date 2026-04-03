/* ══════════════════════════════════════
   PARSER
══════════════════════════════════════ */
function urduCls(q){ return q?.subject?.toLowerCase()==='urdu'?' urdu':''; }

function parseQuestions(text){
  const out=[],lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
  for(let i=0;i<lines.length;i++){
    const qLine=lines[i],oLine=lines[i+1]||'';
    const m=oLine.match(/\(A\)([^,(]+)[,，]\s*\(B\)([^,(]+)[,，]\s*\(C\)([^,(]+)[,，]\s*\(D\)([^,(]+)/i);
    if(m){
      // Detect @ marker in any option to pre-select the correct answer
      const rawOpts=[m[1],m[2],m[3],m[4]];
      let preCorrect=-1;
      const cleanOpts=rawOpts.map((o,idx)=>{
        if(o.includes('@')){ preCorrect=idx; return o.replace(/@/g,'').trim(); }
        return o.trim();
      });
      const entry={text:qLine.replace(/^\d+[.)]\s*/,'').trim(),options:cleanOpts};
      if(preCorrect>=0) entry.correct=preCorrect;
      out.push(entry);
      i++;
    }
  }
  return out;
}
