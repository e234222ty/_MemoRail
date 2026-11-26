import initSudachi,{Tokenizer} from './vendor/sudachi/sudachi_wasm.js';
import {loadPyodide} from './vendor/pyodide/pyodide.mjs';
import {loadDictionary} from './dictionary-loader.mjs';

let ready=null,queue=Promise.resolve();
const metrics={};
const fetchOK=async url=>{const response=await fetch(url);if(!response.ok)throw new Error('Runtime asset unavailable.');return response;};
async function prepare(progress){
  const started=performance.now();
  const [dictionary,,py,source,bridge]=await Promise.all([
    loadDictionary(progress,metrics,{onMetrics:()=>self.postMessage({type:'metrics',metrics})}),
    initSudachi({module_or_path:new URL('vendor/sudachi/sudachi_wasm_bg.wasm',import.meta.url)}),
    loadPyodide({indexURL:new URL('vendor/pyodide/',import.meta.url).href}),
    fetchOK(new URL('morphological_analysis.py',import.meta.url)).then(r=>r.text()),
    fetchOK(new URL('python-bridge.py',import.meta.url)).then(r=>r.text())
  ]);
  progress('読み込んだ辞書で言葉を探しています…');
  const tokenizer=new Tokenizer(dictionary);
  py.registerJsModule('_memorail_native',{tokenizeJson:(text,mode)=>JSON.stringify(tokenizer.tokenize(String(text),String(mode)))});
  py.runPython(bridge);py.globals.set('_memo_source',source);
  try{py.runPython('_memo_install(_memo_source)');}finally{py.globals.delete('_memo_source');}
  metrics.prepareMs=performance.now()-started;
  return py;
}
function ensureReady(){
  if(!ready)ready=prepare(message=>self.postMessage({type:'progress',message})).catch(error=>{ready=null;throw error;});
  return ready;
}
self.onmessage=event=>{
  const {id,type,text}=event.data;
  if(type==='warmup'){
    ensureReady().then(()=>self.postMessage({id,type:'ready',metrics})).catch(()=>self.postMessage({id,type:'error'}));return;
  }
  queue=queue.then(async()=>{
    try{
      if(typeof text!=='string')throw new Error('Invalid input.');
      const py=await ensureReady(),started=performance.now();py.globals.set('_memo_input',text);
      let result;try{result=py.runPython('_memo_analyze_json(_memo_input)');}finally{py.globals.delete('_memo_input');}
      self.postMessage({id,type:'result',tokens:JSON.parse(result),analyzeMs:performance.now()-started});
    }catch(error){self.postMessage({id,type:'error'});}
  });
};
