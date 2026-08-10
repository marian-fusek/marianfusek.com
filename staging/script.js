(()=>{
  const transitionCopyGlobal=document.getElementById('heroTransitionCopy');
  if(transitionCopyGlobal){
    const updateTransitionCopy=()=>{
      const t=Math.max(0,Math.min(1,scrollY/(innerHeight*.95)));
      const paragraph=transitionCopyGlobal.querySelector('p');
      if(!paragraph)return;
      transitionCopyGlobal.style.opacity=String(t>0?1-t:0);
      if(!paragraph.dataset.split){
        paragraph.innerHTML=paragraph.textContent.trim().split(/(\s+)/).map((part,i)=>part.trim()?`<span class="scroll-word" style="--i:${i}">${part}</span>`:part).join('');
        paragraph.dataset.split='1';
      }
      const words=[...paragraph.querySelectorAll('.scroll-word')];
      words.forEach((word,i)=>word.style.color=`rgba(26,26,26,${Math.max(0,Math.min(1,t*1.35-i/words.length))})`);
    };
    addEventListener('scroll',updateTransitionCopy,{passive:true});
    updateTransitionCopy();
  }
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
  const heroInfo=document.querySelector('.hero-info');
  const hitbox=document.querySelector('.hero-hitbox');
  const letters=[...document.querySelectorAll('.name-letter')];
  const pointer={x:innerWidth/2,y:innerHeight*.78};
  const eased={x:pointer.x,y:pointer.y};
  let pressureRaf=0;

  function fitName(){
    if(!nameWrap||!name)return;
    name.style.transform='none';
    const pad=getComputedStyle(document.documentElement).getPropertyValue('--pad').trim();
    const padPx=parseFloat(pad)||32;
    const available=Math.max(0,Math.min(innerWidth-(padPx*2)-12,innerWidth*.6));
    name.style.maxWidth=`${available}px`;
  }
  addEventListener('resize',fitName,{passive:true});
  fitName();
  if(monogram){
    const fadeBottomMonogram=()=>{
      const r=monogram.getBoundingClientRect();
      const fade=clamp((r.top-innerHeight*.1)/(innerHeight*.4),0,1);
      monogram.style.setProperty('--scroll-fade',String(fade));
      monogram.classList.toggle('is-scroll-faded',fade<1);
      if(heroInfo){
        const ir=heroInfo.getBoundingClientRect();
        const infoFade=clamp((ir.top-innerHeight*.1)/(innerHeight*.4),0,1);
        heroInfo.style.setProperty('--scroll-fade',String(infoFade));
        heroInfo.classList.toggle('is-scroll-faded',infoFade<1);
      }
    };
    addEventListener('scroll',fadeBottomMonogram,{passive:true});
    fadeBottomMonogram();
  }
  const navLogo=document.querySelector('.nav-logo');
  if(navLogo){
    navLogo.classList.add('is-scroll-reveal');
    const revealNavLogo=()=>navLogo.classList.toggle('is-scroll-reveal-active',monogram?monogram.getBoundingClientRect().top<=0:false);
    addEventListener('scroll',revealNavLogo,{passive:true}); revealNavLogo();
  }

  function pressureTick(){
    eased.x+=(pointer.x-eased.x)/15;
    eased.y+=(pointer.y-eased.y)/15;
    const maxDist=Math.max(innerWidth*.24,260);
    for(const span of letters){
      const r=span.getBoundingClientRect();
      const cx=r.left+r.width/2,cy=r.top+r.height/2;
      const d=Math.hypot(eased.x-cx,eased.y-cy);
      const influence=clamp(1-d/maxDist,0,1);
      const wght=Math.round(680-influence*300);
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
    const overRect=(e,el)=>{
      const r=el.getBoundingClientRect();
      return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
    };
    const updateHoverState=e=>{
      const overMono=overRect(e,hitbox)||overRect(e,monogram);
      const overFull=nameWrap.classList.contains('is-expanded')&&overRect(e,name);
      nameWrap.classList.toggle('is-expanded',overMono||overFull);
    };
    (hitbox||monogram).addEventListener('pointerenter',updateHoverState,{passive:true});
    (hitbox||monogram).addEventListener('pointermove',updateHoverState,{passive:true});
    name.addEventListener('pointerenter',updateHoverState,{passive:true});
    name.addEventListener('pointermove',updateHoverState,{passive:true});
    (hitbox||monogram).addEventListener('pointerleave',updateHoverState,{passive:true});
    name.addEventListener('pointerleave',e=>{
      if(!overRect(e,hitbox||monogram)) nameWrap.classList.remove('is-expanded');
    },{passive:true});
    addEventListener('pointermove',updateHoverState,{passive:true});
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
    const masks=images.map(img=>img.parentElement);
  if(projects&&stage&&frame&&images.length){
    let seqRaf=0;
    let projectsTop=0;
    let projectProgress=0;
    let introAutoStarted=false;
    let lastProjectProgress=0;
    const progressSegments=[...document.querySelectorAll('.projects-progress-segment')];
    const smoothstep=(edge0,edge1,x)=>{
      const t=clamp((x-edge0)/((edge1-edge0)||1e-6),0,1);
      return t*t*(3-2*t);
    };
    const renderSequence=(sequenceP)=>{
      const p=clamp(sequenceP,0,1);
      lastProjectProgress=p;
      const introP=clamp(p/.1,0,1);
      if(intro){
        const line=intro.querySelector('.projects-intro-piece');
        if(line&&p>=.35){
          line.classList.remove('is-auto');
          line.style.opacity='0';
        }
        if(line&&!line.classList.contains('is-auto')&&p<.08){
          const local=smoothstep(0,.9,introP);
          const fold=1-local;
          line.style.opacity=String(p<.14?local:0);
          line.style.transform='none';
          line.style.filter=`blur(${1.4*fold}px)`;
        }
      }
      const steps=images.length;
      const holdRatio=.4;
      const openRatio=.6;
      const unit=holdRatio+openRatio;
      const galleryStart=.08;
      const galleryP=clamp((p-galleryStart)/(1-galleryStart),0,1);
      const timeline=galleryP*steps*unit;
      const activeIndex=Math.min(steps-1,Math.floor(timeline/unit));
      const within=timeline-activeIndex*unit;
      const open=smoothstep(0,1,clamp(within/openRatio,0,1));
      const info=document.getElementById('projectsInfo');
      const transitionCopy=document.getElementById('heroTransitionCopy');
      if(transitionCopy){const fade=clamp(1-p/.08,0,1);transitionCopy.style.opacity=String(fade);}
      if(info){
        const meta=[
          ['MIUNĀE','A SKINCARE BRAND SYSTEM BUILT AROUND TIME, TACTILITY AND RESTRAINT','CREATIVE DIRECTION'],
          ['GoBaller','FOOTBALL COACHING APP FOR PLAYERS OF ALL AGES','BRAND, IOS APP'],
          ['AIMS','THE MOST ADVANCED AI SEARCH FOR MUSIC CATALOGS','WEBSITE, BRAND REFRESH, MARKETING & SALES ASSETS'],
          ['Fragments','WHATEVER I COULD FIND TO SHOW SOME VARIETY','RANDOM DESIGNS LOST IN TIME, EXPERIMENTS']
        ][activeIndex]||[];
        const key=meta.join('|');
        if(info.dataset.copy!==key){
          info.dataset.copy=key;
          info.classList.remove('is-visible');
          info.innerHTML=meta.map((text,i)=>`<span class="projects-info-col projects-info-col--${i} ${i===0?'type-project-title':'type-project-meta'}">${text}</span>`).join('');
          void info.offsetWidth;
        }
      }
      if(info) info.classList.toggle('is-visible',open>=.99);
      if(intro) intro.classList.toggle('is-gallery-moving',open>0.01);
      window.dispatchEvent(new CustomEvent('projects-shader-progress',{detail:{progress:galleryP,index:activeIndex,open,images:images.map(img=>img.currentSrc||img.src)}}));
      stage.dataset.step=String(activeIndex);
      progressSegments.forEach((seg,i)=>{
        const segTimeline=clamp((timeline-i*unit)/unit,0,1);
        const segFill=i<activeIndex?1:(i===activeIndex?Math.min(1,segTimeline):0);
        seg.style.setProperty('--seg-fill',String(segFill));
      });
      images.forEach((img,i)=>{
        const mask=masks[i];
        const before=i<activeIndex;
        const active=i===activeIndex;
        const next=i===activeIndex+1;
        const settle=before?1:active?open:0;
        const holdP=active?clamp((within-openRatio)/holdRatio,0,1):0;
        const zoom=before?1:active?lerp(1.05,1,holdP):1.05;
        const revealY=before?0:active?lerp(75,0,smoothstep(0,.96,settle)):75;
        const revealLeft=before?0:25;
        const galleryVisible=p>=galleryStart;
        const opacity=!galleryVisible?0:before?1:active?lerp(.35,1,smoothstep(0,.18,settle)):next?0:0;
        img.classList.toggle('is-active',active||before);
        img.style.opacity=String(opacity);
        img.style.transform=`scale(${zoom})`;
        img.style.transformOrigin='center bottom';
        img.style.transition=galleryVisible?'opacity .85s var(--ease), clip-path .85s var(--ease), transform .85s var(--ease)':'none';
        const revealBottom=active&&!before?lerp(100,0,smoothstep(0,.96,settle)):0;
        img.style.clipPath='none';
        if(mask){let maskClip='inset(100% 0 0 0)';if(before)maskClip='inset(0)';else if(active){const r=lerp(100,0,smoothstep(0,.96,settle));maskClip=i===0?`inset(${r}% 0 0 0)`:i===1?`inset(0 0 ${r}% 0)`:i===2?`inset(0 ${r}% 0 0)`: `inset(0 0 0 ${r}%)`;}mask.style.clipPath=maskClip;mask.style.zIndex=String(active?100+i:before?10+i:0);}
        if(active&&!before){
          const size=75;
          img.style.width=`${size}%`;
          img.style.height='auto';
          img.style.left=`${100-size}%`;
          img.style.right='auto';
          img.style.top='auto';
          img.style.bottom='var(--pad)';
          img.style.objectFit='contain';
        }else{
          img.style.width='75%';img.style.height='auto';img.style.left='25%';img.style.top='auto';img.style.bottom='var(--pad)';img.style.objectFit='contain';
        }
        img.style.filter='saturate(.98) contrast(.98)';
        img.style.zIndex=String(active?100+i:before?10+i:0);
        img.style.pointerEvents='none';
      });
      if(info){requestAnimationFrame(()=>{const target=masks[activeIndex],fr=frame.getBoundingClientRect(),shellRect=frame.parentElement.getBoundingClientRect(),navRect=document.querySelector('.site-nav')?.getBoundingClientRect(),ir=target&&target.getBoundingClientRect();if(ir){const menuBottom=navRect?.bottom||0;const metadataY=menuBottom+(ir.top-menuBottom)*.75;info.style.top=`${metadataY-shellRect.top}px`;info.style.left=`${fr.left-shellRect.left}px`;info.style.width=`${fr.width}px`;info.style.transform='none';}});}
      stage.classList.toggle('is-released',p>=.999);
    };
    const projectRange=()=>Math.max(1,projects.scrollHeight-innerHeight);
    const renderFromScroll=()=>{
      const projStart=projectsTop;
      const raw=clamp((scrollY-projStart)/projectRange(),0,1);
      projectProgress=raw;
      renderSequence(raw);
    };
    const updateSequence=()=>{
      seqRaf=0;
      renderFromScroll();
    };
    const requestSequenceUpdate=()=>{if(!seqRaf)seqRaf=requestAnimationFrame(updateSequence)};
    addEventListener('scroll',requestSequenceUpdate,{passive:true});
    addEventListener('resize',requestSequenceUpdate,{passive:true});
    const measure=()=>{projectsTop=projects.getBoundingClientRect().top+scrollY;};
    measure();
    const startIntroAuto=()=>{
      const line=intro.querySelector('.projects-intro-piece');
      if(!line) return;
      introAutoStarted=true;
      line.classList.remove('is-auto');
      void line.offsetWidth;
      line.classList.add('is-auto');
    };
    const introObserver=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting&&entry.intersectionRatio>=.98) startIntroAuto();
      });
    },{threshold:[.98]});
    introObserver.observe(stage.querySelector('.projects-shell')||stage);
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
