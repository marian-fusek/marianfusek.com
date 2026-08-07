import{runLoader}from'./loader.js';import{initHero}from'./hero.js';import{initWorks,closeProject}from'./works.js';import{initGuidance}from'./guidance.js';import{initPractice}from'./practice.js';import{initExperience}from'./experience.js';import{initProfile}from'./profile.js';import{initHeresy}from'./heresy.js';import{initCursor}from'./cursor.js';
const copy=await fetch('content/site-copy.json').then(r=>r.json());
initSmoothScroll();initCursor();initWorks(copy.works);initGuidance(copy.guidance);initPractice(copy.practice);initExperience(copy.experience);initProfile(copy.profile);initHeresy(copy.heresy);document.querySelector('.overlay-close').onclick=closeProject;document.addEventListener('keydown',e=>{if(e.key==='Escape')closeProject()});await runLoader();initHero(copy.hero);
function initSmoothScroll(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  if(window.Lenis){const lenis=new Lenis({duration:1.18,easing:t=>Math.min(1,1.001-Math.pow(2,-10*t)),smoothWheel:true,wheelMultiplier:.88,touchMultiplier:1.1});window.__mfLenis=lenis;const raf=t=>{lenis.raf(t);requestAnimationFrame(raf)};requestAnimationFrame(raf);document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const target=document.querySelector(a.getAttribute('href'));if(target){e.preventDefault();lenis.scrollTo(target,{duration:1.25})}}));}
}
