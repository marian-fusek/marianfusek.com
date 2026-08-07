const originalTitle = document.title || "MF";
document.addEventListener("visibilitychange",()=>{document.title=document.hidden?"💭 MF — Still here":originalTitle;});

/* Let the browser own mobile scroll restoration. The previous delayed series
   of scrollTo calls could fire during normal use and looked like a reload. */

const loader=document.getElementById("mfLoader");
const mfMobileRecovery=window.matchMedia("(max-width: 1024px), (pointer: coarse)").matches;
let mfLoaderAlreadySeen=false;
try{mfLoaderAlreadySeen=mfMobileRecovery&&sessionStorage.getItem("mfLoaderSeen")==="1";}catch(_){ }

/* Mobile Safari may discard a graphics-heavy page and reconstruct it later.
   Persisting the position and skipping the intro on that recovery prevents the
   reconstruction from looking like a fresh restart. Only one restore attempt
   is made; there are no delayed scroll loops. */
(function(){
  if(!mfMobileRecovery)return;
  let saveFrame=0;
  const save=()=>{
    saveFrame=0;
    try{sessionStorage.setItem("mfLastScrollY",String(Math.max(0,window.scrollY)));}catch(_){ }
  };
  window.addEventListener("scroll",()=>{if(!saveFrame)saveFrame=requestAnimationFrame(save);},{passive:true});
  window.addEventListener("pagehide",save,{passive:true});
  window.addEventListener("pageshow",()=>{
    if(!mfLoaderAlreadySeen)return;
    let y=0;
    try{y=Number(sessionStorage.getItem("mfLastScrollY")||0);}catch(_){ }
    if(y>8)setTimeout(()=>window.scrollTo({top:y,left:0,behavior:"auto"}),90);
  },{once:true});
})();

function revealMfSiteImmediately(){
  document.body.classList.remove("mf-preload-locked");
  document.body.classList.add("mf-site-entered","mf-loader-revealing","mf-page-revealed","mf-name-revealed");
  loader?.classList.add("done");
}
function startMfSite(){
  if(mfLoaderAlreadySeen){revealMfSiteImmediately();return;}
  document.body.classList.remove("mf-preload-locked");
  document.body.classList.add("mf-site-entered");
  runMfSiteLoader();
}

const mfLoaderBits=loader?{
  progress:loader.querySelector('#mfLoaderProgress'),
  bar:null,
  ascii:null,
  reveal:null
}:null;
let mfSiteLoaderStarted=false;
function runMfSiteLoader(){
  if(!loader||mfSiteLoaderStarted){ if(loader) setTimeout(()=>loader.classList.add('done'),50); return; }
  mfSiteLoaderStarted=true;
  const progressEl=mfLoaderBits?.progress;
  const barEl=mfLoaderBits?.bar;
  const asciiEl=mfLoaderBits?.ascii;
  const syncLoaderNameHeight=()=>{
    loader.style.setProperty('--mf-loader-name-height',`${Math.max(90,window.innerHeight/3-20).toFixed(1)}px`);
  };
  requestAnimationFrame(syncLoaderNameHeight);
  document.fonts?.ready?.then(syncLoaderNameHeight);
  window.addEventListener('resize',syncLoaderNameHeight,{passive:true});
  const withTimeout=(promise,ms=4200)=>Promise.race([Promise.resolve(promise),new Promise(resolve=>setTimeout(resolve,ms))]);
  const resources=[];
  const imgs=[...document.images].filter(img=>{
    if(img.closest('#mfArtOverlay, #mfArtMiniWorld, #mfArtWorld, #mfArtPreview, #mfLoader'))return false;
    if(img.loading==='lazy')return false;
    return Boolean(img.currentSrc||img.getAttribute('src'));
  });
  imgs.forEach(img=>resources.push(withTimeout(new Promise(resolve=>{
    if(img.complete)return resolve();
    const done=()=>resolve();
    img.addEventListener('load',done,{once:true});
    img.addEventListener('error',done,{once:true});
  }))));
  resources.push(withTimeout(document.fonts?.ready||Promise.resolve()));
  resources.push(withTimeout(new Promise(resolve=>{
    if(document.readyState==='complete')return resolve();
    window.addEventListener('load',()=>resolve(),{once:true});
  })));
  let target=1,display=1,raf=0,finished=false,completionRequested=false;
  let settled=0;
  const total=Math.max(1,resources.length);
  const minDelay=450;
  const simulatedDuration=850;
  const startTime=performance.now();
  function paintFrontier(value){
    const ratio=Math.max(0,Math.min(1,value/100));
    if(progressEl){progressEl.textContent=`${String(Math.round(value)).padStart(2,'0')}%`;}
  }
  const render=()=>{
    raf=0;
    const elapsed=performance.now()-startTime;
    const simulatedCap=Math.min(100,1+(elapsed/simulatedDuration)*99);
    const effectiveTarget=Math.min(target,simulatedCap);
    display += (effectiveTarget-display) * (effectiveTarget>=99 ? 0.14 : 0.12);
    if(target===100 && display>99.55) display=100;
    paintFrontier(display);
    if(target===100&&display===100){beginCompletion();return;}
    if(Math.abs(target-display)>.04||effectiveTarget<target)raf=requestAnimationFrame(render);
  };
  const setTarget=v=>{
    target=Math.max(target,Math.min(100,v));
    if(!raf) raf=requestAnimationFrame(render);
  };
  resources.forEach(p=>Promise.resolve(p).then(()=>{ settled++; setTarget(3+(settled/total)*89); }));
  paintFrontier(1);
  const beginCompletion=()=>{
    if(finished)return;
    finished=true;
    setTimeout(()=>{
      loader.classList.add('is-completing');
      document.body.classList.add('mf-loader-revealing','mf-page-revealed');
      try{sessionStorage.setItem("mfLoaderSeen","1");}catch(_){ }
      loader.classList.add('is-revealing');
      setTimeout(()=>document.body.classList.add('mf-name-revealed'),700);
      setTimeout(()=>loader.classList.add('done'),900);
    },260);
  };
  const requestCompletion=()=>{
    if(completionRequested)return;
    completionRequested=true;
    target=100;
    if(!raf)raf=requestAnimationFrame(render);
  };
  Promise.allSettled(resources).then(()=>{
    const elapsed=performance.now()-startTime;
    setTimeout(requestCompletion,Math.max(0,minDelay-elapsed));
  });
  setTimeout(requestCompletion,6500);
}

startMfSite();

(function(){
  /* Native scrolling is deliberate. Scroll-linked sections animate their own
     visual layers, but never intercept the wheel or ease the page behind the
     user's hand. */
  window._mfScroll=function(y){
    window.scrollTo({top:y,left:0,behavior:'smooth'});
  };
})();

document.querySelectorAll('a[href^="#"]').forEach(link=>{link.addEventListener("click",e=>{const id=link.getAttribute("href").slice(1);if(!id){e.preventDefault();window._mfScroll?window._mfScroll(0):window.scrollTo({top:0,behavior:"smooth"});return}const target=document.getElementById(id);if(!target)return;e.preventDefault();const y=target.getBoundingClientRect().top+window.scrollY;if(window._mfScroll)window._mfScroll(y);else window.scrollTo({top:y,behavior:"smooth"});});});

const footerTop=document.getElementById("footerTop");if(footerTop){footerTop.addEventListener("click",e=>{e.preventDefault();window._mfScroll?window._mfScroll(0):window.scrollTo({top:0,behavior:"smooth"});});}

const grid=document.getElementById("mfGrid"),blur=document.getElementById("mfBlur"),footer=document.querySelector(".mf-footer");window.addEventListener("scroll",()=>{const y=window.scrollY,work=document.getElementById("work"),workTop=work?work.offsetTop:0,footerTop=footer?footer.offsetTop:0;if(grid){if(y<workTop-window.innerHeight*.8){grid.classList.remove("is-soft","is-gone")}else if(y<workTop){grid.classList.add("is-soft");grid.classList.remove("is-gone")}else{grid.classList.remove("is-soft");grid.classList.add("is-gone")}}if(blur){const onFooter=y>footerTop-window.innerHeight*.8,onHero=y<50;if(onHero||onFooter){blur.classList.remove("is-on");blur.classList.add("is-off")}else{blur.classList.add("is-on");blur.classList.remove("is-off")}}},{passive:true});

const revealObserver=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting)entry.target.classList.add("visible")})},{threshold:.1});document.querySelectorAll(".mf-reveal").forEach(el=>revealObserver.observe(el));

/* HERO GRID — preserve segmented touch behavior; only shorten the peak pause */
(function(){
  const grid=document.getElementById("mfGrid");
  const hero=document.getElementById("heroSection");
  if(!grid||!hero)return;

  const mobileGrid=window.matchMedia("(max-width: 1024px)").matches;
  const vertical=mobileGrid?[1/3,2/3]:Array.from({length:9},(_,i)=>(i+1)/10);
  const horizontal=[1/3,2/3];
  const SEGMENT=93;
  const HIT=17;
  const HOLD=115;

  function sparkLine(axis,ratio,x,y){
    const segment=document.createElement("span");
    segment.className=`mf-grid-segment is-${axis}`;
    if(axis==="v"){
      segment.style.left=`${ratio*100}%`;
      segment.style.top=`${Math.max(0,Math.min(innerHeight-SEGMENT,y-SEGMENT/2))}px`;
      segment.style.height=SEGMENT+"px";
    }else{
      segment.style.top=`${ratio*100}%`;
      segment.style.left=`${Math.max(0,Math.min(innerWidth-SEGMENT,x-SEGMENT/2))}px`;
      segment.style.width=SEGMENT+"px";
    }
    grid.appendChild(segment);
    requestAnimationFrame(()=>segment.classList.add("is-on"));
    setTimeout(()=>segment.classList.remove("is-on"),HOLD);
    setTimeout(()=>segment.remove(),HOLD+700);
  }

  let previous={x:null,y:null};
  window.addEventListener("pointermove",e=>{
    if(window.scrollY>hero.offsetHeight)return;
    const points=[];
    if(previous.x!==null){
      const distance=Math.hypot(e.clientX-previous.x,e.clientY-previous.y);
      const steps=Math.max(1,Math.ceil(distance/12));
      for(let i=1;i<=steps;i++)points.push({
        x:previous.x+(e.clientX-previous.x)*i/steps,
        y:previous.y+(e.clientY-previous.y)*i/steps
      });
    }else points.push({x:e.clientX,y:e.clientY});
    previous={x:e.clientX,y:e.clientY};

    points.forEach(point=>{
      vertical.forEach(r=>{if(Math.abs(point.x-innerWidth*r)<HIT)sparkLine("v",r,point.x,point.y);});
      horizontal.forEach(r=>{if(Math.abs(point.y-innerHeight*r)<HIT)sparkLine("h",r,point.x,point.y);});
    });
  },{passive:true});
  window.addEventListener("pointerleave",()=>{previous={x:null,y:null};});
})();

const marksWrap=document.querySelector(".mf-intersections");if(marksWrap){for(let i=0;i<8;i++){const mark=document.createElement("div");mark.className="mf-mark "+["dot","dot","dot","star","diamond"][Math.floor(Math.random()*5)];mark.style.left=[10,20,30,40,50,60,70,80,90][Math.floor(Math.random()*9)]+"%";mark.style.top=[33.333,66.666][i%2]+"%";mark.style.animationDelay=(Math.random()*24).toFixed(2)+"s";marksWrap.appendChild(mark)}}

const ascii=Array.from(document.querySelectorAll(".mf-ascii"));let asciiIndex=0;function cycleAscii(){if(!ascii.length)return;ascii.forEach(el=>el.classList.remove("show"));const current=ascii[asciiIndex%ascii.length];current.classList.add("show");asciiIndex++;setTimeout(()=>{current.classList.remove("show");setTimeout(cycleAscii,3000)},1500)}setTimeout(cycleAscii,1200);

const indexExtra=document.getElementById("indexExtra");
if(indexExtra){
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function runIndexLoop(){
    while(true){
      indexExtra.textContent="";
      await wait(1300);
      indexExtra.textContent="X";
      await wait(420);
      indexExtra.textContent="XX";
      await wait(520);
      for(let i=0;i<3;i++){
        indexExtra.style.opacity="0";
        await wait(180);
        indexExtra.style.opacity="1";
        await wait(180);
      }
      await wait(260);
      indexExtra.textContent="";
      await wait(900);
    }
  }
  runIndexLoop();
}


/* SELECTED WORKS — V177 / isolated restrained index scene
   This replaces the old stacked-card runtime completely. New DOM uses its own
   namespace so legacy .mf-strip / stack CSS cannot style it. Native scroll only. */
