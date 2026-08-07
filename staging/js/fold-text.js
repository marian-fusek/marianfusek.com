export function prepareFold(el,{words=false,lines=false}={}){
  if(!el||el.dataset.foldReady)return;
  const raw=el.dataset.text??el.textContent;
  el.textContent='';
  const append=(value,cls='')=>{const segment=document.createElement('span');segment.className=`fold-segment ${cls}`.trim();const piece=document.createElement('span');piece.className='fold-piece';piece.textContent=value||'\u00a0';segment.appendChild(piece);el.appendChild(segment)};
  if(lines){raw.split('\n').forEach((line,li)=>{const row=document.createElement('span');row.className='fold-line';line.split(/(\s+)/).forEach(part=>{if(!part)return;if(/^\s+$/.test(part)){const gap=document.createElement('span');gap.className='fold-space';gap.textContent=part;row.appendChild(gap)}else{const seg=document.createElement('span');seg.className='fold-segment';const piece=document.createElement('span');piece.className='fold-piece';piece.textContent=part;seg.appendChild(piece);row.appendChild(seg)}});el.appendChild(row)});
  }else if(words){raw.split(/(\s+)/).forEach(part=>{if(!part)return;if(/^\s+$/.test(part)){const gap=document.createElement('span');gap.className='fold-space';gap.textContent=part;el.appendChild(gap)}else append(part)});
  }else Array.from(raw).forEach(char=>char===' '?append('\u00a0','is-space'):append(char));
  el.dataset.foldReady='1';el.classList.add('is-ready');
}
export function playFold(el,{delay=0,stagger=.035,duration=.68,words=false,lines=false,hinge='top',crease=.45}={}){
  prepareFold(el,{words,lines});
  const pieces=[...el.querySelectorAll('.fold-piece')];
  const rotation=hinge==='bottom'?88:-88;
  pieces.forEach((piece,i)=>{
    piece.style.setProperty('--fold-crease',String(crease));
    piece.animate([
      {opacity:0,transform:`perspective(700px) rotateX(${rotation}deg) translateY(${hinge==='bottom'?-10:10}px)`,filter:'blur(1.5px)'},
      {opacity:1,transform:'perspective(700px) rotateX(0deg) translateY(0)',filter:'blur(0)'}
    ],{duration:duration*1000,delay:(delay+i*stagger)*1000,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'}).onfinish=()=>piece.style.setProperty('--fold-crease','0');
  });
}
