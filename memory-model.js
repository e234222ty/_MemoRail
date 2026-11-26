(function(root){
  const USERNAME_LIMIT=7;
  const MIN_SELECTED_WORDS=3, MAX_SELECTED_WORDS=8;
  function tokenize(text){
    if(typeof Intl.Segmenter==='function')return [...new Intl.Segmenter('ja',{granularity:'word'}).segment(text)].map((x,i)=>({id:`token-${i}`,text:x.segment,word:!!x.isWordLike}));
    return (text.match(/\s+|[A-Za-z0-9]+|[\p{Script=Han}]+|[\p{Script=Hiragana}]+|[\p{Script=Katakana}ー]+|./gu)||[]).map((text,i)=>({id:`token-${i}`,text,word:/[\p{Letter}\p{Number}]/u.test(text)}));
  }
  function choices(tokens){return tokens.filter(t=>t.word).map(({id,text})=>({id,text}));}
  function project(tokens,selected){return tokens.filter(t=>!t.word||!selected.has(t.id)).map(t=>t.text).join('').replace(/[ \t]{2,}/g,' ').replace(/ *\n */g,'\n').trim();}
  function postcardParts(tokens,selected){return tokens.map(token=>({text:token.text,erased:token.word&&selected.has(token.id)}));}
  function checkedAnalysis(text,tokens){
    if(!Array.isArray(tokens)||tokens.some(t=>!t||typeof t.text!=='string'||!t.text||typeof t.word!=='boolean')||tokens.map(t=>t.text).join('')!==text)throw new Error('Invalid morphological analysis result.');
    return tokens.map((t,i)=>({id:`token-${i}`,text:t.text,word:t.word}));
  }
  function validSelection(tokens,selected){
    if(selected.size<MIN_SELECTED_WORDS||selected.size>MAX_SELECTED_WORDS)return false;
    const available=new Set(choices(tokens).map(t=>t.id));
    return [...selected].every(id=>available.has(id));
  }
  function hasWords(text){return /[\p{Letter}\p{Number}]/u.test(text);}
  function characters(text){return typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(text)].map(x=>x.segment):Array.from(text);}
  function characterCount(text){return characters(text).length;}
  function validateDraft(input){
    const raw={username:String(input.username||''),text:String(input.text||''),request:String(input.request||'')};
    const value=Object.fromEntries(Object.entries(raw).map(([key,text])=>[key,text.trim()])),errors={};
    if(!value.username)errors.username='ユーザーネームを入力してください。';
    else if(characterCount(raw.username)>USERNAME_LIMIT)errors.username=`ユーザーネームは${USERNAME_LIMIT}文字以内で入力してください。`;
    if(!value.text)errors.text='思い出を入力してください。';
    else if(characterCount(raw.text)>300)errors.text='思い出は300文字以内で入力してください。';
    if(!value.request)errors.request='受け取った人への依頼を入力してください。';
    else if(characterCount(raw.request)>50)errors.request='依頼は50文字以内で入力してください。';
    return {value,errors,valid:Object.keys(errors).length===0};
  }
  function hasRemainingContent(tokens,selected){const remaining=project(tokens,selected);return hasWords(tokens.map(t=>t.text).join(''))?hasWords(remaining):!!remaining.trim();}
  const api=Object.freeze({USERNAME_LIMIT,MIN_SELECTED_WORDS,MAX_SELECTED_WORDS,tokenize,choices,project,postcardParts,checkedAnalysis,validSelection,hasWords,characters,characterCount,validateDraft,hasRemainingContent});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MemoRailWords=api;
})(typeof window!=='undefined'?window:globalThis);
