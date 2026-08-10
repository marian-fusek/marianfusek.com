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
      if(document.body.classList.contains('case-overlay-open'))return;
      if(e.ctrlKey)return;
      e.preventDefault();
      const d=e.deltaMode===1?e.deltaY*16:e.deltaMode===2?e.deltaY*innerHeight:e.deltaY;
      this.target=clamp(this.target+d,0,this.max());this.start();
    }
    onKey(e){
      if(document.body.classList.contains('case-overlay-open'))return;
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
  let nameExitProgress=0;

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
  const alignHeroInfo=()=>{
    if(!heroInfo||!name)return;
    heroInfo.style.top=`${name.getBoundingClientRect().top}px`;
    heroInfo.style.bottom='auto';
  };
  addEventListener('resize',alignHeroInfo,{passive:true});
  requestAnimationFrame(alignHeroInfo);
  document.fonts?.ready?.then(alignHeroInfo);
  if(monogram){
    const renderHeroExit=()=>{
      const infoWipe=clamp(scrollY/(innerHeight*.8),0,1);
      nameExitProgress=clamp((scrollY-innerHeight*.06)/(innerHeight*.34),0,1);
      if(nameWrap){
        nameWrap.classList.add('is-expanded');
        nameWrap.classList.add('is-hero-pinned');
        nameWrap.style.setProperty('--hero-name-exit-y',`${-nameExitProgress*Math.min(96,innerHeight*.12)}px`);
        nameWrap.style.setProperty('--hero-name-wipe',String(nameExitProgress));
        nameWrap.style.setProperty('--hero-name-fade',String(1-nameExitProgress));
        nameWrap.classList.toggle('is-scroll-wiped',nameExitProgress>0);
      }
      if(name){
        name.style.opacity='';
      }
      if(heroInfo){
        const infoFade=1-infoWipe;
        heroInfo.style.setProperty('--hero-info-scroll-y',`${scrollY-infoWipe*Math.min(170,innerHeight*.2)}px`);
        heroInfo.style.setProperty('--scroll-fade',String(infoFade));
        heroInfo.style.setProperty('--hero-info-wipe',String(infoWipe));
        heroInfo.classList.toggle('is-scroll-faded',infoWipe>0);
      }
    };
    addEventListener('scroll',renderHeroExit,{passive:true});
    renderHeroExit();
  }
  const navLogo=document.querySelector('.nav-logo');
  if(navLogo){
    navLogo.classList.add('is-scroll-reveal');
    const revealNavLogo=()=>navLogo.classList.toggle('is-scroll-reveal-active',scrollY>=innerHeight*.06);
    addEventListener('scroll',revealNavLogo,{passive:true}); revealNavLogo();
  }

  function pressureTick(){
    eased.x+=(pointer.x-eased.x)/15;
    eased.y+=(pointer.y-eased.y)/15;
    const maxDist=Math.max(innerWidth*.24,260);
    const padPx=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pad'))||32;
    const virtualWidth=Math.max(1,innerWidth-padPx*2);
    for(const [index,span] of letters.entries()){
      const r=span.getBoundingClientRect();
      /* The visible word is optically constrained to 60vw, but its pressure
         field spans the full viewport: screen edges correspond to its first
         and last letters before the hero collapses. */
      const cx=nameWrap?.classList.contains('is-expanded')
        ?padPx+virtualWidth*((index+.5)/letters.length)
        :r.left+r.width/2;
      const cy=r.top+r.height/2;
      const d=nameWrap?.classList.contains('is-expanded')
        ?Math.abs(eased.x-cx)
        :Math.hypot(eased.x-cx,eased.y-cy);
      const influence=clamp(1-d/maxDist,0,1);
      const interactiveWeight=380+influence*300;
      const wght=Math.round(interactiveWeight);
      const sx=1+influence*.06;
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

  /* Pinned four-step fullscreen image sequence. */
  const projects=document.getElementById('projects');
  const caseOverlay=document.getElementById('caseOverlay');
  const caseOverlayImage=document.getElementById('caseOverlayImage');
  const caseOverlayMedia=document.querySelector('.case-overlay-media');
  const caseOverlayClose=document.getElementById('caseOverlayClose');
  let caseOverlayScrollY=0;
  let projectDetailOpen=false;
  let overlayInfoClone=null;
  const closeCaseOverlay=()=>{
    if(!caseOverlay?.classList.contains('is-open'))return;
    caseOverlay.classList.remove('is-open');caseOverlay.setAttribute('aria-hidden','true');
    overlayInfoClone?.remove();overlayInfoClone=null;
    document.getElementById('projectsInfo')?.style.removeProperty('visibility');
    masks.forEach(mask=>{mask.style.pointerEvents='auto';mask.style.visibility='visible';mask.style.removeProperty('transition');});
    images.forEach(image=>{image.style.removeProperty('transition');image.style.removeProperty('clip-path');});
    document.body.classList.remove('case-overlay-open');projectDetailOpen=false;smooth.goTo(caseOverlayScrollY);
  };
  caseOverlayClose?.addEventListener('click',closeCaseOverlay);
  addEventListener('keydown',event=>{if(event.key==='Escape')closeCaseOverlay();});
  const stage=document.getElementById('projectsStage');
  const frame=document.getElementById('projectsFrame');
  const intro=document.getElementById('projectsIntro');
  const images=frame?[...frame.querySelectorAll('.projects-image')]:[];
  const masks=images.map(img=>img.parentElement);
  if(projects&&stage&&frame&&images.length){
    const sweepLine=document.getElementById('projectsSweepLine');
    let seqRaf=0;
    let projectsTop=0;
    let projectProgress=0;
    let lastProjectProgress=0;
    const progressSegments=[...document.querySelectorAll('.projects-progress-segment')];
    const projectDetails=[
      ['MIUNĀE','A skincare brand system built around time, tactility and restraint','Creative Direction'],
      ['GoBaller','Football coaching app for players of all ages','Brand, iOS App'],
      ['AIMS','The most advanced AI search for music catalogs','Website, Brand Refresh, Marketing & Sales Assets']
    ];
    addEventListener('click',event=>{
      const mask=event.target.closest?.('.projects-image-mask');
      if(!mask||!caseOverlay||projectDetailOpen)return;
      const index=masks.indexOf(mask),detail=projectDetails[index];
      if(!detail)return;
      projectDetailOpen=true;
      const liveInfo=document.getElementById('projectsInfo');
      if(liveInfo){
        const infoRect=liveInfo.getBoundingClientRect();
        overlayInfoClone=liveInfo.cloneNode(true);
        overlayInfoClone.removeAttribute('id');
        overlayInfoClone.setAttribute('aria-hidden','true');
        Object.assign(overlayInfoClone.style,{position:'fixed',left:`${infoRect.left}px`,top:`${infoRect.top}px`,width:`${infoRect.width}px`,height:`${infoRect.height}px`,zIndex:'3003',visibility:'visible',opacity:'1',transform:'none',clipPath:'none',transition:'none',pointerEvents:'none'});
        overlayInfoClone.querySelectorAll('.projects-info-col').forEach(field=>Object.assign(field.style,{opacity:'1',transform:'none',clipPath:'none',animation:'none'}));
        caseOverlay.append(overlayInfoClone);
      }
      const selectedImage=images[index];
      masks.forEach(item=>item.style.pointerEvents='none');
      mask.style.zIndex='999';mask.style.transition='clip-path 1.02s var(--ease)';mask.style.clipPath='inset(0)';
      selectedImage.style.transition='transform 1.02s var(--ease),opacity 1.02s var(--ease)';selectedImage.style.opacity='1';selectedImage.style.transform='scale(1)';selectedImage.style.clipPath='none';
      caseOverlayImage.src=selectedImage.currentSrc||selectedImage.src;
      caseOverlayImage.alt=detail[0];
      caseOverlayScrollY=scrollY;caseOverlay.scrollTop=0;document.body.classList.add('case-overlay-open');
      setTimeout(()=>{
        const sourceRect=selectedImage.getBoundingClientRect();
        caseOverlay.style.setProperty('--case-image-top',`${sourceRect.top}px`);
        caseOverlay.classList.add('is-open');
        caseOverlay.classList.add('is-transitioning');
        caseOverlay.setAttribute('aria-hidden','false');
        liveInfo.style.visibility='hidden';
        requestAnimationFrame(()=>{
          if(!caseOverlayMedia)return;
          const targetRect=caseOverlayMedia.getBoundingClientRect();
          const flyer=selectedImage.cloneNode(true);
          flyer.className='case-transition-image';
          flyer.removeAttribute('style');
          Object.assign(flyer.style,{left:`${sourceRect.left}px`,top:`${sourceRect.top}px`,right:'auto',bottom:'auto',width:`${sourceRect.width}px`,height:`${sourceRect.height}px`,transform:'none',clipPath:'none',opacity:'1'});
          document.body.append(flyer);
          mask.style.visibility='hidden';
          requestAnimationFrame(()=>{
            Object.assign(flyer.style,{left:`${targetRect.left}px`,top:`${targetRect.top}px`,width:`${targetRect.width}px`,height:`${targetRect.height}px`,transition:'left 1.65s var(--ease),top 1.65s var(--ease),width 1.65s var(--ease),height 1.65s var(--ease)'});
            setTimeout(()=>{flyer.remove();caseOverlay.classList.remove('is-transitioning');},1670);
          });
        });
      },1050);
    });
    const smoothstep=(edge0,edge1,x)=>{
      const t=clamp((x-edge0)/((edge1-edge0)||1e-6),0,1);
      return t*t*(3-2*t);
    };
    const renderSequence=(sequenceP)=>{
      if(projectDetailOpen)return;
      const p=clamp(sequenceP,0,1);
      lastProjectProgress=p;
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
      if(intro){
        const line=intro.querySelector('.projects-intro-piece');
        if(line)line.classList.toggle('is-visible',p>=galleryStart&&(activeIndex>0||open>.02));
      }
      const glowDirections=['bottom','left','top'];
      const travel=clamp(within/unit,0,1);
      if(sweepLine){
        const extended=-.06+travel*1.12;
        sweepLine.dataset.direction=glowDirections[activeIndex]||'bottom';
        sweepLine.style.setProperty('--sweep-progress',String(extended));
        sweepLine.style.setProperty('--sweep-color','rgba(12,12,12,.1)');
        const direction=glowDirections[activeIndex]||'bottom';
        if(direction==='bottom'||direction==='top'){
          sweepLine.style.top=`${(direction==='bottom'?1-extended:extended)*100}%`;
          sweepLine.style.left='0px';
        }else{
          sweepLine.style.left=`${(direction==='right'?1-extended:extended)*100}%`;
          sweepLine.style.top='0px';
        }
        sweepLine.style.opacity=p>=galleryStart&&open>0?'1':'0';
      }
      const info=document.getElementById('projectsInfo');
      const transitionCopy=document.getElementById('heroTransitionCopy');
      if(transitionCopy){const fade=clamp(1-p/.08,0,1);transitionCopy.style.opacity=String(fade);}
      if(info){
        const meta=[
          ['MIUNĀE','A skincare brand system built around time, tactility and restraint','Creative Direction'],
          ['GoBaller','Football coaching app for players of all ages','Brand, iOS App'],
          ['AIMS','The most advanced AI search for music catalogs','Website, Brand Refresh, Marketing & Sales Assets']
        ][activeIndex]||[];
        const key=meta.join('|');
        if(info.dataset.copy!==key){
          info.dataset.copy=key;
          info.classList.remove('is-visible');
          info.innerHTML=meta.map((text,i)=>`<span class="projects-info-col projects-info-col--${i} ${i===0?'type-project-title':i===1?'type-project-meta':'type-project-label'}">${text}</span>`).join('');
          void info.offsetWidth;
        }
      }
      if(info) info.classList.toggle('is-visible',open>.02);
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
        img.style.transition=galleryVisible?'opacity 1.275s var(--ease), clip-path 1.275s var(--ease), transform 1.275s var(--ease)':'none';
        const revealBottom=active&&!before?lerp(100,0,smoothstep(0,.96,settle)):0;
        img.style.clipPath='none';
        if(mask){let maskClip='inset(100% 0 0 0)';if(before)maskClip='inset(0)';else if(active){const r=lerp(100,0,smoothstep(0,.96,settle));maskClip=i===0?`inset(${r}% 0 0 0)`:i===1?`inset(0 ${r}% 0 0)`: `inset(0 0 ${r}% 0)`;}mask.style.clipPath=maskClip;mask.style.zIndex=String(active?100+i:before?10+i:0);}
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
      if(info){requestAnimationFrame(()=>{const target=masks[activeIndex],shellRect=frame.parentElement.getBoundingClientRect(),navRect=document.querySelector('.site-nav')?.getBoundingClientRect(),menuRect=document.querySelector('.site-menu')?.getBoundingClientRect(),ir=target&&target.getBoundingClientRect();if(ir){const menuBottom=navRect?.bottom||0;const metadataY=menuBottom+(ir.top-menuBottom)*.6;const localY=metadataY-shellRect.top;info.style.top=`${localY}px`;info.style.left=`${ir.left-shellRect.left}px`;info.style.width=`${ir.width}px`;info.style.transform='none';const pill=info.querySelector('.projects-info-col--2');if(pill&&menuRect&&innerWidth>900){pill.style.left=`${menuRect.left-ir.left}px`;pill.style.right='auto';}const recent=intro?.querySelector('.projects-intro-piece');if(recent){recent.style.top=`${localY}px`;recent.style.bottom='auto';}}});}
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
    addEventListener('resize',measure,{passive:true});
    requestSequenceUpdate();
  }

  /* Cursor. */
  const cursor=document.getElementById('cursor');
  const cursorProject=cursor?.querySelector('.cursor-project');
  const cursorProjects=['MIUNĀE','GOBALLER','AIMS'];
  let cursorProjectName='MIUNĀE';
  let cursorProjectTimer=0;
  const updateCursorProject=name=>{
    if(!cursorProject||!name||name===cursorProjectName)return;
    cursorProjectName=name;
    clearTimeout(cursorProjectTimer);
    cursorProject.classList.remove('is-wiping-in');
    cursorProject.classList.add('is-wiping-out');
    cursorProjectTimer=setTimeout(()=>{
      cursorProject.textContent=name;
      cursorProject.classList.remove('is-wiping-out');
      cursorProject.classList.add('is-wiping-in');
    },160);
  };
  addEventListener('projects-shader-progress',event=>{
    updateCursorProject(cursorProjects[event.detail?.index]);
  });
  let cx=-100,cy=-100,tx=-100,ty=-100,raf=0;
  function tickCursor(){
    cx=lerp(cx,tx,.42);cy=lerp(cy,ty,.42);
    cursor.style.transform=`translate3d(${cx-7}px,${cy-7}px,0)`;
    if(Math.abs(cx-tx)+Math.abs(cy-ty)>.15)raf=requestAnimationFrame(tickCursor);else raf=0;
  }
  addEventListener('pointermove',e=>{
    tx=e.clientX;ty=e.clientY;if(!raf)raf=requestAnimationFrame(tickCursor);
    const mask=e.target.closest('.projects-image-mask');
    cursor.classList.toggle('is-open',!!mask);
    if(mask)updateCursorProject(cursorProjects[Number(mask.querySelector('.projects-image')?.dataset.step)]);
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
