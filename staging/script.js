(()=>{
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const smoothstep=t=>{t=clamp(t);return t*t*(3-2*t)};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* One smooth-scroll owner. No section gets its own wheel handler. */
  class SmoothScroll{
    constructor(){
      this.enabled=!reduce&&matchMedia('(pointer:fine)').matches;
      this.current=window.scrollY;this.target=window.scrollY;this.raf=0;
      if(!this.enabled)return;
      addEventListener('wheel',e=>this.onWheel(e),{passive:false});
      addEventListener('keydown',e=>this.onKey(e));
      addEventListener('resize',()=>{this.target=clamp(this.target,0,this.max())},{passive:true});
    }
    max(){return Math.max(0,document.documentElement.scrollHeight-innerHeight)}
    onWheel(e){
      if(e.ctrlKey)return;
      e.preventDefault();
      const d=e.deltaMode===1?e.deltaY*16:e.deltaMode===2?e.deltaY*innerHeight:e.deltaY;
      this.target=clamp(this.target+d,0,this.max());this.start();
    }
    onKey(e){
      if(/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)||e.metaKey||e.ctrlKey||e.altKey)return;
      const map={ArrowDown:72,ArrowUp:-72,PageDown:innerHeight*.8,PageUp:-innerHeight*.8,' ':innerHeight*.8};
      if(e.key==='Home'){e.preventDefault();this.target=0;return this.start()}
      if(e.key==='End'){e.preventDefault();this.target=this.max();return this.start()}
      if(!(e.key in map))return;
      e.preventDefault();this.target=clamp(this.target+map[e.key],0,this.max());this.start();
    }
    start(){if(!this.raf)this.raf=requestAnimationFrame(()=>this.tick())}
    tick(){
      this.current=lerp(this.current,this.target,.105);
      if(Math.abs(this.target-this.current)<.22)this.current=this.target;
      scrollTo(0,this.current);
      document.dispatchEvent(new CustomEvent('mf:smoothscroll'));
      if(this.current!==this.target)this.raf=requestAnimationFrame(()=>this.tick());else this.raf=0;
    }
    goTo(y){this.target=clamp(y,0,this.max());this.start()}
  }
  const smooth=new SmoothScroll();

  /* Hero: authored three-line statement + the original rotating meta typewriter. */
  const typeTarget=document.getElementById('heroTypewriter');
  const metaLines=['20+ YEARS OF XP','DESIGN, LEADERSHIP, COACHING','SUPERPOWER: FINDING YOUR SUPERPOWER'];
  async function runTypewriter(){
    if(!typeTarget)return;
    await wait(reduce?50:900);
    while(true){
      for(const line of metaLines){
        typeTarget.textContent='';
        for(const ch of line){typeTarget.textContent+=ch;await wait(reduce?2:42)}
        await wait(reduce?80:1250);
        while(typeTarget.textContent.length){typeTarget.textContent=typeTarget.textContent.slice(0,-1);await wait(reduce?1:20)}
        await wait(reduce?30:260);
      }
    }
  }
  runTypewriter();

  /* Hero name loop: accents only. No chroma, blur, disappear, glitch or whole-name effect. */
  const accentLetters=[...document.querySelectorAll('.name-letter[data-accent]')];
  async function accentPulse(el){
    const base=el.textContent,accent=el.dataset.accent;
    el.classList.add('is-accenting');el.textContent=accent;
    await wait(650);
    el.textContent=base;el.classList.remove('is-accenting');
  }
  async function nameLoop(){
    if(reduce)return;
    await wait(2600);
    while(true){
      const first=accentLetters[Math.floor(Math.random()*accentLetters.length)];
      await accentPulse(first);await wait(2200+Math.random()*2600);
    }
  }
  nameLoop();

  /* Reveal = the supplied masked upward + blur-resolve animation. */
  function buildReveal(el,mode='words'){
    if(el.dataset.revealBuilt)return [];
    el.dataset.revealBuilt='1';
    const text=el.textContent;el.textContent='';
    const parts=mode==='chars'?Array.from(text):text.split(/(\s+)/),pieces=[];
    for(const part of parts){
      if(!part)continue;
      if(/^\s+$/.test(part)){el.append(document.createTextNode(part));continue}
      const mask=document.createElement('span');mask.className='reveal-mask';
      const piece=document.createElement('span');piece.className='reveal-piece';piece.textContent=part;
      mask.append(piece);el.append(mask);pieces.push(piece);
    }
    return pieces;
  }
  const heading=document.getElementById('projectsHeading');
  const headingPieces=buildReveal(heading.querySelector('[data-reveal]'),'words');
  let headingPlayed=false;
  function revealHeading(){
    if(headingPlayed)return;headingPlayed=true;heading.classList.add('is-visible');
    headingPieces.forEach((p,i)=>setTimeout(()=>p.classList.add('is-in'),i*90));
  }

  /* Recent Works: scroll progress owns every row reveal and every image state continuously. */
  const section=document.getElementById('projects');
  const stage=section.querySelector('.projects-sticky');
  const rows=[...document.querySelectorAll('.project-row')];
  const previews=[...document.querySelectorAll('.project-preview')];
  let hoverIndex=-1;

  function projectState(){
    const rect=section.getBoundingClientRect();
    const travel=Math.max(1,section.offsetHeight-innerHeight);
    // progress only starts once the project background fully occupies the viewport
    const raw=clamp(-rect.top/travel,0,1);

    if(rect.top<=0 && raw>.018)revealHeading();

    // strips reveal continuously, one after another
    const revealStart=.07,revealSpan=.065;
    rows.forEach((row,i)=>{
      const r=smoothstep((raw-(revealStart+i*revealSpan))/revealSpan);
      row.style.setProperty('--reveal',r.toFixed(4));
    });

    // activation begins only after all four strips have materially arrived
    const activeStart=.31,activeEnd=.79;
    const q=clamp((raw-activeStart)/(activeEnd-activeStart),0,1)*3;
    const inActiveRange=raw>=activeStart;

    rows.forEach((row,i)=>{
      const scrollWeight=inActiveRange?smoothstep(1-clamp(Math.abs(q-i),0,1)):0;
      const weight=hoverIndex===i?Math.max(scrollWeight,.92):scrollWeight;
      row.style.setProperty('--active',weight.toFixed(4));
    });

    previews.forEach((preview,i)=>{
      let weight=inActiveRange?smoothstep(1-clamp(Math.abs(q-i),0,1)):0;
      if(hoverIndex>=0)weight=hoverIndex===i?1:0;
      preview.style.opacity=weight.toFixed(4);
      preview.style.transform=`translateY(${(1-weight)*24}px)`;
    });

    stage.classList.toggle('is-exiting',raw>.86);
  }
  addEventListener('scroll',projectState,{passive:true});
  document.addEventListener('mf:smoothscroll',projectState);
  addEventListener('resize',projectState,{passive:true});
  rows.forEach((row,i)=>{
    row.addEventListener('mouseenter',()=>{hoverIndex=i;projectState()});
    row.addEventListener('mouseleave',()=>{hoverIndex=-1;projectState()});
  });
  projectState();

  /* Cursor: guaranteed visible on fine pointers; OPEN only on project rows. */
  const cursor=document.getElementById('cursor');
  let cx=-100,cy=-100,tx=-100,ty=-100,raf=0;
  function tickCursor(){
    cx=lerp(cx,tx,.42);cy=lerp(cy,ty,.42);
    cursor.style.transform=`translate3d(${cx-7}px,${cy-7}px,0)`;
    if(Math.abs(cx-tx)+Math.abs(cy-ty)>.15)raf=requestAnimationFrame(tickCursor);else raf=0;
  }
  addEventListener('pointermove',e=>{
    tx=e.clientX;ty=e.clientY;if(!raf)raf=requestAnimationFrame(tickCursor);
    cursor.classList.toggle('is-open',!!e.target.closest('.project-row'));
  },{passive:true});
  addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    const ring=document.createElement('span');ring.className='cursor-click';ring.style.left=`${e.clientX}px`;ring.style.top=`${e.clientY}px`;
    document.body.append(ring);setTimeout(()=>ring.remove(),760);
  },{passive:true});

  document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
    const target=document.querySelector(a.getAttribute('href'));if(!target)return;
    e.preventDefault();const y=target.getBoundingClientRect().top+scrollY;
    if(smooth.enabled)smooth.goTo(y);else scrollTo({top:y,behavior:'smooth'});
  }));
})();
