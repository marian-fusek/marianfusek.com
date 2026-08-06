import{playFold,prepareFold}from'./fold-text.js';

const clamp=(v,min=0,max=1)=>Math.min(max,Math.max(min,v));
const easeOut=t=>1-Math.pow(1-clamp(t),3);

export function initWorks(items){
  const section=document.getElementById('works');
  const stack=document.getElementById('workStack');
  const intro=document.querySelector('.works-intro');
  const title=intro.querySelector('h2');
  const sub=intro.querySelector('p');

  items.forEach((item,i)=>{
    const card=document.createElement('button');
    card.className='work-card';
    card.dataset.index=i;
    card.setAttribute('aria-label',`Open ${item.title} case study`);
    card.innerHTML=`<img src="${item.image}" alt="${item.title}"><span class="stack-shade"></span><span class="work-card-info"><strong class="work-card-title">${item.title}</strong><span class="work-card-side"><span>${item.meta}</span><span class="work-description">${item.description}</span></span></span>`;
    card.addEventListener('click',()=>openProject(item));
    stack.appendChild(card);
  });

  prepareFold(title,{words:true});
  prepareFold(sub,{words:true});
  const cards=[...stack.children];
  let introPlayed=false;
  let visualProgress=0;
  let lastTarget=0;

  function render(){
    const rect=section.getBoundingClientRect();
    const travel=Math.max(1,section.offsetHeight-innerHeight);
    const target=clamp(-rect.top/travel);
    visualProgress+=(target-visualProgress)*.115;
    const direction=target-lastTarget;
    lastTarget=target;

    if(!introPlayed&&rect.top<=innerHeight*.02){
      introPlayed=true;
      playFold(title,{words:true,stagger:.11,duration:.78});
      playFold(sub,{words:true,delay:.30,stagger:.035,duration:.68});
    }

    const firstEntry=clamp((visualProgress-.16)/.13);
    intro.style.opacity=String(1-easeOut(firstEntry));
    intro.style.transform=`translate3d(0,${-10*firstEntry}px,0)`;

    cards.forEach((card,i)=>{
      const entryStart=.16+i*.235;
      const enter=clamp((visualProgress-entryStart)/.145);
      const next=clamp((visualProgress-(entryStart+.235))/.15);
      const easedEnter=easeOut(enter);
      const easedNext=easeOut(next);
      const depthCount=Math.max(0,cards.length-1-i);
      const exposed=18;
      const travelY=(1-easedEnter)*108;
      const pushedY=easedNext*(exposed*(i+1));
      const scale=1-(easedNext*.045)-(depthCount*.0025*easedNext);

      card.style.zIndex=String(i+2);
      card.style.opacity=enter<=.005?'0':'1';
      card.style.transform=`translate3d(0,calc(${travelY}vh - ${pushedY}px),0) scale(${scale})`;
      card.classList.toggle('is-present',enter>.04&&next<.995);
      card.classList.toggle('settled',enter>.94&&next<.12&&Math.abs(direction)<.012);
      const shade=clamp(next*.72);
      card.querySelector('.stack-shade').style.opacity=String(shade);
    });

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

function openProject(item){
  const overlay=document.getElementById('projectOverlay');
  const content=document.getElementById('overlayContent');
  content.innerHTML=`<h2 class="overlay-title">${item.title}</h2><div class="overlay-meta">${item.meta} · ${item.description}</div><div class="overlay-gallery">${item.gallery.map(src=>`<img src="${src}" alt="">`).join('')}</div>`;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
}

export function closeProject(){
  const overlay=document.getElementById('projectOverlay');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden','true');
  document.body.style.overflow='';
}
