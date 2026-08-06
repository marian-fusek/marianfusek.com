
import{playFold,prepareFold}from'./fold-text.js';
const clamp=(v,min=0,max=1)=>Math.min(max,Math.max(min,v));
const easeOut=t=>1-Math.pow(1-clamp(t),3);
export function initWorks(items){
  const section=document.getElementById('works'),stack=document.getElementById('workStack'),intro=document.querySelector('.works-intro');
  const title=intro.querySelector('h2'),sub=intro.querySelector('p');
  items.forEach((item,i)=>{const card=document.createElement('button');card.className='work-card';card.dataset.index=i;card.setAttribute('aria-label',`Open ${item.title} case study`);card.innerHTML=`<img src="${item.image}" alt="${item.title}"><span class="stack-shade"></span><span class="work-card-info"><strong class="work-card-title">${item.title}</strong><span class="work-card-side"><span>${item.meta}</span><span class="work-description">${item.description}</span></span></span>`;card.addEventListener('click',()=>openProject(item));stack.appendChild(card)});
  prepareFold(title,{words:true});prepareFold(sub,{words:true});
  const cards=[...stack.children];let introPlayed=false,visualProgress=0,lastTarget=0;
  function render(){
    const rect=section.getBoundingClientRect(),travel=Math.max(1,section.offsetHeight-innerHeight),target=clamp(-rect.top/travel);
    visualProgress+=(target-visualProgress)*.105;const speed=Math.abs(target-lastTarget);lastTarget=target;
    if(!introPlayed&&rect.top<=innerHeight*.05){introPlayed=true;playFold(title,{words:true,stagger:.085,duration:.76});playFold(sub,{words:true,delay:.28,stagger:.025,duration:.65})}
    const firstEntry=clamp((visualProgress-.115)/.115);intro.style.opacity=String(1-easeOut(firstEntry));intro.style.transform=`translate3d(0,${-8*firstEntry}px,0)`;
    cards.forEach((card,i)=>{
      const entryStart=.115+i*.255,enter=clamp((visualProgress-entryStart)/.13),next=clamp((visualProgress-(entryStart+.255))/.13);
      const e=easeOut(enter),n=easeOut(next),exposed=23;
      const travelY=(1-e)*104,pushedY=n*(exposed*(i+1)),scale=1-n*.028;
      card.style.zIndex=String(i+2);card.style.opacity=enter<=.004?'0':'1';card.style.transform=`translate3d(0,calc(${travelY}vh - ${pushedY}px),0) scale(${scale})`;
      card.classList.toggle('is-present',enter>.05&&next<.98);card.classList.toggle('settled',enter>.90&&next<.16&&speed<.018);
      card.querySelector('.stack-shade').style.opacity=String(clamp(next*.78));
    });
    requestAnimationFrame(render)
  }requestAnimationFrame(render)
}
function openProject(item){const overlay=document.getElementById('projectOverlay'),content=document.getElementById('overlayContent');content.innerHTML=`<h2 class="overlay-title">${item.title}</h2><div class="overlay-meta">${item.meta} · ${item.description}</div><div class="overlay-gallery">${item.gallery.map(src=>`<img src="${src}" alt="">`).join('')}</div>`;overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
export function closeProject(){const overlay=document.getElementById('projectOverlay');overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');document.body.style.overflow=''}
