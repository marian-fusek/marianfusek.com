import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve(new URL('..', import.meta.url).pathname);
const fail=(m)=>{throw new Error(m)};
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const index=read('index.html');
const css=read('styles.css');
const jsFiles=['js/core.js','js/preview.js','js/editor.js','js/tools.js','js/compat-runtime.js','js/projects.js','js/main.js'];
for(const file of [...jsFiles,'sw.js']) execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'pipe'});
for(const file of jsFiles) if(!index.includes(`src="${file}"`)) fail(`index missing ${file}`);
if(index.includes('src="app.js"')) fail('old monolith still referenced');
if(/\/\*\s*Build\s+\d/i.test(css)) fail('build-history comments remain in CSS');
if(!read('js/tools.js').includes("return 'IN PROJECT'")) fail('library state wording not migrated');
if(!index.includes('Adds the font to preview. Apply it in CSS.')) fail('font behavior helper missing');
if(!read('sw.js').includes('/__n7_project__/')) fail('N7 runtime path missing');
if(read('sw.js').includes("RUNTIME_MARKER = '/__mf_project__/'")) fail('legacy runtime marker active');
const legacyRuntime=[...jsFiles.map(read),read('sw.js')].join('\n').match(/__mf|data-mf-|X-MF-Code|source:\s*['\"]mf-/g)||[];
if(legacyRuntime.length) fail(`active legacy runtime identifiers remain: ${legacyRuntime.slice(0,5).join(', ')}`);
const functionNames=new Map();
for(const file of jsFiles){
  const src=read(file);
  for(const m of src.matchAll(/^\s*function\s+([\w$]+)\s*\(/gm)){
    if(functionNames.has(m[1])) fail(`duplicate function ${m[1]} in ${file} and ${functionNames.get(m[1])}`);
    functionNames.set(m[1],file);
  }
}
const large=read('tests/fixtures/large/style.css');
if(large.split('\n').length<20000) fail('large fixture too small');
const requiredFixtures=['tests/fixtures/basic/index.html','tests/fixtures/multipage/index.html','tests/fixtures/multipage/pages/about.html','tests/fixtures/modules/index.html'];
for(const f of requiredFixtures) if(!fs.existsSync(path.join(root,f))) fail(`missing fixture ${f}`);
console.log(JSON.stringify({ok:true,modules:jsFiles.length,functions:functionNames.size,cssLines:css.split('\n').length,largeFixtureLines:large.split('\n').length},null,2));
