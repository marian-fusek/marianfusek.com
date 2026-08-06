import{prepareFold,playFold}from'./fold-text.js';

export function initExperience(items){
  const menu=document.getElementById('experienceMenu');
  const host=document.getElementById('experiencePanels');
  items.forEach((item,index)=>{
    const button=document.createElement('button');
    button.textContent=item[1];
    button.addEventListener('click',()=>document.getElementById(`xp-${index}`).scrollIntoView({behavior:'smooth'}));
    menu.appendChild(button);

    const panel=document.createElement('article');
    panel.id=`xp-${index}`;
    panel.className='experience-panel';
    panel.innerHTML=`<div class="experience-big fold-target"></div><div class="experience-small">${item[0]} · ${item[1]} · ${item[2]}</div>`;
    const big=panel.querySelector('.experience-big');
    big.textContent=item[3];
    host.appendChild(panel);
    prepareFold(big,{words:true});

    const observer=new IntersectionObserver(([entry])=>{
      if(!entry.isIntersecting)return;
      [...menu.children].forEach((node,i)=>node.classList.toggle('active',i===index));
      if(!big.dataset.played){
        big.dataset.played='1';
        playFold(big,{words:true,stagger:.032,duration:.72});
      }
    },{threshold:.54});
    observer.observe(panel);
  });
}
