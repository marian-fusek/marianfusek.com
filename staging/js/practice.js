export function initPractice(rows){
  const host=document.getElementById('practiceRows');
  rows.forEach((row,index)=>{
    const item=document.createElement('article');
    item.className='practice-row';
    item.innerHTML=`<div class="practice-title"><span>${row[0]}</span><span>${row[1]}</span></div><p class="practice-desc">${row[2]}</p>`;
    host.appendChild(item);
    const observer=new IntersectionObserver(([entry])=>{
      if(!entry.isIntersecting)return;
      window.setTimeout(()=>item.classList.add('visible'),index*95);
      observer.disconnect();
    },{threshold:.16,rootMargin:'0px 0px -8%'});
    observer.observe(item);
  });
}
