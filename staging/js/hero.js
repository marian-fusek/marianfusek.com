import{playFold,prepareFold}from'./fold-text.js';

export function initHero(copy){
  const statement=document.getElementById('heroStatement');
  const name=document.getElementById('heroName');
  statement.textContent=copy.statement;
  name.textContent=copy.name;
  prepareFold(statement,{words:true});
  prepareFold(name,{words:true});
  playFold(statement,{words:true,stagger:.052,duration:.78});
  window.setTimeout(()=>type(copy.typewriter),1050);
  window.setTimeout(()=>playFold(name,{words:true,stagger:.10,duration:.78}),2050);
}

function type(text){
  const el=document.getElementById('typewriter');
  let index=0;
  function step(){
    el.textContent=text.slice(0,index++);
    if(index<=text.length)window.setTimeout(step,21);
  }
  step();
}
