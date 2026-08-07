(()=>{
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Single smooth-scroll owner. Sections never intercept or snap independently. */
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
      this.current=lerp(this.current,this.target,.095);
      if(Math.abs(this.target-this.current)<.2)this.current=this.target;
      scrollTo(0,this.current);
      if(this.current!==this.target)this.raf=requestAnimationFrame(()=>this.tick());else this.raf=0;
    }
    goTo(y){this.target=clamp(y,0,this.max());this.start()}
  }
  const smooth=new SmoothScroll();

  /* Hero three-line statement + visible rotating typewriter. */
  const typeTarget=document.getElementById('heroTypewriter');
  const metaLines=['20+ YEARS OF XP','DESIGN, LEADERSHIP, COACHING','SUPERPOWER: FINDING YOUR SUPERPOWER'];
  async function runTypewriter(){
    if(!typeTarget)return;
    await wait(reduce?30:650);
    while(true){
      for(const line of metaLines){
        typeTarget.textContent='';
        for(const ch of line){typeTarget.textContent+=ch;await wait(reduce?1:38)}
        await wait(reduce?50:1450);
        while(typeTarget.textContent.length){typeTarget.textContent=typeTarget.textContent.slice(0,-1);await wait(reduce?1:17)}
        await wait(reduce?20:250);
      }
    }
  }
  runTypewriter();

  /* TextPressure-inspired hero name. Individual letters respond smoothly to pointer
     distance using weight + restrained horizontal scale, while the container is
     optically fitted to the viewport so no letter can spill over the edges. */
  const nameWrap=document.getElementById('heroNameWrap');
  const name=document.getElementById('heroName');
  const letters=[...document.querySelectorAll('.name-letter')];
  const pointer={x:innerWidth/2,y:innerHeight*.78};
  const eased={x:pointer.x,y:pointer.y};
  let pressureRaf=0;

  function fitName(){
    if(!nameWrap||!name)return;
    name.style.transform='scaleX(1)';
    const available=nameWrap.clientWidth;
    const measured=name.scrollWidth;
    const fit=measured>0?Math.min(1,available/measured):1;
    name.style.transform=`scaleX(${fit})`;
  }
  addEventListener('resize',fitName,{passive:true});
  fitName();

  function pressureTick(){
    eased.x+=(pointer.x-eased.x)/15;
    eased.y+=(pointer.y-eased.y)/15;
    const maxDist=Math.max(innerWidth*.38,360);
    for(const span of letters){
      const r=span.getBoundingClientRect();
      const cx=r.left+r.width/2,cy=r.top+r.height/2;
      const d=Math.hypot(eased.x-cx,eased.y-cy);
      const influence=clamp(1-d/maxDist,0,1);
      const wght=Math.round(360+influence*330);
      const sx=.94+influence*.14;
      span.style.fontVariationSettings=`'wght' ${wght}`;
      span.style.transform=`scaleX(${sx})`;
    }
    pressureRaf=requestAnimationFrame(pressureTick);
  }
  addEventListener('pointermove',e=>{pointer.x=e.clientX;pointer.y=e.clientY},{passive:true});
  if(!reduce)pressureRaf=requestAnimationFrame(pressureTick);

  /* Accent loop remains the only autonomous character mutation. */
  const accentLetters=letters.filter(el=>el.dataset.accent);
  async function accentLoop(){
    if(reduce||!accentLetters.length)return;
    await wait(2600);
    while(true){
      const el=accentLetters[Math.floor(Math.random()*accentLetters.length)];
      const base=el.dataset.base||el.textContent;
      el.textContent=el.dataset.accent;
      await wait(620);
      el.textContent=base;
      await wait(2400+Math.random()*2600);
    }
  }
  accentLoop();

  /* Recent Works appears only when the second (stage) viewport has fully arrived. */
  const stage=document.getElementById('projectsStage');
  const kicker=document.getElementById('projectsKicker');
  const rows=[...document.querySelectorAll('.project-row')];
  const previews=[...document.querySelectorAll('.project-preview')];
  let stageStarted=false;
  let cycleTimer=0;
  let activeIndex=0;

  function revealStage(){
    if(stageStarted)return;
    stageStarted=true;
    kicker.classList.add('is-revealed');
    rows.forEach((row,i)=>setTimeout(()=>row.classList.add('is-revealed'),220+i*170));
    const introDelay=220+rows.length*170+750;
    setTimeout(()=>startProjectCycle(0),introDelay);
  }

  function setActiveProject(next,animateWipe=true){
    next=(next+rows.length)%rows.length;
    const old=activeIndex;
    if(next===old && rows[next].classList.contains('is-running'))return;

    clearTimeout(cycleTimer);
    rows.forEach((row,i)=>{
      row.classList.toggle('is-active',i===next);
      row.classList.remove('is-running');
      const progress=row.querySelector('.project-progress');
      if(progress){progress.style.animation='none';void progress.offsetWidth;progress.style.animation=''}
    });

    const oldPreview=previews[old];
    const newPreview=previews[next];
    if(newPreview)newPreview.classList.add('is-active');

    if(animateWipe && oldPreview && oldPreview!==newPreview && oldPreview.classList.contains('is-active')){
      oldPreview.classList.add('is-wiping');
      const done=()=>{
        oldPreview.classList.remove('is-active','is-wiping');
        oldPreview.removeEventListener('animationend',done);
      };
      oldPreview.addEventListener('animationend',done);
      setTimeout(done,650);
    }else if(oldPreview && oldPreview!==newPreview){
      oldPreview.classList.remove('is-active','is-wiping');
    }

    activeIndex=next;
    requestAnimationFrame(()=>rows[next].classList.add('is-running'));
    cycleTimer=setTimeout(()=>setActiveProject((next+1)%rows.length,true),5000);
  }

  function startProjectCycle(index){
    activeIndex=index;
    rows.forEach((row,i)=>row.classList.toggle('is-active',i===index));
    previews.forEach((preview,i)=>preview.classList.toggle('is-active',i===index));
    rows.forEach(row=>row.classList.remove('is-running'));
    requestAnimationFrame(()=>rows[index].classList.add('is-running'));
    clearTimeout(cycleTimer);
    cycleTimer=setTimeout(()=>setActiveProject((index+1)%rows.length,true),5000);
  }

  const stageObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){
      // threshold 0.985 means the stage must essentially fill the viewport first.
      if(entry.target===stage && entry.intersectionRatio>=.985)revealStage();
    }
  },{threshold:[.5,.75,.9,.985,1]});
  stageObserver.observe(stage);

  rows.forEach((row,i)=>{
    row.addEventListener('click',()=>setActiveProject(i,true));
  });

  /* Cursor. */
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
