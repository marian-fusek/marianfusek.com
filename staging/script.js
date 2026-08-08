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
  const monogram=document.querySelector('.hero-monogram');
  const letters=[...document.querySelectorAll('.name-letter')];
  const pointer={x:innerWidth/2,y:innerHeight*.78};
  const eased={x:pointer.x,y:pointer.y};
  let pressureRaf=0;

  function fitName(){
    if(!nameWrap||!name)return;
    name.style.transform='scaleX(1)';
    const available=nameWrap.clientWidth;
    const measured=name.scrollWidth;
    const fit=measured>0?Math.min(1,(available/measured)*.985):1;
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
      const wght=Math.round(620-influence*180);
      const sx=1.0-influence*.06;
      span.style.fontVariationSettings=`'wght' ${wght}`;
      span.style.transform=`scaleX(${sx})`;
    }
    pressureRaf=requestAnimationFrame(pressureTick);
  }
  addEventListener('pointermove',e=>{pointer.x=e.clientX;pointer.y=e.clientY},{passive:true});
  if(!reduce)pressureRaf=requestAnimationFrame(pressureTick);

  /* Only the MF monogram opens the name. Once expanded, the pointer can travel
     across the full name without closing it. */
  if(nameWrap&&monogram&&name){
    const updateHoverState=e=>{
      const r=monogram.getBoundingClientRect();
      const overMono=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
      nameWrap.classList.toggle('is-expanded',overMono);
    };
    monogram.addEventListener('pointerenter',updateHoverState,{passive:true});
    monogram.addEventListener('pointermove',updateHoverState,{passive:true});
    monogram.addEventListener('pointerleave',()=>nameWrap.classList.remove('is-expanded'),{passive:true});
    nameWrap.addEventListener('focusout',()=>nameWrap.classList.remove('is-expanded'));
  }

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

  /* Pinned four-step fullscreen image sequence. */
  const projects=document.getElementById('projects');
  const stage=document.getElementById('projectsStage');
  const frame=document.getElementById('projectsFrame');
  const intro=document.getElementById('projectsIntro');
  const images=frame?[...frame.querySelectorAll('.projects-image')]:[];
  if(projects&&stage&&frame&&images.length){
    let seqRaf=0;
    let projectsTop=0;
    const progressSegments=[...document.querySelectorAll('.projects-progress-segment')];
    const smoothstep=(edge0,edge1,x)=>{
      const t=clamp((x-edge0)/((edge1-edge0)||1e-6),0,1);
      return t*t*(3-2*t);
    };
    const renderSequence=(sequenceP)=>{
      const p=clamp(sequenceP,0,1);
      const introP=clamp(p/.82,0,1);
      if(intro){
        const line=intro.querySelector('.projects-intro-piece');
        if(line){
          const local=smoothstep(0,.9,introP);
          const fold=1-local;
          line.style.opacity=String(p<.86?local:0);
          line.style.transform=`rotateX(${92*fold}deg) translateY(${18*fold}px)`;
          line.style.filter=`blur(${1.4*fold}px)`;
        }
      }
      const steps=images.length;
      const holdRatio=.72;
      const openRatio=.28;
      const unit=holdRatio+openRatio;
      const timeline=p*steps*unit;
      const activeIndex=Math.min(steps-1,Math.floor(timeline/unit));
      const within=timeline-activeIndex*unit;
      const open=smoothstep(0,1,clamp(within/openRatio,0,1));
      stage.dataset.step=String(activeIndex);
      progressSegments.forEach((seg,i)=>{
        const segTimeline=clamp((timeline-i*unit)/unit,0,1);
        const segFill=i<activeIndex?1:(i===activeIndex?Math.min(1,segTimeline):0);
        seg.style.setProperty('--seg-fill',String(segFill));
      });
      images.forEach((img,i)=>{
        const before=i<activeIndex;
        const active=i===activeIndex;
        const next=i===activeIndex+1;
        const settle=before?1:active?open:0;
        const zoom=before?1:active?lerp(1.28,1,settle):1.35;
        const insetX=before?0:active?lerp(29,0,settle):29;
        const insetY=before?0:active?lerp(21,0,settle):21;
        const opacity=i===0?1:before?1:active?lerp(.35,1,smoothstep(0,.18,settle)):next?0:0;
        img.classList.toggle('is-active',active||before);
        img.style.opacity=String(opacity);
        img.style.transform=`scale(${zoom})`;
        img.style.clipPath=`inset(${insetY}% ${insetX}% ${insetY}% ${insetX}%)`;
        img.style.zIndex=String(active?100+i:before?10+i:0);
        img.style.pointerEvents='none';
      });
      stage.classList.toggle('is-released',p>=.999);
    };
    const updateSequence=()=>{
      seqRaf=0;
      const projStart=projectsTop-innerHeight;
      const raw=clamp((scrollY-projStart)/(innerHeight*7.2),0,1);
      renderSequence(raw);
    };
    const requestSequenceUpdate=()=>{if(!seqRaf)seqRaf=requestAnimationFrame(updateSequence)};
    addEventListener('scroll',requestSequenceUpdate,{passive:true});
    addEventListener('resize',requestSequenceUpdate,{passive:true});
    const measure=()=>{projectsTop=projects.getBoundingClientRect().top+scrollY;};
    measure();
    addEventListener('resize',measure,{passive:true});
    requestSequenceUpdate();
  }

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
    cursor.classList.toggle('is-open',!!e.target.closest('.projects-frame'));
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
