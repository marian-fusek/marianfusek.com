import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(new URL('..', import.meta.url).pathname);
class ClassList { add(){} remove(){} toggle(){} contains(){return false;} }
class Dummy {
  constructor(){this.classList=new ClassList();this.dataset={};this.style={setProperty(){}};this.hidden=false;this.value='';this.textContent='';this.innerHTML='';this.files=[];this.children=[];this.parentElement=null;this.scrollTop=0;this.scrollLeft=0;this.clientHeight=600;this.clientWidth=800;this.selectionStart=0;this.selectionEnd=0;}
  querySelector(){return new Dummy();} querySelectorAll(){return [];} appendChild(x){return x;} addEventListener(){} removeEventListener(){} setAttribute(){} getAttribute(){return null;} removeAttribute(){} focus(){} blur(){} click(){} closest(){return null;} matches(){return false;} contains(){return false;} scrollIntoView(){} setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;} getBoundingClientRect(){return {width:800,height:600,left:0,right:800,top:0,bottom:600};} setPointerCapture(){}
}
const doc=new Dummy(); doc.body=new Dummy(); doc.documentElement=new Dummy(); doc.visibilityState='visible'; doc.createElement=()=>new Dummy(); doc.querySelector=()=>new Dummy(); doc.querySelectorAll=()=>[]; doc.getElementById=()=>new Dummy();
const storage=new Map();
const windowObj={document:doc,Prism:null,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},addEventListener(){},removeEventListener(){},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:(fn)=>{return 0;},cancelAnimationFrame(){},open(){return null;},location:{protocol:'https:',href:'https://example.test/n7/',origin:'https://example.test',pathname:'/n7/'},navigator:{},URL,Blob,Map,Set};
const context=vm.createContext({window:windowObj,document:doc,navigator:{platform:'MacIntel',userAgent:'node'},console,URL,Blob,Map,Set,WeakMap,WeakSet,Promise,JSON,Date,Math,RegExp,String,Number,Boolean,Array,Object,Error,TypeError,TextEncoder,TextDecoder,queueMicrotask,requestAnimationFrame:()=>0,setTimeout:()=>0,clearTimeout(){},localStorage:windowObj.localStorage,CSS:{escape:s=>String(s)},performance:{now:()=>0}});
windowObj.window=windowObj; windowObj.navigator=context.navigator; windowObj.requestAnimationFrame=context.requestAnimationFrame;
const files=['js/core.js','js/preview.js','js/editor.js','js/tools.js','js/compat-runtime.js','js/projects.js','js/main.js'];
for(const file of files){
  let source=fs.readFileSync(path.join(root,file),'utf8');
  if(file==='js/main.js') source=source.split(/\n  migrateLegacyStorage\(\);/)[0];
  try{vm.runInContext(source,context,{filename:file});}catch(e){console.error(file,e);process.exit(1);}
}
console.log(JSON.stringify({ok:true,loaded:files.length,mode:'pre-init browser-structure smoke'},null,2));
