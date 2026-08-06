
import{playFold}from'./fold-text.js';

export function initHero(copy){
  const statement=document.getElementById('heroStatement');
  const name=document.getElementById('heroName');
  statement.innerHTML='';
  name.textContent=copy.name;
  buildStatement(statement,copy.statement);
  prepareName(name);
  playFold(statement,{words:true,stagger:.032,duration:.76});
  window.setTimeout(()=>type(copy.typewriter),1380);
  window.setTimeout(()=>playFold(name,{words:true,stagger:.09,duration:.8}),2500);
}

function buildStatement(el,text){
  const preferred=[
    'Brand, UI, AI & Visual Designer helping',
    'founders, leaders and digital creatives',
    'build distinctive brands, digital products',
    'and visual systems.'
  ];
  const source=preferred.join(' ')==text?preferred:[text];
  source.forEach((line,lineIndex)=>{
    const row=document.createElement('span');row.className='hero-line';
    line.split(/\s+/).forEach((word,i)=>{
      if(i){const gap=document.createElement('span');gap.className='fold-space';gap.textContent=' ';row.appendChild(gap)}
      const piece=document.createElement('span');piece.className='fold-piece';piece.textContent=word;row.appendChild(piece);
    });
    el.appendChild(row);
  });
  el.dataset.foldReady='1';el.classList.add('is-ready');
}
function prepareName(el){
  const text=el.textContent;el.textContent='';
  text.split(/\s+/).forEach((word,i)=>{if(i){const gap=document.createElement('span');gap.className='fold-space';gap.textContent=' ';el.appendChild(gap)}const piece=document.createElement('span');piece.className='fold-piece';piece.textContent=word;el.appendChild(piece)});
  el.dataset.foldReady='1';el.classList.add('is-ready');
}
function type(text){
  const el=document.getElementById('typewriter');let index=0;
  function step(){el.textContent=text.slice(0,index++);if(index<=text.length)window.setTimeout(step,18)}step();
}
