import{playFold,prepareFold}from'./fold-text.js';
export function initHero(data){
  const statement=document.getElementById('heroStatement'),name=document.getElementById('heroName'),typewriter=document.getElementById('typewriter'),typeWrap=document.querySelector('.hero-type');
  statement.dataset.text=data.statement;name.dataset.text=data.name;
  prepareFold(statement,{lines:true});prepareFold(name,{words:true});
  playFold(statement,{lines:true,stagger:.075,duration:.72,crease:.48});
  const statementPieces=statement.querySelectorAll('.fold-piece').length;
  const typeDelay=Math.max(850,statementPieces*75+520);
  setTimeout(()=>{typeWrap.animate([{opacity:0,transform:'translateY(8px)'},{opacity:.72,transform:'translateY(0)'}],{duration:520,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});type(data.typewriter,typewriter)},typeDelay);
  setTimeout(()=>playFold(name,{words:true,stagger:.11,duration:.82,crease:.32}),typeDelay+620);
}
function type(text,el){let index=0;const step=()=>{el.textContent=text.slice(0,index++);if(index<=text.length)setTimeout(step,18)};step()}
