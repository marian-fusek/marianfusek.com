import{playFold}from'./fold-text.js';

export function initGuidance(data){
  const section=document.getElementById('guidance');
  const left=document.querySelector('.guidance-left');
  const right=document.querySelector('.guidance-right');
  left.querySelector('p').textContent=data.mindset.description;
  right.querySelector('p').textContent=data.leadership.description;
  const heads=[left.querySelector('h2'),right.querySelector('h2')];
  heads.forEach(prepareLines);
  let played=false;

  function frame(){
    const rect=section.getBoundingClientRect();
    const progress=Math.max(0,Math.min(1,-rect.top/(section.offsetHeight-innerHeight)));
    if(!played&&progress>.39){
      played=true;
      heads.forEach((head,i)=>playFold(head,{words:true,delay:i*.05,stagger:.10,duration:.76}));
      [left,right].forEach((zone,i)=>zone.querySelector('p').animate(
        [{opacity:0,transform:'translateY(16px)'},{opacity:1,transform:'translateY(0)'}],
        {duration:760,delay:520+i*80,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'}
      ));
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

}

function prepareLines(head){
  const words=head.textContent.trim().split(/\s+/);
  head.textContent='';
  words.forEach(word=>{
    const line=document.createElement('span');
    line.className='word fold-piece';
    line.textContent=word;
    head.appendChild(line);
  });
  head.classList.add('is-ready');
  head.dataset.foldReady='1';
}
