export function initCursor(){
  if(!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
  const cursor=document.createElement('div');cursor.className='global-cursor';cursor.innerHTML='<span class="cursor-dot"></span><span class="cursor-open">OPEN</span>';document.body.appendChild(cursor);document.body.classList.add('custom-cursor');
  let x=-100,y=-100,visible=false;
  addEventListener('pointermove',e=>{x=e.clientX;y=e.clientY;cursor.style.transform=`translate3d(${x}px,${y}px,0)`;const target=e.target.closest('.work-card,.guidance-zone,.overlay-close,a,button');const openTarget=e.target.closest('.work-card,.guidance-zone');visible=true;cursor.classList.add('visible');cursor.classList.toggle('open-mode',!!openTarget);if(openTarget?.classList.contains('guidance-left'))cursor.querySelector('.cursor-open').textContent='OPEN MC';else if(openTarget?.classList.contains('guidance-right'))cursor.querySelector('.cursor-open').textContent='OPEN TL';else cursor.querySelector('.cursor-open').textContent='OPEN'}, {passive:true});
  addEventListener('pointerleave',()=>cursor.classList.remove('visible','open-mode'));
  addEventListener('pointerdown',e=>{if(e.button!==0||!visible)return;const ring=document.createElement('span');ring.className='cursor-ring';ring.style.left=`${e.clientX}px`;ring.style.top=`${e.clientY}px`;document.body.appendChild(ring);setTimeout(()=>ring.remove(),760)},{passive:true});
}
