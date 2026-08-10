import {value} from './value.js';
const extra=await import('./extra.js');
const data=await fetch('../data/info.json').then(r=>r.json());
document.querySelector('#out').textContent=`${value}-${extra.default}-${data.ok}`;
