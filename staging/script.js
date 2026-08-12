(()=>{
  const transitionCopyGlobal=document.getElementById('heroTransitionCopy');
  if(transitionCopyGlobal){
    const bound=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
    const updateTransitionCopy=()=>{
      const reveal=bound(scrollY/(innerHeight*.7),0,1);
      const fade=1-bound((scrollY-innerHeight*.72)/(innerHeight*.42),0,1);
      const paragraph=transitionCopyGlobal.querySelector('p');
      if(!paragraph)return;
      transitionCopyGlobal.style.opacity=String(scrollY>0?fade:0);
      if(!paragraph.dataset.split){
        paragraph.innerHTML=paragraph.textContent.trim().split(/(\s+)/).map((part,i)=>part.trim()?`<span class="scroll-word" style="--i:${i}">${part}</span>`:part).join('');
        paragraph.dataset.split='1';
      }
      const words=[...paragraph.querySelectorAll('.scroll-word')];
      words.forEach((word,i)=>{
        const wordProgress=bound((reveal-(i/Math.max(1,words.length-1))*.72)/.28,0,1);
        word.style.color=`rgba(26,26,26,${wordProgress})`;
      });
    };
    addEventListener('scroll',updateTransitionCopy,{passive:true});
    updateTransitionCopy();
  }
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Automatic text wipes are split into the lines the browser actually lays out.
     This keeps the effect responsive: a resize recalculates the lines instead of
     relying on hard-coded breaks, while scroll-scrubbed animations remain intact. */
  const autoTextLineSelector='.projects-info-col,.case-project-title,.case-project-strapline,.case-project-copy-title,.case-project-body,.case-project-web-caption,.case-project-instagram-copy,.case-goballer-process,.case-miunae-launch-copy,.case-aims-web-copy,.case-aims-social-copy,.case-aims-deck-copy';
  const prepareAutoTextLines=(root=document)=>{
    const targets=[];
    if(root.matches?.(autoTextLineSelector))targets.push(root);
    targets.push(...root.querySelectorAll?.(autoTextLineSelector)||[]);
    targets.forEach(el=>{
      const source=el.dataset.autoTextSource||el.textContent.trim();
      if(!source)return;
      el.dataset.autoTextSource=source;
      el.innerHTML='';
      const words=source.split(/\s+/).filter(Boolean);
      const measure=words.map(word=>{
        const span=document.createElement('span');
        span.className='auto-wipe-measure';
        span.textContent=word;
        el.append(span,document.createTextNode(' '));
        return span;
      });
      const lines=[];
      measure.forEach(word=>{
        const top=Math.round(word.getBoundingClientRect().top);
        let line=lines[lines.length-1];
        if(!line||line.top!==top){line={top,words:[]};lines.push(line)}
        line.words.push(word.textContent);
      });
      el.innerHTML='';
      lines.forEach((line,index)=>{
        const span=document.createElement('span');
        span.className='auto-wipe-line';
        span.style.setProperty('--line-index',String(index));
        span.textContent=line.words.join(' ');
        el.append(span);
      });
    });
  };
  const scheduleAutoTextLines=(()=>{
    let timer=0;
    return ()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>prepareAutoTextLines(),120);
    };
  })();
  prepareAutoTextLines();
  addEventListener('resize',scheduleAutoTextLines,{passive:true});

  /* Alignment grid: an isolated visual aid toggled from the top-center control. */
  const layoutGrid=document.getElementById('layoutGrid');
  const layoutGridToggle=document.getElementById('layoutGridToggle');
  if(layoutGrid&&layoutGridToggle){
    const setGrid=(visible)=>{
      layoutGrid.classList.toggle('is-visible',visible);
      layoutGrid.setAttribute('aria-hidden',String(!visible));
      layoutGridToggle.setAttribute('aria-pressed',String(visible));
    };
    layoutGridToggle.addEventListener('click',()=>setGrid(!layoutGrid.classList.contains('is-visible')));
  }

  /* Single smooth-scroll owner. Sections never intercept or snap independently. */
  class SmoothScroll{
    constructor(){
      this.enabled=!reduce&&matchMedia('(pointer:fine)').matches;
      this.current=window.scrollY;this.target=window.scrollY;this.raf=0;
      this.overlayCurrent=0;this.overlayTarget=0;this.overlayRaf=0;
      if(!this.enabled)return;
      addEventListener('wheel',e=>this.onWheel(e),{passive:false});
      addEventListener('keydown',e=>this.onKey(e));
      addEventListener('resize',()=>{this.target=clamp(this.target,0,this.max())},{passive:true});
    }
    max(){return Math.max(0,document.documentElement.scrollHeight-innerHeight)}
    overlayMax(overlay){return Math.max(0,overlay.scrollHeight-overlay.clientHeight)}
    onWheel(e){
      if(document.body.classList.contains('case-overlay-open')){
        const overlay=document.getElementById('caseOverlay');
        if(!overlay||!e.target?.closest?.('.case-overlay')){e.preventDefault();return;}
        if(e.ctrlKey)return;
        e.preventDefault();
        const d=e.deltaMode===1?e.deltaY*16:e.deltaMode===2?e.deltaY*innerHeight:e.deltaY;
        this.overlayTarget=clamp(this.overlayTarget+d,0,this.overlayMax(overlay));this.startOverlay();return;
      }
      if(e.ctrlKey)return;
      e.preventDefault();
      const d=e.deltaMode===1?e.deltaY*16:e.deltaMode===2?e.deltaY*innerHeight:e.deltaY;
      this.target=clamp(this.target+d,0,this.max());this.start();
    }
    onKey(e){
      if(document.body.classList.contains('case-overlay-open')){
        if(e.metaKey||e.ctrlKey)return;
        const overlay=document.getElementById('caseOverlay');
        if(!overlay||!(e.target?.closest?.('.case-overlay')||document.activeElement?.closest?.('.case-overlay'))){e.preventDefault();return;}
        const map={ArrowDown:72,ArrowUp:-72,PageDown:innerHeight*.8,PageUp:-innerHeight*.8,' ':innerHeight*.8};
        if(e.key==='Home'){e.preventDefault();this.overlayTarget=0;return this.startOverlay()}
        if(e.key==='End'){e.preventDefault();this.overlayTarget=this.overlayMax(overlay);return this.startOverlay()}
        if(!(e.key in map))return;
        e.preventDefault();this.overlayTarget=clamp(this.overlayTarget+map[e.key],0,this.overlayMax(overlay));this.startOverlay();return;
      }
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
    startOverlay(){if(!this.overlayRaf)this.overlayRaf=requestAnimationFrame(()=>this.tickOverlay())}
    tickOverlay(){
      const overlay=document.getElementById('caseOverlay');
      if(!overlay||!document.body.classList.contains('case-overlay-open')){this.overlayRaf=0;return;}
      this.overlayCurrent=lerp(this.overlayCurrent,this.overlayTarget,.095);
      if(Math.abs(this.overlayTarget-this.overlayCurrent)<.2)this.overlayCurrent=this.overlayTarget;
      overlay.scrollTop=this.overlayCurrent;
      if(this.overlayCurrent!==this.overlayTarget)this.overlayRaf=requestAnimationFrame(()=>this.tickOverlay());else this.overlayRaf=0;
    }
    resetOverlay(y=0){this.overlayCurrent=y;this.overlayTarget=y;const overlay=document.getElementById('caseOverlay');if(overlay)overlay.scrollTop=y}
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
        nameWrap.style.setProperty('--hero-name-exit-y','0px');
        nameWrap.style.setProperty('--hero-name-wipe',String(nameExitProgress));
        nameWrap.style.setProperty('--hero-name-fade',String(1-nameExitProgress));
        nameWrap.classList.toggle('is-scroll-wiped',nameExitProgress>0);
      }
      if(name){
        name.style.opacity='';
      }
      if(heroInfo){
        heroInfo.classList.add('is-hero-pinned');
        const infoFade=1-infoWipe;
        heroInfo.style.setProperty('--hero-info-scroll-y','0px');
        heroInfo.style.setProperty('--scroll-fade',String(infoFade));
        heroInfo.style.setProperty('--hero-info-wipe',String(infoWipe));
        heroInfo.style.opacity=String(infoFade);
        heroInfo.style.clipPath=`inset(0 0 ${infoWipe*100}% 0)`;
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
  const caseOverlayClose=document.getElementById('caseOverlayClose');
  const caseProjectContents=caseOverlay?[...caseOverlay.querySelectorAll('.case-project-content')]:[];
  let activeCaseProjectIndex=0;
  let activeCaseProjectContent=caseProjectContents[0]||null;
  let caseProjectGallery=activeCaseProjectContent?.querySelector('.case-project-gallery')||null;
  let caseProjectHeroVideo=activeCaseProjectContent?.querySelector('.case-project-hero-video')||null;
  let caseProjectMediaLinks=activeCaseProjectContent?.querySelector('.case-project-media-links')||null;
  const projectWipeThreshold=.18;
  const allProjectWipeTargets=caseOverlay?[...caseOverlay.querySelectorAll('.case-project-title, .case-project-strapline, .case-project-copy-title, .case-project-meta .case-project-data, .case-project-body, .case-project-web-caption, .case-project-instagram-copy, .case-goballer-process, .case-miunae-launch-copy, .case-aims-web-copy, .case-aims-social-copy, .case-aims-deck-copy')]:[];
  let projectWipeTargets=[];
  let projectDetailScrollTop=0;
  let projectDetailScrollDirection='forward';
  allProjectWipeTargets.forEach(target=>target.classList.add('project-viewport-wipe'));
  const setActiveCaseProject=index=>{
    activeCaseProjectIndex=index;
    activeCaseProjectContent=caseProjectContents[index]||caseProjectContents[0]||null;
    caseProjectContents.forEach((content,i)=>content.classList.toggle('is-active',i===activeCaseProjectIndex));
    caseProjectGallery=activeCaseProjectContent?.querySelector('.case-project-gallery')||null;
    caseProjectHeroVideo=activeCaseProjectContent?.querySelector('.case-project-hero-video')||null;
    caseProjectMediaLinks=activeCaseProjectContent?.querySelector('.case-project-media-links')||null;
    projectWipeTargets=activeCaseProjectContent?[...activeCaseProjectContent.querySelectorAll('.case-project-title, .case-project-strapline, .case-project-copy-title, .case-project-meta .case-project-data, .case-project-body, .case-project-web-caption, .case-project-instagram-copy, .case-goballer-process, .case-miunae-launch-copy, .case-aims-web-copy, .case-aims-social-copy, .case-aims-deck-copy')]:[];
  };
  setActiveCaseProject(0);
  /* The scroll listener below is the sole owner of detail wipes. An
     IntersectionObserver would toggle the same class independently and
     restart animations whenever its threshold fluctuated. */
  const projectWipeObserver=null;
  const updateProjectWipes=()=>{
    if(!projectDetailOpen||!caseOverlay)return;
    const currentScrollTop=caseOverlay.scrollTop;
    projectDetailScrollDirection=currentScrollTop<projectDetailScrollTop-.5?'backward':'forward';
    projectDetailScrollTop=currentScrollTop;
    const root=caseOverlay.getBoundingClientRect();
    projectWipeTargets.forEach(target=>{
      const rect=target.getBoundingClientRect();
      /* Keep a revealed block visible while any part of it is still in the
         viewport; only wipe it once it has completely left the overlay. */
      const wasVisible=target.dataset.viewportVisible==='1';
      /* Hysteresis avoids threshold flicker at an overlay edge: a revealed
         block stays visible until it is fully out, and only re-enters after
         it has cleared a small buffer inside the viewport. */
      const visible=wasVisible
        ? rect.bottom>root.top-40&&rect.top<root.bottom+40
        : rect.bottom>root.top+40&&rect.top<root.bottom-40;
      const nextVisible=visible?'1':'0';
      const direction=projectDetailScrollDirection;
      /* Keep viewport visibility stateful. Direction classes may change on
         every scroll tick, but a wipe may only start when visibility changes. */
      if(target.dataset.viewportVisible===nextVisible){
        target.classList.toggle('is-wipe-backward',direction==='backward');
        target.classList.toggle('is-wipe-forward',direction==='forward');
        return;
      }
      target.dataset.viewportVisible=nextVisible;
      target.classList.add('detail-wipe-controlled');
      target.classList.toggle('is-wipe-backward',direction==='backward');
      target.classList.toggle('is-wipe-forward',direction==='forward');
      target.classList.toggle('is-viewport-revealed',visible);
      target._detailWipeAnimation?.cancel();
      const edge=direction==='backward'?'inset(100% 0 0 0)':'inset(0 0 100% 0)';
      target.style.opacity=visible?'0':'1';
      target.style.clipPath=visible?edge:'inset(0)';
      target._detailWipeAnimation=target.animate(
        [{opacity:visible?0:1,clipPath:visible?edge:'inset(0)'},{opacity:visible?1:0,clipPath:visible?'inset(0)':edge}],
        {duration:1500,easing:'cubic-bezier(.22,.61,.36,1)',fill:'forwards'}
      );
      target._detailWipeAnimation.onfinish=()=>{
        if(target.dataset.viewportVisible===nextVisible){
          target.style.opacity=visible?'1':'0';
          target.style.clipPath=visible?'inset(0)':edge;
        }
      };
      const lines=[...target.querySelectorAll('.auto-wipe-line')];
      lines.forEach((line,index)=>{
        line._detailLineWipeAnimation?.cancel();
        const lineEdge=direction==='backward'?'inset(100% 0 0 0)':'inset(0 0 100% 0)';
        line.style.opacity=visible?'0':'1';
        line.style.clipPath=visible?lineEdge:'inset(0)';
        line._detailLineWipeAnimation=line.animate(
          [{opacity:visible?0:1,clipPath:visible?lineEdge:'inset(0)',transform:visible?'translateY(8px)':'none'},
           {opacity:visible?1:0,clipPath:visible?'inset(0)':lineEdge,transform:'none'}],
          {duration:1100,easing:'cubic-bezier(.22,.61,.36,1)',delay:visible?index*90:(lines.length-1-index)*50,fill:'forwards'}
        );
        line._detailLineWipeAnimation.onfinish=()=>{line.style.opacity=visible?'1':'0';line.style.clipPath=visible?'inset(0)':lineEdge;line.style.transform='none';};
      });
    });
  };
  caseOverlay?.addEventListener('scroll',updateProjectWipes,{passive:true});
  const siteMenu=document.querySelector('.site-menu');
  let projectDetailOpen=false;
  let lockedPageScroll=0;
  let closingCaseOverlay=false;
  let overlayRevealTimer=0;
  let overlayCloseTimer=0;
  const lockPage=()=>{
    lockedPageScroll=window.scrollY;
    smooth.current=lockedPageScroll;smooth.target=lockedPageScroll;
  };
  const unlockPage=()=>{
    window.scrollTo(0,lockedPageScroll);smooth.current=lockedPageScroll;smooth.target=lockedPageScroll;
  };
  const closeCaseOverlay=()=>{
    if(!caseOverlay?.classList.contains('is-open')||caseOverlay.classList.contains('is-closing')||closingCaseOverlay)return;
    closingCaseOverlay=true;
    clearTimeout(overlayRevealTimer);overlayRevealTimer=0;
    clearTimeout(overlayCloseTimer);overlayCloseTimer=0;
    caseOverlayClose?.classList.remove('is-cursor-target');
    cursor?.classList.remove('is-close-target');
    caseProjectHeroVideo?.classList.remove('is-expanded','is-video-visible','is-video-closing','is-video-returning','is-video-returning-play','is-video-backdrop','is-animating');
    caseProjectMediaLinks?.classList.remove('is-video-expanded');
    caseProjectMediaLinks?.style.removeProperty('--video-placeholder-height');
    caseOverlay.classList.remove('is-video-expanded');
      projectWipeTargets.forEach(target=>{
      target._detailWipeAnimation?.cancel();
      target._detailWipeAnimation=null;
      target.querySelectorAll('.auto-wipe-line').forEach(line=>{line._detailLineWipeAnimation?.cancel();line._detailLineWipeAnimation=null;});
      delete target.dataset.viewportVisible;
      target.classList.remove('detail-wipe-controlled','is-viewport-revealed','is-wipe-forward','is-wipe-backward');
    });
    caseProjectHeroVideo?.setAttribute('aria-label',`Expand ${activeCaseProjectIndex===1?'GoBaller':activeCaseProjectIndex===2?'AIMS':'Miunāe'} video`);
    projectDetailOpen=false;
    masks.forEach(mask=>{mask.style.pointerEvents='auto';mask.style.removeProperty('transition');});
    caseOverlay.classList.add('is-content-exiting');
    caseOverlay.setAttribute('aria-hidden','true');
    siteMenu?.classList.remove('is-wiping-in');
    overlayCloseTimer=setTimeout(()=>{
      caseOverlay.classList.remove('is-content-reveal','is-content-exiting','is-close-visible');
      caseOverlay.classList.add('is-closing');
      overlayCloseTimer=setTimeout(()=>{
        caseOverlay.classList.remove('is-open','is-closing','is-cleaning','is-content-reveal','is-content-exiting','is-close-visible');
        document.body.classList.remove('case-overlay-open');
        unlockPage();
        if(siteMenu){
          void siteMenu.offsetWidth;
          siteMenu.classList.add('is-wiping-in');
        }
        overlayCloseTimer=0;
        closingCaseOverlay=false;
      },900);
    },900);
  };
  caseOverlayClose?.addEventListener('click',closeCaseOverlay);
  caseOverlay?.addEventListener('click',event=>{
    if(event.target?.closest?.('.case-overlay-close'))closeCaseOverlay();
  });
  caseProjectContents.forEach(content=>{
    const video=content.querySelector('.case-project-hero-video');
    const mediaLinks=content.querySelector('.case-project-media-links');
    if(!video)return;
    video.addEventListener('click',event=>{
      event.stopPropagation();
      if(video.classList.contains('is-video-closing'))return;
      const expanded=video.classList.contains('is-expanded');
      if(!expanded){
        mediaLinks?.style.setProperty('--video-placeholder-height',`${video.offsetHeight}px`);
        mediaLinks?.classList.add('is-video-expanded');
        video.classList.add('is-expanded');
        caseOverlay.classList.add('is-video-expanded');
        video.setAttribute('aria-label',`Minimize ${activeCaseProjectIndex===1?'GoBaller':activeCaseProjectIndex===2?'AIMS':'Miunāe'} video`);
        requestAnimationFrame(()=>video.classList.add('is-video-visible'));
        return;
      }
      video.classList.add('is-video-closing');
      video.classList.remove('is-video-visible');
      video.setAttribute('aria-label',`Expand ${activeCaseProjectIndex===1?'GoBaller':activeCaseProjectIndex===2?'AIMS':'Miunāe'} video`);
      setTimeout(()=>{
        video.classList.remove('is-expanded','is-video-closing');
        video.classList.add('is-video-returning');
        void video.offsetWidth;
        requestAnimationFrame(()=>{
          video.classList.add('is-video-returning-play');
          setTimeout(()=>video.classList.remove('is-video-returning','is-video-returning-play'),900);
        });
        caseOverlay.classList.remove('is-video-expanded');
        mediaLinks?.classList.remove('is-video-expanded');
        mediaLinks?.style.removeProperty('--video-placeholder-height');
      },900);
    });
  });
  const galleryStates=caseProjectContents.map(content=>{
    const gallery=content.querySelector('.case-project-gallery');
    if(!gallery)return null;
    return {gallery,rows:[...gallery.querySelectorAll('.case-project-gallery-row')],target:0,current:0,raf:0};
  });
  let updateActiveGallery=()=>{};
  if(caseOverlay&&galleryStates.some(Boolean)){
    const renderGallery=state=>{
      state.current=lerp(state.current,state.target,.12);
      state.rows.forEach(row=>{
        const track=row.querySelector('.case-project-gallery-track');
        if(!track)return;
        const overflow=Math.max(0,track.scrollWidth-row.clientWidth);
        const x=row.dataset.direction==='right'
          ? -overflow*(1-state.current)
          : -overflow*state.current;
        track.style.setProperty('--gallery-x',`${x}px`);
      });
      if(Math.abs(state.current-state.target)>.001)state.raf=requestAnimationFrame(()=>renderGallery(state));else state.raf=0;
    };
    updateActiveGallery=()=>{
      const state=galleryStates[activeCaseProjectIndex];
      if(!state)return;
      const gallery=state.gallery;
      const start=gallery.offsetTop-caseOverlay.clientHeight;
      const end=gallery.offsetTop+gallery.offsetHeight;
      state.target=clamp((caseOverlay.scrollTop-start)/Math.max(1,end-start));
      if(!state.raf)state.raf=requestAnimationFrame(()=>renderGallery(state));
    };
    caseOverlay.addEventListener('scroll',updateActiveGallery,{passive:true});
    addEventListener('resize',updateActiveGallery,{passive:true});
    galleryStates.forEach(state=>state?.rows.forEach(row=>row.querySelectorAll('img').forEach(img=>img.addEventListener('load',updateActiveGallery,{once:true}))));
    requestAnimationFrame(updateActiveGallery);
  }
  const desiraeCards=caseOverlay?[...caseOverlay.querySelectorAll('.case-desirae-card')]:[];
  if(caseOverlay&&desiraeCards.length){
    const desiraeSection=caseOverlay.querySelector('.case-desirae');
    const desiraeNotes=desiraeSection?[...desiraeSection.querySelectorAll('.case-desirae-note')]:[];
    let desiraeRaf=0;
    const renderDesirae=()=>{
      const overlayRect=caseOverlay.getBoundingClientRect();
      const viewportHeight=caseOverlay.clientHeight;
      const startPad=caseOverlay.clientHeight*.1;
      const sectionRect=desiraeSection?.getBoundingClientRect();
      const sectionActive=!!sectionRect&&sectionRect.top<=viewportHeight*.7&&sectionRect.bottom>=viewportHeight*.3;
      const wasSticky=desiraeNotes.some(note=>note.classList.contains('is-sticky'));
      let firstProgress=0;
      let lastCardTop=Infinity;
      desiraeCards.forEach((card,index)=>{
        const cardTop=card.getBoundingClientRect().top-overlayRect.top;
        const progress=clamp((viewportHeight-cardTop)/Math.max(1,viewportHeight-startPad),0,1);
        const scale=.5+progress*.5;
        const rotation=(index%2?-1:1)*progress*1.4;
        card.style.transform=`scale(${scale}) rotate(${rotation}deg)`;
        card.style.zIndex=String(index+1);
        if(index===0)firstProgress=progress;
        if(index===desiraeCards.length-1)lastCardTop=cardTop;
      });
      const galleryFinished=firstProgress>=.995&&lastCardTop<startPad-1;
      const notesVisible=sectionActive&&firstProgress>=.995&&!galleryFinished;
      desiraeNotes.forEach(note=>{
        note.classList.toggle('is-sticky',sectionActive&&(firstProgress>=.995||wasSticky));
        note.classList.toggle('is-visible',notesVisible);
        note.classList.toggle('is-exiting',sectionActive&&wasSticky&&!notesVisible);
      });
      desiraeRaf=0;
    };
    const updateDesirae=()=>{if(!desiraeRaf)desiraeRaf=requestAnimationFrame(renderDesirae)};
    caseOverlay.addEventListener('scroll',updateDesirae,{passive:true});
    addEventListener('resize',updateDesirae,{passive:true});
    requestAnimationFrame(renderDesirae);
  }
  addEventListener('keydown',event=>{if(event.key==='Escape')closeCaseOverlay();});
  const stage=document.getElementById('projectsStage');
  const postTransition=document.getElementById('postProjectTransition');
  const frame=document.getElementById('projectsFrame');
  const intro=document.getElementById('projectsIntro');
  const images=frame?[...frame.querySelectorAll('.projects-image')]:[];
  const masks=images.map(img=>img.parentElement);
  if(projects&&stage&&frame&&images.length){
    const sweepLine=document.getElementById('projectsSweepLine');
    let seqRaf=0;
    let projectsTop=0;
    let projectProgress=0;
    let projectScrollDirection='forward';
    let projectExitLatched=false;
    let infoPositionRaf=0;
    const progressSegments=[...document.querySelectorAll('.projects-progress-segment')];
    const progressBar=document.querySelector('.projects-progress');
    const projectDetails=[
      ['MIUNĀE','A skincare brand system built around time, tactility and restraint','Creative Direction'],
      ['GoBaller','Football coaching app for players of all ages','Brand, iOS App'],
      ['AIMS','The most advanced AI search for music catalogs','Website, Brand Refresh, Marketing & Sales Assets']
    ];
    addEventListener('click',event=>{
      const mask=event.target.closest?.('.projects-image-mask');
      if(!mask||!caseOverlay||projectDetailOpen)return;
      const index=masks.indexOf(mask);
      if(index<0||index>2)return;
      if(!projectDetails[index])return;
      if(smooth.raf){cancelAnimationFrame(smooth.raf);smooth.raf=0;}
      smooth.current=scrollY;smooth.target=scrollY;
      cursor?.classList.remove('is-open','is-close-target');
      caseOverlayClose?.classList.remove('is-cursor-target');
      projectDetailOpen=true;
      clearTimeout(overlayRevealTimer);overlayRevealTimer=0;
      clearTimeout(overlayCloseTimer);overlayCloseTimer=0;
      setActiveCaseProject(index);
      projectDetailScrollTop=0;
      projectDetailScrollDirection='forward';
      caseOverlay.classList.remove('is-cleaning','is-content-reveal','is-content-exiting','is-closing','is-close-visible');
      masks.forEach(item=>item.style.pointerEvents='none');
      smooth.resetOverlay(0);
      requestAnimationFrame(updateActiveGallery);
      lockPage();
      document.body.classList.add('case-overlay-open');
      setTimeout(()=>{
        /* Phase one clears the old view while MF remains in the nav. */
        caseOverlay.classList.add('is-open','is-cleaning');
        caseOverlay.setAttribute('aria-hidden','false');
        /* Phase two immediately wipes the detail content back in. */
        overlayRevealTimer=setTimeout(()=>{
          caseOverlay.classList.remove('is-cleaning');
          caseOverlay.classList.add('is-content-reveal','is-close-visible');
          requestAnimationFrame(updateProjectWipes);
          overlayRevealTimer=0;
        },900);
      },0);
    });
    const smoothstep=(edge0,edge1,x)=>{
      const t=clamp((x-edge0)/((edge1-edge0)||1e-6),0,1);
      return t*t*(3-2*t);
    };
    const applyProjectWipeState=(element,visible,direction)=>{
      if(!element)return;
      const wipeDirection=visible?direction:(element.dataset.wipeDirection||direction);
      const nextVisible=visible?'1':'0';
      /* Visibility is the state machine. Direction is only chosen when a
         state change actually happens; changing scroll direction while an
         element is already hidden must not replay its wipe. */
      if(element.dataset.wipeVisible===nextVisible)return;
      element.dataset.wipeVisible=nextVisible;
      element.dataset.wipeDirection=wipeDirection;
      element.classList.add('wipe-controlled');
      element.classList.toggle('is-wipe-backward',wipeDirection==='backward');
      element.classList.toggle('is-wipe-forward',wipeDirection==='forward');
      element.classList.toggle('is-visible',visible);
      element.classList.toggle('is-wiping-out',!visible);
      element._projectWipeAnimation?.cancel();
      const edge=wipeDirection==='backward'?'inset(100% 0 0 0)':'inset(0 0 100% 0)';
      const from=visible?edge:'inset(0)';
      const to=visible?'inset(0)':edge;
      element.style.opacity=visible?'0':'1';
      element.style.clipPath=from;
      element._projectWipeAnimation=element.animate(
        [{opacity:visible?0:1,clipPath:from,transform:'none'},{opacity:visible?1:0,clipPath:to,transform:'none'}],
        {duration:1500,easing:'cubic-bezier(.22,.61,.36,1)',fill:'forwards'}
      );
      element._projectWipeAnimation.onfinish=()=>{
        if(element.dataset.wipeVisible===nextVisible){
          element.style.opacity=visible?'1':'0';
          element.style.clipPath=visible?'inset(0)':edge;
        }
      };
      const lines=[...element.querySelectorAll('.auto-wipe-line')];
      lines.forEach((line,index)=>{
        line._projectLineWipeAnimation?.cancel();
        const lineEdge=wipeDirection==='backward'?'inset(100% 0 0 0)':'inset(0 0 100% 0)';
        line.style.opacity=visible?'0':'1';
        line.style.clipPath=visible?lineEdge:'inset(0)';
        line._projectLineWipeAnimation=line.animate(
          [{opacity:visible?0:1,clipPath:visible?lineEdge:'inset(0)',transform:visible?'translateY(8px)':'none'},
           {opacity:visible?1:0,clipPath:visible?'inset(0)':lineEdge,transform:'none'}],
          {duration:1100,easing:'cubic-bezier(.22,.61,.36,1)',delay:visible?index*90:(lines.length-1-index)*50,fill:'forwards'}
        );
        line._projectLineWipeAnimation.onfinish=()=>{line.style.opacity=visible?'1':'0';line.style.clipPath=visible?'inset(0)':lineEdge;line.style.transform='none';};
      });
      [...element.querySelectorAll('.projects-info-col')].forEach((column,index)=>{
        column._projectColumnWipeAnimation?.cancel();
        /* The metadata parent owns the wipe. Child masks caused the visible
           title/description to be clipped mid-line and appear cut off. */
        column.style.opacity='1';
        column.style.clipPath='inset(0)';
        column.style.transform='none';
      });
    };
    const resetProjectWipeState=(element)=>{
      if(!element)return;
      element._projectWipeAnimation?.cancel();
      element._projectWipeAnimation=null;
      element.querySelectorAll('.auto-wipe-line').forEach(line=>{line._projectLineWipeAnimation?.cancel();line._projectLineWipeAnimation=null;});
      element.querySelectorAll('.projects-info-col').forEach(column=>{column._projectColumnWipeAnimation?.cancel();column._projectColumnWipeAnimation=null;});
      delete element.dataset.wipeVisible;
      delete element.dataset.wipeDirection;
      element.classList.remove('wipe-controlled','is-visible','is-wiping-out','is-wipe-forward','is-wipe-backward');
      element.style.removeProperty('opacity');
      element.style.removeProperty('clip-path');
      element.style.removeProperty('transform');
    };
    const renderSequence=(sequenceP,stageP=sequenceP)=>{
      if(projectDetailOpen)return;
      const p=clamp(sequenceP,0,1);
      const sectionExit=smoothstep(.88,1,stageP);
      /* Hysteresis prevents smooth-scroll settling at the boundary from
         toggling the same exit wipe repeatedly. Re-entry must travel back
         below .84 before the exit state can be reset. */
      if(!projectExitLatched&&stageP>=.88){
        projectExitLatched=true;
        postTransition?.classList.add('is-project-exit-start');
        const exitDirection=projectScrollDirection;
        applyProjectWipeState(intro?.querySelector('.projects-intro-piece'),false,exitDirection);
        applyProjectWipeState(document.getElementById('projectsInfo'),false,exitDirection);
        applyProjectWipeState(progressBar,false,exitDirection);
      }else if(projectExitLatched&&projectScrollDirection==='backward'&&stageP<=.84){
        projectExitLatched=false;
        postTransition?.classList.remove('is-project-exit-start');
        resetProjectWipeState(intro?.querySelector('.projects-intro-piece'));
        resetProjectWipeState(document.getElementById('projectsInfo'));
        resetProjectWipeState(progressBar);
      }
      const finalTextExit=projectExitLatched;
      if(frame){frame.style.clipPath=`inset(0 0 ${sectionExit*100}% 0)`;frame.style.pointerEvents=sectionExit>.99?'none':'';}
      /* Recent Works and the metadata have independent wipe controllers.
         Clipping their shared wrapper made the metadata disappear/move early
         as the project frame exited. */
      if(intro){intro.style.clipPath='none';}
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
        if(line){
          const introVisible=!finalTextExit&&p>=galleryStart&&(activeIndex>0||open>.02);
          if(!finalTextExit)applyProjectWipeState(line,introVisible,projectScrollDirection);
        }
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
      if(info){
        const meta=[
          ['MIUNĀE','A skincare brand system built around time, tactility and restraint','Creative Direction'],
          ['GoBaller','Football coaching app for players of all ages','Brand, iOS App'],
          ['AIMS','The most advanced AI search for music catalogs','Website, Brand Refresh, Marketing & Sales Assets']
        ][activeIndex]||[];
        const key=meta.join('|');
        if(info.dataset.copy!==key){
          info.dataset.copy=key;
          delete info.dataset.wipeVisible;
          delete info.dataset.wipeDirection;
          info.classList.remove('is-visible','is-wiping-out');
          info.innerHTML=meta.map((text,i)=>`<span class="projects-info-col projects-info-col--${i} ${i===0?'type-project-title':i===1?'type-project-meta':'type-project-tag'}">${text}</span>`).join('');
          prepareAutoTextLines(info);
          void info.offsetWidth;
        }
      }
      if(info){
        const infoVisible=!finalTextExit&&p>=galleryStart;
        if(!finalTextExit){
          applyProjectWipeState(info,infoVisible,projectScrollDirection);
          applyProjectWipeState(progressBar,infoVisible,projectScrollDirection);
        }
      }
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
        const zoom=before?1:active?lerp(1.05,1,settle):1.05;
        const revealY=before?0:active?lerp(75,0,smoothstep(0,.96,settle)):75;
        const galleryVisible=p>=galleryStart;
        const opacity=!galleryVisible?0:before?1:active?lerp(.35,1,smoothstep(0,.18,settle)):next?0:0;
        img.classList.toggle('is-active',active||before);
        img.style.opacity=String(opacity);
        img.style.transform=`scale(${zoom})`;
        img.style.transformOrigin='center bottom';
        img.style.transition=galleryVisible?'opacity 1.275s var(--ease), clip-path 1.275s var(--ease), transform 1.275s var(--ease)':'none';
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
      if(info&&!sectionExit){
        cancelAnimationFrame(infoPositionRaf);
        infoPositionRaf=requestAnimationFrame(()=>{
          const target=masks[activeIndex],shellRect=frame.parentElement.getBoundingClientRect(),navRect=document.querySelector('.site-nav')?.getBoundingClientRect(),menuRect=document.querySelector('.site-menu')?.getBoundingClientRect(),ir=target&&target.getBoundingClientRect();
          if(!ir)return;
          const menuBottom=navRect?.bottom||0;
          const metadataY=menuBottom+(ir.top-menuBottom)*.6;
          const localY=metadataY-shellRect.top;
          info.style.top=`${localY}px`;info.style.left=`${ir.left-shellRect.left}px`;info.style.width=`${ir.width}px`;info.style.transform='none';
          if(progressBar){
            const description=info.querySelector('.projects-info-col--1');
            const descriptionRect=description?.getBoundingClientRect();
            const progressY=descriptionRect?descriptionRect.top-shellRect.top+(descriptionRect.height-progressBar.offsetHeight)/2:localY;
            progressBar.style.top=`${progressY}px`;progressBar.style.bottom='auto';progressBar.style.left='auto';progressBar.style.right=`${shellRect.right-ir.right}px`;
          }
          const pill=info.querySelector('.projects-info-col--2');
          if(pill&&menuRect&&innerWidth>900){pill.style.left=`${menuRect.left-ir.left}px`;pill.style.right='auto';}
          const recent=intro?.querySelector('.projects-intro-piece');
          if(recent){recent.style.top=`${localY}px`;recent.style.bottom='auto';}
        });
      }
      stage.classList.toggle('is-exiting',sectionExit>0);
      stage.classList.toggle('is-released',stageP>=.999);
    };
    const projectRange=()=>Math.max(1,stage.offsetHeight-innerHeight);
    const renderFromScroll=()=>{
      const projStart=projectsTop;
      const raw=clamp((scrollY-projStart)/projectRange(),0,1);
      projectScrollDirection=raw<projectProgress-.0005?'backward':'forward';
      projectProgress=raw;
      const sequenceP=clamp(raw/.88,0,1);
      renderSequence(sequenceP,raw);
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
  const postServices=[...document.querySelectorAll('.post-project-service')];
  if(postTransition){
    let postPlaybackTimer=0;
    let postPlaybackDirection='idle';
    let postPreviousProgress=0;
    let postDirectionAnchor=0;
    const postDirectionThreshold=.015;
    const postServiceStagger=90;
    const setPostServicePhase=(item,phase)=>{
      if(item.dataset.phase===phase)return false;
      item.dataset.phase=phase;
      item.classList.remove('is-visible','is-exiting');
      if(phase==='visible')item.classList.add('is-visible');
      if(phase==='exiting')item.classList.add('is-exiting');
      return true;
    };
    const stopPostPlayback=()=>{if(postPlaybackTimer){clearTimeout(postPlaybackTimer);postPlaybackTimer=0;}};
    const playPostServicesForward=()=>{
      stopPostPlayback();
      postPlaybackDirection='forward';
      let index=0;
      const step=()=>{
        if(postPlaybackDirection!=='forward'||index>=postServices.length){postPlaybackTimer=0;return;}
        const item=postServices[index++];
        setPostServicePhase(item,'visible');
        item.dataset.revealed='1';
        postPlaybackTimer=setTimeout(step,postServiceStagger);
      };
      step();
    };
    const playPostServicesReverse=()=>{
      stopPostPlayback();
      postPlaybackDirection='reverse';
      let index=postServices.length-1;
      const step=()=>{
        if(postPlaybackDirection!=='reverse'||index<0){postPlaybackTimer=0;return;}
        const item=postServices[index--];
        setPostServicePhase(item,'exiting');
        postPlaybackTimer=setTimeout(step,postServiceStagger);
      };
      step();
    };
    const updatePostTransition=()=>{
      const top=postTransition.getBoundingClientRect().top+scrollY;
      const p=clamp((scrollY-top)/(Math.max(1,postTransition.offsetHeight-innerHeight)),0,1);
      postTransition.classList.toggle('is-active',p>.04&&p<.96);
      const scrollingBack=p<postPreviousProgress-.0005;
      const scrollingForward=p>postPreviousProgress+.0005;
      /* Smooth scrolling can oscillate by a few pixels at section boundaries.
         Require meaningful travel before changing playback direction so an
         exit wipe cannot be restarted by settling noise. */
      if(p>=.03&&scrollingForward&&postPlaybackDirection!=='forward'&&p>=postDirectionAnchor+postDirectionThreshold){
        postDirectionAnchor=p;
        playPostServicesForward();
      }
      if(scrollingBack&&postPlaybackDirection!=='reverse'&&p<.995){
        postDirectionAnchor=p;
        playPostServicesReverse();
      }
      postPreviousProgress=p;
    };
    addEventListener('scroll',updatePostTransition,{passive:true});
    addEventListener('resize',updatePostTransition,{passive:true});
    updatePostTransition();
  }
  if(postServices.length){postServices.forEach(item=>{item.classList.remove('is-visible','is-exiting');item.dataset.phase='hidden';});}

  /* Cursor. */
  const cursor=document.getElementById('cursor');
  const cursorAction=cursor?.querySelector('.cursor-label>span:first-child');
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
    const mask=e.target?.closest?.('.projects-image-mask');
    const videoTarget=e.target?.closest?.('.case-project-hero-video');
    const closeEl=caseOverlayClose;
    const closeRect=closeEl?.getBoundingClientRect();
    const overlayIsOpen=!!caseOverlay?.classList.contains('is-open') && !caseOverlay.classList.contains('is-closing');
    const overClose=overlayIsOpen && !!closeRect &&
      e.clientX>=closeRect.left && e.clientX<=closeRect.right &&
      e.clientY>=closeRect.top && e.clientY<=closeRect.bottom;
    const closeTarget=overlayIsOpen && (e.target?.closest?.('.case-overlay-close')||overClose) ? closeEl : null;
    if(closeTarget){
      const rect=closeTarget.getBoundingClientRect();
      tx=rect.left+rect.width/2;ty=rect.top+rect.height/2;
    }else{tx=e.clientX;ty=e.clientY;}
    if(!raf)raf=requestAnimationFrame(tickCursor);
    cursor.classList.toggle('is-open',!!mask||!!videoTarget);
    cursor.classList.toggle('is-video-target',!!videoTarget);
    cursor.classList.toggle('is-close-target',!!closeTarget);
    caseOverlayClose?.classList.toggle('is-cursor-target',!!closeTarget);
    if(cursorAction)cursorAction.textContent=videoTarget?(videoTarget.classList.contains('is-expanded')?'MINIMIZE':'EXPAND'):'OPEN';
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