(function(){
  const section=document.getElementById('work');
  const sourceStack=section?.querySelector('.mf-strips');
  const sources=sourceStack?[...sourceStack.querySelectorAll(':scope > .mf-strip')].slice(0,4):[];
  if(!section||!sourceStack||sources.length<4)return;

  document.documentElement.classList.remove('mf-work-snap-active');
  document.body.classList.remove(
    'mf-selected-works-snap','mf-selected-works-elastic','mf-selected-works-cinematic',
    'mf-selected-works-flow','mf-recent-works-stack','mf-tiktik-works','mf-recent-works-v175'
  );
  document.body.classList.add('mf-recent-works-v177');
  section.classList.remove('mf-selected-works-v2','mf-selected-works-v3','mf-selected-works-v4','mf-selected-works-v5','mf-selected-works-v6','mf-selected-works-v7');

  const fallbackImages={
    '01':'/media/projects/miunae/01-miunae-logo.jpg',
    '02':'/media/projects/goballer/01-goballer-logo.jpg',
    '03':'/media/projects/aims/01-aims-logo.jpg',
    '04':'/media/projects/vault/01-nofakie-1.jpg'
  };
  const slugs={'01':'miunae','02':'goballer','03':'aims','04':'explorations'};
  const inlineBackground=source=>{
    const value=source.querySelector('.mf-strip-img')?.style.backgroundImage||'';
    const match=value.match(/url\(["']?(.*?)["']?\)/i);
    return match?.[1]||'';
  };
  const projects=sources.map((source,index)=>{
    const key=source.dataset.index||String(index+1).padStart(2,'0');
    return {
      key,
      slug:slugs[key],
      title:key==='04'?'Explorations':(source.dataset.title||source.querySelector('.mf-strip-title')?.textContent?.trim()||'Project'),
      meta:source.querySelector('.mf-strip-meta')?.textContent?.trim()||'',
      desc:key==='04'?'Whatever I could find in old Figma files':(source.querySelector('.mf-strip-desc')?.textContent?.trim()||''),
      candidates:[source.dataset.img,fallbackImages[key],inlineBackground(source)].filter(Boolean)
    };
  });

  const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const revealWords=text=>text.split(/(\s+)/).map((token,index)=>{
    if(/^\s+$/.test(token))return '<span class="mf-rw177-reveal-space">&nbsp;</span>';
    return `<span class="mf-rw177-reveal-mask"><span class="mf-rw177-reveal-piece" style="--rw-i:${index}">${esc(token)}</span></span>`;
  }).join('');

  const root=document.createElement('div');
  root.id='mfRecentWorksV177';
  root.className='mf-rw177';
  root.setAttribute('aria-label','Recent Works');
  root.innerHTML=`
    <div class="mf-rw177-sticky">
      <div class="mf-rw177-scene">
        <header class="mf-rw177-heading">
          <h2 aria-label="Recent Works">${revealWords('Recent Works')}</h2>
          <p aria-label="Creative Direction, Brand & Product Design">${revealWords('Creative Direction, Brand & Product Design')}</p>
        </header>
        <div class="mf-rw177-index" role="list"></div>
        <button class="mf-rw177-preview" type="button" aria-label="Open MIUNĀE">
          <span class="mf-rw177-preview-stack"></span>
        </button>
      </div>
    </div>`;

  const sticky=root.querySelector('.mf-rw177-sticky');
  const scene=root.querySelector('.mf-rw177-scene');
  const heading=root.querySelector('.mf-rw177-heading');
  const list=root.querySelector('.mf-rw177-index');
  const preview=root.querySelector('.mf-rw177-preview');
  const previewStack=root.querySelector('.mf-rw177-preview-stack');
  const rows=[];
  const frames=[];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');

  let activeIndex=0;
  projects.forEach((project,index)=>{
    const row=document.createElement('button');
    row.type='button';
    row.className=`mf-rw177-row is-${project.slug}`;
    row.dataset.index=project.key;
    row.dataset.title=project.title;
    row.dataset.img=project.candidates[0]||'';
    row.setAttribute('role','listitem');
    row.setAttribute('aria-label',`Open ${project.title}`);
    row.innerHTML=`
      <span class="mf-rw177-row-title">${esc(project.title)}</span>
      <span class="mf-rw177-row-meta">${esc(project.meta)}</span>
      <span class="mf-rw177-row-desc">${esc(project.desc)}</span>
      <span class="mf-rw177-row-plus" aria-hidden="true">+</span>`;
    list.appendChild(row);
    rows.push(row);

    const frame=document.createElement('span');
    frame.className='mf-rw177-frame';
    frame.dataset.index=project.key;
    const img=document.createElement('img');
    img.alt=`${project.title} selected work`;
    img.draggable=false;
    img.decoding='async';
    img.loading=index===0?'eager':'lazy';
    if(index===0)img.fetchPriority='high';
    let candidateIndex=0;
    const load=()=>{
      const src=project.candidates[candidateIndex];
      if(!src)return;
      img.src=src;
      row.dataset.img=src;
      frame.dataset.img=src;
    };
    img.addEventListener('load',()=>{
      frame.classList.add('is-ready');
      if(index===activeIndex)syncPreviewRatio(index);
    });
    img.addEventListener('error',()=>{candidateIndex+=1;if(candidateIndex<project.candidates.length)load();});
    frame.appendChild(img);
    previewStack.appendChild(frame);
    frames.push(frame);
    load();
  });

  sourceStack.hidden=true;
  sourceStack.setAttribute('aria-hidden','true');
  const oldTitle=section.querySelector(':scope > .mf-index-title');
  const oldLabel=section.querySelector(':scope > .mf-stage-label');
  if(oldTitle){oldTitle.hidden=true;oldTitle.setAttribute('aria-hidden','true');}
  if(oldLabel){oldLabel.hidden=true;oldLabel.setAttribute('aria-hidden','true');}
  section.insertBefore(root,sourceStack);

  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
  const smooth=value=>{value=clamp(value);return value*value*(3-2*value);};
  let target=0;
  let visual=0;
  let raf=0;
  let inView=false;
  let headingPlayed=false;

  function syncPreviewRatio(index){
    const img=frames[index]?.querySelector('img');
    if(!img?.naturalWidth||!img?.naturalHeight)return;
    preview.style.setProperty('--rw177-ratio',`${img.naturalWidth} / ${img.naturalHeight}`);
  }

  function playHeadingReveal(){
    if(headingPlayed)return;
    headingPlayed=true;
    heading.classList.add('is-revealed');
    const title=[...heading.querySelectorAll('h2 .mf-rw177-reveal-piece')];
    const sub=[...heading.querySelectorAll('p .mf-rw177-reveal-piece')];
    if(reduced.matches||!window.gsap){
      [...title,...sub].forEach(el=>{el.style.transform='translate3d(0,0,0)';el.style.filter='blur(0px)';});
      return;
    }
    gsap.timeline()
      .to(title,{yPercent:0,filter:'blur(0px)',duration:1.35,stagger:.11,ease:'power3.out',force3D:true})
      .to(sub,{yPercent:0,filter:'blur(0px)',duration:1.2,stagger:.055,ease:'power3.out',force3D:true},'-=.55');
  }

  function setActive(index){
    index=clamp(index,0,projects.length-1);
    if(index===activeIndex && frames[index]?.classList.contains('is-active'))return;
    activeIndex=index;
    rows.forEach((row,i)=>row.classList.toggle('is-active',i===index));
    frames.forEach((frame,i)=>frame.classList.toggle('is-active',i===index));
    preview.setAttribute('aria-label',`Open ${projects[index].title}`);
    syncPreviewRatio(index);
  }

  rows.forEach((row,index)=>{
    row.addEventListener('click',()=>window.mfOpenProjectByKey?.(projects[index].key,row));
    row.addEventListener('pointerenter',()=>{ if(inView)setActive(index); });
  });
  preview.addEventListener('click',()=>window.mfOpenProjectByKey?.(projects[activeIndex].key,rows[activeIndex]));
  setActive(0);

  function paint(progress){
    /* One clean viewport first. Then the heading reveals and stays pinned. */
    const headingIn=smooth(clamp((progress-.185)/.055));
    if(progress>.18)playHeadingReveal();
    heading.style.opacity=headingIn.toFixed(4);

    /* Menu rows arrive sequentially after the heading animation has space to play. */
    const rowsWindow=clamp((progress-.29)/.15);
    rows.forEach((row,index)=>{
      const local=smooth(clamp(rowsWindow*4-index));
      row.style.setProperty('--rw177-row-in',local.toFixed(4));
    });

    /* The four project states occupy a compact central scroll band. */
    const projectBand=clamp((progress-.435)/.33);
    const state=Math.min(3,Math.floor(projectBand*4));
    setActive(state);
    const previewIn=smooth(clamp((progress-.405)/.065));
    preview.style.setProperty('--rw177-preview-in',previewIn.toFixed(4));

    /* Only after Explorations is established does the complete scene leave. */
    const exit=smooth(clamp((progress-.82)/.11));
    scene.style.opacity=String(1-exit);
    scene.style.transform=`translate3d(0,${(-54*exit).toFixed(2)}px,0)`;
    scene.style.pointerEvents=exit>.75?'none':'auto';
  }

  function tick(){
    raf=0;
    const delta=target-visual;
    visual+=delta*(reduced.matches?1:.095);
    if(Math.abs(delta)<.00006)visual=target;
    paint(visual);
    if(inView&&Math.abs(target-visual)>.00006)raf=requestAnimationFrame(tick);
  }

  function measure(){
    const rect=root.getBoundingClientRect();
    const travel=Math.max(1,root.offsetHeight-innerHeight);
    target=clamp(-rect.top/travel);
    if(!raf)raf=requestAnimationFrame(tick);
  }

  addEventListener('scroll',measure,{passive:true});
  addEventListener('resize',measure,{passive:true});
  new IntersectionObserver(entries=>{
    inView=!!entries[0]?.isIntersecting;
    document.body.classList.toggle('mf-selected-works-active',inView);
    if(inView)measure();
  },{threshold:0}).observe(root);
  measure();
})();


/* GUIDANCE GATEWAY — V162 */
(function(){
  const section=document.getElementById('guidance');
  if(!section)return;
  const oldTitle=section.querySelector('.mf-guidance-title');
  const oldPortals=section.querySelector('.mf-guidance-portals');
  const oldLabel=section.querySelector(':scope > .mf-stage-label');
  [oldTitle,oldPortals,oldLabel].forEach(el=>{if(el){el.hidden=true;el.setAttribute('aria-hidden','true');}});

  const fold=(text)=>Array.from(text).map((char,index)=>char===' '
    ? '<span class="mf-guide-fold-space" aria-hidden="true">&nbsp;</span>'
    : `<span class="mf-guide-fold-segment" aria-hidden="true" style="--fold-i:${index}"><span class="mf-guide-fold-piece">${char}</span></span>`
  ).join('');

  const gateway=document.createElement('div');
  gateway.className='mf-guidance-gateway';
  gateway.innerHTML=`
    <div class="mf-guidance-gateway-stage">
      <button class="mf-guidance-zone mf-guidance-zone-mc" type="button" data-guidance="mindset" aria-label="Open Mindset Coaching">
        <span class="mf-guidance-corner-glow" aria-hidden="true"></span>
        <span class="mf-guidance-gateway-copy">
          <strong aria-label="Mindset Coaching"><span class="mf-guide-sr">Mindset Coaching</span><span class="mf-guide-fold-visual">${fold('Mindset Coaching')}</span></strong>
          <small>One-on-ones with real and direct conversations for founders, leaders and digital creatives.</small>
        </span>
      </button>
      <button class="mf-guidance-zone mf-guidance-zone-tl" type="button" data-guidance="leadership" aria-label="Open Team Leadership">
        <span class="mf-guidance-corner-glow" aria-hidden="true"></span>
        <span class="mf-guidance-gateway-copy">
          <strong aria-label="Team Leadership"><span class="mf-guide-sr">Team Leadership</span><span class="mf-guide-fold-visual">${fold('Team Leadership')}</span></strong>
          <small>Team leadership, people development, and audits for people-first teams.</small>
        </span>
      </button>
      <div class="mf-guidance-open-cursor" aria-hidden="true"><span>OPEN MC</span></div>
    </div>`;
  section.appendChild(gateway);

  const stage=gateway.querySelector('.mf-guidance-gateway-stage');
  const zones=[...gateway.querySelectorAll('.mf-guidance-zone')];
  const cursor=gateway.querySelector('.mf-guidance-open-cursor');
  const pieces=[...gateway.querySelectorAll('.mf-guide-fold-piece')];
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let played=false;

  const play=()=>{
    if(played)return;
    played=true;
    gateway.classList.add('is-played');
    if(reduced.matches||!window.gsap){pieces.forEach(piece=>{piece.style.opacity='1';piece.style.transform='none';piece.style.setProperty('--fold-crease','0');});return;}
    const mc=[...gateway.querySelectorAll('.mf-guidance-zone-mc .mf-guide-fold-piece')];
    const tl=[...gateway.querySelectorAll('.mf-guidance-zone-tl .mf-guide-fold-piece')];
    gsap.timeline()
      .to([mc,tl],{opacity:1,rotateX:0,y:0,'--fold-crease':0,duration:.68,stagger:{each:.038,from:'start'},ease:'power3.out',force3D:true})
      .to(gateway.querySelectorAll('.mf-guidance-gateway-copy small'),{opacity:1,y:0,duration:.6,stagger:.08,ease:'power3.out'},'-=.34');
  };

  const update=()=>{
    const rect=gateway.getBoundingClientRect();
    const travel=Math.max(1,gateway.offsetHeight-innerHeight);
    const p=Math.max(0,Math.min(1,-rect.top/travel));
    if(p>.22)play();
  };
  addEventListener('scroll',update,{passive:true});
  addEventListener('resize',update,{passive:true});
  update();

  zones.forEach(zone=>{
    const isMC=zone.classList.contains('mf-guidance-zone-mc');
    zone.addEventListener('pointerenter',()=>{cursor.querySelector('span').textContent=isMC?'OPEN MC':'OPEN TL';stage.classList.add('is-cursor-active');});
    zone.addEventListener('pointerleave',()=>stage.classList.remove('is-cursor-active'));
    zone.addEventListener('pointermove',event=>{cursor.style.transform=`translate3d(${event.clientX}px,${event.clientY}px,0) translate(-50%,-50%)`;});
  });
})();

/* PROJECT OVERLAYS */
(function(){
  const overlay=document.getElementById("mfOverlay");
  const shell=overlay?.querySelector(".mf-project-shell");
  const gallery=document.getElementById("projectGallery");
  const slides=document.getElementById("projectSlides");
  const closeButton=overlay?.querySelector(".mf-close");
  const controlsHint=document.getElementById("projectControlsHint");
  if(!overlay||!shell||!gallery||!slides||!closeButton)return;

  const goballerCards=[
    "01-0.jpg","01-1.jpg","01-2.jpg",
    "02-0.jpg","02-1.jpg","02-2.jpg","02-3.jpg","02-4.jpg","02-5.jpg","02-6.jpg","02-7.jpg","02-8.jpg",
    "03-0.jpg","03-1.jpg","03-2.jpg",
    "04-0.jpg","04-1.jpg","04-2.jpg","04-3.jpg","04-4.jpg","04-5.jpg",
    "05-0.jpg"
  ].map(name=>`/media/projects/goballer/brand/${name}`);

  const goballerAppCards=[
    {type:"image",src:"/media/projects/goballer/app/04-goballer-ios-1.jpg",title:"GoBaller iOS screen 1"},
    {type:"image",src:"/media/projects/goballer/app/04-goballer-ios-2.jpg",title:"GoBaller iOS screen 2"},
    {type:"image",src:"/media/projects/goballer/app/04-goballer-ios-3.jpg",title:"GoBaller iOS screen 3"},
    {type:"image",src:"/media/projects/goballer/app/04-goballer-ios-4.jpg",title:"GoBaller iOS screen 4"}
  ];

  const projectData={
    "01":{
      title:"MIUNĀE",
      intro:"A natural skincare brand built around time, tactility and restraint. The system turns Eastern European botanical knowledge into a contemporary luxury world without sanding away its character.",
      scope:"Creative direction, brand system, packaging, digital art direction, campaign language and launch expression.",
      context:"MIUNĀE needed to enter a saturated skincare category without resembling another polished wellness brand. Its formulas carried real history, but the story had to feel immediate rather than nostalgic. The work needed enough discipline to feel premium and enough tension to remain alive.",
      approach:"I built the identity around time as both ingredient and attitude. Typography, material choices and imagery were reduced until every element felt deliberate. The resulting system moves between quiet control and botanical overgrowth while staying recognizably MIUNĀE.",
      images:[
        "/media/projects/miunae/01-miunae-logo.jpg",
        {type:"iframe",src:"https://www.miunae.com/",title:"MIUNĀE live website",liveKey:"website"},
        {type:"mediaCarousel",cards:[
          {type:"image",src:"/media/projects/miunae/instagram/01.jpg",title:"MIUNĀE Instagram visual 1"},
          {type:"image",src:"/media/projects/miunae/instagram/02.jpg",title:"MIUNĀE Instagram visual 2"}
        ],title:"MIUNĀE Instagram gallery"},
        "/media/projects/miunae/04-miunae-all.jpg",
        {type:"iframe",src:"https://www.miunae.com/brand-kit",title:"MIUNĀE live brand kit",liveKey:"brandKit"}
      ]
    },
    "02":{
      title:"GoBaller",
      intro:"A football coaching app for players of all ages. The product makes structured training feel clear, motivating and personal without turning the experience into another generic fitness interface.",
      scope:"Brand identity, product strategy, iOS application design, interaction system and visual direction.",
      context:"GoBaller is being built right now from these designs — a training app for young football players, covering workouts, nutrition and the habits that actually move a young athlete forward.",
      approach:"I stayed away from the sterile coaching-app palette — clean blues, dashboard energy, spreadsheet-with-a-logo. Instead I chased something closer to the actual feel of being on the pitch: dark, a bit poppy, energetic without turning into a toy. The world quiets down, and you leave everything on the grass. The logo came out of a creative attack — deconstructing the letterforms, hunting for a visual metaphor, then reshaping it until it held up at full polish. Copy avoids tech stench and cool-guy distance; it talks the way people actually talk to each other.",
      images:[
        {type:"video",src:"/media/projects/goballer/logo/01-goballer-logo.mp4",title:"GoBaller product film"},
        {type:"carousel",background:"/media/projects/goballer/brand/01-goballer-field.jpg",cards:goballerCards,title:"GoBaller brand system"},
        {type:"video",src:"/media/projects/goballer/app-vid/03-goballer-ios-1.mp4",title:"GoBaller iOS application film"},
        {type:"mediaCarousel",cards:goballerAppCards,title:"GoBaller iOS application gallery"}
      ]
    },
    "03":{
      title:"AIMS",
      intro:"The most advanced AI search for music catalogs. AIMS translates complex machine-learning capability into a product story that music professionals can understand, trust and use.",
      scope:"Website, brand refresh, marketing & sales assets.",
      context:"AIMS is an AI search engine for music catalogs — sound, lyrics, video, the whole meaning of a track, searchable in seconds. It serves six very different buyers, from production music companies to broadcasters to music tech startups, and the site had to speak to all of them without turning into a feature dump. Buyers needed to grasp the advantage fast, still trust it could handle catalogs at professional scale, and feel both the engineering precision and the creative intuition behind it.",
      approach:"I built three distinct visual systems to separate what the company is, what it makes, and who it's for — company, products, and use cases each get their own logic. Every section rewards a second look: a color hierarchy that signals what matters where, and an interaction layer that ties it all together smoothly. From that foundation I built out the marketing and sales material — the same system carried straight through.",
      images:[
        {type:"video",src:"/media/projects/aims/logo/01-aims-logo.mp4",title:"AIMS logo animation",note:"[NOT PART OF THE REDESIGN]"},
        {type:"verticalGallery",background:"/media/projects/aims/web/00-aims-bgr.jpg",cards:[
          "/media/projects/aims/web/01-hp.jpg",
          "/media/projects/aims/web/02-products.jpg",
          "/media/projects/aims/web/03-usecases.jpg",
          "/media/projects/aims/web/04-about.jpg",
          "/media/projects/aims/web/05-testimonials.jpg",
          "/media/projects/aims/web/06-blog.jpg",
          "/media/projects/aims/web/07-contact.jpg"
        ],title:"AIMS website"},
        {type:"mediaCarousel",cards:[
          {type:"image",src:"/media/projects/aims/socials/03-aims-socials-1.jpg",title:"AIMS social visual 1"},
          {type:"image",src:"/media/projects/aims/socials/03-aims-socials-2.jpg",title:"AIMS social visual 2"},
          {type:"image",src:"/media/projects/aims/socials/03-aims-socials-3.jpg",title:"AIMS social visual 3"}
        ],title:"AIMS social gallery"},
        "/media/projects/aims/merch/04-aims-merch-1.jpg"
      ]
    },
    "04":{
      title:"Vault 111",
      intro:"Not gonna hide these old-ass random designs just because they're not flashy enough, fully MF on-brand or were never published. Also — I would otherwise have four projects, and I needed one more because I like odd numbers.",
      scope:"Web, iOS, brand stuff",
      context:"Sometimes the night hits and you're like: “How would this layout look?” or “Can I get more minimalistic than clinical minimalism?” or “I WANT TO DESIGN A SKATE BRAND, NOW!” Hmm.",
      approach:"After all these years in agencies, giving it all I had, there was a point when I felt like I couldn't design anymore. What helped bring it back was surrounding myself with people who still wanted to design and build new stuff, with all that unbroken enthusiasm — then reflecting on myself, feeling bad, starting to design again and realizing: “Oh, it's coming back!”",
      images:[
        "/media/projects/vault/01-nofakie-1.jpg",
        "/media/projects/vault/02-nofakie-2.jpg",
        "/media/projects/vault/03-one3.jpg",
        "/media/projects/vault/04-ennui.jpg",
        "/media/projects/vault/05-cultureboard.jpg",
        "/media/projects/vault/06-apod.jpg"
      ]
    },
    "05":{
      title:"Side Quests",
      intro:"Every now and then luck kicks me in the kneecap and I end up stumbling into some quality opportunity. Here are a few that, looking back, give me that nice warm feeling. Mmm.",
      scope:"",
      context:"",
      approach:"",
      compactInfo:true,
      images:[{
        type:"sideQuests",
        title:"Side Quests archive",
        items:[
          {
            title:"Ūndersurface",
            subtitle:"Community co-founder",
            image:"/media/projects/side-quests/undersurface.jpg",
            descriptionHtml:`<p>Co-founded an enclosed community of entrepreneurs, designers and tinkerers. A peer accountability community that ran for 5+ years on Slack, combining structured goal-pushing sessions, sharing circles and talks to help members grow personally and professionally. Beyond the digital space, Joe and I organized an in-person retreat — including a 3-day trip to Estonia — built around deep-sharing, introspective and task-driven exercises designed to get people sharing honestly and working through personal blocks.</p><p>It moved me so much that when I got back, I enrolled in a one-year coaching program to become a certified life coach.</p>`,
            mentions:[
              {name:"Joe Pacal",url:"https://www.pac.al/"}
            ]
          },
          {
            title:"Tomas Bata University",
            subtitle:"Member of Dissertation Committee",
            image:"/media/projects/side-quests/utb.jpg",
            descriptionHtml:`<p>I was twice invited to serve on a panel of industry professionals evaluating final bachelor's and master's thesis presentations on the Visual Arts programme at the university.</p><p>On top of this, while leading a design team, we held full-day design talks for students of the Multimedia &amp; Design subject twice over two years. The sessions continued even after I got promoted out of the Design Team Leadership role.</p><p>I made friends with the faculty lead. Had students applying to STRV years later. Lovely stuff.</p>`,
            mentions:[
              {name:"Tomas Bata University",url:"https://www.utb.cz/en/"}
            ]
          },
          {
            title:"Nollie",
            subtitle:"Creative Studio",
            image:"/media/projects/side-quests/nollie.jpg",
            descriptionHtml:`<p>Co-founded this creative studio with a longtime friend and former colleague, Ales Nesetril, before we each pivoted into our own things — all in good spirit. During this time we launched the NEXT WORKOUT iOS app, which you can check out next.</p><p>Sharing this to also openly admit that not everything I touch always &quot;works out.&quot; Duh! Here, the studio — the app works great! Hehe.</p>`,
            mentions:[
              {name:"Ales Nesetril",url:"https://www.instagram.com/alesnesetril"}
            ]
          },
          {
            title:"NEXT WORKOUT",
            subtitle:"Fitness trainer iOS App",
            image:"/media/projects/side-quests/next-workout.jpg",
            descriptionHtml:`<p>This was a sweet collab between Next.Move (client), Yiskra Creative Studio (brand) — and my former Creative Studio Nollie (Design &amp; Ops w/ Ales Nesetril).</p><p>I sourced and managed developers, tracked the timeline and reported progress to the client side represented by Veronika Huna.</p><p>The app launched and keeps growing. People work out. Life's good.</p>`,
            mentions:[
              {name:"Next.Move",url:"https://www.instagram.com/nextmove.cz/"},
              {name:"Yiskra Creative Studio",url:"https://www.yiskra.studio/"},
              {name:"Ales Nesetril",url:"https://www.instagram.com/alesnesetril"},
              {name:"Veronika Huna",url:"https://www.instagram.com/fitveronika"}
            ]
          }
        ]
      }]
    }
  };

  const projectOrder=Object.keys(projectData);
  const fields={
    index:document.getElementById("projectIndex"),
    title:document.getElementById("projectTitle"),
    intro:document.getElementById("projectIntro"),
    scope:document.getElementById("projectScope"),
    context:document.getElementById("projectContext"),
    approach:document.getElementById("projectApproach"),
    counter:document.getElementById("projectCounter")
  };

  let currentProjectKey="01";
  let activeIndex=0;
  let wheelLocked=false;
  let wheelTotal=0;
  let wheelReset=0;
  let projectSwitching=false;
  let currentCarousel=null;
  let lastOpenedStrip=null;
  let projectMorphing=false;
  const liveStates={website:false,brandKit:false};
  const mobileProjectLayout=window.matchMedia("(max-width: 1024px)");

  const esc=s=>String(s).replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  const projectWeightLinkMarkup=(label,href,className='')=>{
    const chars=[...String(label)];
    const letters=chars.map((char,index)=>`<span style="--i:${index};--r:${chars.length-index-1}">${char===' '?'&nbsp;':esc(char)}</span>`).join('');
    return `<a class="mf-weight-link ${className}" href="${esc(href)}" target="_blank" rel="noopener" aria-label="${esc(label)}">${letters}</a>`;
  };
  const sideQuestMentionsMarkup=mentions=>{
    if(!Array.isArray(mentions)||!mentions.length)return '';
    return `<aside class="mf-sidequest-mentions"><small>Mentions</small><div class="mf-sidequest-mention-list">${mentions.map(mention=>`<div class="mf-sidequest-mention-row"><span class="mf-sidequest-mention-dash" aria-hidden="true">–</span>${projectWeightLinkMarkup(mention.name,mention.url,'mf-sidequest-mention-link')}<i class="mf-sidequest-mention-arrow" aria-hidden="true">↗</i></div>`).join('')}</div></aside>`;
  };

  function liveLabel(key,active){
    if(key==="brandKit"){
      return active
        ? '<span class="mf-live-toggle-label">EXIT THE WEB</span>'
        : '<span class="mf-live-toggle-label">BROWSE <em>[LIVE]</em> MIUNĀE.COM / BRAND-KIT</span>';
    }
    return active
      ? '<span class="mf-live-toggle-label">EXIT THE WEB</span>'
      : '<span class="mf-live-toggle-label">BROWSE <em>[LIVE]</em> MIUNĀE.COM</span>';
  }

  function renderEndCard(key,slideIndex){
    const remaining=projectOrder.filter(other=>other!==key);
    return `<figure class="mf-project-slide mf-project-end-slide" data-slide="${slideIndex}">
      <div class="mf-project-end-card">
        <div class="mf-project-end-list" aria-label="More projects">
          ${remaining.map(other=>`<button class="mf-project-end-link" type="button" data-project-key="${other}">${esc(projectData[other].title)}</button>`).join("")}
        </div>
        <div class="mf-project-end-arrow mf-project-end-arrow-left" aria-hidden="true">→</div>
        <div class="mf-project-end-arrow mf-project-end-arrow-right" aria-hidden="true">→</div>
        <button class="mf-project-exit-button" type="button"><span>Get me outta here!</span><span>[Screaming noises]</span></button>
      </div>
    </figure>`;
  }

  function projectMediaCurtain(){
    return "";
  }

  function projectVideoLoader(copy="LOADING VIDEO"){
    return `<div class="mf-project-video-loader" aria-hidden="true"><div class="mf-project-video-loader-copy"><span>${esc(copy)}<i>_</i></span><b class="mf-project-video-loader-percent">01%</b></div><div class="mf-project-video-loader-bars"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>`;
  }

  function carouselItemMarkup(item,index){
    const normalized=typeof item==="string"?{type:"image",src:item}:item;
    if(normalized?.type==="video"){
      return `<video src="${esc(normalized.src)}" title="${esc(normalized.title||`Carousel video ${index+1}`)}" autoplay muted loop playsinline preload="metadata"></video>`;
    }
    return `<img src="${esc(normalized?.src||"")}" alt="${esc(normalized?.title||`Carousel visual ${index+1}`)}" draggable="false">`;
  }

  function renderMedia(project,media,i){
    if(media&&typeof media==="object"&&media.type==="iframe"){
      const key=media.liveKey||"website";
      const active=!!liveStates[key];
      const loaderCopy=media.loaderCopy||(key==="brandKit"?"LOADING MIUNĀE BRAND KIT":"LOADING MIUNĀE.COM");
      return `<figure class="mf-project-slide mf-project-slide-live" data-slide="${i}" data-live-key="${key}">
        <div class="mf-live-site">
          <div class="mf-live-loader" aria-hidden="true"><div class="mf-live-loader-copy">${loaderCopy}<span>_</span></div><div class="mf-live-loader-bars"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
          <iframe src="${esc(media.src)}" title="${esc(media.title||project.title+' live website')}" loading="eager" allow="fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe>
          <div class="mf-live-shield" aria-hidden="true"></div>
          <button class="mf-live-toggle" type="button" aria-pressed="${active?'true':'false'}">${liveLabel(key,active)}</button>
        </div>
        ${projectMediaCurtain()}
      </figure>`;
    }
    if(media&&typeof media==="object"&&media.type==="sideQuests"){
      const items=Array.isArray(media.items)?media.items:[];
      return `<figure class="mf-project-slide mf-project-slide-sidequests" data-slide="${i}">
        <div class="mf-sidequests-accordion" aria-label="${esc(media.title||'Side Quests')}">
          ${items.map((item,itemIndex)=>`<section class="mf-sidequest-panel${itemIndex===0?' is-active':''}" data-sidequest-index="${itemIndex}">
            <button class="mf-sidequest-trigger" type="button" aria-expanded="${itemIndex===0?'true':'false'}">
              <span class="mf-sidequest-number">${String(itemIndex+1).padStart(2,'0')}</span>
              <span class="mf-sidequest-heading"><span class="mf-sidequest-title">${esc(item.title||'TBD')}</span><span class="mf-sidequest-subtitle">${esc(item.subtitle||'')}</span></span>
              <span class="mf-sidequest-mark" aria-hidden="true">↗</span>
            </button>
            <div class="mf-sidequest-content">
              <div class="mf-sidequest-copy-wrap"><div class="mf-sidequest-copy">${item.descriptionHtml||'<p>TBD</p>'}</div>${sideQuestMentionsMarkup(item.mentions)}</div>
              <figure class="mf-sidequest-image"><img src="${esc(item.image||'')}" alt="${esc(item.title||'Side Quest')}" draggable="false"></figure>
            </div>
          </section>`).join('')}
        </div>
      </figure>`;
    }
    if(media&&typeof media==="object"&&media.type==="verticalGallery"){
      const cards=Array.isArray(media.cards)?media.cards:[];
      const first=cards[0]||"";
      return `<figure class="mf-project-slide mf-project-slide-vertical-gallery" data-slide="${i}">
        <div class="mf-vertical-gallery${cards.length<2?' is-single':''}" aria-label="${esc(media.title||'Vertical project gallery')}">
          <img class="mf-vertical-gallery-background" src="${esc(media.background||'')}" alt="" draggable="false">
          <div class="mf-vertical-scroll">
            <div class="mf-vertical-scroll-inner"><img class="mf-vertical-gallery-image" src="${esc(first)}" alt="${esc(media.title||project.title+' website')}" draggable="false"></div>
          </div>
          <button class="mf-carousel-zone mf-carousel-zone-left" type="button" aria-label="Previous gallery image"></button>
          <button class="mf-carousel-zone mf-carousel-zone-right" type="button" aria-label="Next gallery image"></button>
          <div class="mf-carousel-cursor" aria-hidden="true"><div class="mf-carousel-cursor-inner"><b>→</b><span># 01</span></div></div>
          <button class="mf-live-toggle mf-vertical-toggle" type="button" aria-pressed="false"><span class="mf-live-toggle-label"><em>[ENABLE]</em> SCROLL FOR THE WHOLE THING!</span></button>
        </div>
      </figure>`;
    }
    if(media&&typeof media==="object"&&media.type==="video"){
      const fallback=media.fallbackSrc?` data-fallback-src="${esc(media.fallbackSrc)}"`:"";
      const note=media.note?`<div class="mf-project-media-note">${esc(media.note)}</div>`:"";
      return `<figure class="mf-project-slide mf-project-slide-image mf-project-slide-video" data-slide="${i}"><div class="mf-project-image-viewport mf-project-video-viewport"><video src="${esc(media.src)}"${fallback} title="${esc(media.title||project.title+' project video')}" autoplay muted loop playsinline preload="metadata" aria-label="${esc(media.title||project.title+' project video')}"></video>${projectVideoLoader()}${note}</div>${projectMediaCurtain()}</figure>`;
    }
    if(media&&typeof media==="object"&&(media.type==="carousel"||media.type==="mediaCarousel")){
      const mixed=media.type==="mediaCarousel";
      const first=media.cards[0];
      const second=media.cards[1]||first;
      return `<figure class="mf-project-slide mf-project-slide-carousel${mixed?' mf-project-slide-media-carousel':''}" data-slide="${i}" data-carousel="true">
        <div class="mf-goballer-carousel${mixed?' mf-goballer-app-carousel mf-carousel-fullframe':''}" aria-label="${esc(media.title||'Project carousel')}">
          ${media.background?`<img class="mf-carousel-background" src="${esc(media.background)}" alt="" draggable="false">`:''}
          <div class="mf-carousel-stage">
            ${mixed?`<div class="mf-carousel-card mf-carousel-media-card mf-carousel-card-current">${carouselItemMarkup(first,0)}</div><div class="mf-carousel-card mf-carousel-media-card mf-carousel-card-next" aria-hidden="true">${carouselItemMarkup(second,1)}</div>`:`<img class="mf-carousel-card mf-carousel-card-current" src="${esc(first)}" alt="GoBaller visual 1" draggable="false"><img class="mf-carousel-card mf-carousel-card-next" src="${esc(second)}" alt="" draggable="false" aria-hidden="true">`}
          </div>
          <div class="mf-carousel-runtime-loader" aria-hidden="true"><div class="mf-carousel-runtime-loader-copy"><span>LOADING VIDEO<i>_</i></span><b class="mf-carousel-runtime-loader-percent">01%</b></div><div class="mf-carousel-runtime-loader-bars"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
          <button class="mf-carousel-zone mf-carousel-zone-left" type="button" aria-label="Previous carousel image"></button>
          <button class="mf-carousel-zone mf-carousel-zone-right" type="button" aria-label="Next carousel image"></button>
          <div class="mf-carousel-cursor" aria-hidden="true"><div class="mf-carousel-cursor-inner"><b>→</b><span># 02</span></div></div>
          <div class="mf-carousel-swipe-hint" aria-hidden="true"><span class="mf-carousel-swipe-arrow">←</span><span class="mf-carousel-swipe-copy"><b class="mf-carousel-swipe-count">01 / ${String(media.cards.length).padStart(2,'0')}</b><em>SWIPE</em></span><span class="mf-carousel-swipe-arrow">→</span></div>
        </div>
        ${projectMediaCurtain()}
      </figure>`;
    }
    return `<figure class="mf-project-slide mf-project-slide-image" data-slide="${i}"><div class="mf-project-image-viewport"><img src="${esc(media)}" alt="${esc(project.title)} project visual ${i+1}" loading="${i===0?'eager':'lazy'}" draggable="false"></div>${projectMediaCurtain()}</figure>`;
  }

  function renderProject(key){
    currentProjectKey=key;
    const project=projectData[key]||projectData["01"];
    shell.classList.toggle('is-sidequests-project',!!project.compactInfo);
    fields.index.textContent=`PROJECT ${key}`;
    fields.title.textContent=project.title;
    fields.intro.textContent=project.intro;
    fields.scope.textContent=project.scope;
    fields.context.textContent=project.context;
    fields.approach.textContent=project.approach;
    slides.innerHTML=project.images.map((media,i)=>renderMedia(project,media,i)).join("")+renderEndCard(key,project.images.length);

    setupLiveSlides();
    setupProjectVideoLoaders();
    setupStaticImageSlides();
    setupCarousels(project);
    setupVerticalGalleries(project);
    setupSideQuests();
    setupEndCard();

    activeIndex=0;
    currentCarousel=null;
    gallery.scrollTop=0;
    overlay.scrollTop=0;
    updateCounter();
    updateActiveExtras();
  }

  function setupSideQuests(){
    const accordion=slides.querySelector('.mf-sidequests-accordion');
    if(!accordion)return;
    const panels=[...accordion.querySelectorAll('.mf-sidequest-panel')];
    const activate=panel=>{
      if(!panel||panel.classList.contains('is-active'))return;
      panels.forEach(item=>{
        const active=item===panel;
        item.classList.toggle('is-active',active);
        item.querySelector('.mf-sidequest-trigger')?.setAttribute('aria-expanded',active?'true':'false');
      });
    };
    panels.forEach(panel=>{
      panel.querySelector('.mf-sidequest-trigger')?.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        activate(panel);
      });
    });
  }

  function setupProjectVideoLoaders(){
    slides.querySelectorAll('.mf-project-slide-video').forEach(slide=>{
      const video=slide.querySelector(':scope .mf-project-video-viewport > video');
      if(!video)return;
      let fallbackUsed=false;
      let done=false;
      let loaderShown=false,progress=1,progressTimer=0;
      const percent=slide.querySelector('.mf-project-video-loader-percent');
      const setProgress=value=>{progress=Math.max(progress,Math.min(100,value));if(percent)percent.textContent=`${String(Math.round(progress)).padStart(2,'0')}%`;};
      const timer=setTimeout(()=>{
        if(done)return;
        loaderShown=true;
        slide.classList.add('is-video-loading');
        setProgress(1);
        progressTimer=setInterval(()=>setProgress(Math.min(92,progress+1+Math.random()*3)),120);
      },1000);
      const finish=()=>{
        if(done)return;
        done=true;
        clearTimeout(timer);
        clearInterval(progressTimer);
        if(loaderShown){setProgress(100);setTimeout(()=>slide.classList.remove('is-video-loading'),180);}
        else slide.classList.remove('is-video-loading');
        slide.classList.add('is-video-ready');
        video.muted=true;
        video.playsInline=true;
        video.play().catch(()=>{});
      };
      const tryFallback=()=>{
        const fallback=video.dataset.fallbackSrc;
        if(fallback&&!fallbackUsed){
          fallbackUsed=true;
          done=false;
          video.src=fallback;
          video.load();
          return;
        }
        finish();
      };
      if(video.readyState>=2)finish();
      else{
        video.addEventListener('loadeddata',finish,{once:true});
        video.addEventListener('canplay',finish,{once:true});
        video.addEventListener('error',tryFallback,{once:true});
        setTimeout(finish,8000);
      }
    });
  }

  function setupProjectMediaReveals(){}
  function revealProjectSlide(){}

  function applyLiveState(slide,active){
    const key=slide.dataset.liveKey||"website";
    const frame=slide.querySelector("iframe");
    const toggle=slide.querySelector(".mf-live-toggle");
    liveStates[key]=active;
    slide.classList.toggle("is-browsing",active);
    slide.classList.toggle("is-paused",!active);
    if(frame)frame.style.pointerEvents=active?"auto":"none";
    if(toggle){toggle.setAttribute("aria-pressed",active?"true":"false");toggle.innerHTML=liveLabel(key,active);}
  }

  function setupLiveSlides(){
    slides.querySelectorAll(".mf-project-slide-live").forEach(slide=>{
      const key=slide.dataset.liveKey||"website";
      const frame=slide.querySelector("iframe");
      const toggle=slide.querySelector(".mf-live-toggle");
      if(frame)frame.addEventListener("load",()=>slide.classList.add("is-loaded"),{once:true});
      toggle?.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();applyLiveState(slide,!slide.classList.contains("is-browsing"));});
      applyLiveState(slide,!!liveStates[key]);
    });
  }

  function setupStaticImageSlides(){
    if(!mobileProjectLayout.matches)return;
    slides.querySelectorAll('.mf-project-slide-image .mf-project-image-viewport').forEach(viewport=>{
      const media=viewport.querySelector('img, video');
      if(!media)return;

      /* V49's contain-first state applies only to still images. Videos keep
         their established V48 presentation and interaction unchanged. */
      const isStillImage=media.tagName==='IMG';
      if(isStillImage){
        viewport.classList.add('is-fit');
        viewport.dataset.position='50';
        viewport.style.setProperty('--image-x','50%');
        media.addEventListener('dragstart',event=>event.preventDefault());
        return;
      }else{
        viewport.classList.remove('is-fit');
      }

      media.addEventListener('dragstart',event=>event.preventDefault());
      if(media.tagName==='VIDEO'){
        media.muted=true;
        media.playsInline=true;
        media.play().catch(()=>{});
      }
    });
  }

  function setupCarousels(project){
    slides.querySelectorAll('.mf-project-slide-carousel').forEach(slide=>{
      const media=project.images[Number(slide.dataset.slide)];
      if(!media||!(media.type==="carousel"||media.type==="mediaCarousel"))return;
      const root=slide.querySelector('.mf-goballer-carousel');
      let current=root.querySelector('.mf-carousel-card-current');
      let nextCard=root.querySelector('.mf-carousel-card-next');
      const leftZone=root.querySelector('.mf-carousel-zone-left');
      const rightZone=root.querySelector('.mf-carousel-zone-right');
      const cursor=root.querySelector('.mf-carousel-cursor');
      const cursorInner=cursor.querySelector('.mf-carousel-cursor-inner');
      const arrowEl=cursorInner.querySelector('b');
      const numberEl=cursorInner.querySelector('span');
      const swipeCountEl=root.querySelector('.mf-carousel-swipe-count');
      let index=0,animating=false,isDown=false,startX=0,startY=0,moved=false,panStart=0;
      const cards=media.cards;
      const mixed=media.type==="mediaCarousel";
      const wrap=n=>(n%cards.length+cards.length)%cards.length;
      const label=n=>`# ${String(wrap(n)+1).padStart(2,'0')}`;
      const normalizeItem=item=>typeof item==="string"?{type:"image",src:item}:item;
      const itemAt=n=>normalizeItem(cards[wrap(n)]);
      const syncCurrentMediaType=()=>{
        if(!mixed)return;
        const type=itemAt(index).type==='video'?'video':'image';
        root.classList.toggle('is-current-image',type==='image');
        root.classList.toggle('is-current-video',type==='video');
        if(type==='video'){
          root.classList.remove('is-expanded');
          root.dataset.panX='0';
          root.style.setProperty('--carousel-pan-x','0px');
        }
      };
      syncCurrentMediaType();
      const preloadOne=item=>{
        const normalized=normalizeItem(item);
        if(normalized.type==="video")return;
        const preload=new Image();preload.decoding='async';preload.src=normalized.src;
      };
      const preloadAround=at=>{[at-1,at,at+1].forEach(n=>preloadOne(cards[wrap(n)]));};
      if(mobileProjectLayout.matches)preloadAround(index);
      else cards.forEach(preloadOne);

      function mountCard(card,item,itemIndex,showLoader=false){
        const normalized=normalizeItem(item);
        if(!mixed){
          card.src=normalized.src;
          card.alt=`GoBaller visual ${itemIndex+1}`;
          card._mfReady=card.decode?.().catch(()=>{})||Promise.resolve();
          return card._mfReady;
        }
        card.replaceChildren();
        if(normalized.type==="video"){
          const video=document.createElement('video');
          video.src=normalized.src;
          if(normalized.fallbackSrc)video.dataset.fallbackSrc=normalized.fallbackSrc;
          video.title=normalized.title||`Carousel video ${itemIndex+1}`;
          video.muted=true;video.loop=true;video.playsInline=true;video.preload='auto';
          video.autoplay=true;
          card.appendChild(video);
          card._mfReady=new Promise(resolve=>{
            let finished=false;
            let fallbackUsed=false;
            let loaderShown=false,progress=1,progressTimer=0;
            const percent=root.querySelector('.mf-carousel-runtime-loader-percent');
            const setProgress=value=>{progress=Math.max(progress,Math.min(100,value));if(percent)percent.textContent=`${String(Math.round(progress)).padStart(2,'0')}%`;};
            const loaderTimer=showLoader?setTimeout(()=>{
              if(finished)return;
              loaderShown=true;
              root.classList.add('is-loading-media');
              setProgress(1);
              progressTimer=setInterval(()=>setProgress(Math.min(92,progress+1+Math.random()*3)),120);
            },1000):0;
            const finish=()=>{
              if(finished)return;finished=true;
              if(loaderTimer)clearTimeout(loaderTimer);
              clearInterval(progressTimer);
              if(loaderShown){setProgress(100);setTimeout(()=>root.classList.remove('is-loading-media'),180);}
              else root.classList.remove('is-loading-media');
              video.play().catch(()=>{});
              resolve();
            };
            const fail=()=>{
              const fallback=video.dataset.fallbackSrc;
              if(fallback&&!fallbackUsed){
                fallbackUsed=true;
                video.src=fallback;
                video.load();
                return;
              }
              finish();
            };
            if(video.readyState>=2)finish();
            else{
              video.addEventListener('loadeddata',finish,{once:true});
              video.addEventListener('canplay',finish,{once:true});
              video.addEventListener('error',fail,{once:true});
              setTimeout(finish,8000);
            }
          });
          return card._mfReady;
        }
        const img=document.createElement('img');
        img.src=normalized.src;img.alt=normalized.title||`Carousel visual ${itemIndex+1}`;img.draggable=false;
        if(mixed&&mobileProjectLayout.matches){
          card.style.background='#000';
          img.style.width='100%';
          img.style.height='100%';
          img.style.objectFit='contain';
          img.style.objectPosition='center';
        }
        card.appendChild(img);
        card._mfReady=img.decode?.().catch(()=>{})||Promise.resolve();
        return card._mfReady;
      }

      /* Frame three now begins with video, so initialize it through the same
         delayed-loader path used when a video is reached later in the deck. */
      if(mixed&&itemAt(index).type==='video')mountCard(current,cards[index],index,true);

      function updateCursorLabel(){
        const zone=cursor.dataset.zone||'right';
        arrowEl.textContent=zone==='left'?'←':'→';
        numberEl.textContent=zone==='left'?label(index-1):label(index+1);
        if(swipeCountEl)swipeCountEl.textContent=`${String(index+1).padStart(2,'0')} / ${String(cards.length).padStart(2,'0')}`;
      }

      function emitCursorGhost(direction){
        if(mobileProjectLayout.matches||!cursor.classList.contains('is-visible'))return;
        const ghost=document.createElement('b');
        ghost.className='mf-carousel-cursor-ghost';
        ghost.textContent=arrowEl.textContent;
        cursorInner.appendChild(ghost);
        const drift=direction>0?15:-15;
        ghost.animate([
          {opacity:1,transform:'translate3d(-50%,0,0)'},
          {opacity:0,transform:`translate3d(calc(-50% + ${drift}px),0,0)`}
        ],{duration:420,easing:'cubic-bezier(.16,1,.3,1)',fill:'forwards'}).finished
          .catch(()=>{})
          .then(()=>ghost.remove());
      }

      function prepareIncoming(target){
        nextCard.style.opacity='0';
        nextCard.style.transform='translate3d(0,0,0) scale(.96)';
        nextCard.style.filter='none';
        return mountCard(nextCard,cards[target],target,mixed&&itemAt(target).type==="video");
      }

      async function move(direction,fromGesture=false){
        if(animating)return;
        animating=true;
        root.classList.remove('is-expanded','is-dragging');
        root.dataset.panX='0';
        root.style.setProperty('--carousel-pan-x','0px');
        const target=wrap(index+direction);
        emitCursorGhost(direction);
        const oldCurrent=current;
        const incoming=nextCard;
        oldCurrent.getAnimations().forEach(animation=>animation.cancel());
        incoming.getAnimations().forEach(animation=>animation.cancel());

        const enterFrom=direction>0?30:-30;
        const exitTo=direction>0?-30:30;
        const ready=fromGesture
          ? (incoming._mfReady||incoming.decode?.().catch(()=>{})||Promise.resolve())
          : prepareIncoming(target);
        const outgoingFromTransform=fromGesture&&oldCurrent.style.transform
          ? oldCurrent.style.transform
          : 'translate3d(0,0,0) scale(1)';
        const outgoingFromOpacity=fromGesture&&oldCurrent.style.opacity
          ? Number(oldCurrent.style.opacity)
          : 1;
        const incomingFromTransform=fromGesture&&incoming.style.transform
          ? incoming.style.transform
          : `translate3d(${enterFrom}px,0,0) scale(.955)`;
        const incomingFromOpacity=fromGesture&&incoming.style.opacity
          ? Number(incoming.style.opacity)
          : 0;

        /* The current card reacts immediately and only drifts symbolically.
           The replacement enters from the matching side after it is decoded.
           Swapping the two DOM buffers prevents the old source from flashing
           back while the browser decodes the next image. */
        const outgoing=oldCurrent.animate([
          {transform:outgoingFromTransform,opacity:outgoingFromOpacity},
          {transform:`translate3d(${exitTo}px,0,0) scale(.955)`,opacity:0}
        ],{
          duration:620,
          easing:'cubic-bezier(.32,.72,0,1)',
          fill:'forwards'
        });

        await ready;
        const incomingAnimation=incoming.animate([
          {transform:incomingFromTransform,opacity:incomingFromOpacity},
          {transform:'translate3d(0,0,0) scale(1)',opacity:1}
        ],{
          duration:820,
          easing:'cubic-bezier(.16,1,.3,1)',
          fill:'forwards'
        });

        await Promise.allSettled([outgoing.finished,incomingAnimation.finished]);
        index=target;
        syncCurrentMediaType();

        oldCurrent.classList.remove('mf-carousel-card-current');
        oldCurrent.classList.add('mf-carousel-card-next');
        incoming.classList.remove('mf-carousel-card-next');
        incoming.classList.add('mf-carousel-card-current');

        current=incoming;
        nextCard=oldCurrent;
        current.getAnimations().forEach(animation=>animation.cancel());
        nextCard.getAnimations().forEach(animation=>animation.cancel());
        current.removeAttribute('style');
        nextCard.removeAttribute('style');
        mountCard(nextCard,cards[wrap(index+direction)],wrap(index+direction),false);

        updateCursorLabel();
        if(mobileProjectLayout.matches)preloadAround(index);
        animating=false;
      }

      updateCursorLabel();
      const api={root,slide,move,get index(){return index;}};
      root._mfCarousel=api;
      leftZone.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();move(-1);});
      rightZone.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();move(1);});
      root.addEventListener('pointermove',event=>{
        if(mobileProjectLayout.matches)return;
        const r=root.getBoundingClientRect();
        cursor.dataset.zone=event.clientX-r.left<r.width*.5?'left':'right';
        updateCursorLabel();
        cursor.style.transform=`translate3d(${event.clientX-r.left}px,${event.clientY-r.top}px,0)`;
        cursor.classList.add('is-visible');
      });
      root.addEventListener('pointerleave',()=>cursor.classList.remove('is-visible'));

      if(mobileProjectLayout.matches){
        root.style.setProperty('--carousel-pan-x','0px');
        let swipeDirection=0,swipeTarget=-1;
        const clearSwipePreview=()=>{
          root.classList.remove('is-dragging');
          current.style.transform='';
          current.style.opacity='';
          nextCard.style.transform='';
          nextCard.style.opacity='';
          nextCard.style.pointerEvents='';
          swipeDirection=0;
          swipeTarget=-1;
        };
        let touchLock=null,touchX=0,touchY=0;
        root.addEventListener('touchstart',event=>{
          const touch=event.touches[0];
          if(!touch)return;
          touchX=touch.clientX;touchY=touch.clientY;touchLock=null;
        },{passive:true});
        root.addEventListener('touchmove',event=>{
          const touch=event.touches[0];
          if(!touch)return;
          const dx=touch.clientX-touchX,dy=touch.clientY-touchY;
          if(!touchLock&&Math.max(Math.abs(dx),Math.abs(dy))>7){
            touchLock=Math.abs(dx)>Math.abs(dy)*1.05?'x':'y';
          }
          if(touchLock==='x')event.preventDefault();
        },{passive:false});
        root.addEventListener('touchend',()=>{touchLock=null;},{passive:true});
        root.addEventListener('touchcancel',()=>{touchLock=null;},{passive:true});

        root.addEventListener('pointerdown',event=>{
          if(animating)return;
          isDown=true;moved=false;startX=event.clientX;startY=event.clientY;
          panStart=Number(root.dataset.panX||0);
          root.setPointerCapture?.(event.pointerId);
        });
        root.addEventListener('pointermove',event=>{
          if(!isDown||animating)return;
          const dx=event.clientX-startX,dy=event.clientY-startY;
          if(Math.abs(dx)+Math.abs(dy)>10)moved=true;
          if(Math.abs(dx)<=Math.abs(dy)+5)return;
          event.preventDefault();
          const direction=dx<0?1:-1;
          const target=wrap(index+direction);
          if(direction!==swipeDirection||target!==swipeTarget){
            swipeDirection=direction;swipeTarget=target;
            mountCard(nextCard,cards[target],target,mixed&&itemAt(target).type==="video");
          }
          const width=Math.max(1,root.clientWidth);
          const progress=Math.min(1,Math.abs(dx)/(width*.72));
          const restrained=dx*.62;
          const incomingStart=(direction>0?1:-1)*Math.min(width*.32,120);
          root.classList.add('is-dragging');
          current.style.transform=`translate3d(${restrained}px,0,0) scale(${1-progress*.035})`;
          current.style.opacity=String(1-progress*.58);
          nextCard.style.opacity=String(progress);
          nextCard.style.transform=`translate3d(${incomingStart*(1-progress)}px,0,0) scale(${.965+progress*.035})`;
          nextCard.style.pointerEvents='none';
        },{passive:false});
        const endPointer=event=>{
          if(!isDown)return;
          isDown=false;
          const dx=event.clientX-startX,dy=event.clientY-startY;
          try{root.releasePointerCapture?.(event.pointerId);}catch(_){ }
          const shouldMove=Math.abs(dx)>44&&Math.abs(dx)>Math.abs(dy)+8;
          if(shouldMove){
            root.classList.remove('is-dragging');
            swipeDirection=0;swipeTarget=-1;
            move(dx<0?1:-1,true);
          }else clearSwipePreview();
        };
        root.addEventListener('pointerup',endPointer);
        root.addEventListener('pointercancel',()=>{isDown=false;clearSwipePreview();});
      }
    });
  }

  function setupVerticalGalleries(project){
    slides.querySelectorAll('.mf-project-slide-vertical-gallery').forEach(slide=>{
      const media=project.images[Number(slide.dataset.slide)];
      if(!media||media.type!=="verticalGallery")return;
      const root=slide.querySelector('.mf-vertical-gallery');
      const scroller=root?.querySelector('.mf-vertical-scroll');
      const image=root?.querySelector('.mf-vertical-gallery-image');
      const toggle=root?.querySelector('.mf-vertical-toggle');
      const leftZone=root?.querySelector('.mf-carousel-zone-left');
      const rightZone=root?.querySelector('.mf-carousel-zone-right');
      const cursor=root?.querySelector('.mf-carousel-cursor');
      const arrow=cursor?.querySelector('b');
      const number=cursor?.querySelector('span');
      const cards=Array.isArray(media.cards)?media.cards:[];
      if(!root||!scroller||!image||!toggle||!cards.length)return;
      let index=0,enabled=false,moving=false,startX=0,startY=0;
      const wrap=n=>(n%cards.length+cards.length)%cards.length;
      const label=n=>`# ${String(wrap(n)+1).padStart(2,'0')}`;
      const setEnabled=value=>{
        enabled=value;
        root.classList.toggle('is-scroll-enabled',enabled);
        toggle.setAttribute('aria-pressed',enabled?'true':'false');
        toggle.innerHTML=enabled
          ? '<span class="mf-live-toggle-label">EXIT THE SCROLL</span>'
          : '<span class="mf-live-toggle-label"><em>[ENABLE]</em> SCROLL FOR THE WHOLE THING!</span>';
      };
      const updateCursor=zone=>{
        if(!arrow||!number)return;
        arrow.textContent=zone==='left'?'←':'→';
        number.textContent=zone==='left'?label(index-1):label(index+1);
      };
      const move=async direction=>{
        if(moving||cards.length<2)return;
        moving=true;
        const target=wrap(index+direction);
        const exit=direction>0?-24:24;
        const enter=direction>0?24:-24;
        image.getAnimations().forEach(animation=>animation.cancel());
        try{
          const outgoing=image.animate([
            {opacity:1,transform:'translate3d(0,0,0)'},
            {opacity:0,transform:`translate3d(${exit}px,0,0)`}
          ],{duration:320,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
          await outgoing.finished.catch(()=>{});
          outgoing.cancel();

          image.style.opacity='0';
          image.style.transform=`translate3d(${enter}px,0,0)`;
          image.src=cards[target];
          await (image.decode?.().catch(()=>{})||Promise.resolve());
          scroller.scrollTop=0;

          const incoming=image.animate([
            {opacity:0,transform:`translate3d(${enter}px,0,0)`},
            {opacity:1,transform:'translate3d(0,0,0)'}
          ],{duration:560,easing:'cubic-bezier(.16,1,.3,1)',fill:'forwards'});
          await incoming.finished.catch(()=>{});
          incoming.cancel();
          image.style.opacity='1';
          image.style.transform='translate3d(0,0,0)';
          index=target;
          updateCursor(cursor?.dataset.zone||'right');
        }finally{
          image.getAnimations().forEach(animation=>animation.cancel());
          image.style.opacity='1';
          image.style.transform='translate3d(0,0,0)';
          moving=false;
        }
      };
      toggle.addEventListener('click',event=>{
        event.preventDefault();event.stopPropagation();setEnabled(!enabled);
      });
      leftZone?.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(!enabled)move(-1);});
      rightZone?.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(!enabled)move(1);});
      root.addEventListener('pointermove',event=>{
        if(mobileProjectLayout.matches||enabled||cards.length<2||!cursor)return;
        const rect=root.getBoundingClientRect();
        const zone=event.clientX-rect.left<rect.width/2?'left':'right';
        cursor.dataset.zone=zone;updateCursor(zone);
        cursor.style.transform=`translate3d(${event.clientX-rect.left}px,${event.clientY-rect.top}px,0)`;
        cursor.classList.add('is-visible');
      });
      root.addEventListener('pointerleave',()=>cursor?.classList.remove('is-visible'));
      root.addEventListener('touchstart',event=>{
        if(enabled||cards.length<2)return;
        const touch=event.touches[0];if(!touch)return;startX=touch.clientX;startY=touch.clientY;
      },{passive:true});
      root.addEventListener('touchend',event=>{
        if(enabled||cards.length<2)return;
        const touch=event.changedTouches[0];if(!touch)return;
        const dx=touch.clientX-startX,dy=touch.clientY-startY;
        if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)+8)move(dx<0?1:-1);
      },{passive:true});
      scroller.addEventListener('wheel',event=>{
        if(!enabled)return;
        event.stopPropagation();
      },{passive:true});
      setEnabled(false);
      updateCursor('right');
      const api={root,slide,move,get index(){return index;}};
      root._mfCarousel=cards.length>1?api:null;
    });
  }

  function setupEndCard(){
    const endCard=slides.querySelector('.mf-project-end-card');
    if(!endCard)return;
    const arrows=[...endCard.querySelectorAll('.mf-project-end-arrow')];
    let targetX=0,currentX=0,targetY=0,currentY=0,arrowFrame=0,hovering=false;

    function animateArrows(){
      currentX+=(targetX-currentX)*.16;
      currentY+=(targetY-currentY)*.18;
      arrows.forEach(arrow=>{
        arrow.style.setProperty('--arrow-shift-x',`${currentX.toFixed(2)}px`);
        arrow.style.setProperty('--arrow-shift-y',`${currentY.toFixed(2)}px`);
      });
      if(hovering||Math.abs(targetX-currentX)>.05||Math.abs(targetY-currentY)>.05){
        arrowFrame=requestAnimationFrame(animateArrows);
      }else arrowFrame=0;
    }
    function queueArrows(){if(!arrowFrame)arrowFrame=requestAnimationFrame(animateArrows);}

    endCard.querySelectorAll('.mf-project-end-link').forEach(link=>{
      const labelText=link.textContent.trim();
      link.textContent='';
      const chars=[];
      labelText.split(' ').forEach((word,wordIndex)=>{
        const wordSpan=document.createElement('span');
        wordSpan.className='mf-project-end-word';
        [...word].forEach(character=>{
          const char=document.createElement('span');
          char.className='mf-project-end-char';
          char.textContent=character;
          wordSpan.appendChild(char);chars.push(char);
        });
        link.appendChild(wordSpan);
        if(wordIndex<labelText.split(' ').length-1)link.appendChild(document.createTextNode(' '));
      });
      let textFrame=0,px=-9999,py=-9999,inside=false;
      const renderText=()=>{
        textFrame=0;
        const radius=135;
        chars.forEach(char=>{
          const rect=char.getBoundingClientRect();
          const n=inside?Math.max(0,1-Math.hypot(px-rect.left-rect.width/2,py-rect.top-rect.height/2)/radius):0;
          const weight=400+450*n;
          char.style.fontVariationSettings=`'wght' ${weight.toFixed(0)}, 'opsz' ${(9+31*n).toFixed(1)}`;
          char.style.fontWeight=String(Math.round(weight));
          char.style.opacity=String(.5+.5*n);
        });
      };
      const queueText=()=>{if(!textFrame)textFrame=requestAnimationFrame(renderText);};

      link.addEventListener('click',()=>switchProject(link.dataset.projectKey));
      link.addEventListener('pointerenter',event=>{
        if(mobileProjectLayout.matches)return;
        inside=true;px=event.clientX;py=event.clientY;queueText();
        const cardRect=endCard.getBoundingClientRect(),linkRect=link.getBoundingClientRect();
        endCard.style.setProperty('--end-arrow-y',`${linkRect.top-cardRect.top+linkRect.height/2}px`);
        endCard.classList.add('is-project-hovered');
        hovering=true;targetX=0;targetY=0;queueArrows();
      });
      link.addEventListener('pointermove',event=>{
        if(mobileProjectLayout.matches)return;
        px=event.clientX;py=event.clientY;queueText();
        const r=link.getBoundingClientRect();
        targetX=(event.clientX-r.left-r.width/2)*.055;
        targetY=(event.clientY-r.top-r.height/2)*.10;
        queueArrows();
      });
      link.addEventListener('pointerleave',()=>{
        inside=false;queueText();
        endCard.classList.remove('is-project-hovered');
        hovering=false;targetX=0;targetY=0;queueArrows();
      });
    });
    endCard.querySelector('.mf-project-exit-button')?.addEventListener('click',()=>closeProject());
  }

  function updateCounter(){
    const total=slides.children.length||1;
    fields.counter.textContent=`${String(activeIndex+1).padStart(2,"0")} / ${String(total).padStart(2,"0")}`;
  }

  function updateActiveExtras(){
    const activeSlide=slides.children[activeIndex];
    currentCarousel=(activeSlide?.querySelector('.mf-goballer-carousel, .mf-vertical-gallery'))?._mfCarousel||null;
    if(controlsHint){
      controlsHint.innerHTML=currentCarousel?'↑ ↓ ← → [ESC]&nbsp;&nbsp;–&nbsp;&nbsp;And telekinesis':'↑ ↓ [ESC]&nbsp;&nbsp;–&nbsp;&nbsp;And your free will';
      controlsHint.classList.toggle('is-carousel',!!currentCarousel);
    }
  }

  const getProjectStrip=key=>document.querySelector(`.mf-rw177-row[data-index="${key}"]`)||document.querySelector(`.mf-work-flow-chapter.mf-strip[data-index="${key}"]`)||document.querySelector(`.mf-strip[data-index="${key}"]`);
  const getProjectImage=(strip,key)=>strip?.querySelector('.mf-work-flow-image')?.currentSrc||strip?.querySelector('.mf-work-flow-image')?.src||strip?.querySelector('.mf-work-image')?.currentSrc||strip?.querySelector('.mf-work-image')?.src||strip?.dataset.img||{
    '01':'/media/projects/miunae/01-miunae-logo.jpg',
    '02':'/media/projects/goballer/01-goballer-logo.jpg',
    '03':'/media/projects/aims/01-aims-logo.jpg',
    '04':'/media/projects/vault/01-nofakie-1.jpg',
    '05':'/media/projects/side-quests/undersurface.jpg'
  }[key]||'';
  const windowRect=()=>({left:0,top:0,width:window.innerWidth,height:window.innerHeight,radius:0});
  const boxOf=(element,fallback)=>{
    if(!element)return fallback;
    const rect=element.getBoundingClientRect();
    const radius=parseFloat(getComputedStyle(element).borderTopLeftRadius)||0;
    return {left:rect.left,top:rect.top,width:rect.width,height:rect.height,radius};
  };
  const sourceGeometry=(strip)=>{
    const stageNode=strip?.closest('.mf-work-flow-chapter')||strip;
    const imageNode=strip?.querySelector('.mf-work-flow-image-wrap')||strip;
    const titleNode=strip?.querySelector('.mf-work-flow-copy h2')||strip?.querySelector('.mf-strip-title');
    const stageBox=boxOf(stageNode,{left:0,top:0,width:window.innerWidth,height:window.innerHeight,radius:0});
    return {
      frame:stageBox,
      image:boxOf(imageNode,stageBox),
      title:boxOf(titleNode,{left:stageBox.left+32,top:stageBox.top+32,width:stageBox.width*.4,height:120,radius:0}),
      titleSize:parseFloat(titleNode?getComputedStyle(titleNode).fontSize:'80')||80
    };
  };
  const overlayGeometry=()=>{
    const frame=windowRect();
    const media=slides.querySelector('.mf-project-slide:first-child .mf-project-image-viewport, .mf-project-slide:first-child .mf-carousel-zone, .mf-project-slide:first-child .mf-vertical-gallery, .mf-project-slide:first-child video, .mf-project-slide:first-child img')||gallery;
    const titleNode=fields.title;
    return {
      frame,
      image:boxOf(media,{left:Math.max(280,window.innerWidth*.24)+frame.left,top:frame.top,width:frame.width-Math.max(280,window.innerWidth*.24),height:frame.height,radius:0}),
      title:boxOf(titleNode,{left:frame.left+24,top:frame.top+72,width:Math.max(240,window.innerWidth*.2),height:72,radius:0}),
      titleSize:parseFloat(titleNode?getComputedStyle(titleNode).fontSize:'48')||48
    };
  };
  const setBox=(element,box)=>{
    element.style.left=`${box.left}px`;
    element.style.top=`${box.top}px`;
    element.style.width=`${box.width}px`;
    element.style.height=`${box.height}px`;
    element.style.borderRadius=`${box.radius||0}px`;
  };
  const createProjectMorph=(strip,key,geometry)=>{
    const src=getProjectImage(strip,key);
    const root=document.createElement('div');
    root.className='mf-project-morph';
    root.innerHTML='<div class="mf-project-morph-frame"></div>';
    setBox(root,geometry.frame);

    const image=document.createElement('div');
    image.className='mf-project-morph-image';
    setBox(image,geometry.image);
    const img=document.createElement('img');
    img.alt='';img.src=src;
    img.onerror=()=>{img.onerror=null;img.src=src.startsWith('/')?'.'+src:src;};
    image.appendChild(img);

    const title=document.createElement('div');
    title.className='mf-project-morph-title';
    title.textContent=projectData[key]?.title||'';
    title.style.left=`${geometry.title.left}px`;
    title.style.top=`${geometry.title.top}px`;
    title.style.fontSize=`${geometry.titleSize}px`;

    document.body.append(root,image,title);
    return {root,image,title};
  };
  const animateMorph=(bundle,from,to,duration=900,{closing=false}={})=>{
    const easing='cubic-bezier(.16,1,.3,1)';
    setBox(bundle.root,from.frame);setBox(bundle.image,from.image);
    bundle.title.style.left=`${from.title.left}px`;
    bundle.title.style.top=`${from.title.top}px`;
    bundle.title.style.fontSize=`${from.titleSize}px`;
    const rootAnimation=bundle.root.animate([
      {left:`${from.frame.left}px`,top:`${from.frame.top}px`,width:`${from.frame.width}px`,height:`${from.frame.height}px`,borderRadius:`${from.frame.radius||0}px`,opacity:1},
      {left:`${to.frame.left}px`,top:`${to.frame.top}px`,width:`${to.frame.width}px`,height:`${to.frame.height}px`,borderRadius:`${to.frame.radius||0}px`,opacity:1}
    ],{duration,easing,fill:'forwards'});
    const imageAnimation=bundle.image.animate([
      {left:`${from.image.left}px`,top:`${from.image.top}px`,width:`${from.image.width}px`,height:`${from.image.height}px`,borderRadius:`${from.image.radius||0}px`,filter:closing?'none':'grayscale(1)'},
      {left:`${to.image.left}px`,top:`${to.image.top}px`,width:`${to.image.width}px`,height:`${to.image.height}px`,borderRadius:`${to.image.radius||0}px`,filter:closing?'grayscale(1)':'none'}
    ],{duration,easing,fill:'forwards'});
    const titleAnimation=bundle.title.animate([
      {left:`${from.title.left}px`,top:`${from.title.top}px`,fontSize:`${from.titleSize}px`,opacity:1},
      {left:`${to.title.left}px`,top:`${to.title.top}px`,fontSize:`${to.titleSize}px`,opacity:1}
    ],{duration,easing,fill:'forwards'});
    return Promise.all([rootAnimation.finished,imageAnimation.finished,titleAnimation.finished].map(promise=>promise.catch(()=>{})));
  };
  const removeMorph=bundle=>{
    if(!bundle)return;
    bundle.root?.remove();bundle.image?.remove();bundle.title?.remove();
  };
  const settleProjectOpen=(bundle)=>{
    lastOpenedStrip?.classList.remove('is-morph-source-hidden');
    overlay.classList.remove('is-morph-opening');
    overlay.classList.add('is-visible');
    [bundle?.root,bundle?.image,bundle?.title].forEach(node=>node?.classList.add('is-handing-off'));
    setTimeout(()=>removeMorph(bundle),260);
    projectMorphing=false;
    document.body.classList.remove('project-morphing');
    setTimeout(()=>gallery.focus({preventScroll:true}),150);
  };

  function openProject(stripOrKey){
    const key=typeof stripOrKey==='string'?stripOrKey:(stripOrKey?.dataset.index||'01');
    lastOpenedStrip=typeof stripOrKey==='string'?getProjectStrip(key):stripOrKey;
    Object.keys(liveStates).forEach(liveKey=>{liveStates[liveKey]=false;});
    renderProject(key);
    overlay.classList.remove('is-closing','is-morph-opening','is-morph-closing');
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden','false');
    document.body.classList.add('project-open');
    overlay.scrollTop=0;
    requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.add('is-visible')));
    setTimeout(()=>gallery.focus({preventScroll:true}),520);
  }

  function openProjectFromStrip(strip){
    if(projectMorphing||!strip)return;
    lastOpenedStrip=strip;
    openProject(strip);
  }

  function switchProject(nextKey){
    if(projectSwitching||nextKey===currentProjectKey||!projectData[nextKey])return;
    lastOpenedStrip=getProjectStrip(nextKey)||lastOpenedStrip;
    window.mfSelectedWorksScrollToKey?.(nextKey,'auto');
    projectSwitching=true;
    shell.classList.add('is-switching-out');
    setTimeout(()=>{
      Object.keys(liveStates).forEach(liveKey=>{liveStates[liveKey]=false;});
      renderProject(nextKey);
      shell.classList.remove('is-switching-out');
      shell.classList.add('is-switching-in');
      void shell.offsetWidth;
      requestAnimationFrame(()=>requestAnimationFrame(()=>shell.classList.remove('is-switching-in')));
      setTimeout(()=>{projectSwitching=false;},760);
    },520);
  }

  function finishProjectClose(afterClose){
    overlay.classList.remove('active','is-closing','is-morph-opening','is-morph-closing','is-visible');
    overlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('project-open','project-morphing');
    lastOpenedStrip?.classList.remove('is-morph-source-hidden');
    slides.innerHTML='';
    currentCarousel=null;
    projectMorphing=false;
    if(typeof afterClose==='function')afterClose();
  }

  function closeProject(afterClose){
    if(!overlay.classList.contains('active')||projectMorphing)return;
    const strip=lastOpenedStrip||getProjectStrip(currentProjectKey);
    const canMorph=false;
    if(!canMorph){
      overlay.classList.add('is-closing');
      overlay.classList.remove('is-visible');
      setTimeout(()=>finishProjectClose(afterClose),620);
      return;
    }
    projectMorphing=true;
    const from=overlayGeometry();
    const to=sourceGeometry(strip);
    const bundle=createProjectMorph(strip,currentProjectKey,from);
    strip.classList.add('is-morph-source-hidden');
    overlay.classList.add('is-morph-closing');
    document.body.classList.add('project-morphing');
    requestAnimationFrame(()=>{
      overlay.classList.remove('is-visible');
      setTimeout(()=>strip.classList.remove('is-morph-source-hidden'),680);
      animateMorph(bundle,from,to,820,{closing:true}).then(()=>{
        removeMorph(bundle);
        finishProjectClose(afterClose);
      });
    });
  }

  function easeInOutCubic(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
  function scrollToSlide(next){
    const total=slides.children.length;
    next=Math.max(0,Math.min(total-1,next));
    if(next===activeIndex||wheelLocked)return;
    if(mobileProjectLayout.matches){
      const targetSlide=slides.children[next];
      if(!targetSlide)return;
      activeIndex=next;updateCounter();updateActiveExtras();
      targetSlide.scrollIntoView({behavior:"smooth",block:"start"});
      return;
    }
    wheelLocked=true;
    const start=gallery.scrollTop,target=next*gallery.clientHeight,delta=target-start,duration=760,began=performance.now();
    function frame(now){
      const t=Math.min(1,(now-began)/duration);
      gallery.scrollTop=start+delta*easeInOutCubic(t);
      if(t<1)requestAnimationFrame(frame);
      else{activeIndex=next;updateCounter();updateActiveExtras();wheelLocked=false;}
    }
    requestAnimationFrame(frame);
  }

  document.querySelectorAll(".mf-strip").forEach(strip=>strip.addEventListener("click",()=>openProjectFromStrip(strip)));
  window.mfOpenProjectByKey=(key,source)=>openProjectFromStrip(source||getProjectStrip(key));
  closeButton.addEventListener("click",()=>closeProject());
  document.addEventListener("keydown",event=>{
    if(!overlay.classList.contains("active"))return;
    if(event.key==="Escape"){closeProject();return;}
    if(currentCarousel&&(event.key==="ArrowLeft"||event.key==="ArrowRight")){
      event.preventDefault();currentCarousel.move(event.key==="ArrowRight"?1:-1);return;
    }
    if(event.key==="ArrowDown"||event.key==="PageDown"){event.preventDefault();scrollToSlide(activeIndex+1);}
    if(event.key==="ArrowUp"||event.key==="PageUp"){event.preventDefault();scrollToSlide(activeIndex-1);}
  });

  gallery.addEventListener("wheel",event=>{
    if(mobileProjectLayout.matches)return;
    if(event.target.closest?.(".mf-project-slide-live.is-browsing iframe"))return;
    if(event.target.closest?.(".mf-vertical-gallery.is-scroll-enabled .mf-vertical-scroll"))return;
    event.preventDefault();
    if(wheelLocked)return;
    wheelTotal+=event.deltaY;
    clearTimeout(wheelReset);wheelReset=setTimeout(()=>wheelTotal=0,140);
    if(Math.abs(wheelTotal)<34)return;
    const direction=wheelTotal>0?1:-1;wheelTotal=0;scrollToSlide(activeIndex+direction);
  },{passive:false});

  let touchStartY=0,touchStartedInInteractive=false;
  gallery.addEventListener("touchstart",event=>{
    if(mobileProjectLayout.matches)return;
    touchStartY=event.touches[0].clientY;
    touchStartedInInteractive=!!event.target.closest?.(".mf-project-slide-live.is-browsing");
  },{passive:true});
  gallery.addEventListener("touchend",event=>{
    if(mobileProjectLayout.matches)return;
    if(touchStartedInInteractive){touchStartedInInteractive=false;return;}
    const delta=touchStartY-event.changedTouches[0].clientY;
    if(Math.abs(delta)>40)scrollToSlide(activeIndex+(delta>0?1:-1));
  },{passive:true});

  let mobileProjectScrollFrame=0;
  overlay.addEventListener("scroll",()=>{
    if(!mobileProjectLayout.matches||!overlay.classList.contains("active"))return;
    if(mobileProjectScrollFrame)return;
    mobileProjectScrollFrame=requestAnimationFrame(()=>{
      mobileProjectScrollFrame=0;
      const viewportMid=overlay.scrollTop+overlay.clientHeight*.55;
      const slideList=[...slides.children];
      let closest=0,distance=Infinity;
      slideList.forEach((slide,index)=>{const mid=slide.offsetTop+slide.offsetHeight/2,nextDistance=Math.abs(mid-viewportMid);if(nextDistance<distance){distance=nextDistance;closest=index;}});
      if(activeIndex!==closest){activeIndex=closest;updateCounter();updateActiveExtras();}
    });
  },{passive:true});

  window._mfOpenProject=openProject;
})();
/* HERO NAME — optical glyph spacing + anchor-preserving fit.
   Every painted gap inside MARIAN and FUSEK is equalized independently of
   the font's side-bearings. The larger word gap remains separate. Desktop
   keeps 30px at the painted M and 40px at the painted K. Animations stay on
   the original character spans and are not changed here. */
