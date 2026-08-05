/* ============================================================
   V142 STAGING — captured Guidance sequence + contextual OPEN cursor
   The page does not travel while the Guidance timeline is active.
   ============================================================ */
(function(){
  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
  const smooth=value=>{
    const x=clamp(value);
    return x*x*(3-2*x);
  };

  function initGuidanceEditorial(){
    const section=document.querySelector('.mf-guidance-scroll');
    const sticky=document.getElementById('mfGuidanceSticky');
    const imageIndex=document.getElementById('mfGuidanceImageIndex');
    const editorial=document.getElementById('mfGuidanceEditorial');
    const image=document.getElementById('mfGuidanceEditorialImage');
    if(!section||!sticky)return;

    const mindset=section.querySelector('.mf-guidance-editorial-chapter.is-mindset');
    const leadership=section.querySelector('.mf-guidance-editorial-chapter.is-leadership');
    const reduced=window.matchMedia('(prefers-reduced-motion:reduce)');
    const coarse=window.matchMedia('(hover:none), (pointer:coarse)');

    let current=0;
    let target=0;
    let captured=false;
    let boundaryCarry=0;
    let frame=0;
    let anchorY=0;
    let lastDirection=1;
    let touchY=null;
    let touchCarry=0;
    let ignoreCaptureUntil=0;

    const lineEnd=.43;
    const transitionEnd=.84;
    const inputDistance=1500;
    const boundaryRelease=150;

    const sectionTop=()=>Math.round(section.getBoundingClientRect().top+window.scrollY);

    function applyProgress(progress){
      const line=clamp(progress/lineEnd);
      const transition=smooth((progress-lineEnd)/(transitionEnd-lineEnd));

      section.style.setProperty('--mf-g-progress',progress.toFixed(4));
      section.style.setProperty('--mf-g-line',line.toFixed(4));
      section.style.setProperty('--mf-g-shift',transition.toFixed(4));

      if(editorial&&image){
        const imageTravel=Math.max(0,editorial.clientWidth-image.offsetWidth);
        section.style.setProperty('--mf-g-image-x',`${(imageTravel*transition).toFixed(2)}px`);
      }

      const leadershipActive=transition>=.5;
      mindset?.classList.toggle('is-active',!leadershipActive);
      leadership?.classList.toggle('is-active',leadershipActive);
      mindset?.setAttribute('aria-hidden',leadershipActive?'true':'false');
      leadership?.setAttribute('aria-hidden',leadershipActive?'false':'true');
      if(imageIndex)imageIndex.textContent=leadershipActive?'02':'01';
    }

    function render(){
      frame=0;
      if(captured&&Math.abs(window.scrollY-anchorY)>.5){
        window.scrollTo(0,anchorY);
      }

      current+=(target-current)*.105;
      if(Math.abs(target-current)<.00015)current=target;
      applyProgress(current);

      if(captured||current!==target)frame=requestAnimationFrame(render);
    }

    function requestRender(){
      if(!frame)frame=requestAnimationFrame(render);
    }

    function capture(direction){
      if(reduced.matches||Date.now()<ignoreCaptureUntil)return false;
      captured=true;
      lastDirection=direction||lastDirection;
      anchorY=sectionTop();
      window.scrollTo(0,anchorY);
      boundaryCarry=0;
      touchCarry=0;
      section.classList.add('is-guidance-captured');
      document.documentElement.classList.add('mf-guidance-input-captured');
      requestRender();
      return true;
    }

    function release(direction,carry=0){
      captured=false;
      boundaryCarry=0;
      touchCarry=0;
      section.classList.remove('is-guidance-captured');
      document.documentElement.classList.remove('mf-guidance-input-captured');
      ignoreCaptureUntil=Date.now()+260;

      const nudge=Math.max(4,Math.min(72,Math.abs(carry)*.28));
      window.scrollTo(0,anchorY+(direction>0?nudge:-nudge));
    }

    function shouldCapture(direction){
      if(reduced.matches||Date.now()<ignoreCaptureUntil)return false;
      const rect=section.getBoundingClientRect();
      const viewport=Math.max(1,window.innerHeight);
      const approachingFromAbove=direction>0&&rect.top<=Math.min(26,viewport*.04)&&rect.bottom>viewport*.72;
      const approachingFromBelow=direction<0&&rect.bottom>=viewport-Math.min(26,viewport*.04)&&rect.top<viewport*.28;
      return approachingFromAbove||approachingFromBelow;
    }

    function prepareEntry(direction){
      if(direction>0&&current>.995){
        current=target=0;
        applyProgress(0);
      }else if(direction<0&&current<.005){
        current=target=1;
        applyProgress(1);
      }
    }

    function consume(delta){
      const direction=Math.sign(delta)||lastDirection;
      lastDirection=direction;

      if(!captured){
        if(!shouldCapture(direction))return false;
        prepareEntry(direction);
        if(!capture(direction))return false;
      }

      const atEnd=target>=.9995;
      const atStart=target<=.0005;

      if((atEnd&&delta>0)||(atStart&&delta<0)){
        boundaryCarry+=Math.abs(delta);
        if(boundaryCarry>=boundaryRelease){
          release(direction,boundaryCarry);
        }
        return true;
      }

      boundaryCarry=0;
      target=clamp(target+delta/inputDistance);
      requestRender();
      return true;
    }

    window.addEventListener('wheel',event=>{
      if(reduced.matches)return;
      const delta=Math.abs(event.deltaY)>=Math.abs(event.deltaX)?event.deltaY:event.deltaX;
      if(!delta)return;
      if(consume(delta))event.preventDefault();
    },{passive:false,capture:true});

    window.addEventListener('keydown',event=>{
      if(reduced.matches||event.defaultPrevented)return;
      let delta=0;
      if(event.key==='ArrowDown'||event.key==='PageDown'||event.key===' ')delta=190;
      if(event.key==='ArrowUp'||event.key==='PageUp')delta=-190;
      if(!delta)return;
      if(consume(delta))event.preventDefault();
    },{capture:true});

    section.addEventListener('touchstart',event=>{
      if(!event.touches.length)return;
      touchY=event.touches[0].clientY;
      touchCarry=0;
    },{passive:true});

    section.addEventListener('touchmove',event=>{
      if(reduced.matches||touchY==null||!event.touches.length)return;
      const nextY=event.touches[0].clientY;
      const delta=touchY-nextY;
      touchY=nextY;
      touchCarry+=Math.abs(delta);
      if(consume(delta*1.85))event.preventDefault();
    },{passive:false});

    section.addEventListener('touchend',()=>{
      touchY=null;
      touchCarry=0;
    },{passive:true});

    window.addEventListener('resize',()=>{
      if(captured){
        anchorY=sectionTop();
        window.scrollTo(0,anchorY);
      }
      requestRender();
    },{passive:true});

    reduced.addEventListener?.('change',()=>{
      if(reduced.matches&&captured)release(lastDirection,0);
      requestRender();
    });

    /* Keep the indicator visible only while the viewport is actually held here. */
    const observer=new IntersectionObserver(entries=>{
      const entry=entries[0];
      section.classList.toggle('is-guidance-near',entry.isIntersecting&&entry.intersectionRatio>.72);
    },{threshold:[0,.72,.98]});
    observer.observe(section);

    applyProgress(0);
  }

  function initOpenCursor(){
    if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches)return;
    const cursor=document.querySelector('.mf-global-cursor');
    if(!cursor){
      requestAnimationFrame(initOpenCursor);
      return;
    }
    if(!cursor.querySelector('.mf-global-cursor-open-copy')){
      const copy=document.createElement('span');
      copy.className='mf-global-cursor-open-copy';
      copy.textContent='OPEN';
      cursor.appendChild(copy);
    }

    const isOpenZone=target=>!!target?.closest?.('#work,.mf-guidance-scroll,#mfArtButton');
    window.addEventListener('pointermove',event=>{
      cursor.classList.toggle('is-open-mode',isOpenZone(event.target));
    },{passive:true});
    window.addEventListener('pointerleave',()=>cursor.classList.remove('is-open-mode'),{passive:true});
    window.addEventListener('blur',()=>cursor.classList.remove('is-open-mode'),{passive:true});
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{
      initGuidanceEditorial();
      initOpenCursor();
    },{once:true});
  }else{
    initGuidanceEditorial();
    initOpenCursor();
  }
})();
