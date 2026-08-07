(() => {
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ONE smooth-scroll owner. Keeps wheel/trackpad response immediate but lets
     the actual document position settle with a restrained eased tail. */
  class SmoothScroll{
    constructor(){
      this.current=window.scrollY;
      this.target=this.current;
      this.raf=0;
      this.enabled=matchMedia('(pointer:fine)').matches&&!reduce;
      if(!this.enabled)return;
      addEventListener('wheel',e=>this.onWheel(e),{passive:false});
      addEventListener('keydown',e=>this.onKey(e));
      addEventListener('scroll',()=>{
        if(!this.raf){this.current=this.target=window.scrollY;}
      },{passive:true});
    }
    max(){return Math.max(0,document.documentElement.scrollHeight-innerHeight)}
    onWheel(e){
      if(e.ctrlKey||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
      e.preventDefault();
      let d=e.deltaMode===1?e.deltaY*17:e.deltaMode===2?e.deltaY*innerHeight:e.deltaY;
      d=clamp(d,-190,190);
      this.target=clamp(this.target+d,0,this.max());
      this.start();
    }
    onKey(e){
      if(/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)||e.metaKey||e.ctrlKey||e.altKey)return;
      const step={ArrowDown:76,ArrowUp:-76,PageDown:innerHeight*.78,PageUp:-innerHeight*.78,' ':innerHeight*.78};
      if(e.key==='Home'){e.preventDefault();this.target=0;this.start();return}
      if(e.key==='End'){e.preventDefault();this.target=this.max();this.start();return}
      if(!(e.key in step))return;
      e.preventDefault();this.target=clamp(this.target+step[e.key],0,this.max());this.start();
    }
    start(){if(!this.raf)this.raf=requestAnimationFrame(()=>this.tick())}
    tick(){
      this.current=lerp(this.current,this.target,.132);
      if(Math.abs(this.target-this.current)<.28)this.current=this.target;
      window.scrollTo(0,this.current);
      document.dispatchEvent(new CustomEvent('mf:smoothscroll',{detail:{y:this.current,target:this.target}}));
      if(this.current!==this.target)this.raf=requestAnimationFrame(()=>this.tick());else this.raf=0;
    }
    goTo(y){this.target=clamp(y,0,this.max());this.start()}
  }
  const smooth=new SmoothScroll();

  /* Hero copy: exactly three authored lines, typed in sequence. */
  const typeLines=[...document.querySelectorAll('.type-line')];
  async function typeHero(){
    await wait(260);
    for(const line of typeLines){
      const text=line.dataset.type||'';
      line.textContent='';line.classList.add('is-typing');
      for(const char of text){line.textContent+=char;await wait(reduce?2:(char===' '?15:28));}
      await wait(reduce?10:190);line.classList.remove('is-typing');
    }
  }
  const heroTypingDone=typeHero();

  /* Clean recreation of the original Marian Fusek loop. Nothing else touches
     these letters. Effects shuffle so the name stays alive without constant motion. */
  const heroName=document.getElementById('heroName');
  const letters=[...heroName.querySelectorAll('.name-letter')];
  const byIndex=i=>letters[i];
  async function accent(index,char){
    const el=byIndex(index);if(!el)return;
    const original=el.textContent;el.textContent=char;await wait(600);el.textContent=original;
  }
  async function disappear(){
    const keep=new Set([0,6]);
    letters.forEach((el,i)=>{if(!keep.has(i))el.style.opacity='0'});
    await wait(2100);
    letters.forEach(el=>el.style.opacity='');
    await wait(400);
  }
  async function rgb(){
    const pool=[...letters];
    const picks=pool.sort(()=>Math.random()-.5).slice(0,3);
    let frame=0,total=120;
    await new Promise(resolve=>{
      const timer=setInterval(()=>{
        frame++;const t=frame/total,amp=Math.sin(t*Math.PI)*4,j=(Math.random()-.5)*.8;
        const x=(amp+j).toFixed(2),nx=(-(amp+j*.7)).toFixed(2);
        picks.forEach(el=>{el.style.textShadow=`${x}px 0 3px rgba(226,27,22,.72),${nx}px 0 3px rgba(0,167,255,.72)`});
        if(frame>=total){clearInterval(timer);picks.forEach(el=>el.style.textShadow='');resolve();}
      },16);
    });
  }
  async function blurFx(){
    letters.forEach(el=>{el.style.transition='filter .5s cubic-bezier(.16,1,.3,1)';el.style.filter='blur(3px)'});
    await wait(1300);
    letters.forEach(el=>{el.style.transition='filter .8s cubic-bezier(.16,1,.3,1)';el.style.filter='blur(0)'});
    await wait(900);
    letters.forEach(el=>{el.style.transition='';el.style.filter=''});
  }
  const effects=[()=>accent(4,'Á'),()=>accent(7,'Ů'),disappear,rgb,blurFx];
  const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};
  async function runNameLoop(){
    if(reduce)return;
    await heroTypingDone;
    await wait(1900);let q=[];
    while(true){if(!q.length)q=shuffle(effects);await q.shift()();await wait(2600);}
  }
  runNameLoop();

  /* Grid hover: center fade is CSS-only; hover only wakes the nearest existing lines. */
  const hoverLines=[];
  const addLine=(axis,pos)=>{
    const line=document.createElement('span');line.className='grid-hover-line';
    if(axis==='v'){line.style.left=`${pos}%`;line.style.top='0';line.style.bottom='0';line.style.width='1px'}
    else{line.style.top=`${pos}%`;line.style.left='0';line.style.right='0';line.style.height='1px'}
    document.body.appendChild(line);hoverLines.push({line,axis,pos});
  };
  for(let i=1;i<10;i++)addLine('v',i*10);addLine('h',33.333);addLine('h',66.666);
  addEventListener('pointermove',e=>{
    if(e.pointerType==='touch')return;
    const x=e.clientX/innerWidth*100,y=e.clientY/innerHeight*100;
    hoverLines.forEach(o=>o.line.classList.toggle('is-on',Math.abs((o.axis==='v'?x:y)-o.pos)<1.15));
  },{passive:true});

  /* Shared Reveal = the user-defined masked upward reveal with blur resolving.
     This is the only reveal implementation in this clean staging build. */
  function buildReveal(el,mode='chars'){
    if(el.dataset.revealBuilt)return [];
    el.dataset.revealBuilt='1';
    const text=el.textContent;el.textContent='';
    const parts=mode==='words'?text.split(/(\s+)/):Array.from(text),pieces=[];
    for(const part of parts){
      if(!part)continue;
      if(/^\s+$/.test(part)){el.append(document.createTextNode(part));continue}
      const mask=document.createElement('span');mask.className='reveal-mask';
      const piece=document.createElement('span');piece.className='reveal-piece';piece.textContent=part;
      mask.appendChild(piece);el.appendChild(mask);pieces.push(piece);
    }
    return pieces;
  }
  const revealSets=[...document.querySelectorAll('[data-reveal]')].map(el=>({pieces:buildReveal(el,el.dataset.reveal)}));
  let revealPlayed=false;
  function playHeadingReveal(){
    if(revealPlayed)return;revealPlayed=true;
    revealSets.forEach((set,setIndex)=>set.pieces.forEach((piece,i)=>setTimeout(()=>piece.classList.add('is-in'),setIndex*220+i*(setIndex?42:28))));
  }

  /* RECENT WORKS — one state machine only. */
  const section=document.getElementById('projects');
  const stage=section.querySelector('.projects-sticky');
  const heading=document.getElementById('projectsHeading');
  const menu=document.getElementById('projectsMenu');
  const rows=[...menu.querySelectorAll('.project-row')];
  const preview=document.getElementById('projectPreview');
  const image=document.getElementById('projectPreviewImage');
  const data=[
    {title:'MIUNĀE',src:'../media/projects/miunae/01-miunae-logo.jpg'},
    {title:'GoBaller',src:'../media/projects/goballer/01-goballer-logo.jpg'},
    {title:'AIMS',src:'../media/projects/aims/01-aims-logo.jpg'},
    {title:'Explorations',src:'../media/projects/vault/01-nofakie-1.jpg'}
  ];
  data.forEach(item=>{const pre=new Image();pre.src=item.src});
  let headingOn=false,menuOn=false,active=-1,swapToken=0;
  function showHeading(){if(headingOn)return;headingOn=true;heading.classList.add('is-visible');playHeadingReveal()}
  function showMenu(){
    if(menuOn)return;menuOn=true;menu.classList.add('is-visible');
    rows.forEach((r,i)=>setTimeout(()=>r.classList.add('is-revealed'),i*150));
  }
  function setActive(index){
    index=clamp(index,0,data.length-1);if(index===active)return;
    active=index;rows.forEach((r,i)=>r.classList.toggle('is-active',i===index));
    const token=++swapToken;
    preview.classList.add('is-swapping');
    setTimeout(()=>{
      if(token!==swapToken)return;
      image.onload=()=>{if(token===swapToken)preview.classList.remove('is-swapping')};
      image.src=data[index].src;image.alt=`${data[index].title} project preview`;
      if(image.complete)preview.classList.remove('is-swapping');
    },220);
  }
  function renderProjects(){
    const rect=section.getBoundingClientRect();
    const travel=Math.max(1,section.offsetHeight-innerHeight);
    const p=clamp(-rect.top/travel,0,1);

    // a real empty-background arrival before anything appears
    if(p>=.115)showHeading();
    if(p>=.195)showMenu();

    const start=.265,end=.775;
    if(p>=start){
      preview.classList.add('is-visible');
      const q=clamp((p-start)/(end-start),0,.999999);
      scrollActive=Math.min(3,Math.floor(q*4));
      setActive(scrollActive);
    }else{
      preview.classList.remove('is-visible');
      rows.forEach(r=>r.classList.remove('is-active'));active=-1;scrollActive=-1;
    }

    stage.classList.toggle('is-exiting',p>.845);
  }
  addEventListener('scroll',renderProjects,{passive:true});
  document.addEventListener('mf:smoothscroll',renderProjects);
  addEventListener('resize',renderProjects,{passive:true});
  renderProjects();

  // hover can preview/highlight but does not alter scroll position
  let scrollActive=-1;
  rows.forEach((row,i)=>{
    row.addEventListener('mouseenter',()=>{if(menuOn)setActive(i)});
    row.addEventListener('mouseleave',()=>{if(scrollActive>=0)setActive(scrollActive)});
  });

  /* Cursor. Click pulse is intentionally black. */
  const cursor=document.getElementById('cursor');
  let cx=-100,cy=-100,tx=-100,ty=-100,craf=0;
  function cursorTick(){
    cx=lerp(cx,tx,.36);cy=lerp(cy,ty,.36);
    cursor.style.transform=`translate3d(${cx-5}px,${cy-5}px,0)`;
    if(Math.abs(cx-tx)+Math.abs(cy-ty)>.2)craf=requestAnimationFrame(cursorTick);else craf=0;
  }
  addEventListener('pointermove',e=>{
    tx=e.clientX;ty=e.clientY;if(!craf)craf=requestAnimationFrame(cursorTick);
    cursor.classList.toggle('is-open',!!e.target.closest('.project-row'));
  },{passive:true});
  addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    const ring=document.createElement('span');ring.className='cursor-click';ring.style.left=`${e.clientX}px`;ring.style.top=`${e.clientY}px`;
    document.body.appendChild(ring);setTimeout(()=>ring.remove(),760);
  },{passive:true});

  document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
    const target=document.querySelector(a.getAttribute('href'));if(!target)return;e.preventDefault();
    const y=target.getBoundingClientRect().top+window.scrollY;
    if(smooth.enabled)smooth.goTo(y);else window.scrollTo({top:y,behavior:'smooth'});
  }));
})();