let mfHeroFitFrame=0;
function mfHeroMetric(context,glyph){
  const measured=context.measureText(glyph);
  return {
    width:Math.max(0.01,Number(measured.width)||0.01),
    left:Number.isFinite(measured.actualBoundingBoxLeft)?measured.actualBoundingBoxLeft:0,
    right:Number.isFinite(measured.actualBoundingBoxRight)?measured.actualBoundingBoxRight:(Number(measured.width)||0)
  };
}
function mfApplyOpticalHeroSpacing(wrap){
  const children=[...wrap.children];
  if(!children.length)return {firstInset:0,lastInset:0};

  /* Always measure from the untouched CSS typography, never from a previous
     fit, so repeated resizes cannot accumulate spacing errors. */
  wrap.style.letterSpacing='';
  children.forEach(letter=>{
    letter.style.display='';
    letter.style.marginRight='';
    letter.style.width='';
    letter.style.fontSize='';
    letter.style.overflow='';
  });

  const computed=getComputedStyle(wrap);
  const fontSize=parseFloat(computed.fontSize)||300;
  const rawLetterSpacing=parseFloat(computed.letterSpacing);
  const originalLetterSpacing=Number.isFinite(rawLetterSpacing)?rawLetterSpacing:0;
  const canvas=mfApplyOpticalHeroSpacing.canvas||(mfApplyOpticalHeroSpacing.canvas=document.createElement('canvas'));
  const context=canvas.getContext('2d');
  if(!context)return {firstInset:0,lastInset:0};

  context.font=`${computed.fontStyle||'normal'} ${computed.fontWeight||'400'} ${computed.fontSize||'300px'} ${computed.fontFamily||'Geist, Arial, sans-serif'}`;
  if('fontKerning' in context)context.fontKerning='none';

  const entries=children.map(letter=>{
    const isSpace=letter.classList.contains('n-sp');
    if(!letter.dataset.mfOpticalGlyph&&!isSpace)letter.dataset.mfOpticalGlyph=letter.textContent||'';
    const glyph=isSpace?' ':(letter.dataset.mfOpticalGlyph||letter.textContent||'');
    return {letter,isSpace,glyph,metric:mfHeroMetric(context,glyph)};
  });

  /* Derive the common optical gap from the median of the original design's
     visible gaps. This preserves its overall tightness while making it even. */
  const originalGaps=[];
  for(let index=0;index<entries.length-1;index++){
    const current=entries[index],next=entries[index+1];
    if(current.isSpace||next.isSpace)continue;
    originalGaps.push(current.metric.width+originalLetterSpacing-current.metric.right-next.metric.left);
  }
  const sorted=[...originalGaps].sort((a,b)=>a-b);
  let targetGap=sorted.length?sorted[Math.floor(sorted.length/2)]:0;
  targetGap=Math.max(-fontSize*.08,Math.min(fontSize*.05,targetGap));

  wrap.style.letterSpacing='0px';
  const wordGap=Math.max(fontSize*.08,mfHeroMetric(context,' ').width+originalLetterSpacing);

  entries.forEach((entry,index)=>{
    const {letter,isSpace,metric}=entry;
    letter.style.display='inline-block';
    if(isSpace){
      letter.style.width=`${wordGap}px`;
      letter.style.fontSize='0px';
      letter.style.overflow='hidden';
      letter.style.marginRight='0px';
      return;
    }
    const next=entries[index+1];
    if(next&&!next.isSpace){
      const margin=targetGap-metric.width+metric.right+next.metric.left;
      letter.style.marginRight=`${margin}px`;
    }else letter.style.marginRight='0px';
  });

  const visible=entries.filter(entry=>!entry.isSpace);
  const first=visible[0]?.metric;
  const last=visible[visible.length-1]?.metric;
  return {
    firstInset:first?Math.max(0,-first.left):0,
    lastInset:last?Math.max(0,last.width-last.right):0
  };
}
function scaleHeroName(){
  const hero=document.getElementById('heroName');
  const wrap=document.getElementById('nameWrap');
  const info=document.querySelector('.mf-hero-info');
  if(!hero||!wrap)return;

  hero.style.fontSize='300px';
  wrap.style.transform='none';
  wrap.style.transformOrigin='left bottom';

  const opticalBounds=mfApplyOpticalHeroSpacing(wrap);
  const layoutWidth=wrap.getBoundingClientRect().width||wrap.scrollWidth;
  const viewport=window.innerWidth;
  const isMobile=viewport<=1024;
  const leftPad=isMobile?8:30;
  const rightPad=isMobile?8:40;
  const visibleRun=Math.max(1,layoutWidth-opticalBounds.firstInset-opticalBounds.lastInset);
  const scale=Math.max(.01,(viewport-leftPad-rightPad)/visibleRun);
  const offset=leftPad-opticalBounds.firstInset*scale;

  wrap.style.transform=`translateX(${offset}px) scale(${scale})`;
  const lensWrap=document.getElementById('heroNameLensWrap');
  if(lensWrap){
    lensWrap.style.transform=wrap.style.transform;
    lensWrap.style.transformOrigin=wrap.style.transformOrigin;
  }
  window.dispatchEvent(new CustomEvent('mf:hero-fit'));

  if(info&&window.innerWidth>1000){
    const fChar=hero.querySelector('.n-f');
    if(fChar){
      const fRect=fChar.getBoundingClientRect();
      const fComputed=getComputedStyle(fChar);
      const canvas=scaleHeroName.fCanvas||(scaleHeroName.fCanvas=document.createElement('canvas'));
      const context=canvas.getContext('2d');
      let paintedInset=0;

      if(context){
        context.font=`${fComputed.fontStyle||'normal'} ${fComputed.fontWeight||'400'} ${fComputed.fontSize||'300px'} ${fComputed.fontFamily||'Geist, Arial, sans-serif'}`;
        if('fontKerning' in context)context.fontKerning='none';
        const metrics=context.measureText('F');
        const advance=Math.max(1,metrics.width||1);
        const renderedScale=fRect.width/advance;
        const actualLeft=Number.isFinite(metrics.actualBoundingBoxLeft)?metrics.actualBoundingBoxLeft:0;
        paintedInset=Math.max(0,-actualLeft)*renderedScale;
      }

      /* Align the copy to the visible ink of F, not its font box. */
      const textLeft=fRect.left+paintedInset;
      const textRightGap=30;
      info.style.left=textLeft+'px';
      info.style.right='auto';
      info.style.width=Math.max(280,window.innerWidth-textLeft-textRightGap)+'px';
      info.style.maxWidth='none';
      info.style.top='22%';
      info.style.bottom='auto';
    }
  }else if(info){
    info.style.left='';
    info.style.right='';
    info.style.width='';
    info.style.maxWidth='';
    info.style.bottom='';
    info.style.top='';
  }
}
function queueHeroNameFit(){
  cancelAnimationFrame(mfHeroFitFrame);
  mfHeroFitFrame=requestAnimationFrame(scaleHeroName);
}
(function initHeroNameFit(){
  const hero=document.getElementById("heroName");
  if(!hero)return;
  hero.style.visibility="hidden";
  let revealed=false;
  const fitAndReveal=()=>{
    queueHeroNameFit();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(revealed)return;
      revealed=true;
      hero.style.visibility="";
    }));
  };
  if(document.fonts){
    const exact=document.fonts.load?document.fonts.load('400 300px "Geist"',"MARIAN FUSEK"):Promise.resolve();
    Promise.all([document.fonts.ready,exact]).then(fitAndReveal).catch(fitAndReveal);
    setTimeout(fitAndReveal,1800);
  }else setTimeout(fitAndReveal,200);
  window.addEventListener("resize",queueHeroNameFit,{passive:true});
})();

