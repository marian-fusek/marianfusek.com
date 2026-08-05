/* ============================================================
   V141 STAGING — Guidance scroll sequence + contextual OPEN cursor
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
    let ticking=false;

    const render=()=>{
      ticking=false;
      if(reduced.matches){
        section.style.setProperty('--mf-g-progress','0');
        section.style.setProperty('--mf-g-line','1');
        section.style.setProperty('--mf-g-shift','0');
        return;
      }

      const rect=section.getBoundingClientRect();
      const viewport=Math.max(1,window.innerHeight);
      const travel=Math.max(1,section.offsetHeight-viewport);
      const progress=clamp(-rect.top/travel);
      /* The line completes first. Only then does the chapter transition start. */
      const line=clamp(progress/.42);
      const transition=smooth((progress-.42)/.34);

      section.style.setProperty('--mf-g-progress',progress.toFixed(4));
      section.style.setProperty('--mf-g-line',line.toFixed(4));
      section.style.setProperty('--mf-g-shift',transition.toFixed(4));
      if(editorial&&image){
        const imageTravel=Math.max(0,editorial.clientWidth-image.offsetWidth);
        section.style.setProperty('--mf-g-image-x',`${(imageTravel*transition).toFixed(2)}px`);
      }
      section.classList.toggle('is-guidance-pinned',rect.top<=0&&rect.bottom>=viewport);

      const leadershipActive=transition>=.5;
      mindset?.classList.toggle('is-active',!leadershipActive);
      leadership?.classList.toggle('is-active',leadershipActive);
      mindset?.setAttribute('aria-hidden',leadershipActive?'true':'false');
      leadership?.setAttribute('aria-hidden',leadershipActive?'false':'true');
      if(imageIndex)imageIndex.textContent=leadershipActive?'02':'01';
    };

    const requestRender=()=>{
      if(ticking)return;
      ticking=true;
      requestAnimationFrame(render);
    };

    window.addEventListener('scroll',requestRender,{passive:true});
    window.addEventListener('resize',requestRender,{passive:true});
    reduced.addEventListener?.('change',requestRender);
    requestRender();
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
