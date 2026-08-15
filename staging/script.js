(()=>{
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const smoothstep=(edge0,edge1,x)=>{
    const t=clamp((x-edge0)/((edge1-edge0)||1e-6),0,1);
    return t*t*(3-2*t);
  };
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Whole-page timing map. Its widths come from the real scroll ranges, so
     empty or overlong transitions remain visible while section timing is tuned. */
  const pageScrollProgress=document.getElementById('pageScrollProgress');
  if(pageScrollProgress){
    const phases=[
      {name:'Hero'},
      {name:'Hero → Recent Works',transition:true},
      {name:'Recent Works'},
      {name:'Recent Works → Services',transition:true},
      {name:'Services'},
      {name:'Services → Next',transition:true},
      {name:'Next'}
    ];
    const phaseElements=phases.map(phase=>{
      const segment=document.createElement('span');
      segment.className=`page-scroll-progress-segment${phase.transition?' is-transition':''}`;
      segment.dataset.phase=phase.name;
      pageScrollProgress.append(segment);
      return segment;
    });
    let phaseRanges=[];
    const measurePageProgress=()=>{
      const projectsSection=document.getElementById('projects');
      const projectsStage=document.getElementById('projectsStage');
      const servicesSection=document.getElementById('postProjectTransition');
      const nextSection=document.getElementById('postServicesNext');
      const maxScroll=Math.max(1,document.documentElement.scrollHeight-innerHeight);
      const projectsTop=projectsSection?projectsSection.getBoundingClientRect().top+scrollY:innerHeight;
      const projectsRange=Math.max(1,(projectsStage?.offsetHeight||innerHeight)-innerHeight);
      const servicesTop=servicesSection?servicesSection.getBoundingClientRect().top+scrollY:projectsTop+projectsRange;
      const servicesRange=Math.max(1,(servicesSection?.offsetHeight||innerHeight)-innerHeight);
      const nextTop=nextSection?nextSection.getBoundingClientRect().top+scrollY:maxScroll;
      const rawBoundaries=[0,projectsTop,projectsTop+projectsRange*.08,projectsTop+projectsRange*.88,servicesTop+servicesRange*.2,servicesTop+servicesRange*.58,nextTop,maxScroll];
      const boundaries=rawBoundaries.map((value,index)=>clamp(Math.max(index?rawBoundaries[index-1]:0,value),0,maxScroll));
      for(let index=1;index<boundaries.length;index++)boundaries[index]=Math.max(boundaries[index],boundaries[index-1]);
      phaseRanges=phaseElements.map((element,index)=>{
        const start=boundaries[index];
        const end=boundaries[index+1];
        element.style.flexGrow=String(Math.max(1,end-start));
        element.style.flexBasis='0';
        return {start,end};
      });
    };
    const renderPageProgress=()=>{
      phaseRanges.forEach((range,index)=>{
        const fill=range.end>range.start?clamp((scrollY-range.start)/(range.end-range.start),0,1):scrollY>=range.end?1:0;
        phaseElements[index].style.setProperty('--phase-fill',String(fill));
      });
    };
    const updatePageProgress=()=>{renderPageProgress();};
    measurePageProgress();
    renderPageProgress();
    addEventListener('scroll',updatePageProgress,{passive:true});
    addEventListener('resize',()=>{measurePageProgress();renderPageProgress();},{passive:true});
  }

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
      this.pageMin=0;this.pageMax=Infinity;
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
      this.target=clamp(this.target+d,this.pageMin,Math.min(this.pageMax,this.max()));this.start();
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
      if(e.key==='Home'){e.preventDefault();this.target=this.pageMin;return this.start()}
      if(e.key==='End'){e.preventDefault();this.target=Math.min(this.pageMax,this.max());return this.start()}
      if(!(e.key in map))return;
      e.preventDefault();this.target=clamp(this.target+map[e.key],this.pageMin,Math.min(this.pageMax,this.max()));this.start();
    }
    start(){if(!this.raf)this.raf=requestAnimationFrame(()=>this.tick())}
    tick(){
      this.target=clamp(this.target,this.pageMin,Math.min(this.pageMax,this.max()));
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
    goTo(y){this.target=clamp(y,this.pageMin,Math.min(this.pageMax,this.max()));this.start()}
    setPageBounds(min=0,max=Infinity){
      this.pageMin=min;this.pageMax=max;
      this.target=clamp(this.target,min,Math.min(max,this.max()));
      this.current=clamp(this.current,min,Math.min(max,this.max()));
      scrollTo(0,this.current);this.start();
    }
    clearPageBounds(){this.pageMin=0;this.pageMax=Infinity;this.current=scrollY;this.target=scrollY;}
  }
  const smooth=new SmoothScroll();
  addEventListener('pageshow',()=>requestAnimationFrame(()=>{
    smooth.current=window.scrollY;
    smooth.target=window.scrollY;
    window.dispatchEvent(new Event('scroll'));
  }),{passive:true});
  addEventListener('load',()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
    smooth.current=window.scrollY;
    smooth.target=window.scrollY;
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('scroll'));
  })),{once:true,passive:true});

  const nameWrap=document.getElementById('heroNameWrap');
  const name=document.getElementById('heroName');
  const heroInfo=document.querySelector('.hero-info');
  const heroAvailability=document.querySelector('.hero-availability');
  const heroRecentCue=document.querySelector('.hero-recent-cue');
  const alignHeroNameToInfo=()=>{
    if(!heroInfo||!name||!nameWrap||innerWidth<=900)return;
    const offset=heroInfo.getBoundingClientRect().top-nameWrap.getBoundingClientRect().top;
    name.style.top=`${offset}px`;
    nameWrap.style.setProperty('--hero-name-align-top',`${offset}px`);
  };
  addEventListener('resize',alignHeroNameToInfo,{passive:true});
  requestAnimationFrame(alignHeroNameToInfo);
  document.fonts?.ready?.then(alignHeroNameToInfo);
  const updateHeroCopyWipe=()=>{
    if(!heroInfo)return;
    const raw=clamp(scrollY/Math.max(1,innerHeight),0,1);
    const progress=smoothstep(0,1,raw);
    const pinned=raw<1;
    const opacity=String(1-progress);
    const clipPath=`inset(0 0 ${progress*100}% 0)`;
    [heroInfo,nameWrap,heroAvailability,heroRecentCue].forEach(el=>{
      if(!el)return;
      el.classList.toggle('is-hero-pinned',pinned);
      el.style.opacity=opacity;
      el.style.clipPath=clipPath;
    });
  };
  addEventListener('scroll',updateHeroCopyWipe,{passive:true});
  addEventListener('resize',updateHeroCopyWipe,{passive:true});
  updateHeroCopyWipe();

  /* Pinned four-step fullscreen image sequence. */
  const projects=document.getElementById('projects');
  const caseOverlay=document.getElementById('caseOverlay');
  const caseOverlayClose=document.getElementById('caseOverlayClose');
  const caseProjectSwitcher=document.getElementById('caseProjectSwitcher');
  const caseProjectContents=caseOverlay?[...caseOverlay.querySelectorAll('.case-project-content')]:[];
  const caseProjectNames=['MIUNĀE','GoBaller','AIMS'];
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
  const renderCaseProjectSwitcher=()=>{
    if(!caseProjectSwitcher)return;
    activeCaseProjectContent?.append(caseProjectSwitcher);
    const otherProjects=caseProjectNames.map((name,index)=>({name,index})).filter(project=>project.index!==activeCaseProjectIndex);
    caseProjectSwitcher.innerHTML=`<p class="case-project-switcher-title">Check the other:</p>${otherProjects.map(project=>`<button class="case-project-switcher-link" type="button" data-case-project-index="${project.index}"><span aria-hidden="true">→</span><span>${project.name}</span></button>`).join('')}`;
  };
  allProjectWipeTargets.forEach(target=>target.classList.add('project-viewport-wipe'));
  const setActiveCaseProject=index=>{
    activeCaseProjectIndex=index;
    activeCaseProjectContent=caseProjectContents[index]||caseProjectContents[0]||null;
    caseProjectContents.forEach((content,i)=>content.classList.toggle('is-active',i===activeCaseProjectIndex));
    caseProjectGallery=activeCaseProjectContent?.querySelector('.case-project-gallery')||null;
    caseProjectHeroVideo=activeCaseProjectContent?.querySelector('.case-project-hero-video')||null;
    caseProjectMediaLinks=activeCaseProjectContent?.querySelector('.case-project-media-links')||null;
    projectWipeTargets=activeCaseProjectContent?[...activeCaseProjectContent.querySelectorAll('.case-project-title, .case-project-strapline, .case-project-copy-title, .case-project-meta .case-project-data, .case-project-body, .case-project-web-caption, .case-project-instagram-copy, .case-goballer-process, .case-miunae-launch-copy, .case-aims-web-copy, .case-aims-social-copy, .case-aims-deck-copy')]:[];
    renderCaseProjectSwitcher();
  };
  setActiveCaseProject(0);
  /* The scroll listener below is the sole owner of detail wipes. An
     IntersectionObserver would toggle the same class independently and
     restart animations whenever its threshold fluctuated. */
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
  let caseProjectSwitching=false;
  const resetActiveProjectWipes=()=>{
    projectWipeTargets.forEach(target=>{
      target._detailWipeAnimation?.cancel();
      target._detailWipeAnimation=null;
      target.querySelectorAll('.auto-wipe-line').forEach(line=>{line._detailLineWipeAnimation?.cancel();line._detailLineWipeAnimation=null;line.style.removeProperty('opacity');line.style.removeProperty('clip-path');line.style.removeProperty('transform');});
      delete target.dataset.viewportVisible;
      target.classList.remove('detail-wipe-controlled','is-viewport-revealed','is-wipe-forward','is-wipe-backward');
      target.style.removeProperty('opacity');
      target.style.removeProperty('clip-path');
    });
  };
  /* Same curtain-wipe technique as closing: a solid panel sweeps in to cover
     the screen, the project swaps underneath while fully covered, then the
     panel sweeps away to reveal it — two genuine 900ms motions on the same
     easing, rather than an instant cut followed by a content fade. */
  const switchCaseProject=async index=>{
    if(caseProjectSwitching||!projectDetailOpen||index===activeCaseProjectIndex||!caseProjectContents[index])return;
    caseProjectSwitching=true;
    caseOverlay.classList.remove('is-switch-revealing');
    caseOverlay.classList.add('is-switch-covering');
    await wait(900);
    setActiveCaseProject(index);
    resetActiveProjectWipes();
    smooth.resetOverlay(0);
    projectDetailScrollTop=0;
    requestAnimationFrame(updateProjectWipes);
    requestAnimationFrame(updateActiveGallery);
    caseOverlay.classList.remove('is-switch-covering');
    caseOverlay.classList.add('is-switch-revealing');
    await wait(900);
    caseOverlay.classList.remove('is-switch-revealing');
    caseProjectSwitching=false;
  };
  caseOverlayClose?.addEventListener('click',closeCaseOverlay);
  caseOverlay?.addEventListener('click',event=>{
    if(event.target?.closest?.('.case-overlay-close'))closeCaseOverlay();
  });
  caseProjectSwitcher?.addEventListener('click',event=>{
    const link=event.target.closest('[data-case-project-index]');
    if(link)switchCaseProject(Number(link.dataset.caseProjectIndex));
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
    const projectMeta=[
      ['MIUNĀE','A skincare brand system built around time, tactility and restraint','Creative Direction'],
      ['GoBaller','Football coaching app for players of all ages','Brand, iOS App'],
      ['AIMS','The most advanced AI search for music catalogs','Website, Brand Refresh, Marketing & Sales Assets']
    ];
    const projectsInfo=document.getElementById('projectsInfo');
    if(projectsInfo){
      projectsInfo.innerHTML=projectMeta.map((meta,setIndex)=>`<span class="projects-info-set" data-project-info="${setIndex}">${meta.map((text,i)=>`<span class="projects-info-col projects-info-col--${i} ${i===0?'type-project-title':i===1?'type-project-meta':'type-project-tag'}">${text}</span>`).join('')}</span>`).join('');
      prepareAutoTextLines(projectsInfo);
    }
    const wipeProjectFrame=direction=>{
      frame._sectionWipeAnimation?.cancel();
      const revealing=direction==='backward';
      const hiddenEdge=revealing?'inset(100% 0 0 0)':'inset(0 0 100% 0)';
      const from=revealing?hiddenEdge:'inset(0)';
      const to=revealing?'inset(0)':hiddenEdge;
      frame._sectionWipeAnimation=frame.animate(
        [{clipPath:from},{clipPath:to}],
        {duration:1500,easing:'cubic-bezier(.22,.61,.36,1)',fill:'forwards'}
      );
      frame._sectionWipeAnimation.onfinish=()=>{
        frame.style.clipPath=to;
        frame._sectionWipeAnimation?.cancel();
        frame._sectionWipeAnimation=null;
      };
    };
    const progressSegments=[...document.querySelectorAll('.projects-progress-segment')];
    const progressBar=document.querySelector('.projects-progress');
    addEventListener('click',event=>{
      const mask=event.target.closest?.('.projects-image-mask');
      if(!mask||!caseOverlay||projectDetailOpen)return;
      const index=masks.indexOf(mask);
      if(index<0||index>2)return;
      if(!projectMeta[index])return;
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
      const sectionExit=smoothstep(.88,.95,stageP);
      /* Recent Works hands off through scroll progress alone. Hysteresis only
         guards the wipe direction; it never locks or moves page scroll. */
      if(!projectExitLatched&&stageP>=.88){
        projectExitLatched=true;
        postTransition?.classList.add('is-project-exit-start');
        wipeProjectFrame('forward');
        const exitDirection=projectScrollDirection;
        applyProjectWipeState(intro?.querySelector('.projects-intro-piece'),false,exitDirection);
        applyProjectWipeState(document.getElementById('projectsInfo'),false,exitDirection);
        applyProjectWipeState(progressBar,false,exitDirection);
      }else if(projectExitLatched&&projectScrollDirection==='backward'&&stageP<=.84){
        projectExitLatched=false;
        postTransition?.classList.remove('is-project-exit-start');
        wipeProjectFrame('backward');
        resetProjectWipeState(intro?.querySelector('.projects-intro-piece'));
        resetProjectWipeState(document.getElementById('projectsInfo'));
        resetProjectWipeState(progressBar);
      }
      const finalTextExit=projectExitLatched;
      const visualExit=projectExitLatched?1:sectionExit;
      if(frame){
        const frameClip=projectScrollDirection==='backward'
          ?`inset(${visualExit*100}% 0 0 0)`
          :`inset(0 0 ${visualExit*100}% 0)`;
        frame.style.clipPath=frameClip;
        frame.style.pointerEvents=visualExit>.99?'none':'';
      }
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
        [...info.querySelectorAll('.projects-info-set')].forEach((set,index)=>{
          const local=timeline-index*unit;
          const enter=smoothstep(0,.16,local);
          const exit=index===projectMeta.length-1?0:smoothstep(.78,.98,local);
          const visible=enter*(1-exit);
          set.style.opacity=String(visible);
          set.style.clipPath=exit>0?`inset(0 0 ${exit*100}% 0)`:`inset(0 0 ${(1-enter)*100}% 0)`;
        });
      }
      if(info){
        const infoVisible=!finalTextExit&&p>=galleryStart;
        if(!finalTextExit){
          applyProjectWipeState(info,infoVisible,projectScrollDirection);
          applyProjectWipeState(progressBar,infoVisible,projectScrollDirection);
        }
      }
      if(intro) intro.classList.toggle('is-gallery-moving',open>0.01);
      window.dispatchEvent(new CustomEvent('projects-progress',{detail:{progress:galleryP,index:activeIndex,open,images:images.map(img=>img.currentSrc||img.src)}}));
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
        if(mask){let maskClip='inset(100% 0 0 0)';if(before)maskClip='inset(0)';else if(active){const r=lerp(100,0,smoothstep(0,.96,settle));maskClip=i===0?`inset(${r}% 0 0 0)`:i===1?`inset(0 ${r}% 0 0)`:projectScrollDirection==='backward'?`inset(${r}% 0 0 0)`:`inset(0 0 ${r}% 0)`;}mask.style.clipPath=maskClip;mask.style.zIndex=String(active?100+i:before?10+i:0);}
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
          const pills=[...info.querySelectorAll('.projects-info-col--2')];
          if(menuRect&&innerWidth>900)pills.forEach(pill=>{pill.style.left=`${menuRect.left-ir.left}px`;pill.style.right='auto';});
          const recent=intro?.querySelector('.projects-intro-piece');
          if(recent){
            recent.style.top=`${localY}px`;recent.style.bottom='auto';
            const anchorIsInsideStage=localY>=menuBottom&&localY<=innerHeight*.7;
            if(anchorIsInsideStage){
              postTransition?.style.setProperty('--services-start-y',`${localY}px`);
              document.documentElement.style.setProperty('--section-copy-start-y',`${localY}px`);
            }
          }
        });
      }
      stage.classList.toggle('is-exiting',sectionExit>0);
      stage.classList.toggle('is-released',stageP>=.999);
    };
    const projectRange=()=>Math.max(1,stage.offsetHeight-innerHeight);
    const renderFromScroll=()=>{
      const projStart=projectsTop;
      const raw=clamp((scrollY-projStart)/projectRange(),0,1);
      if(raw<projectProgress-.0005)projectScrollDirection='backward';
      else if(raw>projectProgress+.0005)projectScrollDirection='forward';
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
  const postServicesRange=document.querySelector('.post-project-services-range');
  const postServicesSummary=document.querySelector('.post-project-services-summary');
  const postServicesNext=document.getElementById('postServicesNext');
  const postTransitionItems=[...postServices,...[postServicesRange,postServicesSummary].filter(Boolean)];
  const alignServicesSummary=()=>{
    const output=postServices[0]?.querySelector('.post-project-service-output');
    const stage=postTransition?.querySelector('.post-project-transition-stage');
    if(!output||!stage||!postServicesSummary)return;
    const outputRect=output.getBoundingClientRect();
    const stageRect=stage.getBoundingClientRect();
    postServicesSummary.style.left=`${outputRect.left-stageRect.left}px`;
  };
  requestAnimationFrame(alignServicesSummary);
  addEventListener('resize',alignServicesSummary,{passive:true});
  const serviceDescriptionDuration=800;
  const serviceRevealStarts=new WeakMap();
  const serviceExitTimers=new WeakMap();
  let pointerFocusedService=null;
  const revealService=item=>{
    const exitTimer=serviceExitTimers.get(item);
    if(exitTimer){clearTimeout(exitTimer);serviceExitTimers.delete(item);}
    if(item.classList.contains('is-hovered'))return;
    item.classList.add('is-hovered');
    serviceRevealStarts.set(item,performance.now());
  };
  const hideServiceAfterReveal=item=>{
    const elapsed=performance.now()-(serviceRevealStarts.get(item)||0);
    const remaining=Math.max(0,serviceDescriptionDuration-elapsed);
    const existingTimer=serviceExitTimers.get(item);
    if(existingTimer)clearTimeout(existingTimer);
    const hide=()=>{item.classList.remove('is-hovered');serviceExitTimers.delete(item);};
    if(!remaining)hide();
    else serviceExitTimers.set(item,setTimeout(hide,remaining));
  };
  const focusService=item=>{
    if(item===pointerFocusedService)return;
    const previous=pointerFocusedService;
    pointerFocusedService=item;
    postServices.forEach(service=>service.classList.toggle('is-pointer-focused',service===item));
    postTransition?.classList.toggle('is-service-focused',Boolean(item));
    if(previous)hideServiceAfterReveal(previous);
    if(item)revealService(item);
  };
  postTransition?.addEventListener('pointermove',event=>{
    if(!postTransition.classList.contains('is-active'))return focusService(null);
    const centers=postServices.map(item=>{const rect=item.getBoundingClientRect();return rect.top+10;});
    const firstBoundary=centers[0]-(centers[1]-centers[0])/2;
    const last=centers.length-1;
    const lastBoundary=centers[last]+(centers[last]-centers[last-1])/2;
    if(event.clientY<firstBoundary||event.clientY>lastBoundary)return focusService(null);
    let nearestIndex=0;
    for(let index=1;index<centers.length;index++){
      if(Math.abs(event.clientY-centers[index])<Math.abs(event.clientY-centers[nearestIndex]))nearestIndex=index;
    }
    focusService(postServices[nearestIndex]);
  });
  postTransition?.addEventListener('pointerleave',()=>focusService(null));
  if(postTransition){
    const verticalLine=postTransition.querySelector('.post-project-transition-line');
    const horizontalLine=postTransition.querySelector('.post-project-services-summary-line');
    postTransition.classList.add('is-scroll-timeline');
    postTransitionItems.forEach(item=>item.classList.remove('is-visible','is-exiting'));
    const updatePostTransition=()=>{
      const top=postTransition.getBoundingClientRect().top+scrollY;
      const p=clamp((scrollY-top)/(Math.max(1,postTransition.offsetHeight-innerHeight)),0,1);
      const verticalIn=smoothstep(.02,.18,p);
      const verticalOut=smoothstep(.58,.68,p);
      const horizontalIn=smoothstep(.132,.25,p);
      const horizontalOut=smoothstep(.65,.75,p);
      const verticalScale=verticalIn*(1-verticalOut);
      const horizontalScale=horizontalIn*(1-horizontalOut);
      if(verticalLine){
        verticalLine.style.transition='none';
        verticalLine.style.transformOrigin=verticalOut>0?'bottom center':'top center';
        verticalLine.style.transform=`scaleY(${verticalScale})`;
      }
      if(horizontalLine){
        horizontalLine.style.transition='none';
        horizontalLine.style.opacity=String(horizontalScale>.001?1:0);
        horizontalLine.style.transformOrigin=horizontalOut>0?'right center':'left center';
        horizontalLine.style.transform=`scaleX(${horizontalScale})`;
      }
      postTransitionItems.forEach((item,index)=>{
        const enter=smoothstep(.035+index*.012,.105+index*.012,p);
        const reverseIndex=postTransitionItems.length-1-index;
        const exit=smoothstep(.72+reverseIndex*.018,.79+reverseIndex*.018,p);
        const visible=enter*(1-exit);
        item.style.animation='none';
        item.style.opacity=String(visible);
        item.style.clipPath=exit>0?`inset(0 0 ${exit*100}% 0)`:`inset(0 0 ${(1-enter)*100}% 0)`;
        item.style.transform='none';
      });
      const servicesInteractive=p>=.2&&p<.68;
      postTransition.classList.toggle('is-active',servicesInteractive);
      if(!servicesInteractive)focusService(null);
    };
    addEventListener('scroll',updatePostTransition,{passive:true});
    addEventListener('resize',updatePostTransition,{passive:true});
    updatePostTransition();
  }
  if(postServicesNext){
    const bioWipes=[...postServicesNext.querySelectorAll('.bio-wipe')];
    const bioAboutCopy=postServicesNext.querySelector('#bioAboutCopy');
    const bioRight=postServicesNext.querySelector('.bio-right');
    const bioCopySwitches=[...postServicesNext.querySelectorAll('[data-bio-copy]')];
    const bioCopy={
      about:`<p class="type-project-title">What satisfies me isn't another logo on my résumé, a new design approach, or clicking buttons in Figma — and I don't do any of this out of passion either. My process is a fight, with the brief, with the obvious, with anything that comes too easy. That restlessness is where everything starts: design, leadership, coaching, all of it.</p><p class="type-project-title">It's showing up for individuals and teams who need support, finding that rare fit where something real clicks between us. Underneath the polish, there's usually something worth digging for — and when those layers break, the real and beautiful comes alive.</p><p class="bio-about-xp">20+ Years of XP</p>`,
      leadership:`<p class="type-project-title">My leadership experience comes mostly from my time at STRV. I led team leads and platform experts across iOS, Android, Backend, Frontend, Data Science, Design &amp; QA.</p><p class="type-project-title">Before that, I ran STRV's Design Team — and for a bit, when QA had no lead, ran both teams at once. Good times.</p><div class="bio-leadership-meta"><div><h2 class="type-project-title">Led</h2><p class="type-project-meta">11 managers</p></div><div><h2 class="type-project-title">Overseeing</h2><p class="type-project-meta">130 people</p></div></div><div class="case-project-links"><button id="openLeadershipReviews" type="button"><span class="case-project-link-arrow" aria-hidden="true">→</span><span class="case-project-link-label">Read my team's reviews</span></button><a href="https://www.eleken.co/blog-posts/managing-a-design-team-interview-with-seasoned-design-leaders" target="_blank" rel="noopener noreferrer"><span class="case-project-link-arrow" aria-hidden="true">↗</span><span class="case-project-link-label">My take on leadership in Eleken interview</span></a></div>`,
      coaching:`<p class="type-project-title">I work with teams and individuals to find the version of you that isn't performing for anyone — the noise gone, just what's actually there. No immediate advice. No "do it like this." Your style all the way — nothing forced.</p><div class="bio-leadership-meta"><div><h2 class="type-project-title">Coached</h2><p class="type-project-meta">70+ people (500+ hours)</p></div><div><h2 class="type-project-title">Accreditation</h2><p class="type-project-meta">ICF (ACSTH) &amp; EMCC</p></div></div><div class="case-project-links"><button id="openCoachingReviews" type="button"><span class="case-project-link-arrow" aria-hidden="true">→</span><span class="case-project-link-label">Read all client feedback</span></button></div>`
    };
    const bioRightCopy={
      about:(bioRight?.innerHTML||'').replaceAll(' bio-wipe',''),
      leadership:`<div class="bio-career bio-copy-block"><h2>Highlights</h2><ul class="bio-leadership-highlights"><li>Started the company's first regular performance reviews — later adopted company-wide</li><li>Built the first career ladder for designers — later adopted by other D&amp;E departments</li><li>Co-ran the first company academy for new talent in D&amp;E</li><li>Mentored the first company academy track for designers</li><li>Listen, stuff was happening and I was around, so...</li></ul></div>`,
      coaching:`<div class="bio-career bio-copy-block bio-coaching-details"><div class="bio-coaching-section"><h2>Focus</h2><p class="bio-muted">Design, career, leadership, executive, life and transformational coaching.</p></div><div class="bio-coaching-section"><h2>Clients</h2><p class="bio-muted">Designers, engineers, QA testers, team leaders, C-level executives. Individual sessions, team work, all of it.</p></div></div>`
    };
    let activeBioCopy='about';
    let bioCopySwitching=false;
    const switchBioCopy=next=>{
      if(!bioAboutCopy||!bioCopy[next]||next===activeBioCopy||bioCopySwitching)return;
      bioCopySwitching=true;
      if(bioRight){
        bioRight.classList.remove('is-copy-wiping-in');
        bioRight.classList.add('is-copy-wiping-out');
        bioRight.addEventListener('animationend',()=>{
          bioRight.innerHTML=bioRightCopy[next]||'';
          bioRight.classList.remove('is-copy-wiping-out');
          void bioRight.offsetWidth;
          bioRight.classList.add('is-copy-wiping-in');
          bioRight.addEventListener('animationend',()=>bioRight.classList.remove('is-copy-wiping-in'),{once:true});
        },{once:true});
      }
      bioAboutCopy.classList.remove('is-copy-wiping-in');
      bioAboutCopy.classList.add('is-copy-wiping-out');
      bioAboutCopy.addEventListener('animationend',()=>{
        bioAboutCopy.innerHTML=bioCopy[next];
        activeBioCopy=next;
        bioCopySwitches.forEach(control=>control.classList.toggle('is-active',control.dataset.bioCopy===next));
        bioAboutCopy.classList.remove('is-copy-wiping-out');
        void bioAboutCopy.offsetWidth;
        bioAboutCopy.classList.add('is-copy-wiping-in');
        bioAboutCopy.addEventListener('animationend',()=>{
          bioAboutCopy.classList.remove('is-copy-wiping-in');
          bioCopySwitching=false;
        },{once:true});
      },{once:true});
    };
    bioCopySwitches.forEach(control=>control.addEventListener('click',()=>switchBioCopy(control.dataset.bioCopy)));
    const updateBio=()=>{
      const sectionTop=postServicesNext.getBoundingClientRect().top+scrollY;
      const range=Math.max(1,postServicesNext.offsetHeight-innerHeight);
      const p=clamp((scrollY-sectionTop)/range,0,1);
      bioWipes.forEach((item,index)=>{
        if(item===bioRight&&bioCopySwitching)return;
        const order=Number(item.dataset.bioOrder||index);
        const enter=smoothstep(.02+order*.018,.16+order*.018,p);
        const reverseOrder=bioWipes.length-1-order;
        const exit=smoothstep(.76+reverseOrder*.018,.91+reverseOrder*.018,p);
        const visible=enter*(1-exit);
        if(item.classList.contains('bio-divider')){
          item.style.opacity=String(visible>.001?1:0);
          item.style.clipPath='none';
          item.style.transformOrigin=exit>0?'right center':'left center';
          item.style.transform=`scaleX(${visible})`;
          return;
        }
        item.style.opacity=String(visible);
        item.style.clipPath=exit>0?`inset(0 0 ${exit*100}% 0)`:`inset(0 0 ${(1-enter)*100}% 0)`;
        item.style.transform='none';
      });
    };
    addEventListener('scroll',updateBio,{passive:true});
    addEventListener('resize',updateBio,{passive:true});
    updateBio();
  }

  const initiativesSection=document.getElementById('initiatives');
  if(initiativesSection){
    const initiativesStage=initiativesSection.querySelector('.initiatives-stage');
    const initiativesGrid=initiativesSection.querySelector('.initiatives-grid');
    const initiativesWipes=[...initiativesSection.querySelectorAll('.initiatives-wipe')];
    const initiativeImage=initiativesSection.querySelector('#initiativeImage');
    const initiativeCopy=initiativesSection.querySelector('#initiativeCopy');
    const initiativeType=initiativesSection.querySelector('#initiativeType');
    const initiativeStatus=initiativesSection.querySelector('#initiativeStatus');
    const initiativeMentions=initiativesSection.querySelector('#initiativeMentions');
    const initiativeApps=[...initiativesSection.querySelectorAll('[data-initiative]')];
    const initiativeData={
      'a-void':{name:'A-Void',image:'media/initiatives/vibe-coding/app_a-void.jpg',copy:'An iOS app for keeping track of the things that quietly become problems when you forget them. Passports, renewals, appointments, birthdays and anything else with a future attached. Instead of treating every date with equal urgency, A-Void understands when something actually starts to matter, gradually shifting its interface, color and personality as pressure builds.',type:'iOS App',status:'Awaiting AppStore Submission'},
      taiki:{name:'Taiki',image:'media/initiatives/vibe-coding/app_taiki.jpg',copy:'Taiki is a quiet place for the links you don’t want to lose. Save something once and it slips into your library with barely any effort, already sorted and easy to find later. Pre-defined folders based on your creative style. The whole thing is built to feel light: visual folders, soft movement, quick search, and none of the usual “organize your life” pressure. It’s less about managing bookmarks and more about keeping a small, useful corner of the internet tidy.',type:'Browser Extension',status:'Waiting For Launch'},
      'aww-wake':{name:'Aww-wake',image:'media/initiatives/vibe-coding/app_n7-awake.jpg',copy:'A tiny macOS utility for when your Mac just needs to stay awake. Pick 30 minutes, set your own time, or leave it on until you turn it off. That’s basically it — except the app treats the whole thing like a live state instead of a boring system toggle. The glassy interface shifts with the session, the countdown stays quietly visible, and the menu bar keeps everything close without getting in the way. Simple job, slightly obsessive execution.',type:'MacOS App',status:'Final Tweaks'},
      kokoji:{name:'Kokoji',image:'media/initiatives/vibe-coding/app_kokoji.jpg',copy:['Kokoji is a tiny opinionated creature living somewhere on your Mac, mostly concerned with your water intake, the state of his room, and your questionable decisions. You check in, add a drink, poke around, and over time the place starts changing, new things appear, conversations get stranger, and Kokoji develops more reasons to comment on what you’re doing.','There are no streaks, guilt trips, or productivity sermons. Just a weird little world, dry jokes, occasional insults, and a creature who somehow became involved in your hydration.'],type:'MacOS App',status:'Final Tweaks'},
      wezzaa:{name:'Wezzaa',image:'media/initiatives/vibe-coding/app_wezzaa.jpg',copy:'A minimalist weather app for when you just want a clean weather info delivery. Open it, see the temperature, read one useful line, move on with your life. The forecast stays out of the way until you need it, and widgets, alternate icons and shareable weather cards let you dress things up a little. No accounts, no clutter, no pretending weather needs a dashboard.',type:'iOS App',status:'Final Tweaks'},
      'and-then':{name:'And Then',image:'media/initiatives/vibe-coding/app_and-then.jpg',copy:'A personal journal for everything you watch. Save what you want to see, keep track of what you’re watching, or look back at movies and shows from years ago — with ratings, notes, dates, people, places, collections, and all the little context that made them yours. And Then keeps the whole thing private and personal, then quietly connects the pieces into a timeline you can actually explore. Less streaming tracker, more memory for your movie life.',type:'iOS App',status:'Concept Prototype'},
      terracoda:{name:'Terracoda',image:'media/initiatives/vibe-coding/app_terracoda.jpg',copy:['Terracoda is a stripped-back browser editor for HTML, CSS and JavaScript, built to keep the interface quiet while still doing a lot under the surface. Code updates live as you work, real project folders can be opened or dropped straight in, and larger files stay usable without turning the whole thing into a heavy IDE. There’s syntax highlighting, autocomplete, Emmet, diagnostics, Find + Replace, persistent undo, code-to-preview linking, detached live preview, project recovery, curated frontend libraries, Google Fonts, responsive preview modes, file navigation and a command palette for the rest.','It’s meant to feel closer to a precise creative tool than a development environment — fast, minimal, and only as complex as you need it to be.'],type:'Browser App',status:'Testing With Dev Friends'},
      utb:{name:'Tomas Bata Uni.',image:'media/initiatives/side-quests/side-quests_utb.jpg',copy:["I was twice invited to serve on a panel of industry professionals evaluating final bachelor's and master's thesis presentations on the Visual Arts programme at the university.",'On top of this, while leading a design team, we held full-day design talks for students of the Multimedia & Design subject twice over two years. The sessions continued even after I got promoted out of the Design Team Leadership role.','I made friends with the faculty lead. Had students applying to STRV years later. Lovely stuff.'],sideQuest:true},
      undersurface:{name:'Ūndersurface',image:'media/initiatives/side-quests/side-quests_undersurface.jpg',copy:['Co-founded an enclosed community of entrepreneurs, designers and tinkerers. A peer accountability community that ran for 5+ years on Slack, combining structured goal-pushing sessions, sharing circles and talks to help members grow personally and professionally. Beyond the digital space, Joe and I organized an in-person retreat — including a 3-day trip to Estonia — built around deep-sharing, introspective and task-driven exercises designed to get people sharing honestly and working through personal blocks.','It moved me so much that when I got back, I enrolled in a one-year coaching program to become a certified life coach.'],mentions:[['Joe Pacal','https://www.pac.al/']],sideQuest:true},
      'femme-palette':{name:'Femme Palette',image:'media/initiatives/side-quests/side-quests_femme-palette.jpg',copy:['Femme Palette is a mentoring platform and community built around career development and practical advice, not theory. Network of 1,200+ mentors, community of 5,000+, hubs in Prague, Berlin, Amsterdam, Barcelona, Copenhagen, and Paris.','I mentor in Design, General Career Guidance & Soft Skills, and Management & Leadership.'],sideQuest:true},
      nollie:{name:'Nollie',image:'media/initiatives/side-quests/side-quests_nollie.jpg',copy:['Co-founded this creative studio with a longtime friend and former colleague, Ales Nesetril, before we each pivoted into our own things — all in good spirit. During this time we launched the NEXT WORKOUT iOS app, which you can check out next.','Sharing this to also openly admit that not everything I touch always "works out." Duh! Here, the studio — the app works great! Hehe.'],mentions:[['Ales Nesetril','https://www.instagram.com/alesnesetril']],sideQuest:true},
      'next-workout':{name:'NEXT.WORKOUT',image:'media/initiatives/side-quests/side-quests_next-workout.jpg',copy:["This was a sweet collab between Next.Move (client), Yiskra Creative Studio (brand) — and my former Creative Studio Nollie (Design & Ops w/ Ales Nesetril).",'I sourced and managed developers, tracked the timeline and reported progress to the client side represented by Veronika Huna.',"The app launched and keeps growing. People work out. Life's good."],projectLink:'https://www.nextworkout.app/en',mentions:[['Next.Move','https://www.instagram.com/nextmove.cz/'],['Yiskra Creative Studio','https://www.yiskra.studio/'],['Ales Nesetril','https://www.instagram.com/alesnesetril'],['Veronika Huna','https://www.instagram.com/fitveronika']],sideQuest:true}
    };
    const initialInitiative=initiativeData['a-void'];
    if(initialInitiative&&initiativeCopy){
      initiativeCopy.replaceChildren(...(Array.isArray(initialInitiative.copy)?initialInitiative.copy:[initialInitiative.copy]).map(copy=>{
        const paragraph=document.createElement('p');
        paragraph.textContent=copy;
        return paragraph;
      }));
    }
    let activeInitiative='a-void';
    let initiativeSwitchTimer=0;
    const switchInitiative=key=>{
      const next=initiativeData[key];
      if(!next||key===activeInitiative||!initiativesStage||!initiativesGrid)return;
      clearTimeout(initiativeSwitchTimer);
      initiativesStage.classList.add('is-switching');
      initiativeSwitchTimer=setTimeout(()=>{
        activeInitiative=key;
        initiativeImage.src=next.image;
        initiativeImage.alt=`${next.name} app interface`;
        initiativeCopy.replaceChildren(...(Array.isArray(next.copy)?next.copy:[next.copy]).map(copy=>{
          const paragraph=document.createElement('p');
          paragraph.textContent=copy;
          return paragraph;
        }));
        if(next.projectLink){
          const link=document.createElement('a');
          link.className='initiatives-copy-link';
          link.href=next.projectLink;
          link.target='_blank';
          link.rel='noopener noreferrer';
          link.innerHTML='<span class="case-project-link-arrow" aria-hidden="true">↗</span><span class="case-project-link-label">'+next.name+'</span>';
          initiativeCopy.append(link);
        }
        initiativeMentions.replaceChildren();
        if(next.mentions?.length){
          const title=document.createElement('h3');
          title.textContent='Mentions';
          const links=document.createElement('div');
          links.className='case-project-links';
          next.mentions.forEach(([label,href])=>{
            const link=document.createElement('a');
            link.href=href;
            link.target='_blank';
            link.rel='noopener noreferrer';
            const arrow=document.createElement('span');
            arrow.className='case-project-link-arrow';
            arrow.setAttribute('aria-hidden','true');
            arrow.textContent='↗';
            const linkLabel=document.createElement('span');
            linkLabel.className='case-project-link-label';
            linkLabel.textContent=label;
            link.append(arrow,linkLabel);
            links.append(link);
          });
          initiativeMentions.append(title,links);
        }
        initiativesGrid.classList.toggle('is-side-quest-active',!!next.sideQuest);
        if(!next.sideQuest){
          initiativeType.textContent=next.type;
          initiativeStatus.textContent=next.status;
        }
        initiativeApps.forEach(app=>app.classList.toggle('is-active',app.dataset.initiative===key));
        requestAnimationFrame(()=>initiativesStage.classList.remove('is-switching'));
      },300);
    };
    initiativesSection.addEventListener('click',event=>{
      const app=event.target.closest('[data-initiative]');
      if(app)switchInitiative(app.dataset.initiative);
    });
    const updateInitiatives=()=>{
      const sectionTop=initiativesSection.getBoundingClientRect().top+scrollY;
      const range=Math.max(1,initiativesSection.offsetHeight-innerHeight);
      const p=clamp((scrollY-sectionTop)/range,0,1);
      initiativesWipes.forEach((item,index)=>{
        const order=Number(item.dataset.initiativesOrder||index);
        const visible=smoothstep(.02+order*.018,.18+order*.018,p);
        if(item.classList.contains('initiatives-divider')){
          item.style.opacity=String(visible>.001?1:0);
          item.style.clipPath='none';
          item.style.transform=`scaleX(${visible})`;
          return;
        }
        item.style.opacity=String(visible);
        item.style.clipPath=`inset(0 0 ${(1-visible)*100}% 0)`;
        item.style.transform='none';
      });
    };
    addEventListener('scroll',updateInitiatives,{passive:true});
    addEventListener('resize',updateInitiatives,{passive:true});
    updateInitiatives();
  }

  const coachingOverlay=document.getElementById('coachingOverlay');
  const coachingOverlayClose=document.getElementById('coachingOverlayClose');
  const coachingReviewIndex=document.getElementById('coachingReviewIndex');
  const coachingReviewDuration=document.getElementById('coachingReviewDuration');
  const coachingReviewType=document.getElementById('coachingReviewType');
  const coachingReviewProfile=document.getElementById('coachingReviewProfile');
  const coachingReviewCopy=document.getElementById('coachingReviewCopy');
  const coachingReviews=[
    ['Michal Boháč','CEO','Wonder Makers','Transformational Coaching','Czechia','michal-bohac.jpg',[
      `Hi, my name is Michal, and I was born twice in my life. The first time was 29 years ago, and I am grateful to my Mom for that (and my Dad, of course). The second time was six months ago, and I owe that to Marián. You see, I was not always who I am now, and I became this person thanks to him. Actually, thanks to myself—but I would not have been capable of it without him. Complicated, right?`,
      `The fact is, Marián’s presence affected every aspect of my being. For the better. What was the magic? That is the best thing about all of it: there is no magic, and there never was. There is only an incredible ability to listen, and a boundless interest in and attention toward you. When you sit opposite Marián, you are the only person who matters in that moment. No one is more important than you. As if no one else had ever existed.`,
      `When I first met Marián, I was fairly convinced I knew who I was and who I needed to become. I had an idea of myself and my desires—everything I had to fit into my life, everything I had to achieve. Those were all the things that would make me happy. What I will be grateful to Marián for until the day I die is that he did not help me achieve any of them. Instead, he helped me realize that none of them were my dreams or goals, let alone the foundation of my happiness. They were the dreams and goals of other people. Strangers. People I know nothing about and probably never will. (What do those people even know about themselves?) Dreams someone sold me and I bought willingly and thoughtlessly. Very little of it came from me, from my personality, or from knowing myself.`,
      `It was only with Marián that we discovered me: what I truly want, what gives me energy, and what takes it away. And that brings us to a major affliction of today’s world. Many people will tell you what is best for you. They will sell it to you or offer it for free. Based on their own experience or someone else’s, they will advise you on how to achieve success, fame, and happiness as a finished product. Yet not one of them makes even the slightest effort to know and understand you sincerely—to understand what it is like to be YOU. To discover you. They think that what worked for them must work for others. So they give advice. But that is nothing more than vanity disguised as goodwill, and advice aimed blindly. Instead of showing you a direction, they entangle you even further and lead you farther away from yourself. If happiness has ever existed in this world, you already have it within you; you simply have not discovered it. YET. And that is what Marián helped me understand—and that understanding is the key to everything!`,
      `Marián sincerely believes there is no universal advice, no universal path to happiness. The only right path is your own, and no one has ever published a map of it. How could they? It is up to you to discover that path and find out what lies along it. No one can tell you when and where to turn, let alone where you are supposed to arrive. You probably do not know that yourself. YET. No one has ever walked that path before, so no one can tell you what will be waiting there. But someone can help you prepare for it and pack your backpack. YOUR own backpack, equipped with everything you might need along the way so that nothing catches you unprepared. They will not fill it with what other people needed, but with what you need.`,
      `I am immensely grateful that I was able to pack mine with Marián. I now know there is no one else I would rather have packed it with. I cannot imagine anyone doing it with such genuine interest in my journey as he did. When you allow the right person to know you better than you may know yourself, it is as if your older self were preparing you for the road. Thank you, Marián, for being my older self, just as you are the older self of all your “bodies,” as you call them.`,
      `I leave my work with Marián a free, self-aware person, able to interpret my life in my own favor, whatever happens in it. You cannot always control which cards land on the table or whether you run into snakes in the sand along the way (Marián will never promise otherwise). But you can always play as well as you possibly can, despite everything and everyone. You can always enjoy your game, your journey, so that one day you can calmly say, from a good place: I followed my own path, and it was a ride no one else experienced. And perhaps, through that, inspire others never to stop searching for their own path for a very good reason, and never to settle for anything less. That is what this is all about. Thank you, my friend, for teaching me to play as if my life depended on it!`
    ]],
    ['Roman Bartoš','Designer','Freelance','Transformational Coaching','Czechia','roman-bartos.jpg',[`I started seeing Marián because I wanted to do something about my work ethic and discipline. I had left the company to work independently. Work began piling up, and very quickly I no longer knew what to tackle first.`,`Marián’s help was invaluable in several ways. As someone new to coaching, he first explained thoroughly how the whole thing worked and how it would unfold. Then, as we worked on the problem itself, his intelligent, perceptive questions led me to answers and solutions that were actually my own. Many things from our sessions are now firmly embedded in my life, and I often think back to the many small pieces of advice and tips I picked up along the way with Marián. A bonus was Marián’s advice and experience from his own remarkably rich professional life, and the completely relaxed Scandinavian-Japanese-style atmosphere.`]],
    ['Darja Arefjeva','Product Designer','Pipedrive','Design Coaching','Russia','darja-arefjeva.jpg',[`Just like many other product designers out there, I pivoted careers and got into design through courses, books, webinars… basically learning by trial and error. At some point, I found myself completely overwhelmed with information and unsure how to navigate my career further, how to evolve, and what to focus on. That was when I reached out to Marián—not with a clear question, just a bunch of self-doubt. Although I used to be skeptical about the concept of mentoring, I could not miss the opportunity to talk to Marián because I followed and admired his design work. Yet I received so much more than a thorough design review, and I have been the most loyal design-coaching promoter ever since.`,`To begin with, Marián created a safe and encouraging space for me to open up and put my thoughts in order. I always came with a problem that seemed unsolvable and always left feeling empowered and uplifted. He is the leader I desperately needed. We talked about pixels and icons, but also long-term goals, personal priorities, and emotional well-being. I received the most on-point design advice, which noticeably took my skills to a completely new level. I gained confidence and, most importantly, understood what my strengths are and how to develop them. As a result, I feel more connected to myself. Marián is a very talented designer and an incredible coach, and I am so grateful for the mentoring sessions that helped me grow on both career and personal levels.`]],
    ['Anastasiia Kozina','Founding Designer','Illusian','Life Coaching','Finland','anastasiia-kozina.jpg',[`Working with Marián when I felt burned out, overwhelmed, and immobilized helped me acknowledge my feelings and rework my self-afflicting beliefs and interactions with the world. Marián can be the venting system you may have needed for a long time, but he can also be an essential part of setting a new course for that stage of your life.`]],
    ['Mako Ueda','Business Operations Manager','Career Break','Transformational Coaching','United States','mako-ueda.jpg',[`The coaching sessions helped me shift my paradigms in life. I thought I knew what steps to take to be a “good person,” which included living up to a particular set of standards influenced far more by my surroundings than by myself. Over the sessions, I learned to listen to myself and let myself be me—and everything else would fall into place. One day, I started thinking about the kind of life I could live on my own terms, without always trying to fit into the “successful career woman” mold. Such a simple thought freed my imagination and allowed me to reconsider what I truly valued: fulfilling relationships, authenticity, and a healthy, balanced life—not work. Last week, I had an interview for a job I wanted. I got nervous during the interview and did not feel that I performed the activities well. That night, I was overwhelmed with anxiety and racing thoughts, but I was quickly able to return to my foundations—the loving relationships I have around me. Now I feel okay. If I do not get hired, it will be okay, and I will keep trying elsewhere.`,`My diary entry from October 1, 2022:`,`Whenever I leave my coaching session, I feel an overwhelming sense of love for myself. That self-love inspires me to naturally do things that are “good” for me, like paint, journal, or even clean the house. I do these things because I want to take care of myself—not out of guilt to be productive. Over the week, that self-love dissipates. I eventually go back to trying to escape my reality by binge-watching TV. But the more I practice being kinder to myself and listening to my intuition, the more I can return to this space of forgiveness and self-love. I want to live on my own terms and figure out what that means for me.`]],
    ['Ilja Panić','CTO & Co-Founder','Resolve','Career Coaching','Czechia','ilja-panic.jpg',[`Before meeting Marián, my history with coaching was a mixed bag. Until then, I had thought of coaches as self-assured gurus who applied a predefined set of techniques to help you clarify your goals and boost your productivity and performance. My perspective completely shifted after working with Marián. Marián is a highly perceptive and empathetic listener. Whenever my words said one thing but my body language said something else, he picked up on it and used it as an avenue to help me deconstruct my underlying motives and assumptions. What stood out was his ability to quickly understand my personality and temperament and adapt his coaching style to suit me. This knack allowed him to skillfully balance guiding me while encouraging self-direction. Most importantly, Marián was not afraid to nudge me out of my comfort zone, challenging my initial answers and steering me toward deeper reflection.`,`Sometimes I found myself leaving a session shaken, yet profoundly contemplative. Other times, I was brimming with inspiration and energy, barely able to contain the excitement and eagerness stirring within me. Both kinds of sessions proved invaluable, offering unique insights into the underlying mental models that drive my personal and professional behavior. A few months into our collaboration, I realized a significant transformation. I did not leave our sessions burdened with a laundry list of goals and benchmarks to meet, which Marián would then hold me accountable for. Instead, I left with a new understanding of myself. I recognized that I did not thrive within rigid structures, something I had already been somewhat aware of. Through my journey with Marián, however, I learned not merely to acknowledge this trait but to harness it as a powerful tool. I can wholeheartedly recommend Marián to anyone looking for a coaching experience that is transformative, personalized, and insightful.`]],
    ['Marie Lauren','Community Representative','Scott.Weber Workspace','Life Coaching','Czechia','marie-lauren.jpg',[`Coaching with Marián recharges your batteries and gives you so much energy to move forward that you feel like a Duracell. We’ve had sessions in both lighter and more difficult moments, but the result was always the same—a smile on my face and the strength to take action, choose what matters and throw the rest overboard. Every hour with him saved me so many others that I would otherwise have lost, had it not been for his perceptive questions to reflect on.`]],
    ['Tomáš Lodňan','CEO','Good Request','Executive Coaching','Slovakia','tomas-lodnan.jpg',[`I have to say, we had many mentors and consultants. Many of them helped us move forward, gave us feedback and created a space where we could talk about our challenges despite the daily routine.`,`Marián was on another level for us. To be honest, I was extremely surprised by how quickly and precisely he was able to understand who we are, what our challenges are and identify the problems without any unnecessary fluff. His presentation was so valuable that I went through it several times. :) Based on his suggestions and his ability to identify potential issues in the future, we made important changes to our organisational structure and prioritised our focus on areas where we had pain points.`,`Marián continues to be our long-term mentor and coach. We regularly return to discuss specific topics and validate whether he confirms that our approach is good or provides a different perspective. If your organisation is growing and you are seeking an expert in leadership and team management for your tech company, Marián is definitely the person I would recommend first.`]],
    ['Kristýna Pecková','UX/UI Designer','Freelance','Design Coaching','Czechia','kristyna-peckova.jpg',[`When I started in design several years ago, I was looking for someone who could open the door to that world and help me launch my career. Marián became one of the key people who guided me through that process. His support, advice and knowledge were indispensable to me, and thanks to him I found courage and confidence in my abilities. Marián gave me foundational design knowledge, explained it in a practical and entertaining way, gave me constructive feedback on my designs and stood by me when I landed my first client. His coaching and support contributed significantly to building my confidence in design and in my personal life.`,`It is great to see how he has combined two things he genuinely enjoys—design and coaching. There is no question that he is a great designer, but I am glad I could be part of his professional growth and see him develop as a coach and share his know-how with others with such passion. I can only recommend working with him in any capacity!`]],
    ['Jakub Nešpor','Design Engineer','Entire','Transformational Coaching','Czechia','jakub-nespor.jpg',[`I would say I have a pretty good history with Marián. He was there for me during the most crucial phase of my career as my Team Leader, always striking the right balance between friendliness and professionalism. He introduced me to the fundamentals of coaching, so it is no surprise that, even years later, he was there to lend a hand when I needed it. What I love most about our sessions is how authentic they are, even when things are not always smooth sailing. And my favorite part? Leaving! Not because I am eager to go home, but because I always feel so pumped and happy that I have just learned something new about myself.`]],
    ['Tomáš Bruzda','Designer','Freelance','Coaching','Czechia','tomas-bruzda.jpg',[`I have been attending sessions with Marián in waves. We have already gone through two waves. The first dealt with both personal and work life a bit. The second was primarily about work life. Regardless, in both cases, I left very satisfied. Marián helped me organize my thoughts, set priorities and, most importantly, figure out what I really want. Even when we did not have a specific topic to address, it helped me a lot just to vent about what was bothering me. Sometimes we followed up on something, sometimes we did not, but I always left with peace of mind. If a third wave comes, it will certainly be with Marián again.`]],
    ['Maroš Novák','Head of Design & Engineering','GoodRequest','Leadership Coaching','Slovakia','maros-novak.jpg',[`After eight years as iOS Lead at GoodRequest, I started wondering what should come next. The team was finely tuned, with no weak links—technologically strong and motivated—while I found myself digging deeper into how the company operated. Around that time, we invited Marián to come in and look at the company from a distance. After years inside it, we lacked that perspective because we were deep in operations, business and everyday problems. During our conversation, he wanted to understand how we worked, and he asked exactly the questions I needed to answer but had never asked myself.`,`One of the outcomes after his week with us was the recommendation that the tech leaders needed a leader: a Head of Design & Engineering who would motivate them, listen to them, help guide them and launch them to the moon. Simply someone who would be there for them in the same way they were there for their teams. The recommendation came with my name, followed by an offer from the board asking whether I was in. I was. Naturally, I had respect and concerns, but I was not alone in it—we started sessions with Marián.`,`Our coaching sessions are pure gold. Whether I was looking for a replacement for myself on the iOS platform and thinking about how to tell the team, figuring out how to take the right first steps as Head of D&E, preparing for difficult conversations or finding ways to connect the tech leads more closely, we found answers to everything together—or rather, I found them. Marián asked the questions. His empathy, spark, ability to step out of the role and precisely targeted advice make me feel more confident in what I do. Our leadership styles are similar, and our vibe and shared perspective help me immensely. Also thanks to lines like: “Hey, I’m here for you,” “Let’s make this easier for you,” “I’m rooting for you,” “Go take what’s yours,” and “This is the shit.”`]]
  ];
  const leadershipReviews=[
    ['Jan Kaltoun','Chief Operating Officer','STRV','jan-kaltoun.jpg',[`Marian is one in a million kind of person, and working with him is simply a privilege. While Marian is not really a deeply technical person, he was able to successfully lead a team of leads who in turn led over a hundred designers and engineers. Working as a direct report to Marian, I was constantly amazed by how effortlessly he was able to tackle all the important tasks that needed to get done by empowering every single one of us in ways that are tough to put into words but endlessly effective. Marian listens, he brings the best out of you, he advises and, when needed, he pushes.`]],
    ['Jan Pacek','Product Architect','STRV','jan-pacek.jpg',[`When I think of leadership, two people immediately pop into my mind — Jocko Willink and Marian. Yes, Jocko is more badass and would probably kick both our asses, but I’ve had a chance to be part of Marian’s team for about two years, and his approach to leadership was always very inspiring. It’s the combination of absolute calmness in the face of everyday disasters together with strong values that bring new perspectives. After a conversation with Marian, every hopeless crisis has a light at the end of a tunnel, and you are left wondering why it was a disaster in the first place. Those two years made me a better person for sure.`]],
    ['Petr Nohejl','Engineering Manager','STRV','petr-nohejl.jpg',[`The collaboration with Marian was very inspiring and definitely helped me move forward in my career as a leader. Marian was my lead and I worked closely with him for more than four years. What I appreciate most is that I could tell him anything, without filtering what I can or cannot say to my boss, and he always supported me and gave me good advice. He helped me overcome a number of crises. He made me think differently, from another perspective. Marian is a good listener and has a great talent for coaching. I am very happy I could be part of his team.`]],
    ['Jan Malý','Founding AI Engineer','Kontext','jan-maly.jpg',[`I was lucky to work under Marian’s supervision at STRV. He significantly impacted my career and development as he was highly supportive and acted as a coach, giving me space to grow. Thanks to Marian’s trust and guidance, we were able to start and grow the Data Science department.`]],
    ['Daniel Kraus','Chief Technology Officer','STRV','daniel-kraus.jpg',[`Everyone has in mind those very few people who at some point in their life left a substantial impact on their future. Those people are different from the crowd. Those people stand by their ideals no matter what. Those people you simply somehow know that you will always remember. This is Marian to me. I feel lucky I could have spent four years working closely under his leadership at STRV. He’s been an inspiring mentor. A manager who could support me fully but also was strict when needed.`]],
    ['Michal Klačko','Director of Engineering','STRV','michal-klacko.jpg',[`Marian is a very unique person. He was my lead while I worked as the Lead of the Backend department at STRV. He was a lead you read about in books. He trusted his people, always left me and others space to grow, and helped or pushed when needed. Marian was always inclined toward coaching and dedicated a significant amount of time to learning it from professionals from QED. Having a “boss” and a coach in one person was unique, and I loved it. People at STRV noticed Marian’s talent for listening to people and helping them become better, or just to figure things out.`]],
    ['Juraj Kuliška','Senior Android Engineer','Paylocity','juraj-kuliska.jpg',[`I had the honor to work with Marian for about two years. We had some really amazing talks that made me do great leaps in my career. Also, what I loved about Marian’s approach was that he always supported people in what they wanted to do most, even if it went against his own interests that he put aside — which is amazing both humanly and from a leadership point of view.`]]
  ];
  const coachingFlagByCountry={'Czechia':'czechia.svg','Russia':'russia.svg','Finland':'finland.svg','United States':'united-states.svg','Slovakia':'slovakia.svg'};
  const coachingReviewDurations=['Ongoing Coaching Partnership (weekly, 1yr+)','Focused Coaching Cycle (~7 sessions)','Kickstart Coaching Session (1–3 sessions)','Kickstart Coaching Session (1–3 sessions)','Focused Coaching Cycle (~7 sessions)','Focused Coaching Cycle (~7 sessions)','Focused Coaching Cycle (~7 sessions)','Kickstart Coaching Session (1–3 sessions)','Kickstart Coaching Session (1–3 sessions)','Focused Coaching Cycle (~7 sessions)','Focused Coaching Cycle (~7 sessions)','Focused Coaching Cycle (~7 sessions)'];
  let activeCoachingReview=0;
  let activeLeadershipReview=0;
  let activeReviewMode='coaching';
  let activeCoachingReviewPart=0;
  let coachingEntryAnimations=[];
  const renderCoachingReview=(index,partIndex=0)=>{
    const isLeadership=activeReviewMode==='leadership';
    const reviews=isLeadership?leadershipReviews:coachingReviews;
    const review=reviews[index];if(!review)return;
    if(isLeadership)activeLeadershipReview=index;else activeCoachingReview=index;
    const [name,position,company,type,country,photo,paragraphs]=isLeadership?[review[0],review[1],review[2],'','',review[3],review[4]]:review;
    const parts=!isLeadership&&index===0?[paragraphs.slice(0,3),paragraphs.slice(3,5),paragraphs.slice(5)]:[paragraphs];
    activeCoachingReviewPart=Math.min(partIndex,parts.length-1);
    coachingReviewIndex.innerHTML=reviews.map((item,i)=>`<button type="button" data-review="${i}" class="client-review-menu-item ${i===index?'is-active':''}"><b class="client-review-menu-number">${String(i+1).padStart(2,'0')}</b><strong class="client-review-menu-name">${item[0]}</strong>${isLeadership?'':`<img class="client-review-menu-flag" src="media/flags/${coachingFlagByCountry[item[4]]}" alt="" aria-hidden="true">`}</button>`).join('');
    coachingReviewDuration.textContent=isLeadership?'':coachingReviewDurations[index];
    coachingReviewType.textContent=isLeadership?'':type;
    coachingReviewProfile.innerHTML=`<img src="media/${isLeadership?'leadership':'coaching'}/${photo}" alt="${name}"><h2 class="coaching-review-profile-name">${name}</h2><p class="coaching-review-profile-position"><span>${position}</span><span aria-hidden="true"> ∙ </span><span class="coaching-review-profile-company">${company}</span></p>${isLeadership?'':`<p class="coaching-review-profile-country"><img src="media/flags/${coachingFlagByCountry[country]}" alt="" aria-hidden="true"><span>${country}</span></p>`}`;
    const partNavigation=parts.length>1?`<nav class="coaching-review-parts" aria-label="${name} review parts">${parts.map((part,i)=>`<button type="button" data-review-part="${i}" class="${i===activeCoachingReviewPart?'is-active':''}">Part ${String(i+1).padStart(2,'0')}</button>`).join('')}</nav>`:'';
    coachingReviewCopy.innerHTML=`${partNavigation}<div class="coaching-review-part-copy">${parts[activeCoachingReviewPart].map(paragraph=>`<p>${paragraph}</p>`).join('')}</div>`;
  };
  const playCoachingEntry=()=>{
    coachingEntryAnimations.forEach(animation=>animation.cancel());
    const metaTargets=activeReviewMode==='leadership'?[]:[coachingReviewDuration,coachingReviewType];
    const targets=[coachingReviewIndex,...metaTargets,...coachingReviewProfile.children,...coachingReviewCopy.children];
    coachingEntryAnimations=targets.map((target,index)=>{
      const animation=target.animate([{opacity:0,clipPath:'inset(0 0 100% 0)'},{opacity:1,clipPath:'inset(0)'}],{duration:700,delay:index*45,easing:'cubic-bezier(.22,.61,.36,1)',fill:'both'});
      animation.onfinish=()=>{animation.cancel();coachingEntryAnimations=coachingEntryAnimations.filter(item=>item!==animation)};
      return animation;
    });
  };
  const openCoachingOverlay=(mode='coaching')=>{activeReviewMode=mode;const isLeadership=mode==='leadership';coachingOverlay.classList.toggle('is-leadership-reviews',isLeadership);coachingReviewIndex?.setAttribute('aria-label',isLeadership?'Team leadership reviews':'Coaching reviews');coachingOverlayClose?.setAttribute('aria-label',isLeadership?'Close team leadership reviews':'Close coaching reviews');renderCoachingReview(isLeadership?activeLeadershipReview:activeCoachingReview);coachingOverlay.classList.add('is-open');coachingOverlay.setAttribute('aria-hidden','false');document.body.classList.add('coaching-overlay-open');requestAnimationFrame(playCoachingEntry)};
  const closeCoachingOverlay=()=>{if(!coachingOverlay?.classList.contains('is-open')||coachingOverlay.classList.contains('is-closing'))return;coachingEntryAnimations.forEach(animation=>animation.cancel());coachingEntryAnimations=[];coachingOverlayClose?.classList.remove('is-cursor-target');cursor?.classList.remove('is-close-target');coachingOverlay.classList.add('is-closing');setTimeout(()=>{coachingOverlay.classList.remove('is-open','is-closing');coachingOverlay.setAttribute('aria-hidden','true');document.body.classList.remove('coaching-overlay-open')},800)};
  postServicesNext?.addEventListener('click',event=>{if(event.target.closest('#openCoachingReviews'))openCoachingOverlay();if(event.target.closest('#openLeadershipReviews'))openCoachingOverlay('leadership')});
  coachingReviewIndex?.addEventListener('click',event=>{const button=event.target.closest('[data-review]');if(!button)return;coachingOverlay.classList.add('is-review-switching');setTimeout(()=>{renderCoachingReview(Number(button.dataset.review));coachingOverlay.classList.remove('is-review-switching')},350)});
  coachingReviewCopy?.addEventListener('click',event=>{const button=event.target.closest('[data-review-part]');if(!button||coachingOverlay.classList.contains('is-part-switching'))return;const nextPart=Number(button.dataset.reviewPart);if(nextPart===activeCoachingReviewPart)return;coachingOverlay.classList.add('is-part-switching');setTimeout(()=>{renderCoachingReview(activeCoachingReview,nextPart);coachingOverlay.scrollTo({top:0,behavior:'smooth'});requestAnimationFrame(()=>coachingOverlay.classList.remove('is-part-switching'))},350)});
  coachingOverlayClose?.addEventListener('click',closeCoachingOverlay);
  addEventListener('keydown',event=>{if(event.key==='Escape'&&coachingOverlay?.classList.contains('is-open'))closeCoachingOverlay()});

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
  addEventListener('projects-progress',event=>{
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
    const coachingIsOpen=!!coachingOverlay?.classList.contains('is-open')&&!coachingOverlay.classList.contains('is-closing');
    const closeEl=coachingIsOpen?coachingOverlayClose:caseOverlayClose;
    const closeRect=closeEl?.getBoundingClientRect();
    const overlayIsOpen=coachingIsOpen||(!!caseOverlay?.classList.contains('is-open')&&!caseOverlay.classList.contains('is-closing'));
    const overClose=overlayIsOpen && !!closeRect &&
      e.clientX>=closeRect.left && e.clientX<=closeRect.right &&
      e.clientY>=closeRect.top && e.clientY<=closeRect.bottom;
    const closeTarget=overlayIsOpen&&(e.target?.closest?.('.case-overlay-close,#coachingOverlayClose')||overClose)?closeEl:null;
    if(closeTarget){
      const rect=closeTarget.getBoundingClientRect();
      tx=rect.left+rect.width/2;ty=rect.top+rect.height/2;
    }else{tx=e.clientX;ty=e.clientY;}
    if(!raf)raf=requestAnimationFrame(tickCursor);
    cursor.classList.toggle('is-open',!!mask||!!videoTarget);
    cursor.classList.toggle('is-video-target',!!videoTarget);
    cursor.classList.toggle('is-close-target',!!closeTarget);
    caseOverlayClose?.classList.toggle('is-cursor-target',!!closeTarget);
    coachingOverlayClose?.classList.toggle('is-cursor-target',!!closeTarget);
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