(function(){
  const hero=document.getElementById("heroName");
  const baseWrap=document.getElementById("nameWrap");
  if(!hero||!baseWrap)return;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const ease='cubic-bezier(.16,1,.3,1)';
  const chars=()=>Array.from(baseWrap.querySelectorAll('.nc')).filter(char=>!char.classList.contains('n-sp'));

  async function accent(selector){
    const letter=hero.querySelector(selector);
    if(!letter)return;
    requestAnimationFrame(()=>letter.classList.add('is-accent-visible'));
    await wait(620);
    letter.classList.remove('is-accent-visible');
    await wait(420);
  }
  const accentA=()=>accent('.n-a2');
  const accentU=()=>accent('.n-u');

  async function fadeLetters(list,show,duration){
    const animations=list.map(letter=>letter.animate(
      show
        ?[{opacity:0},{opacity:1}]
        :[{opacity:1},{opacity:0}],
      {duration,easing:ease,fill:'forwards'}
    ));
    await Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));
    animations.forEach(animation=>animation.cancel());
    list.forEach(letter=>letter.style.opacity=show?'':'0');
  }

  async function disappear(){
    const list=['n-a1','n-r','n-i','n-a2','n-n','n-u','n-s','n-e','n-k']
      .map(className=>hero.querySelector('.'+className)).filter(Boolean);
    await fadeLetters(list,false,620);
    await wait(1300);
    list.forEach(letter=>letter.style.opacity='0');
    await fadeLetters(list,true,760);
    list.forEach(letter=>letter.style.opacity='');
    await wait(260);
  }

  async function blurFx(){
    const list=chars();
    const animations=[];
    list.forEach((letter,index)=>{
      const delay=index*46;
      const blurIn=letter.animate(
        [{filter:'blur(0px)'},{filter:'blur(3.2px)'}],
        {duration:230,delay,easing:ease,fill:'forwards'}
      );
      const blurOut=letter.animate(
        [{filter:'blur(3.2px)'},{filter:'blur(0px)'}],
        {duration:430,delay:delay+205,easing:ease,fill:'forwards'}
      );
      animations.push(blurIn,blurOut);
    });
    await Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));
    animations.forEach(animation=>animation.cancel());
    list.forEach(letter=>letter.style.filter='');
    await wait(260);
  }

  const effects=[accentA,accentU,disappear,blurFx];
  let effectIndex=0;
  async function run(){
    while(!document.body.classList.contains('mf-page-revealed'))await wait(100);
    await wait(2500);
    while(true){
      await effects[effectIndex]();
      effectIndex=(effectIndex+1)%effects.length;
      await wait(2500);
    }
  }
  run();
})();

/* XP structural reveal + title effects */
(function(){const section=document.getElementById("xp"),track=document.getElementById("timelineItems");if(!section||!track)return;const cards=[...track.querySelectorAll(".mf-xp-card")];let started=false;const style=document.createElement("style");style.textContent=`.xp-char{display:inline-block;will-change:transform,opacity,filter,color,text-shadow;}.xp-cursor{display:inline-block;margin-left:0;animation:xpCursorBlink .72s steps(1) infinite;}@keyframes xpCursorBlink{50%{opacity:0;}}.xp-heart{display:inline-block;margin-left:.35em;color:var(--mf-title,#75848a);filter:blur(.15px);transform-origin:center;animation:xpHeartBeat 1.05s cubic-bezier(.16,1,.3,1) infinite;}@keyframes xpHeartBeat{0%,100%{transform:scale(1);filter:blur(.15px);}12%{transform:scale(1.22);filter:blur(1.1px);}22%{transform:scale(.98);filter:blur(.25px);}34%{transform:scale(1.16);filter:blur(.9px);}48%{transform:scale(1);filter:blur(.15px);}}.xp-strv-red{color:var(--mf-ink,#050505)!important;text-shadow:none;}.xp-symbio-word,.xp-symbio-digital{display:inline-block;white-space:pre;will-change:transform,opacity,letter-spacing;}`;document.head.appendChild(style);
const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(!entry.isIntersecting||started)return;started=true;cards.forEach((card,i)=>setTimeout(()=>card.classList.add("show"),i*180));});},{threshold:.22});observer.observe(section);

cards.forEach(card=>{const title=card.querySelector(".mf-xp-title");if(!title)return;title.dataset.original=title.dataset.title||title.textContent;wrapTitle(title);let cleanup=null;card.addEventListener("mouseenter",()=>{if(cleanup)cleanup();cleanup=runTitleEffect(card,title);});card.addEventListener("mouseleave",()=>{if(cleanup)cleanup();cleanup=null;resetTitle(title);});});

function wrapTitle(title){const text=title.dataset.original;title.innerHTML="";for(const ch of text){const span=document.createElement("span");span.className="xp-char";span.textContent=ch===" "?"\u00A0":ch;title.appendChild(span);}}
function resetTitle(title){title.classList.remove("is-blood","is-symbio","xp-strv-red");title.style.opacity="";title.style.filter="";title.style.textShadow="";title.style.color="";title.style.width="";title.style.minWidth="";title.style.display="";title.style.alignItems="";title.innerHTML="";title.textContent=title.dataset.original;wrapTitle(title);}
function setPlain(title,text){title.classList.remove("is-blood","is-symbio","xp-strv-red");title.style.color="";title.style.textShadow="";title.innerHTML="";title.textContent=text;}
function setCursorText(title,text){title.innerHTML="";title.append(document.createTextNode(text));const cursor=document.createElement("span");cursor.className="xp-cursor";cursor.textContent="_";title.appendChild(cursor);}

function runTitleEffect(card,title){const type=card.dataset.xpEffect;const timers=[];let killed=false;const t=(fn,ms)=>{const id=setTimeout(()=>{if(!killed)fn()},ms);timers.push(id);return id};const clearAll=()=>timers.forEach(clearTimeout);resetTitle(title);

if(type==="independent"){setCursorText(title,"Independent");const steps=["Independen","Independe","Independ","Indepen","Indepe","Indep","Inde","Ind","In"];steps.forEach((txt,i)=>t(()=>setCursorText(title,txt),520+i*95));const phrase="In depth";[...phrase].forEach((_,i)=>t(()=>setCursorText(title,phrase.slice(0,i+1)),1520+i*85));t(()=>clearAll(),2350);}

if(type==="coach"){title.innerHTML='Coach <span class="xp-heart">♥</span>';}

if(type==="strv"){title.classList.add("xp-strv-red");}

if(type==="symbio"){
  const originalWidth=title.getBoundingClientRect().width;
  title.style.width=originalWidth+"px";
  title.style.minWidth=originalWidth+"px";
  title.style.display="inline-flex";
  title.style.alignItems="baseline";
  title.innerHTML="";
  const sym=document.createElement("span");
  sym.className="xp-symbio-word";
  sym.textContent="SYMBIO";
  const gap=document.createElement("span");
  gap.className="xp-symbio-gap";
  gap.textContent=" ";
  const dig=document.createElement("span");
  dig.className="xp-symbio-digital";
  dig.textContent="Digital";
  title.append(sym,gap,dig);
  const letters=[...sym.textContent].map(ch=>{const s=document.createElement("span");s.className="xp-char";s.textContent=ch;return s;});
  sym.replaceChildren(...letters);
  [...letters].reverse().forEach((ch,i)=>t(()=>{
    ch.style.transition="opacity .1s linear, transform .1s linear";
    ch.style.opacity="0";
    ch.style.transform="scaleX(0)";
  },i*65));
  t(()=>{
    if(killed)return;
    sym.replaceChildren();
    sym.style.width="1.15em";
    sym.style.flex="0 0 1.15em";
    sym.style.textAlign="left";
    sym.style.transform="translateY(.12em) rotate(45deg)";
    sym.style.transformOrigin="center";
    sym.textContent="☯";
  },letters.length*65+80);
}

if(type==="fg"){t(()=>setPlain(title,"FG 1"),300);t(()=>setPlain(title,"FG 2"),700);t(()=>setPlain(title,"FG 3"),1100);t(()=>setPlain(title,"FG 4"),1500);t(()=>{setPlain(title,"FG 4rest");clearAll();},1900);}

return ()=>{killed=true;clearAll();resetTitle(title);};}
})();

const xpPlus=document.getElementById("xpPlus");if(xpPlus){function popXP(){xpPlus.classList.remove("pop");void xpPlus.offsetWidth;xpPlus.classList.add("pop")}setInterval(popXP,4000)}




/* HERO EXPERIENCE TYPEWRITER */
(function(){
  const target=document.getElementById("metaText");
  if(!target)return;
  const lines=[
    "20+ YEARS OF XP",
    "DESIGN, LEADERSHIP, COACHING",
    "SUPERPOWER: FINDING YOUR SUPERPOWER"
  ];
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function loop(){
    while(true){
      for(const line of lines){
        target.textContent="";
        for(const ch of line){target.textContent+=ch;await wait(42);}
        await wait(1250);
        while(target.textContent.length){target.textContent=target.textContent.slice(0,-1);await wait(20);}
        await wait(260);
      }
    }
  }
  setTimeout(loop,2200);
})();

/* BIO LETTER LOOP */
(function(){
  const b=document.querySelector(".bio-b"),i=document.querySelector(".bio-i"),o=document.querySelector(".bio-o");
  if(!b||!i||!o)return;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function loop(){
    while(true){
      b.classList.remove("is-off");i.classList.remove("is-off");o.classList.remove("is-off");
      await wait(1600);
      b.classList.add("is-off");
      await wait(300);
      o.classList.add("is-off");
      await wait(180);
      for(let n=0;n<3;n++){
        i.classList.add("is-off");o.classList.remove("is-off");
        await wait(300);
        i.classList.remove("is-off");o.classList.add("is-off");
        await wait(300);
      }
      i.classList.remove("is-off");o.classList.remove("is-off");
      await wait(250);
      b.classList.remove("is-off");
      await wait(1500);
    }
  }
  loop();
})();

/* ============================================================
   GUIDANCE — Mindset + Team Leadership overlays
   ============================================================ */
