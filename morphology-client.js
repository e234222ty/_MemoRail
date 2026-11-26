(function(){
  'use strict';
  let worker=null,nextId=0,warmupPromise=null;
  const pending=new Map(),listeners=new Set();
  let state={status:'idle',startedAt:0,readyAt:0,lastAnalyzeMs:0};
  function failAll(){
    if(worker)worker.terminate();worker=null;warmupPromise=null;state={...state,status:'error'};
    for(const request of pending.values()){clearTimeout(request.timeout);request.reject(new Error('Morphology unavailable.'));}
    pending.clear();listeners.clear();
  }
  function request(type,text){
    if(!worker){
      worker=new Worker('morphology/worker.js?v=2',{type:'module'});
      worker.onmessage=event=>{
        const message=event.data;
        if(message.type==='metrics'){state={...state,...message.metrics};return;}
        if(message.type==='progress'){
          for(const listener of listeners)listener(message.message);
          return;
        }
        const item=pending.get(message.id);if(!item)return;
        clearTimeout(item.timeout);pending.delete(message.id);
        if(message.type==='ready'){
          state={...state,...message.metrics,status:'ready',readyAt:performance.now()};item.resolve(message.metrics);
        }else if(message.type==='result'){
          state={...state,lastAnalyzeMs:message.analyzeMs};item.resolve(message.tokens);
        }else item.reject(new Error('Morphology unavailable.'));
      };
      worker.onerror=failAll;
    }
    return new Promise((resolve,reject)=>{
      const id=++nextId,timeout=setTimeout(failAll,type==='warmup'?300000:30000);
      pending.set(id,{resolve,reject,timeout});worker.postMessage({id,type,...(type==='analyze'?{text}:{})});
    });
  }
  function warmup(onProgress){
    if(onProgress)listeners.add(onProgress);
    if(!warmupPromise){
      state={...state,status:'loading',startedAt:performance.now()};
      try{warmupPromise=request('warmup').catch(error=>{warmupPromise=null;state={...state,status:'error'};throw error;});}
      catch(error){failAll();warmupPromise=Promise.reject(error);warmupPromise.catch(()=>{warmupPromise=null;});}
    }
    return onProgress?warmupPromise.finally(()=>listeners.delete(onProgress)):warmupPromise;
  }
  async function analyze(text,onProgress){
    await warmup(onProgress);
    return request('analyze',text);
  }
  window.MemoRailMorphology=Object.freeze({warmup,analyze,get state(){return {...state};}});
})();
