(function(){
  'use strict';
  const engine=window.MemoRailEngine, config=window.MEMORAIL_JOURNEY, words=window.MemoRailWords;
  const world=document.getElementById('world'), startScreen=document.getElementById('startScreen'), startButton=document.getElementById('startButton');
  const dialog=document.getElementById('experienceDialog'), content=document.getElementById('experienceContent');
  const flow=config.steps;
  const {MIN_SELECTED_WORDS,MAX_SELECTED_WORDS}=words;
  const wordSelectionRange=`${MIN_SELECTED_WORDS}〜${MAX_SELECTED_WORDS}個`;
  let phase='start', index=-1, stepAnchor=0, currentView='', editTrail=[], renderId=0;
  let draft={username:'',text:'',request:''}, registeredAt=null, tokens=[], selected=new Set();
  let analysis={text:'',status:'idle',message:''},analysisId=0;
  let analysisTimer=null,warmupRequested=false,submittedAt=0,readyBeforeSubmit=false;
  let activeAnalysis=null;
  let stopTarget=null;

  const views={
    guide:`<div class="guide-steps" id="guideNotes"></div>`,
    memory:`<form id="memoryForm" class="memory-form" novalidate>
      <div class="memory-field"><label for="memoryUsername">ユーザーネーム <span class="field-limit">${words.USERNAME_LIMIT}文字以内</span> <span class="field-required">必須</span></label><input id="memoryUsername" name="username" type="text" required autocomplete="off" aria-describedby="usernameError usernameCount"><div class="input-meta"><p id="usernameError" class="form-error" role="alert"></p><span id="usernameCount">0 / ${words.USERNAME_LIMIT}</span></div></div>
      <div class="memory-field"><label for="memoryText">思い出 <span class="field-limit">300文字以内</span> <span class="field-required">必須</span></label><textarea id="memoryText" name="memory" required rows="4" data-character-limit="300" aria-describedby="memoryError memoryCount"></textarea><div class="input-meta"><p id="memoryError" class="form-error" role="alert"></p><span id="memoryCount">0 / 300</span></div></div>
      <div class="memory-field"><label for="memoryRequest">思い出を受け取った人に行ってほしい依頼 <span class="field-limit">50文字以内</span> <span class="field-required">必須</span></label><textarea id="memoryRequest" name="request" required rows="2" data-character-limit="50" aria-describedby="requestError requestCount"></textarea><div class="input-meta"><p id="requestError" class="form-error" role="alert"></p><span id="requestCount">0 / 50</span></div></div>
      </form>`,
    words:`<div class="word-selection-head"><span>${wordSelectionRange}選択</span><span id="selectionCount">0 / ${MAX_SELECTED_WORDS}個</span></div><div id="analysisStatus" role="status"></div><div id="wordChoices" class="word-choices" role="group" aria-label="文章の中から消す単語を${wordSelectionRange}選択"></div><p id="wordError" class="form-error" aria-live="polite"></p><button type="button" id="retryAnalysis" class="text-button" hidden>解析をもう一度試す</button><button type="button" id="editMemory" class="text-button">入力を修正する</button>`,
    preview:`<div class="postcard-wrap"><canvas id="postcardCanvas" width="1749" height="1182" role="img" aria-label="入力した思い出を反映したポストカード"></canvas><p id="postcardStatus" class="postcard-status" role="status">ポストカードを用意しています…</p><button type="button" id="postcardRetry" class="postcard-retry" hidden>もう一度読み込む</button></div><p id="postcardText" class="visually-hidden"></p><div class="card-tools"><button id="editWords" class="text-button" type="button">言葉を選び直す</button></div>`,
    outro:`<div class="receive-instructions"><p>だれかの思い出が印刷されたポストカードが出力されます。</p><p>ポストカードに書かれた依頼を実行したあと、QRコードを読み取ってください。かすれていた言葉が表示されます。</p></div><p class="received-note">思い出をのせてくれて、ありがとう。<br>また、次の旅で会いましょう。</p>`
  };
  for(let i=0;i<flow.length;i++){
    if(!Object.hasOwn(views,flow[i].view)||flow[i].scene<0||flow[i].scene>3||(i&&flow[i].scene<flow[i-1].scene))throw new Error('案内設定のviewまたはsceneを確認してください。');
  }
  function setPhase(value){phase=value;world.dataset.phase=value;world.classList.toggle('at-start',value==='start');}
  function normalize(state){return state.worldX/(state.height/1080);}
  function closeDialog(){if(dialog.open)dialog.close();currentView='';renderId++;}
  function start(){if(phase!=='start'||!engine.start())return;startScreen.hidden=true;index=0;stepAnchor=normalize(engine.state());setPhase('travel');}
  function reset(){closeDialog();engine.reset();clearTimeout(analysisTimer);analysisTimer=null;draft={username:'',text:'',request:''};registeredAt=null;tokens=[];selected.clear();analysisId++;analysis={text:'',status:'idle',message:''};submittedAt=0;readyBeforeSubmit=false;delete world.dataset.wordTiming;editTrail=[];stopTarget=null;index=-1;stepAnchor=0;content.replaceChildren();startScreen.hidden=false;setPhase('start');startButton.focus({preventScroll:true});}
  function next(){closeDialog();editTrail=[];stopTarget=null;index++;if(index>=flow.length){reset();return;}stepAnchor=normalize(engine.state());setPhase('travel');engine.resume();}
  function confirm(){
    if(currentView==='memory'){
      const form=document.getElementById('memoryForm');form.dataset.submitted='true';
      const result=updateMemoryForm();
      if(!result.valid){document.getElementById({username:'memoryUsername',text:'memoryText',request:'memoryRequest'}[Object.keys(result.errors)[0]]).focus();return;}
      draft=result.value;if(!registeredAt)registeredAt=new Date().toISOString();const text=draft.text;
      submittedAt=performance.now();readyBeforeSubmit=analysis.text===text&&analysis.status==='ready';
      clearTimeout(analysisTimer);analysisTimer=null;
      if(analysis.text!==text||!['loading','ready'].includes(analysis.status))analyzeMemory(text);
    }
    if(currentView==='words'&&(analysis.status!=='ready'||!words.validSelection(tokens,selected)))return;
    if(editTrail.length){renderView(editTrail.pop(),flow[index]);return;}
    if(currentView==='outro'){reset();return;}next();
  }
  function edit(view){editTrail.push(currentView);renderView(view,flow[index]);}
  function renderView(view,step){
    engine.pause();renderId++;currentView=view;
    const subtitle=view==='guide'?(step.description||''):'';
    const restartControl=view==='outro'?'':'<div class="panel-topline"><button type="button" id="dialogRestart" class="dialog-restart" aria-label="スタート画面へ戻る">スタートへ ↺</button></div>';
    content.innerHTML=`${restartControl}<h2 id="experienceTitle"></h2><p id="experienceSubtitle" class="panel-description"></p><div class="panel-body">${views[view]}</div><div class="panel-actions"><button type="button" id="experienceConfirm" class="confirm-button"></button></div>`;
    const isInputView=view==='memory'||view==='words';
    const viewStep=step.view!==view&&isInputView?(flow.find(item=>item.view===view)||step):step;
    const title=viewStep.title;
    const heading=document.getElementById('experienceTitle'),description=document.getElementById('experienceSubtitle');
    heading.textContent=title||'旅の案内';
    heading.hidden=!title;
    description.textContent=subtitle;
    description.hidden=!subtitle;
    document.getElementById('experienceConfirm').textContent=view==='outro'?'スタート画面に戻る':editTrail.length&&!isInputView?'変更を反映する':viewStep.confirmLabel||'次へ進む';
    document.getElementById('experienceConfirm').addEventListener('click',confirm);
    document.getElementById('dialogRestart')?.addEventListener('click',reset);
    dialog.dataset.view=view;
    if(view==='guide'){
      (step.notes||[]).forEach((text,i)=>{const item=document.createElement('div');item.className='guide-step';const number=document.createElement('span');number.textContent=String(i+1).padStart(2,'0');const label=document.createElement('p');label.textContent=text;item.append(number,label);document.getElementById('guideNotes').appendChild(item);});
    }
    if(view==='memory'){
      document.getElementById('memoryUsername').value=draft.username;document.getElementById('memoryText').value=draft.text;document.getElementById('memoryRequest').value=draft.request;
      for(const id of ['memoryUsername','memoryText','memoryRequest'])document.getElementById(id).addEventListener('input',updateMemoryForm);
      document.getElementById('memoryText').addEventListener('input',scheduleAnalysis);
      document.getElementById('memoryText').addEventListener('compositionend',scheduleAnalysis);
      updateMemoryForm();
      document.getElementById('memoryForm').addEventListener('submit',event=>{event.preventDefault();confirm();});
    }
    if(view==='words'){
      world.dataset.wordTiming=JSON.stringify({readyBeforeSubmit,submitToPanelMs:performance.now()-submittedAt,readyAtPanel:analysis.status==='ready'});
      document.getElementById('editMemory').addEventListener('click',()=>edit('memory'));
      document.getElementById('retryAnalysis').addEventListener('click',()=>analyzeMemory(draft.text));
      renderWordChoices();
    }
    if(view==='preview'){
      const memory={...draft,text:words.project(tokens,selected),parts:words.postcardParts(tokens,selected),registeredAt,recipientUsername:'',receivedAt:null};
      const canvas=document.getElementById('postcardCanvas');
      document.getElementById('postcardRetry').addEventListener('click',()=>drawPostcard(canvas,memory));
      drawPostcard(canvas,memory);
      document.getElementById('editWords').addEventListener('click',()=>edit('words'));
    }
    if(!dialog.open)dialog.showModal();
    // 入力画面では、走行キーの文字が入力されないようダイアログの枠にフォーカスする。
    const target=view==='memory'?dialog:document.getElementById('experienceConfirm');
    target.focus({preventScroll:true});
    dialog.scrollTop=0;
  }
  function updateMemoryForm(){
    const fields={username:'memoryUsername',text:'memoryText',request:'memoryRequest'},errors={username:'usernameError',text:'memoryError',request:'requestError'};
    const limits={username:words.USERNAME_LIMIT,text:300,request:50},counters={username:'usernameCount',text:'memoryCount',request:'requestCount'};
    const input=Object.fromEntries(Object.entries(fields).map(([key,id])=>[key,document.getElementById(id).value]));
    const result=words.validateDraft(input),submitted=document.getElementById('memoryForm').dataset.submitted==='true';
    for(const [key,id] of Object.entries(fields)){
      const count=words.characterCount(input[key]),limit=limits[key];
      const message=submitted||count>limit?result.errors[key]||'':'';
      document.getElementById(errors[key]).textContent=message;document.getElementById(id).setAttribute('aria-invalid',String(!!message));
      const counter=document.getElementById(counters[key]);counter.textContent=`${count} / ${limit}`;counter.classList.toggle('over-limit',count>limit);
    }
    return result;
  }
  function scheduleAnalysis(event){
    clearTimeout(analysisTimer);analysisTimer=null;
    const text=document.getElementById('memoryText').value.trim();
    if(analysis.text===text&&['loading','ready'].includes(analysis.status))return;
    analysisId++;tokens=[];selected.clear();analysis={text,status:'idle',message:''};
    if(event?.isComposing||!text||words.characterCount(text)>300)return;
    // Avoid a job for every keystroke, including Japanese IME composition.
    analysisTimer=setTimeout(()=>{analysisTimer=null;analyzeMemory(text);},350);
  }
  function analysisErrorMessage(error){
    const code=error?.morphologyCode;
    if(/^DICTIONARY_HTTP_[0-9]{3}$/.test(code))return `辞書ファイルを取得できませんでした（HTTP ${code.slice(-3)}）。`;
    return {
      DIGEST_UNAVAILABLE:'辞書を検証できません。このページをHTTPSまたはlocalhostで開いてください。',
      DICTIONARY_LOAD:'辞書を読み込めませんでした（DICTIONARY_LOAD）。',
      DICTIONARY_INTEGRITY:'配信された辞書データが一致しません（DICTIONARY_INTEGRITY）。',
      SUDACHI_INIT:'Sudachiの実行環境を起動できませんでした（SUDACHI_INIT）。',
      PYODIDE_INIT:'Pythonの実行環境を起動できませんでした（PYODIDE_INIT）。',
      PYTHON_FILES:'解析用のPythonファイルを取得できませんでした（PYTHON_FILES）。',
      ANALYZER_INIT:'解析エンジンを初期化できませんでした（ANALYZER_INIT）。',
      WORKER_START:'解析用のWorkerを起動できませんでした（WORKER_START）。',
      PREPARE_TIMEOUT:'辞書と実行環境の準備が時間内に完了しませんでした（PREPARE_TIMEOUT）。',
      ANALYZE_TIMEOUT:'文章の解析が時間内に完了しませんでした（ANALYZE_TIMEOUT）。',
      ANALYZER_RUN:'文章の解析中にエラーが発生しました（ANALYZER_RUN）。'
    }[code]||'解析結果を読み込めませんでした（ANALYSIS_RESULT）。';
  }
  async function analyzeMemory(text){
    clearTimeout(analysisTimer);analysisTimer=null;
    if(analysis.text!==text)selected.clear();
    tokens=[];const generation=++analysisId;
    analysis={text,status:'loading',message:'思い出の言葉を探しています…'};
    if(currentView==='words')renderWordChoices();
    try{
      await window.MemoRailMorphology.warmup(message=>{
        if(generation!==analysisId)return;
        analysis.message=message;if(currentView==='words')updateWords();
      });
      // Only the latest draft enters Python after initialization finishes.
      if(generation!==analysisId)return;
      // Keep at most one running job, so edits cannot queue obsolete drafts.
      if(activeAnalysis)await activeAnalysis.catch(()=>{});
      if(generation!==analysisId)return;
      const job=window.MemoRailMorphology.analyze(text);activeAnalysis=job;
      let result;
      try{result=await job;}finally{if(activeAnalysis===job)activeAnalysis=null;}
      if(generation!==analysisId)return;
      tokens=words.checkedAnalysis(text,result);
      const available=new Set(words.choices(tokens).map(t=>t.id));
      selected=new Set([...selected].filter(id=>available.has(id)).slice(0,MAX_SELECTED_WORDS));
      analysis={text,status:'ready',message:''};
      if(currentView==='words')renderWordChoices();
    }catch(error){
      if(generation!==analysisId)return;
      analysis={text,status:'error',message:analysisErrorMessage(error)};
      if(currentView==='words')renderWordChoices();
    }
  }
  function renderWordChoices(){
    const container=document.getElementById('wordChoices');container.replaceChildren();
    if(analysis.status==='ready'){
      const occurrences=new Map();
      for(const token of tokens){
        if(!token.word){container.append(document.createTextNode(token.text));continue;}
        const occurrence=(occurrences.get(token.text)||0)+1;occurrences.set(token.text,occurrence);
        const button=document.createElement('button');button.type='button';button.className='word-toggle';button.textContent=token.text;
        button.dataset.word=token.text;button.dataset.tokenId=token.id;
        button.setAttribute('aria-label',`${token.text}（${occurrence}箇所目）`);
        button.addEventListener('click',()=>{
          if(selected.has(token.id))selected.delete(token.id);else if(selected.size<MAX_SELECTED_WORDS)selected.add(token.id);
          updateWords();
        });container.append(button);
      }
    }else container.textContent=draft.text;
    updateWords();
  }
  function updateWords(){
    const ready=analysis.status==='ready',valid=ready&&words.validSelection(tokens,selected),candidates=words.choices(tokens);
    document.getElementById('selectionCount').textContent=`${selected.size} / ${MAX_SELECTED_WORDS}個`;
    document.getElementById('analysisStatus').textContent=analysis.message;
    document.getElementById('retryAnalysis').hidden=analysis.status!=='error';
    const error=document.getElementById('wordError');
    error.textContent='';
    if(ready&&candidates.length<MIN_SELECTED_WORDS){
      error.textContent=`選べる単語が${MIN_SELECTED_WORDS}個未満です。入力を修正してください。`;
    }else if(ready&&selected.size<MIN_SELECTED_WORDS){
      error.textContent=`消す単語を${MIN_SELECTED_WORDS}個以上選んでください。`;
    }else if(ready&&selected.size===MAX_SELECTED_WORDS){
      error.textContent=`${MAX_SELECTED_WORDS}個選択しました。選び直す場合は、選択を解除してください。`;
    }
    error.classList.toggle('selection-info',valid);
    document.querySelectorAll('#wordChoices .word-toggle').forEach(button=>{
      const pressed=selected.has(button.dataset.tokenId);button.setAttribute('aria-pressed',String(pressed));button.disabled=!pressed&&selected.size>=MAX_SELECTED_WORDS;
    });
    document.getElementById('experienceConfirm').disabled=!valid;
  }
  async function drawPostcard(canvas,memory){
    const version=renderId,status=document.getElementById('postcardStatus'),confirm=document.getElementById('experienceConfirm'),retry=document.getElementById('postcardRetry');
    canvas.setAttribute('aria-busy','true');canvas.hidden=true;confirm.disabled=true;retry.disabled=true;
    status.hidden=false;status.setAttribute('role','status');
    status.textContent='ポストカードを用意しています…';
    try{
      const assets=await window.MemoRailPostcard.load();
      if(version!==renderId||!canvas.isConnected)return;
      window.MemoRailPostcard.draw(canvas,memory,assets,words.characters);
      document.getElementById('postcardText').textContent=window.MemoRailPostcard.describe(memory);
      canvas.hidden=false;canvas.setAttribute('aria-busy','false');confirm.disabled=false;
      if(document.activeElement===retry)confirm.focus({preventScroll:true});
      retry.hidden=true;
      status.hidden=true;
    }catch(error){
      if(version!==renderId||!canvas.isConnected)return;
      console.warn('Postcard rendering failed.',error);
      canvas.setAttribute('aria-busy','false');
      status.setAttribute('role','alert');status.textContent='ポストカードを表示できませんでした。';
      retry.hidden=false;retry.disabled=false;
    }
  }
  function update(_now,state){
    startButton.disabled=!state.ready;
    if(state.ready&&!warmupRequested){
      warmupRequested=true;
      window.MemoRailMorphology.warmup().catch(()=>{});
    }
    const wasBraking=phase==='braking';
    if(phase==='travel'&&flow[index]){
      const step=flow[index];
      if(state.requestedScene<step.scene){if(!state.inTransit)engine.travelTo(step.scene);}
      else if(!state.inTransit&&state.scene===step.scene){
        const scale=state.height/1080,stopDistance=(state.brakingDistance||0)/scale;
        const page=state.oddPage,pageWidth=(page?.width||0)/scale;
        const usePage=Number.isFinite(step.stopAt)&&pageWidth>0;
        if(usePage&&stopTarget===null){
          const origin=page.origin/scale,first=origin+pageWidth*Math.max(0,Math.min(1,step.stopAt));
          // Additional guides in the same season use the following repeated page.
          const minimum=Math.max(origin,stepAnchor+pageWidth*0.02);
          stopTarget=first+Math.max(0,Math.ceil((minimum-first)/pageWidth))*pageWidth;
        }
        const threshold=usePage?stopTarget:Math.max(stepAnchor,state.arrivalWorld/scale)+(step.distance||0);
        // Speed drops before each movement tick. Use the lower estimate at
        // the tile boundary so the train does not stop just short of it.
        const approach=usePage&&step.stopAt===1
          ? Math.max(0,stopDistance-state.speed/(2*scale))
          : stopDistance;
        if(state.speed>=0&&normalize(state)+approach>=threshold){
          engine.brake();setPhase('braking');
        }
      }
    }
    if(wasBraking&&phase==='braking'&&Math.abs(state.speed||0)<0.001){
      setPhase('panel');renderView(flow[index].view,flow[index]);
    }
    world.dataset.experience=JSON.stringify({phase,index,view:currentView,stepId:flow[index]?.id||null,selectedCount:selected.size,hasDraft:!!draft.text,stopWorld:stopTarget===null?null:stopTarget*(state.height/1080)});
    world.dataset.morphology=JSON.stringify({...window.MemoRailMorphology.state,analysisStatus:analysis.status});
  }
  startButton.addEventListener('click',start);
  document.getElementById('resetButton').addEventListener('click',reset);
  document.getElementById('logo').addEventListener('click',event=>{event.preventDefault();reset();});
  dialog.addEventListener('cancel',event=>event.preventDefault());
  window.MemoRailExperience=Object.freeze({get phase(){return phase;},start,reset,update});
  setPhase('start');
})();