(function(){
  const title=document.getElementById('guidanceTitle');
  const overlay=document.getElementById('mfGuidanceOverlay');
  const reviewsHost=document.getElementById('mfGuidanceReviews');
  const reviewNav=document.getElementById('mfGuidanceReviewNav');
  const overlayTitle=document.getElementById('mfGuidanceOverlayTitle');
  const overlayIntro=document.getElementById('mfGuidanceOverlayIntro');
  const kicker=document.getElementById('mfGuidanceKicker');
  const overlayAside=overlay?.querySelector('.mf-guidance-overlay-aside');
  const guidanceSection=document.getElementById('guidance');
  const closeButton=overlay?.querySelector('.mf-guidance-close');
  if(!title||!overlay||!reviewsHost||!reviewNav||!overlayTitle||!overlayIntro||!kicker||!overlayAside||!guidanceSection||!closeButton)return;

  const engagementLine=document.createElement('div');
  engagementLine.className='mf-guidance-engagement-fixed';
  engagementLine.setAttribute('aria-hidden','true');
  overlay.appendChild(engagementLine);

  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function runTitle(){
    while(title.isConnected){
      title.classList.remove('is-id','is-clearing');
      await wait(2000);
      title.classList.add('is-id');
      await wait(2000);
      title.classList.add('is-clearing');
      await wait(430);
      title.classList.remove('is-id','is-clearing');
      await wait(4000);
    }
  }
  runTitle();

  const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#39;'}[char]));
  const nl=value=>Array.isArray(value)?value.map(paragraph=>`<p>${escapeHtml(paragraph)}</p>`).join(''):String(value).split(/\n{2,}/).map(paragraph=>`<p>${escapeHtml(paragraph)}</p>`).join('');
  const flagEmoji={CZ:'🇨🇿',RU:'🇷🇺',FI:'🇫🇮',US:'🇺🇸',SK:'🇸🇰'};
  const flagMarkup=flag=>`<span class="mf-guidance-flag-emoji" data-flag="${escapeHtml(flag)}" aria-hidden="true">${flagEmoji[flag]||'◻'}</span>`;
  const personMarkup=entry=>`<div class="mf-guidance-person"><img class="mf-guidance-person-photo" src="${escapeHtml(entry.photo)}" alt="${escapeHtml(entry.name)}" loading="lazy" decoding="async"><span class="mf-guidance-person-info"><small class="mf-guidance-person-country">${flagMarkup(entry.flag)}<span>${escapeHtml(entry.country)}</span></small><b class="mf-guidance-person-name">${escapeHtml(entry.name)}</b><span class="mf-guidance-person-gap" aria-hidden="true"></span><small class="mf-guidance-person-role">${escapeHtml(entry.role)}</small><small class="mf-guidance-person-company">${escapeHtml(entry.company)}</small></span></div>`;
  const tagsMarkup=entry=>(entry.tags||[]).length?`<div class="mf-guidance-review-tags">${entry.tags.map(tag=>`<span>${escapeHtml(tag)}</span>`).join('')}</div>`:'';
  const weightLinkMarkup=(label,className,href)=>{
    const chars=[...label];
    const letters=chars.map((char,index)=>`<span style="--i:${index};--r:${chars.length-index-1}">${char===' '?'&nbsp;':escapeHtml(char)}</span>`).join('');
    return `<a class="mf-weight-link ${className}" href="${escapeHtml(href)}" target="_blank" rel="noopener" aria-label="${escapeHtml(label)}">${letters}</a>`;
  };

  const revealTextMarkup=label=>{
    const chars=[...label];
    return chars.map((char,index)=>`<span class="mf-guidance-next-char" style="--char:${index};--i:${index};--r:${chars.length-index-1}">${char===' '?'&nbsp;':escapeHtml(char)}</span>`).join('');
  };
  const guidanceNextMarkup=(label,target)=>`<button class="mf-guidance-next-link" type="button" data-guidance-next="${escapeHtml(target)}" aria-label="Open ${escapeHtml(label.replace('→','').trim())}"><span class="mf-guidance-next-label">${revealTextMarkup(label.replace('→','').trim())}</span><span class="mf-guidance-next-runway" aria-hidden="true"></span><span class="mf-guidance-next-arrow" aria-hidden="true">→</span></button>`;

  const romanReview=[
    `I started seeing Marián because I wanted to do something about my work ethic and discipline. I had left the company to work independently. Work began piling up, and very quickly I no longer knew what to tackle first.`,
    `Marián’s help was invaluable in several ways. As someone new to coaching, he first explained thoroughly how the whole thing worked and how it would unfold. Then, as we worked on the problem itself, his intelligent, perceptive questions led me to answers and solutions that were actually my own. Many things from our sessions are now firmly embedded in my life, and I often think back to the many small pieces of advice and tips I picked up along the way with Marián. A bonus was Marián’s advice and experience from his own remarkably rich professional life, and the completely relaxed Scandinavian-Japanese-style atmosphere.`
  ];

  const darjaReview=[
    `Just like many other product designers out there, I pivoted careers and got into design through courses, books, webinars… basically learning by trial and error. At some point, I found myself completely overwhelmed with information and unsure how to navigate my career further, how to evolve, and what to focus on. That was when I reached out to Marián—not with a clear question, just a bunch of self-doubt. Although I used to be skeptical about the concept of mentoring, I could not miss the opportunity to talk to Marián because I followed and admired his design work. Yet I received so much more than a thorough design review, and I have been the most loyal design-coaching promoter ever since.`,
    `To begin with, Marián created a safe and encouraging space for me to open up and put my thoughts in order. I always came with a problem that seemed unsolvable and always left feeling empowered and uplifted. He is the leader I desperately needed. We talked about pixels and icons, but also long-term goals, personal priorities, and emotional well-being. I received the most on-point design advice, which noticeably took my skills to a completely new level. I gained confidence and, most importantly, understood what my strengths are and how to develop them. As a result, I feel more connected to myself. Marián is a very talented designer and an incredible coach, and I am so grateful for the mentoring sessions that helped me grow on both career and personal levels.`
  ];

  const anastasiiaReview=`Working with Marián when I felt burned out, overwhelmed, and immobilized helped me acknowledge my feelings and rework my self-afflicting beliefs and interactions with the world. Marián can be the venting system you may have needed for a long time, but he can also be an essential part of setting a new course for that stage of your life.`;

  const makoReview=[
    `The coaching sessions helped me shift my paradigms in life. I thought I knew what steps to take to be a “good person,” which included living up to a particular set of standards influenced far more by my surroundings than by myself. Over the sessions, I learned to listen to myself and let myself be me—and everything else would fall into place. One day, I started thinking about the kind of life I could live on my own terms, without always trying to fit into the “successful career woman” mold. Such a simple thought freed my imagination and allowed me to reconsider what I truly valued: fulfilling relationships, authenticity, and a healthy, balanced life—not work. Last week, I had an interview for a job I wanted. I got nervous during the interview and did not feel that I performed the activities well. That night, I was overwhelmed with anxiety and racing thoughts, but I was quickly able to return to my foundations—the loving relationships I have around me. Now I feel okay. If I do not get hired, it will be okay, and I will keep trying elsewhere.`,
    `My diary entry from October 1, 2022:`,
    `Whenever I leave my coaching session, I feel an overwhelming sense of love for myself. That self-love inspires me to naturally do things that are “good” for me, like paint, journal, or even clean the house. I do these things because I want to take care of myself—not out of guilt to be productive. Over the week, that self-love dissipates. I eventually go back to trying to escape my reality by binge-watching TV. But the more I practice being kinder to myself and listening to my intuition, the more I can return to this space of forgiveness and self-love. I want to live on my own terms and figure out what that means for me.`
  ];

  const iljaReview=[
    `Before meeting Marián, my history with coaching was a mixed bag. Until then, I had thought of coaches as self-assured gurus who applied a predefined set of techniques to help you clarify your goals and boost your productivity and performance. My perspective completely shifted after working with Marián. Marián is a highly perceptive and empathetic listener. Whenever my words said one thing but my body language said something else, he picked up on it and used it as an avenue to help me deconstruct my underlying motives and assumptions. What stood out was his ability to quickly understand my personality and temperament and adapt his coaching style to suit me. This knack allowed him to skillfully balance guiding me while encouraging self-direction. Most importantly, Marián was not afraid to nudge me out of my comfort zone, challenging my initial answers and steering me toward deeper reflection.`,
    `Sometimes I found myself leaving a session shaken, yet profoundly contemplative. Other times, I was brimming with inspiration and energy, barely able to contain the excitement and eagerness stirring within me. Both kinds of sessions proved invaluable, offering unique insights into the underlying mental models that drive my personal and professional behavior. A few months into our collaboration, I realized a significant transformation. I did not leave our sessions burdened with a laundry list of goals and benchmarks to meet, which Marián would then hold me accountable for. Instead, I left with a new understanding of myself. I recognized that I did not thrive within rigid structures, something I had already been somewhat aware of. Through my journey with Marián, however, I learned not merely to acknowledge this trait but to harness it as a powerful tool. I can wholeheartedly recommend Marián to anyone looking for a coaching experience that is transformative, personalized, and insightful.`
  ];

  const longReview=[
    `Hi, my name is Michal, and I was born twice in my life. The first time was 29 years ago, and I am grateful to my Mom for that (and my Dad, of course). The second time was six months ago, and I owe that to Marián. You see, I was not always who I am now, and I became this person thanks to him. Actually, thanks to myself—but I would not have been capable of it without him. Complicated, right?`,
    `The fact is, Marián’s presence affected every aspect of my being. For the better. What was the magic? That is the best thing about all of it: there is no magic, and there never was. There is only an incredible ability to listen, and a boundless interest in and attention toward you. When you sit opposite Marián, you are the only person who matters in that moment. No one is more important than you. As if no one else had ever existed.`,
    `When I first met Marián, I was fairly convinced I knew who I was and who I needed to become. I had an idea of myself and my desires—everything I had to fit into my life, everything I had to achieve. Those were all the things that would make me happy. What I will be grateful to Marián for until the day I die is that he did not help me achieve any of them. Instead, he helped me realize that none of them were my dreams or goals, let alone the foundation of my happiness. They were the dreams and goals of other people. Strangers. People I know nothing about and probably never will. (What do those people even know about themselves?) Dreams someone sold me and I bought willingly and thoughtlessly. Very little of it came from me, from my personality, or from knowing myself. It was only with Marián that we discovered me: what I truly want, what gives me energy, and what takes it away. And that brings us to a major affliction of today’s world. Many people will tell you what is best for you. They will sell it to you or offer it for free. Based on their own experience or someone else’s, they will advise you on how to achieve success, fame, and happiness as a finished product. Yet not one of them makes even the slightest effort to know and understand you sincerely—to understand what it is like to be YOU. To discover you. They think that what worked for them must work for others. So they give advice. But that is nothing more than vanity disguised as goodwill, and advice aimed blindly. Instead of showing you a direction, they entangle you even further and lead you farther away from yourself. If happiness has ever existed in this world, you already have it within you; you simply have not discovered it. YET. And that is what Marián helped me understand—and that understanding is the key to everything!`,
    `Marián sincerely believes there is no universal advice, no universal path to happiness. The only right path is your own, and no one has ever published a map of it. How could they? It is up to you to discover that path and find out what lies along it. No one can tell you when and where to turn, let alone where you are supposed to arrive. You probably do not know that yourself. YET. No one has ever walked that path before, so no one can tell you what will be waiting there. But someone can help you prepare for it and pack your backpack. YOUR own backpack, equipped with everything you might need along the way so that nothing catches you unprepared. They will not fill it with what other people needed, but with what you need. I am immensely grateful that I was able to pack mine with Marián. I now know there is no one else I would rather have packed it with. I cannot imagine anyone doing it with such genuine interest in my journey as he did. When you allow the right person to know you better than you may know yourself, it is as if your older self were preparing you for the road. Thank you, Marián, for being my older self, just as you are the older self of all your “bodies,” as you call them.`,
    `I leave my work with Marián a free, self-aware person, able to interpret my life in my own favor, whatever happens in it. You cannot always control which cards land on the table or whether you run into snakes in the sand along the way (Marián will never promise otherwise). But you can always play as well as you possibly can, despite everything and everyone. You can always enjoy your game, your journey, so that one day you can calmly say, from a good place: I followed my own path, and it was a ride no one else experienced. And perhaps, through that, inspire others never to stop searching for their own path for a very good reason, and never to settle for anything less. That is what this is all about. Thank you, my friend, for teaching me to play as if my life depended on it!`
  ];

  const splitReviewAt=(text,marker)=>{
    const index=text.indexOf(marker);
    return index<0?[text,'']:[text.slice(0,index).trim(),text.slice(index).trim()];
  };
  const [michalDiscoveryLead,michalDiscoveryTail]=splitReviewAt(longReview[2],'It was only with Marián that we discovered me:');
  const [michalPathLead,michalPathTail]=splitReviewAt(longReview[3],'I am immensely grateful that I was able to pack mine with Marián.');
  const michalParts=[
    [longReview[0],longReview[1],michalDiscoveryLead],
    [michalDiscoveryTail,michalPathLead],
    [michalPathTail,longReview[4]]
  ];

  const tomasLodnanReview=[
    `I have to say, we had many mentors and consultants. Many of them helped us move forward, gave us feedback and created a space where we could talk about our challenges despite the daily routine.`,
    `Marián was on another level for us. To be honest, I was extremely surprised by how quickly and precisely he was able to understand who we are, what our challenges are and identify the problems without any unnecessary fluff. His presentation was so valuable that I went through it several times. :) Based on his suggestions and his ability to identify potential issues in the future, we made important changes to our organisational structure and prioritised our focus on areas where we had pain points.`,
    `Marián continues to be our long-term mentor and coach. We regularly return to discuss specific topics and validate whether he confirms that our approach is good or provides a different perspective. If your organisation is growing and you are seeking an expert in leadership and team management for your tech company, Marián is definitely the person I would recommend first.`
  ];

  const kristynaPeckovaReview=[
    `When I started in design several years ago, I was looking for someone who could open the door to that world and help me launch my career. Marián became one of the key people who guided me through that process. His support, advice and knowledge were indispensable to me, and thanks to him I found courage and confidence in my abilities. Marián gave me foundational design knowledge, explained it in a practical and entertaining way, gave me constructive feedback on my designs and stood by me when I landed my first client. His coaching and support contributed significantly to building my confidence in design and in my personal life.`,
    `It is great to see how he has combined two things he genuinely enjoys—design and coaching. There is no question that he is a great designer, but I am glad I could be part of his professional growth and see him develop as a coach and share his know-how with others with such passion. I can only recommend working with him in any capacity!`
  ];

  const jakubNesporReview=`I would say I have a pretty good history with Marián. He was there for me during the most crucial phase of my career as my Team Leader, always striking the right balance between friendliness and professionalism. He introduced me to the fundamentals of coaching, so it is no surprise that, even years later, he was there to lend a hand when I needed it. What I love most about our sessions is how authentic they are, even when things are not always smooth sailing. And my favorite part? Leaving! Not because I am eager to go home, but because I always feel so pumped and happy that I have just learned something new about myself.`;

  const tomasBruzdaReview=`I have been attending sessions with Marián in waves. We have already gone through two waves. The first dealt with both personal and work life a bit. The second was primarily about work life. Regardless, in both cases, I left very satisfied. Marián helped me organize my thoughts, set priorities and, most importantly, figure out what I really want. Even when we did not have a specific topic to address, it helped me a lot just to vent about what was bothering me. Sometimes we followed up on something, sometimes we did not, but I always left with peace of mind. If a third wave comes, it will certainly be with Marián again.`;

  const marosNovakReview=[
    `After eight years as iOS Lead at GoodRequest, I started wondering what should come next. The team was finely tuned, with no weak links—technologically strong and motivated—while I found myself digging deeper into how the company operated. Around that time, we invited Marián to come in and look at the company from a distance. After years inside it, we lacked that perspective because we were deep in operations, business and everyday problems. During our conversation, he wanted to understand how we worked, and he asked exactly the questions I needed to answer but had never asked myself.`,
    `One of the outcomes after his week with us was the recommendation that the tech leaders needed a leader: a Head of Design & Engineering who would motivate them, listen to them, help guide them and launch them to the moon. Simply someone who would be there for them in the same way they were there for their teams. The recommendation came with my name, followed by an offer from the board asking whether I was in. I was. Naturally, I had respect and concerns, but I was not alone in it—we started sessions with Marián.`,
    `Our coaching sessions are pure gold. Whether I was looking for a replacement for myself on the iOS platform and thinking about how to tell the team, figuring out how to take the right first steps as Head of D&E, preparing for difficult conversations or finding ways to connect the tech leads more closely, we found answers to everything together—or rather, I found them. Marián asked the questions. His empathy, spark, ability to step out of the role and precisely targeted advice make me feel more confident in what I do. Our leadership styles are similar, and our vibe and shared perspective help me immensely. Also thanks to lines like: “Hey, I’m here for you,” “Let’s make this easier for you,” “I’m rooting for you,” “Go take what’s yours,” and “This is the shit.”`
  ];

  const marieLaurenReview=`Coaching with Marián recharges your batteries and gives you so much energy to move forward that you feel like a Duracell. We’ve had sessions in both lighter and more difficult moments, but the result was always the same—a smile on my face and the strength to take action, choose what matters and throw the rest overboard. Every hour with him saved me so many others that I would otherwise have lost, had it not been for his perceptive questions to reflect on.`;

  const mindsetEntries=[
    {id:'michal-bohac',length:'big-parts',name:'Michal Boháč',role:'CEO',company:'Wonder Makers',country:'Czechia',flag:'CZ',photo:'/media/guidance/coaching/michal-bohac.jpg',tags:['Transformational Coaching'],copy:longReview,parts:michalParts},
    {id:'roman-bartos',length:'medium',name:'Roman Bartoš',role:'Designer',company:'Freelance',country:'Czechia',flag:'CZ',photo:'/media/guidance/coaching/roman-bartos.jpg',tags:['Transformational Coaching'],copy:romanReview},
    {id:'darja-arefjeva',length:'medium',name:'Darja Arefjeva',role:'Product Designer',company:'Pipedrive',country:'Russia',flag:'RU',photo:'/media/guidance/coaching/darja-arefjeva.jpg',tags:['Design Coaching'],copy:darjaReview},
    {id:'anastasiia-kozina',length:'short',name:'Anastasiia Kozina',role:'Founding Designer',company:'Illusian',country:'Finland',flag:'FI',photo:'/media/guidance/coaching/anastasiia-kozina.jpg',tags:['Life Coaching'],copy:anastasiiaReview},
    {id:'mako-ueda',length:'short',name:'Mako Ueda',role:'Business Operations Manager',company:'Career Break',country:'United States',flag:'US',photo:'/media/guidance/coaching/mako-ueda.jpg',tags:['Transformational Coaching'],copy:makoReview},
    {id:'ilja-panic',length:'medium',name:'Ilja Panić',role:'CTO & Co-Founder',company:'Resolve',country:'Czechia',flag:'CZ',photo:'/media/guidance/coaching/ilja-panic.jpg',tags:['Career Coaching'],copy:iljaReview},
    {id:'marie-lauren',length:'short',name:'Marie Lauren',role:'Community Representative',company:'Scott.Weber Workspace',country:'Czechia',flag:'CZ',photo:'/media/guidance/coaching/marie-lauren.jpg',tags:['Life Coaching'],copy:marieLaurenReview},
    {id:'tomas-lodnan',length:'medium',name:'Tomáš Lodňan',role:'CEO',company:'Good Request',country:'Slovakia',flag:'SK',photo:'/media/guidance/coaching/tomas-lodnan.jpg',tags:['Executive Coaching'],copy:tomasLodnanReview},
    {id:'kristyna-peckova',length:'medium',name:'Kristýna Pecková',role:'UX/UI Designer',company:'Freelance',country:'Czechia',flag:'CZ',photo:'/media/guidance/coaching/kristyna-peckova.jpg',tags:['Design Coaching'],copy:kristynaPeckovaReview},
    {id:'jakub-nespor',length:'short',name:'Jakub Nešpor',role:'Design Engineer',company:'Entire',country:'Czechia',flag:'CZ',photo:'/media/guidance/coaching/jakub-nespor.jpg',tags:['Transformational Coaching'],copy:jakubNesporReview},
    {id:'tomas-bruzda',length:'short',name:'Tomáš Bruzda',role:'Designer',company:'Freelance',country:'Czechia',flag:'CZ',photo:'/media/guidance/coaching/tomas-bruzda.jpg',tags:[],copy:tomasBruzdaReview},
    {id:'maros-novak',length:'big-single',name:'Maroš Novák',role:'Head of Design & Engineering',company:'GoodRequest',country:'Slovakia',flag:'SK',photo:'/media/guidance/coaching/maros-novak.jpg',tags:['Leadership Coaching'],copy:marosNovakReview}
  ];

  const coachingEngagementById={
    'michal-bohac':'Ongoing Coaching Partnership (weekly, 1yr+)',
    'roman-bartos':'Focused Coaching Cycle (~7 sessions)',
    'darja-arefjeva':'Kickstart Coaching Session (1–3 sessions)',
    'anastasiia-kozina':'Kickstart Coaching Session (1–3 sessions)',
    'mako-ueda':'Focused Coaching Cycle (~7 sessions)',
    'ilja-panic':'Focused Coaching Cycle (~7 sessions)',
    'marie-lauren':'Focused Coaching Cycle (~7 sessions)',
    'tomas-lodnan':'Kickstart Coaching Session (1–3 sessions)',
    'kristyna-peckova':'Kickstart Coaching Session (1–3 sessions)',
    'jakub-nespor':'Focused Coaching Cycle (~7 sessions)',
    'tomas-bruzda':'Focused Coaching Cycle (~7 sessions)',
    'maros-novak':'Focused Coaching Cycle (~7 sessions)'
  };
  mindsetEntries.forEach(entry=>{entry.engagement=coachingEngagementById[entry.id]||'';});

  const mindsetNextEntry={id:'next-leadership',type:'next',name:'NEXT: Team Leadership →'};


  const LEADERSHIP_HERO_SRC='/media/guidance/leadership/marian-fusek_chill.jpg';
  let leadershipHeroPreloadPromise=null;
  const preloadLeadershipHero=()=>{
    if(leadershipHeroPreloadPromise)return leadershipHeroPreloadPromise;
    leadershipHeroPreloadPromise=new Promise(resolve=>{
      const image=new Image();
      image.decoding='async';
      image.fetchPriority='high';
      image.addEventListener('load',()=>resolve(true),{once:true});
      image.addEventListener('error',()=>{
        leadershipHeroPreloadPromise=null;
        resolve(false);
      },{once:true});
      image.src=LEADERSHIP_HERO_SRC;
    });
    return leadershipHeroPreloadPromise;
  };
  const armLeadershipHeroImage=()=>{
    const image=reviewsHost.querySelector('.mf-leadership-hero-photo img');
    if(!image)return;
    const retry=()=>{
      if(image.dataset.mfLoadRetry==='1')return;
      image.dataset.mfLoadRetry='1';
      image.src=`${LEADERSHIP_HERO_SRC}?v=118`;
    };
    image.addEventListener('error',retry,{once:true});
    if(image.complete&&!image.naturalWidth)retry();
  };

  const leadershipEntries=[
    {id:'jan-pacek',name:'Jan Pacek',role:'Product Architect',company:'STRV',country:'Czechia',flag:'CZ',photo:'/media/guidance/leadership/jan-pacek.jpg',review:`When I think of leadership, two people immediately pop into my mind — Jocko Willink and Marian. Yes, Jocko is more badass and would probably kick both our asses, but I’ve had a chance to be part of Marian’s team for about two years, and his approach to leadership was always very inspiring. It’s the combination of absolute calmness in the face of everyday disasters together with strong values that bring new perspectives. After a conversation with Marian, every hopeless crisis has a light at the end of a tunnel, and you are left wondering why it was a disaster in the first place. Those two years made me a better person for sure.`},
    {id:'jan-kaltoun',name:'Jan Kaltoun',role:'Chief Operating Officer',company:'STRV',country:'Czechia',flag:'CZ',photo:'/media/guidance/leadership/jan-kaltoun.jpg',review:`Marian is one in a million kind of person, and working with him is simply a privilege. While Marian is not really a deeply technical person, he was able to successfully lead a team of leads who in turn led over a hundred designers and engineers. Working as a direct report to Marian, I was constantly amazed by how effortlessly he was able to tackle all the important tasks that needed to get done by empowering every single one of us in ways that are tough to put into words but endlessly effective. Marian listens, he brings the best out of you, he advises and, when needed, he pushes.`},
    {id:'petr-nohejl',name:'Petr Nohejl',role:'Engineering Manager',company:'STRV',country:'Czechia',flag:'CZ',photo:'/media/guidance/leadership/petr-nohejl.jpg',review:`The collaboration with Marian was very inspiring and definitely helped me move forward in my career as a leader. Marian was my lead and I worked closely with him for more than four years. What I appreciate most is that I could tell him anything, without filtering what I can or cannot say to my boss, and he always supported me and gave me good advice. He helped me overcome a number of crises. He made me think differently, from another perspective. Marian is a good listener and has a great talent for coaching. I am very happy I could be part of his team.`},
    {id:'jan-maly',name:'Jan Malý',role:'Founding AI Engineer',company:'Kontext',country:'Czechia',flag:'CZ',photo:'/media/guidance/leadership/jan-maly.jpg',review:`I was lucky to work under Marian’s supervision at STRV. He significantly impacted my career and development as he was highly supportive and acted as a coach, giving me space to grow. Thanks to Marian’s trust and guidance, we were able to start and grow the Data Science department.`},
    {id:'daniel-kraus',name:'Daniel Kraus',role:'Chief Technology Officer',company:'STRV',country:'Czechia',flag:'CZ',photo:'/media/guidance/leadership/daniel-kraus.jpg',review:`Everyone has in mind those very few people who at some point in their life left a substantial impact on their future. Those people are different from the crowd. Those people stand by their ideals no matter what. Those people you simply somehow know that you will always remember. This is Marian to me. I feel lucky I could have spent four years working closely under his leadership at STRV. He’s been an inspiring mentor. A manager who could support me fully but also was strict when needed.`},
    {id:'michal-klacko',name:'Michal Klačko',role:'Director of Engineering',company:'STRV',country:'Slovakia',flag:'SK',photo:'/media/guidance/leadership/michal-klacko.jpg',review:`Marian is a very unique person. He was my lead while I worked as the Lead of the Backend department at STRV. He was a lead you read about in books. He trusted his people, always left me and others space to grow, and helped or pushed when needed. Marian was always inclined toward coaching and dedicated a significant amount of time to learning it from professionals from QED. Having a “boss” and a coach in one person was unique, and I loved it. People at STRV noticed Marian’s talent for listening to people and helping them become better, or just to figure things out.`},
    {id:'juraj-kuliska',name:'Juraj Kuliška',role:'Senior Android Engineer',company:'Paylocity',country:'Slovakia',flag:'SK',photo:'/media/guidance/leadership/juraj-kuliska.jpg',review:`I had the honor to work with Marian for about two years. We had some really amazing talks that made me do great leaps in my career. Also, what I loved about Marian’s approach was that he always supported people in what they wanted to do most, even if it went against his own interests that he put aside — which is amazing both humanly and from a leadership point of view.`}
  ];

  const modes={
    mindset:{title:'Mindset<br>Coaching',kicker:'',intro:`I work with teams and individuals to find the version of you that isn't performing for anyone — the noise gone, just what's actually there. No immediate advice. No "do it like this." Your style all the way — nothing forced.

70+ people coached and mentored — designers, engineers, QA testers, team leaders, C-level executives. Individual sessions, team work, all of it.

Certified ICF-ACSTH & EMCC, if credentials matter to you.`,order:['michal-bohac','roman-bartos','darja-arefjeva','anastasiia-kozina','mako-ueda','ilja-panic','marie-lauren','tomas-lodnan','kristyna-peckova','jakub-nespor','tomas-bruzda','maros-novak','next-leadership']},
    leadership:{title:'Team<br>Leadership',kicker:'',intro:`Yeah... and a fitting photo of just me with no team around. I'm not a photo kinda guy, relax... I mean, chill!`,order:leadershipEntries.map(entry=>entry.id)}
  };

  const partMarkup=entry=>`<div class="mf-guidance-copy-shell"><nav class="mf-guidance-review-parts" aria-label="Review parts">${entry.parts.map((_,index)=>`<button class="mf-guidance-part-button${index===0?' is-active':''}" type="button" data-review-part="${index}">PART ${String(index+1).padStart(2,'0')}</button>`).join('')}</nav><div class="mf-guidance-part-panels">${entry.parts.map((part,index)=>`<div class="mf-guidance-part-panel${index===0?' is-active':''}" data-review-part-panel="${index}"${index===0?'':' aria-hidden="true"'}>${nl(part)}</div>`).join('')}</div></div>`;
  const reviewMarkup=entry=>{
    if(entry.type==='next')return `<article class="mf-guidance-review is-guidance-next" id="guidance-review-${entry.id}" data-review-id="${entry.id}">${guidanceNextMarkup('Team Leadership →','leadership')}</article>`;
    const copy=entry.parts?partMarkup(entry):`<div class="mf-guidance-copy-shell"><div class="mf-guidance-single-copy">${nl(entry.copy)}</div></div>`;
    const engagement=entry.engagement?`<div class="mf-guidance-engagement">${escapeHtml(entry.engagement)}</div>`:'';
    return `<article class="mf-guidance-review mf-guidance-review-universal${entry.parts?' has-parts':''}" id="guidance-review-${entry.id}" data-review-id="${entry.id}"><div class="mf-guidance-person-wrap">${personMarkup(entry)}</div><div class="mf-guidance-review-content">${tagsMarkup(entry)}${copy}${engagement}</div></article>`;
  };


  const leadershipPeopleMarkup=()=>leadershipEntries.map((entry,index)=>`<button class="mf-leadership-person-card${index===0?' is-active':''}" type="button" data-leadership-person="${entry.id}" aria-label="Show review from ${escapeHtml(entry.name)}" aria-pressed="${index===0?'true':'false'}"><span class="mf-leadership-person-photo-wrap"><img src="${escapeHtml(entry.photo)}" alt="${escapeHtml(entry.name)}" loading="lazy" decoding="async"></span></button>`).join('');

  const leadershipContent=()=>`<div class="mf-leadership-page">
    <figure class="mf-leadership-hero-photo mf-guidance-scroll-reveal">
      <img src="${LEADERSHIP_HERO_SRC}" alt="Marian Fusek portrait" loading="eager" decoding="async" fetchpriority="high">
      <div class="mf-leadership-hero-scroll-cue" aria-hidden="true">
        <span>THE READS</span><b>↓</b>
      </div>
    </figure>
    <section class="mf-leadership-section" id="leadership-xp">
      <div class="mf-leadership-copy-block mf-guidance-scroll-reveal">
        <h3>XP – CHIEF DESIGN &amp; ENGINEERING OFFICER</h3>
        <p>My leadership experience comes mostly from my time at ${weightLinkMarkup('STRV','is-strv','https://www.strv.com')}. I led team leads and platform experts across iOS, Android, Backend, Frontend, Data Science, Design &amp; QA.</p>
        <div class="mf-leadership-stats"><div><small>LED</small><strong><span>11</span> <span>managers</span></strong></div><div><small>OVERSEEING</small><strong><span>130</span> <span>people</span></strong></div></div>
        <div class="mf-leadership-projects"><small>PROJECTS</small><p>Microsoft, Epic Games, The Athletic, Tinder, Autodesk, Barnes &amp; Noble, The Pump by Arnold Schwarzenegger, Barry's, and many more.</p></div>
        <h3 class="mf-leadership-secondary-xp">XP – DESIGN TEAM LEAD*</h3>
        <p>Before that, I ran STRV’s Design Team — and for a bit, when QA had no lead, ran both teams at once. Good times.</p>
        <p class="mf-leadership-eleken-link">${weightLinkMarkup('My take on leadership in Eleken interview','is-eleken','https://www.eleken.co/blog-posts/managing-a-design-team-interview-with-seasoned-design-leaders')}</p>
      </div>
      <div class="mf-leadership-copy-block mf-guidance-scroll-reveal">
        <h3>UPTIME</h3>
        <p>I’m at my best when things are still being established — early-stage, lots of heavy lifting, real progress. That’s also where my coaching background kicks in — I’m good at navigating chaos and clearing the air. Once everything’s clicking, stagnation creeps in, and everyone’s obsessing over optimizing 91% into 92%, I’m ready for a shift.</p>
      </div>
      <div class="mf-leadership-copy-block mf-guidance-scroll-reveal">
        <h3>HIGHLIGHTS</h3>
        <ul>
          <li>Started the company’s first regular performance reviews — later adopted company-wide</li>
          <li>Built the first career ladder for designers — later adopted by other D&amp;E departments</li>
          <li>Co-ran the first company academy for new talent in D&amp;E</li>
          <li>Mentored the first company academy track for designers</li>
          <li>Listen, stuff was happening and I was around, so…</li>
        </ul>
      </div>
      <figure class="mf-leadership-graduates-photo mf-guidance-scroll-reveal">
        <img src="/media/guidance/leadership/academy-designers.jpg" alt="Academy designers" loading="lazy">
        <figcaption>MY Y2 DESIGN GRADUATES</figcaption>
      </figure>
      <div class="mf-leadership-copy-block mf-leadership-reviews-intro mf-guidance-scroll-reveal">
        <h3>REVIEWS</h3>
        <p>Kind words (no cash transaction involved) from some of my former team members.</p>
      </div>
    </section>
    <section class="mf-leadership-section" id="leadership-reviews">
      <div class="mf-leadership-people-strip mf-guidance-scroll-reveal" aria-label="Team review carousel">${leadershipPeopleMarkup()}</div>
      <div class="mf-leadership-review-detail mf-guidance-scroll-reveal" id="mfLeadershipReviewDetail"></div>
    </section>
    <section class="mf-leadership-section" id="leadership-next">
      <div class="mf-leadership-copy-block mf-guidance-scroll-reveal">
        <h3>NEXT?</h3>
        <p>If you’ve got a team out there and need support — hit me up. I treat leadership with the utmost respect. It’s sensitive territory, so job descriptions go aside here. Just tell me what’s going on, and we’ll figure it out from there.</p>
        <p>Design, coaching, leadership — whatever the label, if something I do feels relevant to what you need, that’s enough reason to reach out. We’ll cook up the collab that actually fits, together. [hits the table]</p>
        <button class="mf-art-cta mf-leadership-cta" type="button" id="mfLeadershipCopyButton">Well said MF!</button>
      </div>
      <div class="mf-leadership-guidance-next mf-guidance-scroll-reveal">${guidanceNextMarkup('Mindset Coaching →','mindset')}</div>
    </section>
  </div>`;


  const leadershipDetailMarkup=entry=>`<article class="mf-leadership-review-expanded"><header class="mf-leadership-review-head"><h4>${escapeHtml(entry.name)}</h4><div class="mf-leadership-review-meta"><span>${escapeHtml(entry.role)}</span><span>${escapeHtml(entry.company)}</span></div></header><div class="mf-leadership-review-body"><p>${escapeHtml(entry.review)}</p></div></article>`;

  let currentMode='mindset';
  let guidanceReturnY=0;
  let activeReviewId='';
  let reviewScrollFrame=0;
  let guidanceObserver=null;
  let snapTimer=0;
  let asciiTimer=0;
  const mobileGuidance=window.matchMedia('(max-width:1024px)');

  /* V112: short-height Mindset submenu. The approved full menu remains
     unchanged whenever it fits. When it would reach the description, only
     the active row remains visible. Clicking that row opens the full list and
     temporarily hides the description. */
  let compactNavFrame=0;
  const compactFitClasses=['is-width-fit','is-width-fit-1','is-width-fit-2','is-width-fit-3','is-width-fit-4','is-width-fit-5','is-width-fit-6','is-width-fit-7','is-width-fit-8'];
  const closeCompactReviewNav=()=>{
    overlay.classList.remove('is-review-nav-open');
    reviewNav.querySelectorAll('[data-review-target]').forEach(button=>button.setAttribute('aria-expanded','false'));
  };
  function updateCompactReviewNav(){
    compactNavFrame=0;
    if(currentMode!=='mindset'||mobileGuidance.matches||!overlay.classList.contains('is-open')){
      overlay.classList.remove('is-compact-review-nav','is-review-nav-open');
      return;
    }

    const keepOpen=overlay.classList.contains('is-review-nav-open');
    overlay.classList.remove('is-compact-review-nav','is-review-nav-open');

    const asideRect=overlayAside.getBoundingClientRect();
    const introRect=overlayIntro.getBoundingClientRect();
    const navStyle=getComputedStyle(reviewNav);
    const navBottom=Number.parseFloat(navStyle.bottom)||30;
    const fullNavHeight=reviewNav.getBoundingClientRect().height;
    const theoreticalTop=asideRect.bottom-navBottom-fullNavHeight;
    const threatened=theoreticalTop<introRect.bottom+26;

    overlay.classList.toggle('is-compact-review-nav',threatened);
    if(threatened&&keepOpen)overlay.classList.add('is-review-nav-open');
    reviewNav.querySelectorAll('[data-review-target]').forEach(button=>{
      const expanded=threatened&&button.classList.contains('is-active')&&overlay.classList.contains('is-review-nav-open');
      button.setAttribute('aria-expanded',expanded?'true':'false');
    });
  }
  function scheduleCompactReviewNav(){
    cancelAnimationFrame(compactNavFrame);
    compactNavFrame=requestAnimationFrame(()=>requestAnimationFrame(updateCompactReviewNav));
  }

  /* V113: staged Mindset review fitting. Only the settled active review is
     measured. It starts at the larger approved copy size, reduces only as much
     as required down to a conventional 14px desktop minimum, and only then
     gains width toward the left. The engagement line follows the final copy
     axis while keeping its approved bottom position. */
  let mindsetFitFrame=0;
  let mindsetFitTimer=0;
  const mindsetMinimumFontSize=14;
  const mindsetEmergencyFontSize=13.25;
  const mindsetEngagementSafeGap=44;
  const mindsetLeftSafetyGap=28;
  const mindsetMaximumVerticalLift=64;

  function clearMindsetReviewFit(review){
    if(!review)return;
    review.classList.remove(...compactFitClasses,'is-measuring-review-fit','is-dense-review-fit','is-review-fitted');
    review.style.removeProperty('--mf-review-fit-font-size');
    review.style.removeProperty('--mf-review-copy-gain');
    review.style.removeProperty('--mf-review-person-shift');
    review.style.removeProperty('--mf-review-vertical-lift');
  }
  function resetMindsetReviewWidths(exceptReview=null){
    reviewsHost.querySelectorAll('.mf-guidance-review-universal').forEach(review=>{
      if(review===exceptReview)return;
      clearMindsetReviewFit(review);
    });
  }
  function activeReviewFlowBottom(review){
    const nodes=[
      review.querySelector('.mf-guidance-review-content > .mf-guidance-review-tags'),
      review.querySelector('.mf-guidance-part-panel.is-active'),
      review.querySelector('.mf-guidance-single-copy'),
      review.querySelector('.mf-guidance-review-parts')
    ].filter(Boolean);
    return nodes.reduce((bottom,node)=>Math.max(bottom,node.getBoundingClientRect().bottom),-Infinity);
  }
  function resetEngagementLineGeometry(){
    engagementLine.style.removeProperty('left');
    engagementLine.style.removeProperty('right');
  }
  function alignEngagementLineToReview(review){
    if(mobileGuidance.matches||!review||!engagementLine.classList.contains('has-text')){
      resetEngagementLineGeometry();
      return;
    }
    const content=review.querySelector('.mf-guidance-review-content');
    if(!content)return;
    const rect=content.getBoundingClientRect();
    engagementLine.style.setProperty('left',`${Math.max(0,rect.left).toFixed(2)}px`,'important');
    engagementLine.style.setProperty('right',`${Math.max(0,window.innerWidth-rect.right).toFixed(2)}px`,'important');
  }
  function fitSettledMindsetReviewWidth(id=activeReviewId){
    cancelAnimationFrame(mindsetFitFrame);
    clearTimeout(mindsetFitTimer);
    if(currentMode!=='mindset'||mobileGuidance.matches||snapInFlight||(!overlay.classList.contains('is-open')&&!overlay.classList.contains('is-entering')))return;

    mindsetFitFrame=requestAnimationFrame(()=>{
      mindsetFitFrame=0;
      const review=reviewsHost.querySelector(`[data-review-id="${id}"]`);
      if(!review||review.classList.contains('is-guidance-next')||getDominantMindsetReview()!==review)return;
      if(!engagementLine.classList.contains('has-text'))return;

      resetMindsetReviewWidths(review);
      clearMindsetReviewFit(review);
      review.classList.add('is-measuring-review-fit');
      alignEngagementLineToReview(review);

      const sample=review.querySelector('.mf-guidance-part-panel.is-active p, .mf-guidance-single-copy p');
      if(!sample){
        review.classList.remove('is-measuring-review-fit');
        return;
      }

      const baseFontSize=Number.parseFloat(getComputedStyle(sample).fontSize)||16;
      const minimumFontSize=Math.min(baseFontSize,mindsetMinimumFontSize);
      const emergencyFontSize=Math.min(minimumFontSize,mindsetEmergencyFontSize);
      const collides=()=>activeReviewFlowBottom(review)>engagementLine.getBoundingClientRect().top-mindsetEngagementSafeGap;
      const setFontSize=value=>review.style.setProperty('--mf-review-fit-font-size',`${value.toFixed(3)}px`);
      let personShiftLimit=0;
      const setHorizontalGain=value=>{
        if(value<=.25){
          review.classList.remove('is-width-fit');
          review.style.removeProperty('--mf-review-copy-gain');
          review.style.removeProperty('--mf-review-person-shift');
          return;
        }
        const personShift=Math.min(value,personShiftLimit);
        review.classList.add('is-width-fit');
        review.style.setProperty('--mf-review-copy-gain',`${value.toFixed(2)}px`);
        review.style.setProperty('--mf-review-person-shift',`${personShift.toFixed(2)}px`);
      };
      const findLargestFittingFont=(minimum,maximum)=>{
        let low=minimum,high=maximum;
        setFontSize(low);
        if(collides())return low;
        for(let index=0;index<10;index+=1){
          const middle=(low+high)/2;
          setFontSize(middle);
          if(collides())high=middle;
          else low=middle;
        }
        setFontSize(low);
        return low;
      };
      const findSmallestFittingGain=maximum=>{
        if(maximum<=0)return 0;
        let low=0,high=maximum;
        setHorizontalGain(high);
        if(collides())return high;
        for(let index=0;index<10;index+=1){
          const middle=(low+high)/2;
          setHorizontalGain(middle);
          if(collides())low=middle;
          else high=middle;
        }
        setHorizontalGain(high);
        return high;
      };
      const maximumSafeHorizontalGain=()=>{
        setHorizontalGain(0);
        const person=review.querySelector('.mf-guidance-person-wrap');
        const content=review.querySelector('.mf-guidance-review-content');
        if(!person||!content||!overlayAside)return 0;
        const personRect=person.getBoundingClientRect();
        const contentRect=content.getBoundingClientRect();
        const asideRight=overlayAside.getBoundingClientRect().right;
        personShiftLimit=Math.max(0,personRect.left-asideRight-mindsetLeftSafetyGap);
        /* Once the portrait reaches its safe left boundary, exceptionally
           long reviews may also reclaim the oversized desktop column gap. */
        const gapReductionLimit=Math.max(0,contentRect.left-personRect.right-mindsetLeftSafetyGap);
        return personShiftLimit+gapReductionLimit;
      };
      const setVerticalLift=value=>{
        review.classList.toggle('is-dense-review-fit',value>.25);
        if(value>.25)review.style.setProperty('--mf-review-vertical-lift',`${value.toFixed(2)}px`);
        else review.style.removeProperty('--mf-review-vertical-lift');
      };
      const findSmallestFittingVerticalLift=maximum=>{
        if(maximum<=0)return 0;
        let low=0,high=maximum;
        setVerticalLift(high);
        if(collides())return high;
        for(let index=0;index<9;index+=1){
          const middle=(low+high)/2;
          setVerticalLift(middle);
          if(collides())low=middle;
          else high=middle;
        }
        setVerticalLift(high);
        return high;
      };

      if(collides()){
        review.classList.add('is-review-fitted');
        /* Stage 1: preserve the approved geometry and reduce only as much as
           needed, never below the normal desktop readability floor. */
        setFontSize(minimumFontSize);
        if(!collides()){
          findLargestFittingFont(minimumFontSize,baseFontSize);
        }else{
          /* Stage 2: once the readable floor is reached, widen toward the
             unused left side. The portrait/credentials travel by the same
             amount and the fixed duration label follows the final copy axis. */
          const maxHorizontalGain=maximumSafeHorizontalGain();
          setFontSize(minimumFontSize);
          findSmallestFittingGain(maxHorizontalGain);
          if(!collides()){
            findLargestFittingFont(minimumFontSize,baseFontSize);
          }else{
            /* Stage 3: only at an extreme short-height edge, compact the
               vertical rhythm and lift the copy by the smallest amount that
               clears the protected duration-label buffer. */
            setHorizontalGain(maxHorizontalGain);
            review.classList.add('is-dense-review-fit');
            findSmallestFittingVerticalLift(mindsetMaximumVerticalLift);
            if(collides()){
              /* Width and rhythm are exhausted before type crosses the normal
                 readability floor. A very small final reduction is allowed,
                 still only on this settled active review. */
              findLargestFittingFont(emergencyFontSize,minimumFontSize);
            }else{
              findLargestFittingFont(minimumFontSize,baseFontSize);
            }
          }
        }
      }

      alignEngagementLineToReview(review);
      review.classList.remove('is-measuring-review-fit');
    });
  }
  function queueSettledMindsetWidthFit(delay=90){
    clearTimeout(mindsetFitTimer);
    mindsetFitTimer=setTimeout(()=>fitSettledMindsetReviewWidth(activeReviewId),delay);
  }

  let leadershipTargetScroll=0;
  let leadershipCurrentScroll=0;
  let leadershipScrollFrame=0;
  let modeSwitching=false;

  function stopLeadershipScroll(){
    cancelAnimationFrame(leadershipScrollFrame);
    leadershipScrollFrame=0;
    leadershipCurrentScroll=reviewsHost.scrollTop;
    leadershipTargetScroll=reviewsHost.scrollTop;
  }
  /* Exact homepage-style target scrolling: normal input distance with a long,
     controlled drift rather than a reduced scroll amount. */
  function runLeadershipScroll(){
    const max=Math.max(0,reviewsHost.scrollHeight-reviewsHost.clientHeight);
    leadershipTargetScroll=Math.max(0,Math.min(max,leadershipTargetScroll));
    const distance=leadershipTargetScroll-leadershipCurrentScroll;
    if(Math.abs(distance)<.35){
      leadershipCurrentScroll=leadershipTargetScroll;
      reviewsHost.scrollTop=leadershipCurrentScroll;
      updateLeadershipVisuals();
      leadershipScrollFrame=0;
      return;
    }
    leadershipCurrentScroll+=distance*.065;
    reviewsHost.scrollTop=leadershipCurrentScroll;
    updateLeadershipVisuals();
    leadershipScrollFrame=requestAnimationFrame(runLeadershipScroll);
  }

  function updateLeadershipVisuals(){
    if(currentMode!=='leadership')return;
    const scrollRoot=mobileGuidance.matches?overlay:reviewsHost;
    const rootRect=scrollRoot.getBoundingClientRect();
    const viewportTop=mobileGuidance.matches?0:rootRect.top;
    const viewportHeight=mobileGuidance.matches?window.innerHeight:reviewsHost.clientHeight;
    const hero=reviewsHost.querySelector('.mf-leadership-hero-photo');
    if(hero){
      const rect=hero.getBoundingClientRect();
      const height=Math.max(1,rect.height);
      const travelled=viewportTop-rect.top;
      const progress=Math.max(0,Math.min(1,(travelled-height*.06)/Math.max(1,height*.76)));
      /* Hysteresis prevents tiny scroll/rounding changes around the threshold
         from rapidly enabling and disabling the RGB hover overlay. */
      const wasScrollingAway=hero.classList.contains('is-scrolling-away');
      const isScrollingAway=wasScrollingAway?progress>.004:progress>.035;
      hero.classList.toggle('is-scrolling-away',isScrollingAway);
      if(isScrollingAway)hero.querySelector('.mf-image-grid-distortion')?.classList.remove('is-active');
      hero.style.setProperty('opacity',(1-progress).toFixed(4),'important');
      hero.style.setProperty('transform',`translate3d(0,${(-28*progress).toFixed(2)}px,0)`,'important');
      hero.style.setProperty('filter',`brightness(${(1-.72*progress).toFixed(3)}) blur(${(5*progress).toFixed(2)}px)`,'important');
    }
    const next=reviewsHost.querySelector('.mf-leadership-guidance-next');
    if(next){
      const button=reviewsHost.querySelector('#mfLeadershipCopyButton');
      const buttonRect=button?.getBoundingClientRect();
      const nextRect=next.getBoundingClientRect();
      const triggerLine=viewportTop+viewportHeight*.5;
      const visible=(buttonRect?.top<=triggerLine||nextRect.top<=viewportTop+viewportHeight*.88)
        &&nextRect.bottom>viewportTop;
      next.classList.toggle('is-in-view',visible);
      next.querySelector('.mf-guidance-next-link')?.classList.toggle('is-in-view',visible);
    }
  }


  function setupGuidanceReveals(){
    guidanceObserver?.disconnect();
    const root=mobileGuidance.matches?overlay:reviewsHost;
    const targets=[...reviewsHost.querySelectorAll('.mf-guidance-review, .mf-guidance-scroll-reveal, .mf-guidance-next-link')];
    if(!targets.length)return;
    guidanceObserver=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        const rootBounds=entry.rootBounds||{top:0,height:innerHeight};
        const isNext=entry.target.classList.contains('mf-guidance-next-link');
        const visible=isNext
          ?entry.isIntersecting&&entry.boundingClientRect.top<=rootBounds.top+rootBounds.height*.52&&entry.boundingClientRect.bottom>rootBounds.top
          :entry.isIntersecting&&entry.intersectionRatio>=.12;
        entry.target.classList.toggle('is-in-view',visible);
        if(!visible&&entry.target.classList.contains('is-initial-review'))entry.target.classList.remove('is-initial-review');
      });
    },{root,rootMargin:'-4% 0px -7% 0px',threshold:[0,.12,.32,.58]});
    targets.forEach((target,index)=>{
      target.style.setProperty('--guide-delay',`${Math.min(index,6)*34}ms`);
      guidanceObserver.observe(target);
    });
  }


  let snapInFlight=false;
  let snapAnimationFrame=0;
  let mindsetWheelTotal=0;
  let mindsetWheelReset=0;
  const easeInOutCubic=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  const getDominantMindsetReview=()=>{
    const articles=[...reviewsHost.querySelectorAll('[data-review-id]')];
    if(!articles.length)return null;

    /* On mobile the overlay itself is the scrolling document and the reviews
       host expands naturally beneath the full-screen introduction. Measure
       articles against the visible overlay viewport rather than scrollTop. */
    if(mobileGuidance.matches){
      const topBar=overlay.querySelector('.mf-guidance-overlay-top');
      const viewportTop=topBar?.getBoundingClientRect().bottom||0;
      const viewportBottom=window.innerHeight;
      let best=articles[0],bestVisible=-1,bestCenter=Infinity;
      articles.forEach(article=>{
        const rect=article.getBoundingClientRect();
        const visible=Math.max(0,Math.min(rect.bottom,viewportBottom)-Math.max(rect.top,viewportTop));
        const centerDistance=Math.abs((rect.top+rect.bottom)/2-(viewportTop+viewportBottom)/2);
        if(visible>bestVisible+1||(Math.abs(visible-bestVisible)<=1&&centerDistance<bestCenter)){
          best=article;bestVisible=visible;bestCenter=centerDistance;
        }
      });
      return best;
    }

    const viewportTop=reviewsHost.scrollTop;
    const viewportBottom=viewportTop+reviewsHost.clientHeight;
    let best=articles[0],bestVisible=-1,bestCenter=Infinity;
    articles.forEach(article=>{
      const top=article.offsetTop;
      const bottom=top+article.offsetHeight;
      const visible=Math.max(0,Math.min(bottom,viewportBottom)-Math.max(top,viewportTop));
      const centerDistance=Math.abs((top+bottom)/2-(viewportTop+viewportBottom)/2);
      if(visible>bestVisible+1||(Math.abs(visible-bestVisible)<=1&&centerDistance<bestCenter)){
        best=article;bestVisible=visible;bestCenter=centerDistance;
      }
    });
    return best;
  };
  function animateGuidanceScroll(targetOrDestination,duration=760){
    cancelAnimationFrame(snapAnimationFrame);
    cancelAnimationFrame(mindsetFitFrame);
    clearTimeout(mindsetFitTimer);
    snapInFlight=true;

    /* Reset the outgoing review under a no-transition guard, then wait two
       paint frames before reading the destination. Fitted reviews can be much
       shorter than their base layout; measuring immediately would capture a
       stale offset and leave the next review stranded halfway down the page. */
    overlay.classList.remove('is-fit-preparing');
    overlay.classList.add('is-fit-preparing');
    resetMindsetReviewWidths();
    void reviewsHost.offsetHeight;

    snapAnimationFrame=requestAnimationFrame(()=>{
      snapAnimationFrame=requestAnimationFrame(()=>{
        const targetElement=typeof targetOrDestination==='number'?null:targetOrDestination;
        const fixedDestination=typeof targetOrDestination==='number'?targetOrDestination:0;
        const readDestination=()=>targetElement?.offsetTop??fixedDestination;
        const start=reviewsHost.scrollTop;
        const initialDistance=readDestination()-start;

        if(Math.abs(initialDistance)<2){
          reviewsHost.scrollTop=readDestination();
          overlay.classList.remove('is-fit-preparing');
          snapInFlight=false;
          const target=getDominantMindsetReview();
          if(target){markActiveReview(target.dataset.reviewId);queueSettledMindsetWidthFit();}
          return;
        }

        const started=performance.now();
        const frame=now=>{
          const progress=Math.min(1,(now-started)/duration);
          const liveDestination=readDestination();
          reviewsHost.scrollTop=start+(liveDestination-start)*easeInOutCubic(progress);
          if(progress<1){snapAnimationFrame=requestAnimationFrame(frame);return;}
          reviewsHost.scrollTop=readDestination();
          overlay.classList.remove('is-fit-preparing');
          snapInFlight=false;
          const target=getDominantMindsetReview();
          if(target){markActiveReview(target.dataset.reviewId);queueSettledMindsetWidthFit();}
        };
        snapAnimationFrame=requestAnimationFrame(frame);
      });
    });
  }

  function scrollToMindsetReview(next){
    const articles=[...reviewsHost.querySelectorAll('[data-review-id]')];
    if(!articles.length||snapInFlight)return;
    next=Math.max(0,Math.min(articles.length-1,next));
    const currentIndex=Math.max(0,articles.findIndex(article=>article.dataset.reviewId===activeReviewId));
    if(next===currentIndex)return;
    clearTimeout(snapTimer);
    mindsetWheelTotal=0;
    animateGuidanceScroll(articles[next],760);
  }
  function settleMindsetReview(){
    if(currentMode!=='mindset'||mobileGuidance.matches||!overlay.classList.contains('is-open')||snapInFlight)return;
    const target=getDominantMindsetReview();
    if(!target)return;
    markActiveReview(target.dataset.reviewId);
    animateGuidanceScroll(target,760);
  }
  function queueMindsetSettle(){
    if(currentMode!=='mindset'||mobileGuidance.matches||snapInFlight)return;
    clearTimeout(snapTimer);
    snapTimer=setTimeout(settleMindsetReview,150);
  }

  function stopGuidanceAscii(){
    clearInterval(asciiTimer);
    asciiTimer=0;
    overlay.querySelectorAll('.mf-guidance-ascii').forEach(node=>node.remove());
  }
  function startGuidanceAscii(){
    stopGuidanceAscii();
    if(currentMode!=='leadership')return;
    const glyphs=['+ +','001101','// MF','[LEAD]','<>_','0xFF',':::','* * *'];
    asciiTimer=setInterval(()=>{
      if(!overlay.classList.contains('is-open')||document.hidden)return;
      const host=reviewsHost.querySelector('.mf-leadership-page');
      if(!host)return;
      const node=document.createElement('span');
      node.className='mf-guidance-ascii';
      node.textContent=glyphs[Math.floor(Math.random()*glyphs.length)];
      node.style.left=`${8+Math.random()*84}%`;
      node.style.top=`${Math.max(12,Math.min(92,((reviewsHost.scrollTop+Math.random()*reviewsHost.clientHeight)/Math.max(1,host.scrollHeight))*100))}%`;
      host.appendChild(node);
      requestAnimationFrame(()=>node.classList.add('is-visible'));
      setTimeout(()=>node.remove(),950);
    },2300);
  }

  const markActiveReview=id=>{
    if(!id)return;
    activeReviewId=id;
    let activeArticle=null;
    reviewsHost.querySelectorAll('[data-review-id]').forEach(review=>{
      const active=review.dataset.reviewId===id;
      review.classList.toggle('is-active-review',active);
      if(active)activeArticle=review;
    });
    const engagementSource=activeArticle?.querySelector('.mf-guidance-engagement');
    const engagementText=engagementSource?.textContent?.trim()||'';
    engagementLine.textContent=engagementText;
    engagementLine.classList.toggle('has-text',Boolean(engagementText));
    if(engagementText)requestAnimationFrame(()=>alignEngagementLineToReview(activeArticle));
    else resetEngagementLineGeometry();
    reviewNav.querySelectorAll('[data-review-target]').forEach(button=>{
      /* Mobile shows the submenu as a neutral jump index. No person is
         visually selected while the reviews flow beneath it. */
      const active=!mobileGuidance.matches&&button.dataset.reviewTarget===id;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-current',active?'true':'false');
    });
  };
  const updateActiveReview=()=>{
    reviewScrollFrame=0;
    if(currentMode!=='mindset')return;
    const dominant=getDominantMindsetReview();
    if(dominant)markActiveReview(dominant.dataset.reviewId);
  };
  const scheduleReviewTracking=()=>{ if(!reviewScrollFrame)reviewScrollFrame=requestAnimationFrame(updateActiveReview); };
  const supportsScrollEnd='onscrollend' in reviewsHost;
  reviewsHost.addEventListener('scroll',()=>{
    scheduleReviewTracking();
    if(currentMode==='leadership'){
      if(!leadershipScrollFrame){
        leadershipTargetScroll=reviewsHost.scrollTop;
        leadershipCurrentScroll=reviewsHost.scrollTop;
      }
      updateLeadershipVisuals();
    }
    if(!supportsScrollEnd)queueMindsetSettle();
  },{passive:true});
  if(supportsScrollEnd)reviewsHost.addEventListener('scrollend',settleMindsetReview,{passive:true});
  reviewsHost.addEventListener('wheel',event=>{
    if(mobileGuidance.matches||!overlay.classList.contains('is-open'))return;
    if(currentMode==='leadership'){
      event.preventDefault();
      const unit=event.deltaMode===1?16:event.deltaMode===2?reviewsHost.clientHeight:1;
      if(!leadershipScrollFrame){
        leadershipTargetScroll=reviewsHost.scrollTop;
        leadershipCurrentScroll=reviewsHost.scrollTop;
      }
      leadershipTargetScroll+=event.deltaY*unit*1.4;
      if(!leadershipScrollFrame)leadershipScrollFrame=requestAnimationFrame(runLeadershipScroll);
      return;
    }
    if(currentMode!=='mindset')return;
    event.preventDefault();
    if(snapInFlight)return;
    mindsetWheelTotal+=event.deltaY;
    clearTimeout(mindsetWheelReset);
    mindsetWheelReset=setTimeout(()=>{mindsetWheelTotal=0;},140);
    if(Math.abs(mindsetWheelTotal)<34)return;
    const articles=[...reviewsHost.querySelectorAll('[data-review-id]')];
    if(!articles.length)return;
    const activeIndex=articles.findIndex(article=>article.dataset.reviewId===activeReviewId);
    const currentIndex=activeIndex>=0?activeIndex:Math.max(0,articles.indexOf(getDominantMindsetReview()));
    const direction=mindsetWheelTotal>0?1:-1;
    mindsetWheelTotal=0;
    scrollToMindsetReview(currentIndex+direction);
  },{passive:false});
  overlay.addEventListener('scroll',()=>{
    scheduleReviewTracking();
    if(currentMode==='leadership')updateLeadershipVisuals();
  },{passive:true});
  reviewsHost.addEventListener('scroll',()=>{
    if(currentMode==='leadership')updateLeadershipVisuals();
  },{passive:true});

  function fitGuidanceNextLinks(){
    requestAnimationFrame(()=>{
      reviewsHost.querySelectorAll('.mf-guidance-next-link').forEach(link=>{
        const label=link.querySelector('.mf-guidance-next-label');
        const arrow=link.querySelector('.mf-guidance-next-arrow');
        if(!label||!arrow)return;
        const mobile=mobileGuidance.matches;
        const base=mobile?Math.min(78,window.innerWidth*.14):Math.min(128,window.innerWidth*.0725);
        const minimum=mobile?28:38;
        link.style.setProperty('font-size',`${base}px`,'important');
        const available=Math.max(1,link.clientWidth);
        const needed=Math.max(1,label.scrollWidth+arrow.scrollWidth+12);
        const fitted=Math.max(minimum,Math.min(base,base*(available/needed)*.91));
        link.style.setProperty('--guidance-next-size',`${fitted.toFixed(2)}px`);
        link.style.removeProperty('font-size');
      });
    });
  }
  window.addEventListener('resize',fitGuidanceNextLinks,{passive:true});

  function bindReviewParts(){
    reviewsHost.querySelectorAll('.mf-guidance-copy-shell').forEach(shell=>{
      const buttons=[...shell.querySelectorAll('[data-review-part]')];
      const panels=[...shell.querySelectorAll('[data-review-part-panel]')];
      if(buttons.length<2||panels.length<2)return;
      let active=0,switching=false;
      buttons.forEach(button=>button.addEventListener('click',()=>{
        const next=Number(button.dataset.reviewPart);
        if(switching||next===active||!panels[next])return;
        switching=true;
        panels[active].classList.add('is-leaving');
        setTimeout(()=>{
          panels[active].classList.remove('is-active','is-leaving');
          panels[active].setAttribute('aria-hidden','true');
          panels[next].classList.add('is-active','is-entering');
          panels[next].setAttribute('aria-hidden','false');
          buttons.forEach((item,index)=>item.classList.toggle('is-active',index===next));
          requestAnimationFrame(()=>requestAnimationFrame(()=>panels[next].classList.remove('is-entering')));
          active=next;
          queueSettledMindsetWidthFit(40);
          setTimeout(()=>{switching=false;},220);
        },130);
      }));
    });
  }

  function bindMindset(){
    bindReviewParts();
    reviewNav.querySelectorAll('[data-review-target]').forEach(button=>button.addEventListener('click',()=>{
      if(overlay.classList.contains('is-compact-review-nav')&&!overlay.classList.contains('is-review-nav-open')&&button.classList.contains('is-active')){
        overlay.classList.add('is-review-nav-open');
        button.setAttribute('aria-expanded','true');
        return;
      }
      const target=document.getElementById(`guidance-review-${button.dataset.reviewTarget}`);
      if(!target)return;
      markActiveReview(button.dataset.reviewTarget);
      closeCompactReviewNav();

      if(mobileGuidance.matches){
        const topBar=overlay.querySelector('.mf-guidance-overlay-top');
        const topOffset=topBar?.offsetHeight||0;
        const destination=overlay.scrollTop+target.getBoundingClientRect().top-overlay.getBoundingClientRect().top-topOffset;
        overlay.scrollTo({top:Math.max(0,destination),behavior:'smooth'});
        return;
      }

      animateGuidanceScroll(target,760);
    }));
  }

  function bindLeadership(){
    const detail=reviewsHost.querySelector('#mfLeadershipReviewDetail');
    const strip=reviewsHost.querySelector('.mf-leadership-people-strip');
    if(!detail||!strip)return;

    const paint=(id,animate=true)=>{
      const entry=leadershipEntries.find(item=>item.id===id)||leadershipEntries[0];
      if(!entry)return;
      const cards=[...strip.querySelectorAll('[data-leadership-person]')];
      const clicked=cards.find(card=>card.dataset.leadershipPerson===entry.id);
      if(!clicked)return;

      const firstRects=new Map(cards.map(card=>[card,card.getBoundingClientRect()]));
      while(strip.firstElementChild!==clicked)strip.appendChild(strip.firstElementChild);
      const reordered=[...strip.querySelectorAll('[data-leadership-person]')];
      const lastRects=new Map(reordered.map(card=>[card,card.getBoundingClientRect()]));
      reordered.forEach(card=>{
        const first=firstRects.get(card),last=lastRects.get(card);
        if(!first||!last)return;
        card.style.transition='none';
        card.style.transform=`translate3d(${first.left-last.left}px,${first.top-last.top}px,0)`;
      });
      strip.offsetHeight;
      reordered.forEach(card=>{
        card.style.transition='transform .78s cubic-bezier(.16,1,.3,1), opacity .48s cubic-bezier(.16,1,.3,1), flex-basis .72s cubic-bezier(.16,1,.3,1), width .72s cubic-bezier(.16,1,.3,1)';
        card.style.transform='translate3d(0,0,0)';
        const active=card===clicked;
        card.classList.toggle('is-active',active);
        card.setAttribute('aria-pressed',active?'true':'false');
      });
      strip.scrollTo({left:0,behavior:'smooth'});

      const swap=()=>{
        detail.innerHTML=leadershipDetailMarkup(entry);
        const panel=detail.querySelector('.mf-leadership-review-expanded');
        requestAnimationFrame(()=>requestAnimationFrame(()=>{panel?.classList.add('is-visible');}));
      };
      if(!animate){swap();return;}
      detail.classList.add('is-switching');
      setTimeout(()=>{swap();detail.classList.remove('is-switching');},150);
    };

    strip.addEventListener('click',event=>{
      const card=event.target.closest('[data-leadership-person]');
      if(card)paint(card.dataset.leadershipPerson,true);
    });
    const first=strip.querySelector('[data-leadership-person]');
    if(first)paint(first.dataset.leadershipPerson,false);

    const copyBtn=reviewsHost.querySelector('#mfLeadershipCopyButton');
    let copyClicks=0;
    copyBtn?.addEventListener('click',async()=>{
      copyClicks+=1;
      if(copyClicks>=3){
        copyBtn.classList.add('is-removing');
        copyBtn.disabled=true;
        copyBtn.setAttribute('aria-hidden','true');
        copyBtn.tabIndex=-1;
        return;
      }

      const email='email@marianfusek.com';
      let copied=false;
      try{
        await navigator.clipboard.writeText(email);
        copied=true;
      }catch(_){
        const helper=document.createElement('textarea');
        helper.value=email;
        helper.setAttribute('readonly','');
        helper.style.position='fixed';
        helper.style.opacity='0';
        document.body.appendChild(helper);
        helper.select();
        try{ copied=document.execCommand('copy'); }catch(__){ copied=false; }
        helper.remove();
      }
      if(!copied){
        copyBtn.textContent='Copy email@marianfusek.com';
        copyClicks=Math.max(0,copyClicks-1);
        return;
      }
      copyBtn.textContent=copyClicks===1
        ?'EMAIL COPIED TO YOUR CLIPBOARD...'
        :"ONCE MORE & I'M GONE!";
    });
  }

  function render(mode){
    currentMode=mode in modes?mode:'mindset';
    overlay.classList.toggle('is-leadership',currentMode==='leadership');
    overlay.classList.toggle('is-mindset',currentMode==='mindset');
    const config=modes[currentMode];
    overlayTitle.innerHTML=config.title;
    kicker.textContent="";
    overlayIntro.textContent=config.intro;
    reviewsHost.scrollTop=0;
    overlay.scrollTop=0;
    activeReviewId='';
    engagementLine.textContent='';
    engagementLine.classList.remove('has-text');
    resetEngagementLineGeometry();
    overlay.classList.remove('is-compact-review-nav','is-review-nav-open');
    mindsetWheelTotal=0;
    clearTimeout(mindsetWheelReset);

    if(currentMode==='mindset'){
      const ordered=config.order.map(id=>id===mindsetNextEntry.id?mindsetNextEntry:mindsetEntries.find(entry=>entry.id===id)).filter(Boolean);
      reviewNav.innerHTML=ordered.map((entry,index)=>entry.type==='next'
        ?`<button class="is-guidance-next-nav" type="button" data-review-target="${entry.id}"><span>${String(index+1).padStart(2,'0')}</span><span>NEXT: Team Leadership →</span><span></span></button>`
        :`<button type="button" data-review-target="${entry.id}"><span>${String(index+1).padStart(2,'0')}</span><span>${escapeHtml(entry.name)}</span><span>${flagMarkup(entry.flag)}</span></button>`).join('');
      reviewsHost.innerHTML=ordered.map(reviewMarkup).join('');
      const initialReview=reviewsHost.querySelector('[data-review-id]');
      initialReview?.classList.add('is-initial-review');
      if(initialReview)reviewsHost.scrollTop=initialReview.offsetTop;
      bindMindset();
      markActiveReview(ordered[0]?.id);
      scheduleReviewTracking();
      requestAnimationFrame(()=>{
        setupGuidanceReveals();
        fitGuidanceNextLinks();
        scheduleCompactReviewNav();
        requestAnimationFrame(()=>queueSettledMindsetWidthFit(120));
      });
      return;
    }

    reviewNav.innerHTML='';
    reviewsHost.innerHTML=leadershipContent();
    armLeadershipHeroImage();
    leadershipTargetScroll=0;
    leadershipCurrentScroll=0;
    bindLeadership();
    requestAnimationFrame(()=>{
      setupGuidanceReveals();
      fitGuidanceNextLinks();
      updateLeadershipVisuals();
      startGuidanceAscii();
    });
  }

  async function transitionGuidanceMode(mode){
    if(modeSwitching||mode===currentMode)return;
    if(mode==='leadership')preloadLeadershipHero();
    modeSwitching=true;
    stopLeadershipScroll();
    overlay.classList.add('is-mode-switching');
    await wait(330);
    render(mode);
    overlay.classList.remove('is-mode-switching');
    overlay.classList.add('is-mode-entering');
    requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.remove('is-mode-entering')));
    setTimeout(()=>{modeSwitching=false;},620);
  }

  function open(mode){
    if(mode==='leadership')preloadLeadershipHero();
    guidanceReturnY=window.scrollY+guidanceSection.getBoundingClientRect().top;
    render(mode);
    overlay.setAttribute('aria-hidden','false');
    document.body.classList.add('mf-guidance-open');
    overlay.classList.add('is-entering');
    if(currentMode==='mindset'){
      overlay.classList.add('is-fit-preparing');
      fitSettledMindsetReviewWidth(activeReviewId);
    }
    requestAnimationFrame(()=>{
      overlay.classList.add('is-open');
      scheduleCompactReviewNav();
      requestAnimationFrame(()=>overlay.classList.remove('is-fit-preparing'));
    });
    setTimeout(()=>overlay.classList.remove('is-entering'),1150);
    setTimeout(()=>reviewsHost.focus({preventScroll:true}),360);
  }
  function close(){
    stopGuidanceAscii();
    stopLeadershipScroll();
    guidanceObserver?.disconnect();
    overlay.classList.remove('is-open','is-entering','is-compact-review-nav','is-review-nav-open');
    resetMindsetReviewWidths();
    engagementLine.textContent='';
    engagementLine.classList.remove('has-text');
    resetEngagementLineGeometry();
    overlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('mf-guidance-open');
    requestAnimationFrame(()=>window.scrollTo({top:guidanceReturnY,behavior:'auto'}));
  }

  reviewsHost.addEventListener('click',event=>{
    const next=event.target.closest('[data-guidance-next]');
    if(next)transitionGuidanceMode(next.dataset.guidanceNext);
  });

  document.querySelectorAll('[data-guidance]').forEach(button=>{
    if(button.dataset.guidance==='leadership'){
      button.addEventListener('pointerenter',preloadLeadershipHero,{passive:true});
      button.addEventListener('focus',preloadLeadershipHero,{passive:true});
    }
    button.addEventListener('click',()=>open(button.dataset.guidance));
  });
  closeButton.addEventListener('click',close);
  let mindsetLayoutResizeTimer=0;
  window.addEventListener('resize',()=>{
    scheduleCompactReviewNav();
    clearTimeout(mindsetLayoutResizeTimer);
    /* Keep the current fit in place while the viewport is moving, then replace
       it atomically after the new geometry settles. This prevents a visible
       large-small flash during manual window-height adjustments. */
    mindsetLayoutResizeTimer=setTimeout(()=>queueSettledMindsetWidthFit(0),110);
  },{passive:true});
  document.fonts?.ready?.then(()=>{
    scheduleCompactReviewNav();
    queueSettledMindsetWidthFit(40);
  });
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&overlay.classList.contains('is-open'))close();});
})();

