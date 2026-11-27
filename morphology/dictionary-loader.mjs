// Cache language assets only. User input and token results are never persisted.
export async function loadDictionary(progress,metrics,options={}){
  const base=options.base||new URL('./',import.meta.url),fetcher=options.fetch||fetch;
  const store=options.storage===undefined?globalThis.caches:options.storage;
  const dictionaryError=code=>Object.assign(new Error(code),{morphologyCode:code});
  const subtle=globalThis.crypto?.subtle;
  if(!options.digest&&!subtle)throw dictionaryError('DIGEST_UNAVAILABLE');
  const digest=options.digest||async function(bytes){return Array.from(new Uint8Array(await subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');};
  async function get(url,requestOptions){
    const response=await fetcher(url,requestOptions);
    if(!response.ok)throw dictionaryError(`DICTIONARY_HTTP_${response.status}`);
    return response;
  }
  const manifest=await (await get(new URL('dictionary/manifest.json',base),{cache:'no-cache'})).json();
  let cache=null;
  try{cache=await store?.open('memorail-morphology-chunks-v1');}catch(error){metrics.cacheError=error.name;}
  metrics.dictionaryCache=cache?'loading':'unavailable';
  const bytes=new Uint8Array(manifest.rawBytes);let next=0,done=0,last=-1,offset=0,hits=0,writes=0,misses=0,failed=false;
  const offsets=manifest.chunks.map(chunk=>{const start=offset;offset+=chunk.rawBytes;return start;});
  async function unpack(packed,chunk){
    const value=new Uint8Array(await new Response(new Response(packed).body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    if(value.length!==chunk.rawBytes||await digest(value)!==chunk.sha256)throw dictionaryError('DICTIONARY_INTEGRITY');
    return value;
  }
  await Promise.all(Array.from({length:6},async()=>{
    while(next<manifest.chunks.length){
      const index=next++,chunk=manifest.chunks[index];
      const key=new URL('dictionary/'+chunk.file+'?sha='+chunk.sha256,base).href;
      let value=null;
      if(cache){
        try{
          const response=await cache.match(key);
          if(response){value=await unpack(await response.arrayBuffer(),chunk);hits++;}
        }catch{try{await cache.delete(key);}catch{}}
      }
      if(!value){
        misses++;
        const packed=await (await get(new URL('dictionary/'+chunk.file,base))).arrayBuffer();
        value=await unpack(packed,chunk);
        if(cache){
          cache.put(key,new Response(packed,{headers:{'Content-Type':'application/octet-stream'}})).then(()=>{
            writes++;
            if(!failed)metrics.dictionaryCache=writes===misses?'saved':'saving';
            metrics.cachedChunks=hits+writes;
            options.onMetrics?.();
          }).catch(error=>{failed=true;metrics.dictionaryCache='write-failed';metrics.cacheError=error.name;options.onMetrics?.();});
        }
      }
      bytes.set(value,offsets[index]);done++;
      const percent=Math.floor(done/manifest.chunks.length*10)*10;
      if(percent!==last){last=percent;progress('解析辞書を準備しています… '+percent+'%');}
    }
  }));
  if(offset!==manifest.rawBytes||await digest(bytes)!==manifest.sha256)throw dictionaryError('DICTIONARY_INTEGRITY');
  metrics.dictionarySource=hits===manifest.chunks.length?'cache':hits?'mixed':'network';
  metrics.cachedChunks=hits+writes;
  if(hits===manifest.chunks.length)metrics.dictionaryCache='hit';
  return bytes;
}