/* BIO TABS — slower sequential fade, stable on desktop and mobile */
(function(){
  const menu=document.querySelector('.mf-bio-menu');
  const wrapper=document.getElementById('mfBioPanels');
  if(!menu||!wrapper)return;

  const buttons=[...menu.querySelectorAll('[data-bio-tab]')];
  const panels=[...wrapper.querySelectorAll('[data-bio-panel]')];
  const about=document.querySelector('.mf-about');
  const photoWrap=about?.querySelector('.mf-photo-wrap');
  let active=wrapper.querySelector('.mf-bio-panel.is-active')||panels[0];
  let switching=false;

  function setBioMode(key){
    const expanded=key==='heresy';
    about?.classList.toggle('is-bio-expanded',expanded);
    if(photoWrap){
      photoWrap.inert=expanded;
      photoWrap.setAttribute('aria-hidden',expanded?'true':'false');
    }
  }

  panels.forEach(panel=>{
    const selected=panel===active;
    panel.setAttribute('aria-hidden',selected?'false':'true');
    panel.inert=!selected;
  });
  setBioMode(active?.dataset.bioPanel||'101');

  function setMenu(key){
    buttons.forEach(button=>{
      const selected=button.dataset.bioTab===key;
      button.classList.toggle('is-active',selected);
      button.setAttribute('aria-selected',selected?'true':'false');
    });
  }

  const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

  async function showPanel(key){
    const next=wrapper.querySelector(`[data-bio-panel="${key}"]`);
    if(!next||next===active||switching)return;
    switching=true;
    setMenu(key);

    const outgoing=active;
    const outAnimation=outgoing.animate(
      [{opacity:1},{opacity:0}],
      {duration:330,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'}
    );
    await outAnimation.finished.catch(()=>{});
    outAnimation.cancel();

    outgoing.classList.remove('is-active');
    outgoing.setAttribute('aria-hidden','true');
    outgoing.inert=true;

    next.style.opacity='0';
    next.classList.add('is-active');
    next.setAttribute('aria-hidden','false');
    next.inert=false;
    setBioMode(key);
    await nextFrame();

    const inAnimation=next.animate(
      [{opacity:0},{opacity:1}],
      {duration:620,easing:'cubic-bezier(.16,1,.3,1)',fill:'forwards'}
    );
    await inAnimation.finished.catch(()=>{});
    inAnimation.cancel();
    next.style.opacity='';

    active=next;
    switching=false;
  }

  buttons.forEach(button=>button.addEventListener('click',()=>showPanel(button.dataset.bioTab)));
})();


/* BIO / HERESY — click-to-expand editorial list */
(function(){
  const heresy=document.getElementById('mfHeresyList');
  if(!heresy)return;
  const items=[...heresy.querySelectorAll('.mf-heresy-item')];
  const close=item=>{
    item.classList.remove('is-open');
    item.querySelector('.mf-heresy-trigger')?.setAttribute('aria-expanded','false');
    item.querySelector('.mf-heresy-reveal')?.setAttribute('aria-hidden','true');
  };
  items.forEach(item=>{
    const trigger=item.querySelector('.mf-heresy-trigger');
    trigger?.addEventListener('click',()=>{
      const opening=!item.classList.contains('is-open');
      items.forEach(other=>close(other));
      if(opening){
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded','true');
        item.querySelector('.mf-heresy-reveal')?.setAttribute('aria-hidden','false');
      }
    });
  });
})();

/* VARIABLE PROXIMITY — word-safe, link-safe BIO copy */
(function(){
  const container=document.querySelector('.mf-about-text');
  if(!container)return;
  const radius=120;

  function wrapTextNode(node){
    const text=node.nodeValue;
    if(!text||!text.trim())return;
    const fragment=document.createDocumentFragment();
    const tokens=text.split(/(\s+)/);
    tokens.forEach(token=>{
      if(!token)return;
      if(/^\s+$/.test(token)){fragment.appendChild(document.createTextNode(token));return;}
      const word=document.createElement('span');
      word.className='vp-word';
      [...token].forEach(ch=>{
        const span=document.createElement('span');
        span.className='vp-char';
        span.setAttribute('aria-hidden','true');
        span.textContent=ch;
        word.appendChild(span);
      });
      fragment.appendChild(word);
    });
    node.replaceWith(fragment);
  }

  container.querySelectorAll('.mf-bio-panel:not([data-bio-panel="heresy"]) p, .mf-bio-panel:not([data-bio-panel="heresy"]) .mf-about-note').forEach(el=>{
    el.setAttribute('aria-label',el.textContent.trim());
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode(node){
      return node.parentElement?.closest('.vp-word')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;
    }});
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(wrapTextNode);
  });

  let mouse={x:-9999,y:-9999},raf=0;
  function update(){
    raf=0;
    container.querySelectorAll('.mf-bio-panel.is-active .vp-char').forEach(char=>{
      const r=char.getBoundingClientRect();
      const dx=mouse.x-(r.left+r.width/2),dy=mouse.y-(r.top+r.height/2);
      const d=Math.sqrt(dx*dx+dy*dy);
      const n=Math.max(0,Math.min(1,1-d/radius));
      const wght=400+(650-400)*n;
      char.style.fontVariationSettings=`'wght' ${wght}, 'opsz' ${9+(40-9)*n}`;
      char.style.fontWeight=String(Math.round(wght));
      char.style.opacity=String(.68+(.32*n));
    });
  }
  container.addEventListener('pointermove',event=>{mouse={x:event.clientX,y:event.clientY};if(!raf)raf=requestAnimationFrame(update);});
  container.addEventListener('pointerleave',()=>{mouse={x:-9999,y:-9999};if(!raf)raf=requestAnimationFrame(update);});
})();

/* Mobile practice titles are rendered as one literal line so normal word
   spacing is preserved instead of stretching two independent flex items. */
(function(){
  document.querySelectorAll('.mf-roll').forEach(row=>{
    if(row.querySelector('.mf-roll-mobile-label'))return;
    const left=row.querySelector('.mf-roll-left')?.textContent.trim()||'';
    const right=row.querySelector('.mf-roll-right')?.textContent.trim()||'';
    const label=document.createElement('span');
    label.className='mf-roll-mobile-label';
    label.textContent=`${left} ${right}`.trim();
    row.appendChild(label);
  });
})();

/* PRACTICE ROLL */
function positionRollCopies(){
  if(window.matchMedia("(max-width: 1024px), (pointer: coarse)").matches)return;
  document.querySelectorAll(".mf-roll").forEach(row=>{const left=row.querySelector(".mf-roll-left"),right=row.querySelector(".mf-roll-right");if(!left||!right)return;const rowRect=row.getBoundingClientRect(),leftRect=left.getBoundingClientRect(),rightRect=right.getBoundingClientRect();const center=((leftRect.right+rightRect.left)/2)-rowRect.left;row.style.setProperty("--copy-x",center+"px");});
}
positionRollCopies();
window.addEventListener("resize",positionRollCopies);
document.querySelectorAll(".mf-roll").forEach(row=>{["mouseenter","mouseleave"].forEach(event=>{row.addEventListener(event,()=>{requestAnimationFrame(positionRollCopies);[100,200,300,400,500,600,700].forEach(ms=>setTimeout(positionRollCopies,ms));});});});

/* Mobile / small-tablet expertise rows open by tap. The selected explanation
   appears above its own large type and naturally pushes the rows below down. */
(function(){
  const mobileRolls=window.matchMedia("(max-width: 1024px)");
  const rows=[...document.querySelectorAll(".mf-roll")];
  if(!rows.length)return;
  rows.forEach(row=>{
    row.setAttribute("tabindex","0");
    row.setAttribute("role","button");
    row.setAttribute("aria-expanded","false");
    const toggle=()=>{
      if(!mobileRolls.matches)return;
      const opening=!row.classList.contains("is-mobile-open");
      rows.forEach(other=>{
        other.classList.remove("is-mobile-open");
        other.setAttribute("aria-expanded","false");
      });
      if(opening){
        row.classList.add("is-mobile-open");
        row.setAttribute("aria-expanded","true");
      }
    };
    row.addEventListener("click",toggle);
    row.addEventListener("keydown",event=>{
      if(event.key==="Enter"||event.key===" "){
        event.preventDefault();
        toggle();
      }
    });
  });
  mobileRolls.addEventListener?.("change",event=>{
    if(event.matches)return;
    rows.forEach(row=>{
      row.classList.remove("is-mobile-open");
      row.setAttribute("aria-expanded","false");
    });
  });
})();

/* Mobile big-type fitting: one stable shared size measured from the literal
   longest title. It only recalculates when viewport width changes, so Safari's
   address-bar height animation cannot resize or clip the rows mid-scroll. */
(function(){
  const mobile=window.matchMedia("(max-width: 1024px)");
  const rows=[...document.querySelectorAll(".mf-roll")];
  if(!rows.length)return;
  let resizeTimer=0,lastWidth=0;
  const measurer=document.createElement('span');
  measurer.setAttribute('aria-hidden','true');
  measurer.style.cssText='position:fixed;left:-99999px;top:0;display:block;width:max-content;white-space:nowrap;visibility:hidden;pointer-events:none;font-family:Geist,Arial,sans-serif;font-weight:850;line-height:.74;letter-spacing:-.08em;text-transform:uppercase;';
  document.body.appendChild(measurer);
  function fit(force=false){
    if(!mobile.matches){rows.forEach(row=>row.style.removeProperty("--mobile-roll-size"));return;}
    const width=Math.round(document.documentElement.clientWidth||window.innerWidth);
    if(!force&&Math.abs(width-lastWidth)<3)return;
    lastWidth=width;
    const available=Math.max(240,width-28);
    const labels=rows.map(row=>row.querySelector('.mf-roll-mobile-label')).filter(Boolean);
    let widest=1;
    measurer.style.fontSize='100px';
    labels.forEach(label=>{
      measurer.textContent=label.textContent;
      widest=Math.max(widest,measurer.getBoundingClientRect().width);
    });
    const shared=Math.max(27,Math.min(96,100*available/widest));
    rows.forEach(row=>row.style.setProperty('--mobile-roll-size',`${shared.toFixed(2)}px`));
  }
  const queue=()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>fit(false),100);};
  if(document.fonts?.ready)document.fonts.ready.then(()=>fit(true));else setTimeout(()=>fit(true),220);
  window.addEventListener('resize',queue,{passive:true});
  mobile.addEventListener?.('change',()=>fit(true));
})();

/* XP SHAPE — fast particles, two-second hover morphs, lively breathing */
(function(){
  const container=document.getElementById("xpShape");
  if(!container||typeof p5==="undefined")return;
  const COUNT=window.matchMedia("(max-width: 1024px)").matches?110:760;
  const SHAPE_MAP={independent:"triangle",coach:"heart",strv:"fourStar",symbio:"sinusoid",fg:"spiral"};
  let currentShape="circle",targetShape="circle",morphFrom="circle";
  let morphStarted=0,morphDuration=2000,isMorphing=false,isHovering=false;

  const sketch=p=>{
    let particles=[],R=0;
    let lastCanvasWidth=0;
    p.setup=()=>{
      p.pixelDensity(window.matchMedia('(max-width: 1024px)').matches?1:Math.min(window.devicePixelRatio||1,2));
      lastCanvasWidth=container.offsetWidth;
      const cnv=p.createCanvas(container.offsetWidth,container.offsetHeight);
      cnv.parent(container);
      p.colorMode(p.HSB,360,100,100,1);
      R=Math.min(p.width,p.height)*.351;
      for(let i=0;i<COUNT;i++)particles.push({
        pos:p.createVector(p.random(-R,R),p.random(-R,R)),
        vel:p.createVector(p.random(-1.2,1.2),p.random(-1.2,1.2)),
        acc:p.createVector(0,0),
        sz:p.random(.55,2.35),
        alpha:p.random(.18,.82),
        trail:p.random(1.8,5.8),
        phase:p.random(p.TWO_PI),
        phase2:p.random(p.TWO_PI)
      });
    };

    p.draw=()=>{
      p.clear();
      p.translate(p.width/2,p.height/2);

      let morphT=1;
      if(isMorphing){
        morphT=Math.min(1,(p.millis()-morphStarted)/morphDuration);
        if(morphT>=1){isMorphing=false;currentShape=targetShape;morphFrom=targetShape;}
      }
      const eased=easeInOut(morphT);
      const breathe=1+Math.sin(p.frameCount*.045)*.032;
      const speed=isHovering?18:8.5;
      const force=isHovering?1.35:.58;
      const damping=isHovering?.86:.9;

      particles.forEach((pt,i)=>{
        const angle=p.map(i,0,COUNT,0,p.TWO_PI);
        const from=shapePos(p,isMorphing?morphFrom:currentShape,angle,R*breathe);
        const to=shapePos(p,isMorphing?targetShape:currentShape,angle,R*breathe);
        const target=isMorphing?p5.Vector.lerp(from,to,eased):to;

        /* Visible, fluid wiggle: alive rather than jittery. */
        const driftAmp=isHovering?7.5:10.5;
        target.x+=Math.sin(p.frameCount*.052+pt.phase)*driftAmp;
        target.y+=Math.cos(p.frameCount*.044+pt.phase2)*driftAmp;

        const desired=p5.Vector.sub(target,pt.pos);
        const dist=desired.mag();
        if(dist>.01)desired.setMag(Math.min(speed,Math.max(.75,dist*.48)));
        const steer=p5.Vector.sub(desired,pt.vel).limit(force);
        pt.acc.add(steer);
        pt.vel.add(pt.acc).mult(damping).limit(speed);
        pt.pos.add(pt.vel);
        pt.acc.mult(0);

        const motion=Math.min(1,pt.vel.mag()/Math.max(speed,.01));
        const lightStudy=document.body.classList.contains('mf-cloud-study');

        /* Fine motion trail: only becomes visible while particles travel. */
        if(motion>.06){
          lightStudy?p.stroke(198,24,43,Math.min(.82,pt.alpha*motion*.72)):p.stroke(0,0,98,pt.alpha*motion*.34);
          p.strokeWeight(Math.max(.28,pt.sz*.42));
          p.line(
            pt.pos.x-pt.vel.x*pt.trail,
            pt.pos.y-pt.vel.y*pt.trail,
            pt.pos.x,
            pt.pos.y
          );
        }

        p.noStroke();
        lightStudy?p.fill(198,25,46,Math.min(.98,pt.alpha+.24+motion*.2)):p.fill(0,0,98,Math.min(.94,pt.alpha+motion*.16));
        p.circle(pt.pos.x,pt.pos.y,pt.sz*(1+motion*.14));
      });
    };

    p.windowResized=()=>{
      const nextWidth=container.offsetWidth;
      if(Math.abs(nextWidth-lastCanvasWidth)<4)return;
      lastCanvasWidth=nextWidth;
      p.resizeCanvas(nextWidth,container.offsetHeight);
      R=Math.min(p.width,p.height)*.351;
    };

    window._xpMorph=(shape,hovering)=>{
      isHovering=hovering;
      morphFrom=currentShape;
      targetShape=shape;
      morphStarted=p.millis();
      morphDuration=hovering?900:650;
      isMorphing=true;
    };
  };

  const xpCanvas=new p5(sketch,container);
  const xpSection=document.getElementById("xp");
  let xpVisible=true;
  const syncXpLoop=()=>{
    if(xpVisible&&!document.hidden)xpCanvas.loop();
    else xpCanvas.noLoop();
  };
  if(xpSection){
    const xpObserver=new IntersectionObserver(entries=>{
      xpVisible=!!entries[0]?.isIntersecting;
      syncXpLoop();
    },{rootMargin:"20% 0px",threshold:0});
    xpObserver.observe(xpSection);
  }
  document.addEventListener("visibilitychange",syncXpLoop);
  const track=document.getElementById("timelineItems");
  if(track)track.querySelectorAll(".mf-xp-card").forEach(card=>{
    const shape=SHAPE_MAP[card.dataset.xpEffect]||"circle";
    card.addEventListener("mouseenter",()=>window._xpMorph&&window._xpMorph(shape,true));
    card.addEventListener("mouseleave",()=>window._xpMorph&&window._xpMorph("circle",false));
  });

  function shapePos(p,shape,angle,r){
    switch(shape){
      case"circle":return p.createVector(p.cos(angle)*r*.8,p.sin(angle)*r*.8);
      case"triangle":{
        const a=((angle-p.PI/2)%p.TWO_PI+p.TWO_PI)%p.TWO_PI,side=Math.floor(a/(p.TWO_PI/3)),t=(a%(p.TWO_PI/3))/(p.TWO_PI/3);
        return p5.Vector.lerp(p.createVector(p.cos(side*p.TWO_PI/3-p.PI/2)*r,p.sin(side*p.TWO_PI/3-p.PI/2)*r),p.createVector(p.cos((side+1)*p.TWO_PI/3-p.PI/2)*r,p.sin((side+1)*p.TWO_PI/3-p.PI/2)*r),t);
      }
      case"heart":{
        const u=((angle%p.TWO_PI)+p.TWO_PI)%p.TWO_PI/p.TWO_PI;
        const pts=[
          p.createVector(0,r*.68),p.createVector(-r*.78,r*.08),p.createVector(-r*.82,-r*.42),
          p.createVector(-r*.48,-r*.72),p.createVector(0,-r*.38),p.createVector(r*.48,-r*.72),
          p.createVector(r*.82,-r*.42),p.createVector(r*.78,r*.08)
        ];
        const pos=u*pts.length,seg=Math.floor(pos)%pts.length,t=pos-Math.floor(pos);
        return p5.Vector.lerp(pts[seg],pts[(seg+1)%pts.length],t);
      }
      case"fourStar":{
        const u=((angle%p.TWO_PI)+p.TWO_PI)%p.TWO_PI/p.TWO_PI;
        const points=[];
        for(let k=0;k<8;k++){
          const a=-p.PI/2+k*p.PI/4;
          const rr=k%2===0?r:r*.32;
          points.push(p.createVector(p.cos(a)*rr,p.sin(a)*rr));
        }
        const pos=u*points.length,seg=Math.floor(pos)%points.length,t=pos-Math.floor(pos);
        return p5.Vector.lerp(points[seg],points[(seg+1)%points.length],t);
      }
      case"sinusoid":{
        const u=((angle%p.TWO_PI)+p.TWO_PI)%p.TWO_PI/p.TWO_PI;
        const x=(u-.5)*2*r;
        const y=Math.sin(u*p.TWO_PI*2)*r*.48;
        return p.createVector(x,y);
      }
      case"spiral":{
        const u=((angle%p.TWO_PI)+p.TWO_PI)%p.TWO_PI/p.TWO_PI;
        const turns=3.15;
        const rr=r*(.08+.90*u);
        const a=-p.PI/2+u*p.TWO_PI*turns;
        return p.createVector(p.cos(a)*rr,p.sin(a)*rr);
      }
      default:return p.createVector(0,0);
    }
  }
  function easeInOut(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
})();

/* GUIDANCE PORTAL PARTICLES — lightweight isometric heart / STRV star. */
(function(){
  const canvases=[...document.querySelectorAll('.mf-guidance-particle-canvas')];
  if(!canvases.length)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile=window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;
  const states=canvases.map((canvas,index)=>{
    const ctx=canvas.getContext('2d',{alpha:true});
    const shape=canvas.dataset.guidanceShape||'heart';
    const count=mobile?92:170;
    const particles=Array.from({length:count},(_,i)=>({
      u:i/count,
      phase:Math.random()*Math.PI*2,
      phase2:Math.random()*Math.PI*2,
      size:.55+Math.random()*1.9,
      alpha:.18+Math.random()*.64,
      depth:.55+Math.random()*.75
    }));
    return {canvas,ctx,shape,particles,index,hover:false,width:0,height:0,dpr:1};
  });
  let visible=false,frame=0,start=performance.now();
  function point(shape,u,r){
    const a=u*Math.PI*2;
    let x=0,y=0;
    if(shape==='heart'){
      x=16*Math.pow(Math.sin(a),3)/18;
      y=-(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))/18;
    }else{
      const seg=u*8;
      const k=Math.floor(seg)%8;
      const t=seg-Math.floor(seg);
      const a1=-Math.PI/2+k*Math.PI/4;
      const a2=-Math.PI/2+(k+1)*Math.PI/4;
      const r1=k%2===0?1:.30;
      const r2=(k+1)%2===0?1:.30;
      x=(Math.cos(a1)*r1*(1-t)+Math.cos(a2)*r2*t);
      y=(Math.sin(a1)*r1*(1-t)+Math.sin(a2)*r2*t);
    }
    x*=r;y*=r;
    /* Isometric projection: a shallow rotated plane rather than a flat icon. */
    const isoX=(x-y)*.82;
    const isoY=(x+y)*.40;
    return [isoX,isoY];
  }
  function resize(state){
    const rect=state.canvas.getBoundingClientRect();
    const dpr=Math.min(window.devicePixelRatio||1,mobile?1:1.5);
    const w=Math.max(1,Math.round(rect.width*dpr));
    const h=Math.max(1,Math.round(rect.height*dpr));
    if(w===state.canvas.width&&h===state.canvas.height)return;
    state.canvas.width=w;state.canvas.height=h;state.width=rect.width;state.height=rect.height;state.dpr=dpr;
    state.ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function draw(now){
    frame=0;
    if(!visible||document.hidden)return;
    const t=(now-start)*.001;
    states.forEach(state=>{
      resize(state);
      const {ctx,width,height}=state;
      ctx.clearRect(0,0,width,height);
      const r=Math.min(width,height)*(mobile?.24:.31);
      const cx=width*.54,cy=height*.48;
      const hoverBoost=state.hover?1.08:1;
      state.particles.forEach((pt,i)=>{
        const [px,py]=point(state.shape,pt.u,r*hoverBoost);
        const drift=(state.hover?3.2:5.8);
        const x=cx+px+Math.sin(t*1.15+pt.phase)*drift*pt.depth;
        const y=cy+py+Math.cos(t*.92+pt.phase2)*drift*.65*pt.depth;
        const vx=Math.cos(t*1.15+pt.phase)*drift*.16;
        const vy=-Math.sin(t*.92+pt.phase2)*drift*.10;
        const motion=state.hover?.58:.34;
        const particleRGB=document.body.classList.contains('mf-cloud-study')?'117,132,138':'255,255,255';
        ctx.strokeStyle=`rgba(${particleRGB},${pt.alpha*motion})`;
        ctx.lineWidth=Math.max(.35,pt.size*.34);
        ctx.beginPath();ctx.moveTo(x-vx*5,y-vy*5);ctx.lineTo(x,y);ctx.stroke();
        ctx.fillStyle=`rgba(${particleRGB},${Math.min(.92,pt.alpha+(state.hover?.12:0))})`;
        ctx.beginPath();ctx.arc(x,y,pt.size*(state.hover?1.12:1),0,Math.PI*2);ctx.fill();
      });
    });
    if(!reduced)frame=requestAnimationFrame(draw);
  }
  function sync(){
    if(visible&&!document.hidden&&!reduced){if(!frame)frame=requestAnimationFrame(draw);}
    else if(frame){cancelAnimationFrame(frame);frame=0;}
    if(reduced&&visible)draw(performance.now());
  }
  states.forEach(state=>{
    const portal=state.canvas.closest('.mf-guidance-portal');
    portal?.addEventListener('mouseenter',()=>{state.hover=true;sync();});
    portal?.addEventListener('mouseleave',()=>{state.hover=false;sync();});
  });
  const section=document.getElementById('guidance');
  if(section&&'IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{visible=!!entries[0]?.isIntersecting;sync();},{rootMargin:'15% 0px',threshold:0});
    observer.observe(section);
  }else{visible=true;sync();}
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('resize',()=>{states.forEach(resize);sync();},{passive:true});
})();


/* MF ART — magnetic button + infinitely wrapping draggable field */
(function(){
  const zone=document.getElementById("mfArtZone");
  const button=document.getElementById("mfArtButton");
  const overlay=document.getElementById("mfArtOverlay");
  const world=document.getElementById("mfArtWorld");
  const miniWorld=document.getElementById("mfArtMiniWorld");
  const close=document.getElementById("mfArtClose");
  const intro=document.getElementById("mfArtIntro");
  const particleHost=document.getElementById("mfArtParticles");
  const artLoader=document.getElementById("mfArtRuntimeLoader");
  const houseButton=document.getElementById("mfHouseButton");
  const donation=document.getElementById("mfDonationOverlay");
  const donationClose=document.getElementById("mfDonationClose");
  const donationParticles=document.getElementById("mfDonationParticles");
  if(!button||!overlay||!world||!close)return;

  const files=[
    "01-konnichiwawa.png","02-perefction.png","03-flawr.png","04-mattress.png","05-egg.png",
    "06-huh.png","07-hotdog.png","08-jail.png","09-box.png","10-ufo.png","11-claude.png",
    "12-hay.png","13-spaghet.png","14-doctor.png","15-cher.png","16-pantalones.png","17-tuli.png",
    "18-wave.png","19-bean.png","20-accept.png","21-violins.png","22-holy.png","23-tiktok.png",
    "24-ai.png","25-blushies.png","26-arse.png","27-glow.png","28-smash.png","29-stairs.png","30-orange.png"
  ];
  const strength=0;
  const moveButton=(x,y,duration=.4,ease="power2.out")=>{
    if(window.gsap)gsap.to(button,{x,y,duration,ease,overwrite:true});
    else button.style.transform=`translate(${x}px,${y}px)`;
  };
  if(zone){
    zone.addEventListener("mousemove",e=>{
      const rect=zone.getBoundingClientRect();
      const x=((e.clientX-rect.left)/rect.width-.5)*rect.width;
      const y=((e.clientY-rect.top)/rect.height-.5)*rect.height;
      moveButton(x*strength,y*strength);
    });
    zone.addEventListener("mouseleave",()=>moveButton(0,0,.7,"elastic.out(1, 0.4)"));
  }

  let pieces=[];
  let miniPieces=[];
  let artReady=false;
  let artPreviewReady=false;
  let artInitPromise=null;
  let offsetX=0,offsetY=0;
  let dragging=false,lastX=0,lastY=0,dragDistance=0,downFigure=null;
  let velocityX=0,velocityY=0,lastMoveTime=0,inertiaFrame=0;
  let expanded=null;
  const preview=document.getElementById("mfArtPreview");
  const previewImage=document.getElementById("mfArtPreviewImage");
  const previewClose=document.getElementById("mfArtPreviewClose");
  const seeded=i=>{const x=Math.sin(i*12.9898)*43758.5453;return x-Math.floor(x);};

  function build(){
    if(pieces.length)return;
    world.innerHTML="";
    if(miniWorld)miniWorld.innerHTML="";
    const vw=window.innerWidth,vh=window.innerHeight;
    const mobileArt=vw<=1024;
    const fieldW=vw*(mobileArt?2.9:2.45),fieldH=vh*(mobileArt?2.7:2.25);
    const cols=6,rows=5,cellW=fieldW/cols,cellH=fieldH/rows;
    pieces=files.map((name,i)=>{
      const figure=document.createElement("figure");
      figure.className="mf-art-piece";
      figure.style.setProperty("--float-delay",`${-(seeded(i+11)*7).toFixed(2)}s`);
      figure.style.setProperty("--float-duration",`${(6.5+seeded(i+19)*7.5).toFixed(2)}s`);
      figure.style.setProperty("--float-x",`${(-12+seeded(i+27)*24).toFixed(1)}px`);
      figure.style.setProperty("--float-y",`${(-14+seeded(i+35)*28).toFixed(1)}px`);
      figure.style.setProperty("--tilt",`${(-1+seeded(i+43)*2).toFixed(2)}deg`);
      figure.style.setProperty("--tilt-x",`${(-1+seeded(i+47)*2).toFixed(2)}deg`);
      figure.style.setProperty("--tilt-y",`${(-1+seeded(i+53)*2).toFixed(2)}deg`);
      const size=mobileArt
        ? Math.round(88+seeded(i+2)*128)
        : Math.round(160+seeded(i+2)*252);
      const ratio=.72+seeded(i+31)*.62;
      const depth=.55+seeded(i+68)*.95;
      figure.style.width=size+"px";
      figure.style.height=Math.round(size*ratio)+"px";
      figure.style.zIndex=String(1+Math.floor(depth*10));
      figure.style.setProperty("--depth",depth.toFixed(3));
      const depthNorm=Math.max(0,Math.min(1,(depth-.55)/.95));
      figure.style.setProperty("--depth-brightness",(0.8+depthNorm*.2).toFixed(3));
      figure.style.setProperty("--depth-blur",((1-depthNorm)*1.45).toFixed(2)+"px");
      const artSrc=`/media/art/${name}`;
      const img=document.createElement("img");
      img.alt="";
      img.draggable=false;
      img.dataset.src=artSrc;
      img.dataset.fallback=`./media/art/${name}`;
      img.onerror=()=>{ if(img.dataset.fallback&&img.src!==img.dataset.fallback){ img.src=img.dataset.fallback; return; } img.onerror=null; };
      figure.appendChild(img);
      world.appendChild(figure);

      let miniEl=null,miniImg=null;
      const shouldCreateMini=!mobileArt||i<12;
      if(miniWorld&&shouldCreateMini){
        miniEl=document.createElement("figure");
        miniEl.className="mf-art-piece mf-art-piece--mini";
        miniEl.style.zIndex=figure.style.zIndex;
        miniEl.style.setProperty("--depth-brightness",figure.style.getPropertyValue("--depth-brightness"));
        miniEl.style.setProperty("--depth-blur",figure.style.getPropertyValue("--depth-blur"));
        miniImg=document.createElement("img");
        miniImg.alt="";
        miniImg.draggable=false;
        miniImg.dataset.src=artSrc;
        miniImg.dataset.fallback=`./media/art/${name}`;
        miniImg.onerror=()=>{ if(miniImg.dataset.fallback&&miniImg.src!==miniImg.dataset.fallback){miniImg.src=miniImg.dataset.fallback;return;} miniImg.onerror=null; };
        miniEl.appendChild(miniImg);
        miniWorld.appendChild(miniEl);
      }

      const x=((i%cols)+.5)*cellW-fieldW/2+(seeded(i+90)-.5)*cellW*.32;
      const y=(Math.floor(i/cols)+.5)*cellH-fieldH/2+(seeded(i+150)-.5)*cellH*.28;
      return {
        el:figure,img,miniEl,miniImg,
        x,y,nx:x/fieldW,ny:y/fieldH,
        w:size,h:Math.round(size*ratio),depth,
        driftX:(seeded(i+210)-.5)*10,
        driftY:(seeded(i+260)-.5)*8,
        phase:seeded(i+310)*Math.PI*2
      };
    });
    pieces.forEach(piece=>{
      piece.el.addEventListener("click",e=>{
        e.preventDefault();
        e.stopPropagation();
      });
    });
    render(performance.now());
  }
  function wrap(value,span){return ((value+span/2)%span+span)%span-span/2;}
  function render(now=performance.now()){
    if(expanded)return;
    const vw=window.innerWidth,vh=window.innerHeight;
    const mobileArt=vw<=1024;
    const spanX=vw*(mobileArt?2.9:2.45),spanY=vh*(mobileArt?2.7:2.25);
    const t=now*.00012;
    const wholeX=Math.sin(t)*22;
    const wholeY=Math.cos(t*.82)*16;
    const miniRect=miniWorld?.getBoundingClientRect();
    const mw=miniRect?.width||0,mh=miniRect?.height||0;
    const miniSpanX=mw*(mobileArt?2.9:2.45),miniSpanY=mh*(mobileArt?2.7:2.25);
    const scale=mw&&mh?Math.min(mw/vw,mh/vh):0;
    pieces.forEach(piece=>{
      const localX=Math.sin(t*(.7+piece.depth*.45)+piece.phase)*piece.driftX;
      const localY=Math.cos(t*(.65+piece.depth*.38)+piece.phase)*piece.driftY;
      const x=wrap(piece.nx*spanX+(offsetX+wholeX)*piece.depth+localX,spanX)+vw/2-piece.w/2;
      const y=wrap(piece.ny*spanY+(offsetY+wholeY)*piece.depth+localY,spanY)+vh/2-piece.h/2;
      piece.el.style.setProperty("--base-transform",`translate3d(${x}px,${y}px,0)`);

      if(piece.miniEl&&mw&&mh){
        const miniW=Math.max(42,piece.w*scale);
        const miniH=Math.max(32,piece.h*scale);
        const miniOffsetX=(offsetX+wholeX)*scale;
        const miniOffsetY=(offsetY+wholeY)*scale;
        const mx=wrap(piece.nx*miniSpanX+miniOffsetX*piece.depth+localX*scale,miniSpanX)+mw/2-miniW/2;
        const my=wrap(piece.ny*miniSpanY+miniOffsetY*piece.depth+localY*scale,miniSpanY)+mh/2-miniH/2;
        piece.miniEl.style.width=`${miniW}px`;
        piece.miniEl.style.height=`${miniH}px`;
        piece.miniEl.style.setProperty("--base-transform",`translate3d(${mx}px,${my}px,0)`);
      }
    });
  }
  let artMotionFrame=0;
  let miniVisible=!miniWorld;
  const shouldAnimateArt=()=>!document.hidden&&!expanded&&(miniVisible||overlay.classList.contains("active"));
  function animateArt(now){
    artMotionFrame=0;
    if(!shouldAnimateArt())return;
    render(now);
    artMotionFrame=requestAnimationFrame(animateArt);
  }
  function syncArtMotion(){
    if(shouldAnimateArt()){
      if(!artMotionFrame)artMotionFrame=requestAnimationFrame(animateArt);
    }else if(artMotionFrame){
      cancelAnimationFrame(artMotionFrame);
      artMotionFrame=0;
    }
  }
  if(miniWorld){
    const miniObserver=new IntersectionObserver(entries=>{
      miniVisible=!!entries[0]?.isIntersecting;
      syncArtMotion();
    },{rootMargin:"15% 0px",threshold:0});
    miniObserver.observe(miniWorld);
  }
  document.addEventListener("visibilitychange",syncArtMotion);
  function ensureArtBuilt(){
    if(artInitPromise)return artInitPromise;
    artInitPromise=Promise.resolve().then(()=>{
      build();
      render(performance.now());
    });
    return artInitPromise;
  }
  function loadImg(el){
    return new Promise(resolve=>{
      if(!el)return resolve();
      if(el.getAttribute('src')){
        if(el.complete&&el.naturalWidth>0)return resolve();
      } else if(el.dataset.src){
        el.src=el.dataset.src;
      }
      const done=()=>resolve();
      if(el.complete&&el.naturalWidth>0)return resolve();
      el.addEventListener('load',done,{once:true});
      el.addEventListener('error',done,{once:true});
    });
  }
  function ensureArtPreview(){
    return ensureArtBuilt().then(async()=>{
      if(artPreviewReady)return;
      const mobilePreview=window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;
      const previewPieces=mobilePreview?pieces.slice(0,12):pieces;
      if(mobilePreview)pieces.slice(12).forEach(piece=>piece.miniEl?.remove());
      await Promise.allSettled(previewPieces.map(piece=>loadImg(piece.miniImg)));
      artPreviewReady=true;
      render(performance.now());
    });
  }
  function setArtLoaderProgress(value,copy){
    if(!artLoader)return;
    const progress=artLoader.querySelector('.mf-loader-progress');
    const bar=artLoader.querySelector('.mf-loader-bar-fill');
    const ascii=artLoader.querySelector('.mf-loader-ascii');
    const txt=`${String(Math.round(value)).padStart(2,'0')}%`;
    if(progress){ progress.textContent=txt; progress.dataset.glitch=txt; progress.classList.toggle('is-glitch', value<100); }
    if(bar) bar.style.width=`${value}%`;
    if(copy&&ascii) ascii.textContent=copy;
  }
  async function ensureArtWorldLoaded(){
    await ensureArtBuilt();
    if(artReady)return;
    let loaderVisible=false;
    const loaderTimer=setTimeout(()=>{ if(artLoader){ artLoader.classList.add('is-visible'); artLoader.setAttribute('aria-hidden','false'); setArtLoaderProgress(6,'// loading MF art'); loaderVisible=true; } },1000);
    await ensureArtPreview();
    let done=0;
    const total=Math.max(1,pieces.length);
    await Promise.allSettled(pieces.map(async piece=>{ await loadImg(piece.img); done++; if(loaderVisible) setArtLoaderProgress(6 + (done/total)*94); }));
    clearTimeout(loaderTimer);
    artReady=true;
    if(loaderVisible){
      setArtLoaderProgress(100,'// art unlocked');
      setTimeout(()=>{ if(artLoader){ artLoader.classList.remove('is-visible'); artLoader.setAttribute('aria-hidden','true'); } },260);
    }
  }
  const artPreviewTrigger=zone||button||miniWorld;
  if(artPreviewTrigger&&'IntersectionObserver' in window){
    const obs=new IntersectionObserver(entries=>{
      if(entries[0]?.isIntersecting){ ensureArtPreview(); obs.disconnect(); }
    },{rootMargin:'260px 0px',threshold:0});
    obs.observe(artPreviewTrigger);
  }
  syncArtMotion();
  function expandPiece(piece){
    if(expanded)return;
    expanded=piece;
    syncArtMotion();
    overlay.classList.add("is-image-open");
    pieces.forEach(p=>p.el.classList.toggle("is-expanded",p===piece));
  }
  function collapsePiece(){
    if(!expanded)return;
    expanded=null;
    overlay.classList.remove("is-image-open");
    syncArtMotion();
    pieces.forEach(p=>p.el.classList.remove("is-expanded"));
    render();
  }
  function openPreview(piece){
    if(!preview||!previewImage||!piece)return;
    previewImage.src=piece.img.currentSrc||piece.img.src;
    preview.classList.add("active");
    preview.setAttribute("aria-hidden","false");
  }
  function closePreview(){
    if(!preview)return;
    preview.classList.remove("active");
    preview.setAttribute("aria-hidden","true");
    setTimeout(()=>{if(previewImage)previewImage.removeAttribute("src");},560);
  }
  preview?.addEventListener("click",closePreview);
  previewClose?.addEventListener("click",e=>{e.stopPropagation();closePreview();});

  function createAmbientParticles(host){
    if(!host||host.childElementCount)return;
    for(let i=0;i<40;i++){
      const particle=document.createElement("span");
      const comet=i<4;
      particle.className=comet?"mf-art-particle is-comet":"mf-art-particle";
      particle.style.setProperty("--px",`${seeded(i+410)*100}%`);
      particle.style.setProperty("--py",`${seeded(i+460)*100}%`);
      particle.style.setProperty("--ps",`${2+Math.floor(seeded(i+510)*2)}px`);
      particle.style.setProperty("--pd",`${7+seeded(i+560)*13}s`);
      particle.style.setProperty("--pdelay",`${-seeded(i+610)*18}s`);
      particle.style.setProperty("--pdx",`${-50+seeded(i+660)*100}px`);
      particle.style.setProperty("--pdy",`${-40+seeded(i+710)*80}px`);
      particle.style.setProperty("--pa",`${.18+seeded(i+760)*.62}`);
      if(comet){
        const travelsRight=seeded(i+860)>.5;
        const startX=travelsRight?-18:118;
        const endX=travelsRight?118:-18;
        const startY=18+seeded(i+910)*68;
        const endY=Math.max(4,Math.min(96,startY+(-28+seeded(i+960)*56)));
        const dx=endX-startX;
        const dy=endY-startY;
        const angle=Math.atan2(dy,dx)*180/Math.PI;
        particle.style.setProperty("--comet-start-x",`${startX}vw`);
        particle.style.setProperty("--comet-start-y",`${startY}vh`);
        particle.style.setProperty("--comet-end-x",`${endX}vw`);
        particle.style.setProperty("--comet-end-y",`${endY}vh`);
        particle.style.setProperty("--comet-angle",`${angle}deg`);
        particle.style.setProperty("--comet-length",`${34+seeded(i+1010)*52}px`);
      }
      if(seeded(i+810)>.72)particle.classList.add("is-glow");
      host.appendChild(particle);
    }
  }
  async function openArt(){
    createAmbientParticles(particleHost);
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden","false");
    document.body.classList.add("art-open");
    requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.add("is-visible")));
    syncArtMotion();
    await ensureArtWorldLoaded();
  }
  function closeArt(){
    collapsePiece();
    overlay.classList.remove("is-visible");
    setTimeout(()=>{
      overlay.classList.remove("active","is-dragging");
      overlay.setAttribute("aria-hidden","true");
      document.body.classList.remove("art-open");
      if(window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches){
        pieces.forEach(piece=>piece.img?.removeAttribute('src'));
        artReady=false;
      }
      syncArtMotion();
    },720);
  }
  button.addEventListener("click",openArt);
  close.addEventListener("click",e=>{e.stopPropagation();closeArt();});

  overlay.addEventListener("click",e=>{
    if(e.target.closest(".mf-art-close"))return;
    if(expanded){collapsePiece();return;}
  });
  overlay.addEventListener("pointerdown",e=>{
    if(expanded||e.target.closest(".mf-art-close, .mf-art-intro, .mf-art-cta"))return;
    downFigure=e.target.closest?.(".mf-art-piece")||null;
    cancelAnimationFrame(inertiaFrame);
    dragging=true;dragDistance=0;lastX=e.clientX;lastY=e.clientY;lastMoveTime=performance.now();velocityX=0;velocityY=0;
    overlay.classList.add("is-dragging");
    overlay.setPointerCapture?.(e.pointerId);
  });
  overlay.addEventListener("pointermove",e=>{
    if(!dragging)return;
    const now=performance.now();
    const dx=e.clientX-lastX,dy=e.clientY-lastY;
    const dt=Math.max(16,now-lastMoveTime);
    dragDistance+=Math.abs(dx)+Math.abs(dy);
    velocityX=dx/(dt/16);velocityY=dy/(dt/16);
    offsetX+=dx;offsetY+=dy;lastX=e.clientX;lastY=e.clientY;lastMoveTime=now;render();
  });
  const stopDrag=e=>{
    if(!dragging)return;
    const clickedFigure=downFigure;
    const wasClick=!!clickedFigure&&dragDistance<7;
    dragging=false;overlay.classList.remove("is-dragging");try{overlay.releasePointerCapture?.(e.pointerId)}catch(_){}
    downFigure=null;
    if(wasClick){
      const piece=pieces.find(p=>p.el===clickedFigure);
      if(piece){openPreview(piece);return;}
    }
    const drift=()=>{
      velocityX*=.93;velocityY*=.93;
      offsetX+=velocityX;offsetY+=velocityY;render();
      if(Math.abs(velocityX)+Math.abs(velocityY)>.08)inertiaFrame=requestAnimationFrame(drift);
    };
    inertiaFrame=requestAnimationFrame(drift);
  };
  overlay.addEventListener("pointerup",stopDrag);
  overlay.addEventListener("pointercancel",stopDrag);

  function addMagnetic(target,strength=.18){
    if(!target)return;
    target.addEventListener("pointermove",e=>{
      const r=target.getBoundingClientRect();
      const x=(e.clientX-r.left-r.width/2)*strength;
      const y=(e.clientY-r.top-r.height/2)*strength;
      if(window.gsap)gsap.to(target,{x,y,duration:.35,ease:"power2.out",overwrite:true});
    });
    target.addEventListener("pointerleave",()=>window.gsap&&gsap.to(target,{x:0,y:0,duration:.65,ease:"elastic.out(1,.4)",overwrite:true}));
  }
  document.querySelectorAll(".mf-art-cta").forEach(btn=>addMagnetic(btn));
  function openDonation(){
    if(!donation)return;
    createAmbientParticles(donationParticles);
    donation.classList.add("active");
    donation.setAttribute("aria-hidden","false");
    requestAnimationFrame(()=>requestAnimationFrame(()=>donation.classList.add("is-visible")));
  }
  function closeDonation(){
    if(!donation)return;
    donation.classList.remove("is-visible");
    setTimeout(()=>{donation.classList.remove("active");donation.setAttribute("aria-hidden","true");},600);
  }
  houseButton?.addEventListener("click",openDonation);
  donationClose?.addEventListener("click",closeDonation);
  donation?.addEventListener("click",e=>{if(e.target===donation)closeDonation();});

  window.addEventListener("resize",render);
  document.addEventListener("keydown",e=>{
    if(e.key!=="Escape")return;
    if(preview?.classList.contains("active")){closePreview();return;}
    if(donation?.classList.contains("active")){closeDonation();return;}
    if(!overlay.classList.contains("active"))return;
    if(expanded)collapsePiece();else closeArt();
  });
})();


/* BIO PHOTO — intentionally static; the shared monochrome grid effect is the only hover treatment. */

/* HERO NAME — cursor-driven monochrome grid deformation. */
(function(){
  const hero=document.getElementById("heroName");
  const source=document.getElementById("nameWrap");
  const fine=window.matchMedia("(hover:hover) and (pointer:fine)");
  if(!hero||!source||!fine.matches)return;

  const overlay=document.createElement("span");
  overlay.className="mf-hero-grid-distortion";
  overlay.setAttribute("aria-hidden","true");
  hero.appendChild(overlay);

  const columns=10,rows=4,cells=[];
  for(let row=0;row<rows;row++){
    for(let column=0;column<columns;column++){
      const cell=document.createElement("span");
      cell.className="mf-hero-grid-cell";
      const clone=source.cloneNode(true);
      clone.removeAttribute("id");
      clone.classList.add("mf-hero-grid-clone");
      clone.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
      const clipTop=row===0?-24:row/rows*100;
      const clipBottom=row===rows-1?-18:(rows-row-1)/rows*100;
      cell.style.clipPath=`inset(${clipTop}% ${(columns-column-1)/columns*100}% ${clipBottom}% ${column/columns*100}%)`;
      cell.appendChild(clone);
      overlay.appendChild(cell);
      cells.push({cell,clone,column,row,x:(column+.5)/columns,y:(row+.5)/rows,tx:0,ty:0,cx:0,cy:0});
    }
  }

  const sync=()=>{
    const transform=source.style.transform;
    const origin=source.style.transformOrigin||"left bottom";
    cells.forEach(item=>{
      item.clone.style.transform=transform;
      item.clone.style.transformOrigin=origin;
      item.clone.style.letterSpacing=source.style.letterSpacing;
      const sourceLetters=[...source.children],cloneLetters=[...item.clone.children];
      sourceLetters.forEach((letter,index)=>{
        const cloneLetter=cloneLetters[index];
        if(!cloneLetter)return;
        cloneLetter.textContent=letter.textContent;
        cloneLetter.className=letter.className;
        cloneLetter.style.display=letter.style.display;
        cloneLetter.style.marginRight=letter.style.marginRight;
        cloneLetter.style.width=letter.style.width;
        cloneLetter.style.fontSize=letter.style.fontSize;
        cloneLetter.style.overflow=letter.style.overflow;
      });
    });
  };
  sync();
  window.addEventListener("mf:hero-fit",sync);
  new MutationObserver(sync).observe(source,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});

  let pointerX=-9999,pointerY=-9999,velocityX=0,velocityY=0,lastX=pointerX,lastY=pointerY,inside=false,raf=0;
  const animate=()=>{
    raf=0;
    const rect=overlay.getBoundingClientRect();
    const radius=Math.max(150,Math.min(rect.width*.22,310));
    cells.forEach(item=>{
      const centerX=item.x*rect.width,centerY=item.y*rect.height;
      const dx=centerX-pointerX,dy=centerY-pointerY;
      const distance=Math.hypot(dx,dy)||1;
      const influence=inside?Math.pow(Math.max(0,1-distance/radius),1.65):0;
      const push=20*influence;
      item.tx=(dx/distance)*push+velocityX*.12*influence+(item.row%2?1:-1)*2.5*influence;
      item.ty=(dy/distance)*push*.62+velocityY*.09*influence+(item.column%2?1:-1)*1.7*influence;
      /* Keep the outer rows inside the original letter bounds so the monochrome
         deformation never appears clipped at the top or bottom edge. */
      if(item.row===0)item.ty=Math.max(0,item.ty);
      if(item.row===rows-1)item.ty=Math.min(0,item.ty);
      item.cx+=(item.tx-item.cx)*.24;
      item.cy+=(item.ty-item.cy)*.24;
      item.cell.style.transform=`translate3d(${item.cx.toFixed(2)}px,${item.cy.toFixed(2)}px,0)`;
    });
    velocityX*=.78;velocityY*=.78;
    const unsettled=cells.some(item=>Math.abs(item.tx-item.cx)>.08||Math.abs(item.ty-item.cy)>.08);
    if(inside||unsettled)raf=requestAnimationFrame(animate);
  };
  const queue=()=>{if(!raf)raf=requestAnimationFrame(animate);};

  hero.addEventListener("pointerenter",event=>{
    const rect=overlay.getBoundingClientRect();
    pointerX=event.clientX-rect.left;pointerY=event.clientY-rect.top;
    lastX=pointerX;lastY=pointerY;inside=true;
    overlay.classList.add("is-active");queue();
  },{passive:true});
  hero.addEventListener("pointermove",event=>{
    const rect=overlay.getBoundingClientRect();
    const nextX=event.clientX-rect.left,nextY=event.clientY-rect.top;
    velocityX=nextX-lastX;velocityY=nextY-lastY;
    pointerX=nextX;pointerY=nextY;lastX=nextX;lastY=nextY;
    overlay.style.setProperty("--mf-grid-x",`${pointerX}px`);
    overlay.style.setProperty("--mf-grid-y",`${pointerY}px`);
    overlay.classList.add("is-active");queue();
  },{passive:true});
  hero.addEventListener("pointerleave",()=>{
    inside=false;velocityX=0;velocityY=0;
    overlay.classList.remove("is-active");queue();
  },{passive:true});
  window.addEventListener("resize",()=>{sync();queue();},{passive:true});
  window.addEventListener("load",sync,{once:true});
})();

/* FOOTER NAME — original variable expansion, RAF-throttled to remove lag */
(function(){
  const name=document.getElementById("footerName");
  if(!name)return;
  const label="MARIAN FUSEK";
  name.textContent="";
  const chars=[...label].map(ch=>{
    const el=document.createElement("span");
    el.className="footer-vp-char";
    el.textContent=ch===" "?"\u00A0":ch;
    name.appendChild(el);
    return el;
  });
  const radius=130;
  let x=-9999,y=-9999,raf=0,inside=false;
  function render(){
    raf=0;
    chars.forEach(ch=>{
      const r=ch.getBoundingClientRect();
      const n=inside?Math.max(0,1-Math.hypot(x-r.left-r.width/2,y-r.top-r.height/2)/radius):0;
      const weight=400+450*n;
      ch.style.fontVariationSettings=`'wght' ${weight.toFixed(0)}, 'opsz' ${(12+27*n).toFixed(1)}`;
      ch.style.fontWeight=String(Math.round(weight));
    });
  }
  function queue(){if(!raf)raf=requestAnimationFrame(render);}
  name.addEventListener("pointerenter",e=>{inside=true;x=e.clientX;y=e.clientY;queue();});
  name.addEventListener("pointermove",e=>{x=e.clientX;y=e.clientY;queue();});
  name.addEventListener("pointerleave",()=>{inside=false;queue();});
})();

/* FOOTER TYPEWRITER */
(function(){
  const target=document.getElementById("twText");
  if(!target)return;
  const sentences = [
    "“You met me at a very strange time in my life.”",
    "“There is no spoon.”",
    "“Just be a rock.”",
    "“Devour feculence.”",
    "“Majestical.”"
  ];
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  async function loop(){
    while(true){
      for(const sentence of sentences){
        target.textContent="";
        for(const ch of sentence){target.textContent+=ch;await wait(42);}
        await wait(5000);
        while(target.textContent.length){target.textContent=target.textContent.slice(0,-1);await wait(18);}
        await wait(320);
      }
    }
  }
  loop();
})();

/* V24 — click-and-hold a hero grid cell to illuminate all four edges. */
(function(){
  const grid=document.getElementById("mfGrid");
  const hero=document.getElementById("heroSection");
  if(!grid||!hero)return;
  let active=[];
  const clear=()=>{
    active.forEach(line=>line.classList.remove("is-on"));
    const old=active;active=[];
    setTimeout(()=>old.forEach(line=>line.remove()),760);
  };
  const make=(cls,styles)=>{
    const line=document.createElement("span");
    line.className=`mf-grid-cell-line ${cls}`;
    Object.assign(line.style,styles);
    grid.appendChild(line);
    requestAnimationFrame(()=>line.classList.add("is-on"));
    active.push(line);
  };
  hero.addEventListener("pointerdown",e=>{
    if(e.button!==0)return;
    clear();
    const cols=window.matchMedia("(max-width: 1024px)").matches?3:10;
    const col=Math.max(0,Math.min(cols-1,Math.floor(e.clientX/(innerWidth/cols))));
    const row=Math.max(0,Math.min(2,Math.floor(e.clientY/(innerHeight/3))));
    const left=col*innerWidth/cols,right=(col+1)*innerWidth/cols;
    const top=row*innerHeight/3,bottom=(row+1)*innerHeight/3;
    make("is-v",{left:`${left}px`,top:`${top}px`,height:`${bottom-top}px`});
    make("is-v",{left:`${right}px`,top:`${top}px`,height:`${bottom-top}px`});
    make("is-h",{left:`${left}px`,top:`${top}px`,width:`${right-left}px`});
    make("is-h",{left:`${left}px`,top:`${bottom}px`,width:`${right-left}px`});
  });
  window.addEventListener("pointerup",clear);
  window.addEventListener("pointercancel",clear);
})();

/* ART preview uses the exact same renderer and state as the full gallery.
   It remains non-interactive; clicking the frame opens the full overlay. */

/* Legacy BIO ASCII/RGB timer removed — hover grid distortion only. */


/* MF ART section title — the base title stays fixed while suffixes animate. */
(function(){
  const title=document.querySelector('.mf-art-showcase-copy h2');
  if(!title)return;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  title.innerHTML='<span class="mf-art-title-base">MF ART</span><span class="mf-art-title-suffix">!</span>';
  const suffix=title.querySelector('.mf-art-title-suffix');
  const set=value=>{suffix.textContent=value;};
  const fadeTo=async(value)=>{
    suffix.style.opacity='0';
    suffix.style.transform='translateY(-3px)';
    await wait(180);
    set(value);
    suffix.style.transform='translateY(3px)';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      suffix.style.opacity='1';
      suffix.style.transform='translateY(0)';
    }));
    await wait(260);
  };
  async function loop(){
    while(true){
      set('!');suffix.style.opacity='1';suffix.style.transform='translateY(0)';
      await wait(1500);
      for(let i=0;i<3;i++){suffix.style.opacity='0';await wait(105);suffix.style.opacity='1';await wait(105);}
      await fadeTo('?');
      await wait(1500);
      let text='?';
      for(const ch of ' HUH?!'){text+=ch;set(text);await wait(62);}
      await wait(1350);
      await fadeTo('');
      for(let count=1;count<=3;count++){set('.'.repeat(count));await wait(170);}
      await wait(500);
      for(let count=2;count>=0;count--){set('.'.repeat(count));await wait(120);}
      for(let count=1;count<=3;count++){set('.'.repeat(count));await wait(170);}
      await wait(2000);
      await fadeTo('!');
    }
  }
  loop();
})();



/* V153 GUIDANCE STAGE — explicit focus classes keep the 76/24 transfer
   deterministic across pointer and keyboard interaction. */
(function(){
  const portals=document.querySelector('.mf-guidance-portals[data-mc-tl-version="3"]');
  if(!portals)return;
  const mindset=portals.querySelector('.mf-guidance-portal-mindset');
  const leadership=portals.querySelector('.mf-guidance-portal-leadership');
  const clear=()=>portals.classList.remove('is-focus-mindset','is-focus-leadership');
  const focus=side=>{clear();portals.classList.add(`is-focus-${side}`);};
  mindset?.addEventListener('pointerenter',()=>focus('mindset'));
  leadership?.addEventListener('pointerenter',()=>focus('leadership'));
  mindset?.addEventListener('focus',()=>focus('mindset'));
  leadership?.addEventListener('focus',()=>focus('leadership'));
  portals.addEventListener('pointerleave',clear);
  portals.addEventListener('focusout',event=>{if(!portals.contains(event.relatedTarget))clear();});
})();

/* Desktop cursor — restrained dot, visible micro-trail and pulse only on click. */
(function(){
  if(!window.matchMedia('(pointer:fine)').matches)return;
  const cursor=document.createElement('div');
  cursor.className='mf-global-cursor';
  cursor.innerHTML='<span class="mf-global-cursor-pulse"></span><span class="mf-global-cursor-dot"></span><span class="mf-global-cursor-open">OPEN</span>';
  document.body.appendChild(cursor);
  document.body.classList.add('mf-custom-cursor');

  let x=-100,y=-100,lastX=-100,lastY=-100,lastTrailAt=0,visible=false;
  const hiddenZone=target=>!!target?.closest?.('.mf-carousel-zone,.mf-art-overlay,.mf-wip-gate');
  const place=()=>{cursor.style.transform=`translate3d(${x}px,${y}px,0)`;};
  const addTrail=(trailX,trailY,scale=1)=>{
    const trail=document.createElement('span');
    trail.className='mf-global-cursor-trail';
    trail.style.left=`${trailX}px`;
    trail.style.top=`${trailY}px`;
    trail.style.setProperty('--trail-scale',String(scale));
    document.body.appendChild(trail);
    setTimeout(()=>trail.remove(),1450);
  };

  window.addEventListener('pointermove',event=>{
    x=event.clientX;y=event.clientY;place();
    const sideQuestsOpen=document.body.classList.contains('project-open')&&!!document.querySelector('.mf-project-shell.is-sidequests-project');
    const shouldHide=hiddenZone(event.target)||(document.body.classList.contains('project-open')&&!sideQuestsOpen)||document.body.classList.contains('art-open');
    const openTarget=event.target?.closest?.('.mf-rw177-row,.mf-rw177-preview,.mf-work-flow-chapter,.mf-guidance-portal,#mfArtButton');
    const openMode=!!openTarget&&!shouldHide;
    const wasVisible=visible;
    visible=!shouldHide;
    cursor.classList.toggle('is-visible',visible);
    cursor.classList.toggle('is-open-mode',openMode);
    const now=performance.now();
    if(!visible||!wasVisible){lastX=x;lastY=y;lastTrailAt=now;return;}
    const distance=Math.hypot(x-lastX,y-lastY);
    /* Keep the previous emitted position while throttled. Updating it on every
       pointer event made fast 120 Hz pointer streams produce no visible trail. */
    if(now-lastTrailAt<18||distance<2.5)return;
    const steps=Math.min(5,Math.max(1,Math.floor(distance/7)));
    for(let step=1;step<=steps;step++){
      const t=step/(steps+1);
      addTrail(lastX+(x-lastX)*t,lastY+(y-lastY)*t,.68+t*.24);
    }
    lastTrailAt=now;lastX=x;lastY=y;
  },{passive:true});

  window.addEventListener('pointerdown',event=>{
    if(event.button!==0||!visible)return;
    const ring=document.createElement('span');
    ring.className='mf-global-cursor-click-ring';
    ring.style.left=`${event.clientX}px`;
    ring.style.top=`${event.clientY}px`;
    document.body.appendChild(ring);
    ring.addEventListener('animationend',()=>ring.remove(),{once:true});
    setTimeout(()=>ring.remove(),900);
  },{passive:true});
  window.addEventListener('pointerleave',()=>{visible=false;cursor.classList.remove('is-visible','is-open-mode');});
  window.addEventListener('blur',()=>{visible=false;cursor.classList.remove('is-visible','is-open-mode');});
})();


/* ============================================================
   V147 — monochrome grid deformation for photographic assets
   ============================================================ */
(function(){
  const finePointer=window.matchMedia('(hover:hover) and (pointer:fine)');
  const reducedMotion=window.matchMedia('(prefers-reduced-motion:reduce)');
  if(!finePointer.matches||reducedMotion.matches)return;

  function initImageGridDistortion(host,sourceSelector){
    if(!host||host.dataset.mfImageGridReady==='true')return;
    const source=host.querySelector(sourceSelector);
    if(!source)return;
    host.dataset.mfImageGridReady='true';
    host.classList.add('mf-image-grid-host');

    const overlay=document.createElement('span');
    overlay.className='mf-image-grid-distortion';
    overlay.setAttribute('aria-hidden','true');
    overlay.style.inset='auto';
    host.appendChild(overlay);

    const syncOverlayGeometry=()=>{
      /* Local layout coordinates avoid double-applying reveal and scroll
         transforms to the BIO overlay. */
      let left=0,top=0,width=source.offsetWidth,height=source.offsetHeight;
      if(source.offsetParent===host){
        left=source.offsetLeft;
        top=source.offsetTop;
      }else{
        const hostRect=host.getBoundingClientRect();
        const sourceRect=source.getBoundingClientRect();
        left=sourceRect.left-hostRect.left;
        top=sourceRect.top-hostRect.top;
        width=sourceRect.width;
        height=sourceRect.height;
      }
      overlay.style.setProperty('left',`${left}px`,'important');
      overlay.style.setProperty('top',`${top}px`,'important');
      overlay.style.setProperty('right','auto','important');
      overlay.style.setProperty('bottom','auto','important');
      overlay.style.width=`${width}px`;
      overlay.style.height=`${height}px`;
    };
    syncOverlayGeometry();
    source.addEventListener('load',syncOverlayGeometry,{passive:true});
    window.addEventListener('resize',syncOverlayGeometry,{passive:true});
    const resizeObserver='ResizeObserver' in window?new ResizeObserver(syncOverlayGeometry):null;
    resizeObserver?.observe(source);
    resizeObserver?.observe(host);

    const columns=8;
    const rows=5;
    const cells=[];

    const buildLayer=(channel)=>{
      const image=source.cloneNode(false);
      image.removeAttribute('id');
      image.removeAttribute('alt');
      image.removeAttribute('loading');
      image.removeAttribute('onerror');
      image.setAttribute('aria-hidden','true');
      image.className=`mf-image-grid-layer is-${channel}`;
      const computed=getComputedStyle(source);
      image.style.objectFit=computed.objectFit||'cover';
      image.style.objectPosition=computed.objectPosition||'50% 50%';
      image.style.filter=computed.filter||'none';
      image.style.opacity=computed.opacity||'1';
      return image;
    };

    for(let row=0;row<rows;row++){
      for(let column=0;column<columns;column++){
        const cell=document.createElement('span');
        cell.className='mf-image-grid-cell';
        cell.style.clipPath=`inset(${row/rows*100}% ${(columns-column-1)/columns*100}% ${(rows-row-1)/rows*100}% ${column/columns*100}%)`;
        cell.append(buildLayer('base'));
        overlay.appendChild(cell);
        cells.push({cell,x:(column+.5)/columns,y:(row+.5)/rows,column,row,tx:0,ty:0,cx:0,cy:0});
      }
    }

    /* Do not reveal partially decoded clone layers. That was the source of the
       occasional first-hover flash on the full-screen Leadership image. */
    let visualsReady=false;
    const clonedImages=[...overlay.querySelectorAll('img')];
    Promise.all(clonedImages.map(image=>{
      if(image.decode)return image.decode().catch(()=>{});
      if(image.complete)return Promise.resolve();
      return new Promise(resolve=>image.addEventListener('load',resolve,{once:true}));
    })).then(()=>{
      visualsReady=true;
      overlay.classList.add('is-ready');
    });

    let pointerX=-9999;
    let pointerY=-9999;
    let lastX=pointerX;
    let lastY=pointerY;
    let velocityX=0;
    let velocityY=0;
    let inside=false;
    let raf=0;
    const effectAllowed=()=>visualsReady&&!host.classList.contains('is-scrolling-away');

    const animate=()=>{
      raf=0;
      const rect=overlay.getBoundingClientRect();
      if(rect.width<1||rect.height<1)return;
      const radius=Math.max(130,Math.min(Math.min(rect.width,rect.height)*.58,330));
      overlay.style.setProperty('--mf-image-grid-radius',`${radius}px`);
      cells.forEach(item=>{
        const centerX=item.x*rect.width;
        const centerY=item.y*rect.height;
        const dx=centerX-pointerX;
        const dy=centerY-pointerY;
        const distance=Math.hypot(dx,dy)||1;
        const influence=inside?Math.pow(Math.max(0,1-distance/radius),1.55):0;
        const push=Math.min(28,Math.max(16,rect.width*.022))*influence;
        item.tx=(dx/distance)*push+velocityX*.15*influence+(item.row%2?1:-1)*2.3*influence;
        item.ty=(dy/distance)*push*.68+velocityY*.11*influence+(item.column%2?1:-1)*1.6*influence;
        item.cx+=(item.tx-item.cx)*.22;
        item.cy+=(item.ty-item.cy)*.22;
        item.cell.style.transform=`translate3d(${item.cx.toFixed(2)}px,${item.cy.toFixed(2)}px,0)`;
      });
      velocityX*=.76;
      velocityY*=.76;
      const unsettled=cells.some(item=>Math.abs(item.tx-item.cx)>.07||Math.abs(item.ty-item.cy)>.07);
      if(inside||unsettled)raf=requestAnimationFrame(animate);
    };
    const queue=()=>{if(!raf)raf=requestAnimationFrame(animate);};
    const reset=()=>{
      inside=false;
      velocityX=0;
      velocityY=0;
      overlay.classList.remove('is-active');
      queue();
    };
    host._mfImageGridReset=reset;

    /* Bind interaction to the visible image, never to empty wrapper space. */
    source.addEventListener('pointermove',event=>{
      if(!effectAllowed()){
        reset();
        return;
      }
      syncOverlayGeometry();
      const rect=overlay.getBoundingClientRect();
      const nextX=event.clientX-rect.left;
      const nextY=event.clientY-rect.top;
      if(!inside){
        lastX=nextX;
        lastY=nextY;
        velocityX=0;
        velocityY=0;
      }else{
        velocityX=nextX-lastX;
        velocityY=nextY-lastY;
      }
      pointerX=nextX;
      pointerY=nextY;
      lastX=nextX;
      lastY=nextY;
      inside=true;
      overlay.style.setProperty('--mf-image-grid-x',`${pointerX}px`);
      overlay.style.setProperty('--mf-image-grid-y',`${pointerY}px`);
      overlay.classList.add('is-active');
      queue();
    },{passive:true});
    source.addEventListener('pointerleave',reset,{passive:true});
    source.addEventListener('pointercancel',reset,{passive:true});

    /* Reset at the exact start of the Leadership scroll fade. This removes
       load/exit blinking and lets the effect initialise cleanly on return. */
    new MutationObserver(()=>{
      if(host.classList.contains('is-scrolling-away'))reset();
    }).observe(host,{attributes:true,attributeFilter:['class']});
  }

  const initStaticTargets=()=>{
    initImageGridDistortion(document.querySelector('.mf-photo-wrap'),'.mf-photo-card');
    document.querySelectorAll('.mf-leadership-hero-photo').forEach(host=>initImageGridDistortion(host,'img'));
    document.querySelectorAll('.mf-leadership-graduates-photo').forEach(host=>initImageGridDistortion(host,'img'));
  };

  initStaticTargets();
  new MutationObserver(initStaticTargets).observe(document.body,{childList:true,subtree:true});
})();


/* ============================================================
   V139 — AFTER HOURS title cycle, stronger desktop hover image follow,
   mobile tap-to-reveal and one-time progress entrance.
   ============================================================ */
(function(){
  const section=document.getElementById('afterHours');
  const list=document.getElementById('mfAfterHoursList');
  const title=document.getElementById('mfAfterHoursTitle');
  if(!section||!list||!title)return;

  const rows=[...list.querySelectorAll('.mf-after-hours-row')];
  const mobile=window.matchMedia('(max-width:1024px), (hover:none), (pointer:coarse)');
  const reduced=window.matchMedia('(prefers-reduced-motion:reduce)');

  const closeMobileRows=except=>{
    rows.forEach(row=>{
      if(row===except)return;
      row.classList.remove('is-mobile-open');
      row.querySelector('.mf-after-hours-trigger')?.setAttribute('aria-expanded','false');
      row.querySelector('.mf-after-hours-preview')?.setAttribute('aria-hidden','true');
    });
  };

  rows.forEach(row=>{
    const trigger=row.querySelector('.mf-after-hours-trigger');
    const preview=row.querySelector('.mf-after-hours-preview');

    row.addEventListener('pointermove',event=>{
      if(mobile.matches)return;
      const rect=row.getBoundingClientRect();
      const nx=Math.max(-.5,Math.min(.5,(event.clientX-rect.left)/Math.max(1,rect.width)-.5));
      const ny=Math.max(-.5,Math.min(.5,(event.clientY-rect.top)/Math.max(1,rect.height)-.5));
      row.style.setProperty('--mf-after-follow-x',`${(nx*116).toFixed(2)}px`);
      row.style.setProperty('--mf-after-follow-y',`${(ny*76).toFixed(2)}px`);
    },{passive:true});
    row.addEventListener('pointerleave',()=>{
      row.style.setProperty('--mf-after-follow-x','0px');
      row.style.setProperty('--mf-after-follow-y','0px');
    },{passive:true});

    trigger?.addEventListener('click',()=>{
      if(!mobile.matches)return;
      const opening=!row.classList.contains('is-mobile-open');
      closeMobileRows(opening?row:null);
      row.classList.toggle('is-mobile-open',opening);
      trigger.setAttribute('aria-expanded',opening?'true':'false');
      preview?.setAttribute('aria-hidden',opening?'false':'true');
    });
  });

  const resetForDesktop=()=>{
    if(mobile.matches)return;
    closeMobileRows(null);
    rows.forEach(row=>row.querySelector('.mf-after-hours-preview')?.setAttribute('aria-hidden','true'));
  };
  mobile.addEventListener?.('change',resetForDesktop);

  const sectionObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        section.classList.add('is-after-hours-visible');
        sectionObserver.disconnect();
      }
    });
  },{threshold:.2});
  sectionObserver.observe(section);

  if(reduced.matches)return;
  const hours=[...title.querySelectorAll('[data-after-word="hours"] i')];
  const dark=[...title.querySelectorAll('[data-after-word="dark"] i')];
  let titleStarted=false;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  async function animateLetters(chars,show,reverse,total=2500){
    if(!chars.length)return;
    const duration=720;
    const stagger=chars.length>1?(total-duration)/(chars.length-1):0;
    const sequence=reverse?[...chars].reverse():chars;
    const animations=sequence.map((char,index)=>{
      const delay=index*stagger;
      const keyframes=show
        ?[{opacity:0,filter:'blur(7px)',transform:'translate3d(0,.34em,0)'},{opacity:1,filter:'blur(0px)',transform:'translate3d(0,0,0)'}]
        :[{opacity:1,filter:'blur(0px)',transform:'translate3d(0,0,0)'},{opacity:0,filter:'blur(7px)',transform:'translate3d(0,-.34em,0)'}];
      const animation=char.animate(keyframes,{duration,delay,easing:'cubic-bezier(.16,1,.3,1)',fill:'forwards'});
      return animation.finished.catch(()=>{}).then(()=>{
        char.style.opacity=show?'1':'0';
        char.style.filter=show?'none':'blur(7px)';
        char.style.transform=show?'none':'translate3d(0,-.34em,0)';
        animation.cancel();
      });
    });
    await Promise.all(animations);
  }

  async function runTitleCycle(){
    while(title.isConnected){
      await wait(1500);
      await animateLetters(hours,false,true,2500);
      await animateLetters(dark,true,false,2500);
      await wait(4000);
      await animateLetters(dark,false,true,2500);
      await animateLetters(hours,true,false,2500);
      await wait(2500);
    }
  }

  const titleObserver=new IntersectionObserver(entries=>{
    if(titleStarted)return;
    if(entries.some(entry=>entry.isIntersecting)){
      titleStarted=true;
      titleObserver.disconnect();
      runTitleCycle();
    }
  },{threshold:.35});
  titleObserver.observe(section);
})();


/* V151 — hard guarantee that staging never falls back to Geist Mono,
   including content inserted after overlays open. */
(function enforceStagingGeist(){
  const apply=root=>{
    const nodes=[];
    if(root?.nodeType===1)nodes.push(root);
    if(root?.querySelectorAll)nodes.push(...root.querySelectorAll('*'));
    nodes.forEach(node=>{
      if(/^(STYLE|SCRIPT|PATH)$/i.test(node.tagName||''))return;
      node.style?.setProperty('font-family','"Geist", Arial, sans-serif','important');
    });
  };
  apply(document.body);
  new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(apply)))
    .observe(document.body,{childList:true,subtree:true});
})();


/* V173 — exact existing hero copy, FoldText-style entrance only. */
(function(){
  const title=document.querySelector('#heroSection .mf-hero-info h1');
  if(!title||title.dataset.mfV173Fold==='1')return;
  title.dataset.mfV173Fold='1';
  const lines=title.innerHTML.split(/<br\s*\/?>/i).map(line=>line.replace(/<[^>]*>/g,'').trim());
  const render=line=>line.split(/(\s+)/).map(part=>{
    if(!part)return '';
    if(/^\s+$/.test(part))return '<span class="mf-hero-fold-space">&nbsp;</span>';
    return `<span class="mf-hero-fold-segment"><span class="mf-hero-fold-piece">${part}</span></span>`;
  }).join('');
  title.setAttribute('aria-label',lines.join(' '));
  title.innerHTML=lines.map(line=>`<span class="mf-hero-fold-line">${render(line)}</span>`).join('');
  const pieces=[...title.querySelectorAll('.mf-hero-fold-piece')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const play=()=>{
    if(title.classList.contains('is-mf-v173-played'))return;
    title.classList.add('is-mf-v173-played');
    if(reduced||!window.gsap){pieces.forEach(piece=>{piece.style.opacity='1';piece.style.transform='none';});return;}
    gsap.to(pieces,{opacity:1,rotateX:0,y:0,duration:.68,stagger:.055,ease:'power3.out',force3D:true});
  };
  if(document.body.classList.contains('mf-page-revealed'))play();
  else new MutationObserver((_,observer)=>{
    if(document.body.classList.contains('mf-page-revealed')){observer.disconnect();requestAnimationFrame(()=>requestAnimationFrame(play));}
  }).observe(document.body,{attributes:true,attributeFilter:['class']});
})();
