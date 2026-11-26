(function(root){
  'use strict';
  const WIDTH=1749,HEIGHT=1182;
  // Coordinates are PDF points from Postcard0.ai, with y measured from the top.
  const scale=WIDTH/419.528;
  const hand='"MemoRail Charifont", "MemoRail Hand", serif';
  const gold='"MemoRail Kinkakuji", sans-serif';
  function field(x,y,width,size,extra={}){
    return {x:x*scale,y:y*scale,width:width*scale,size:size*scale,...extra};
  }
  const boxes={
    sender:field(52.5903,53.6945,133.0237,18.124,{stretch:17.6284/18.124}),
    recipient:field(233.9248,53.6486,133.0622,18,{stretch:17.5082/18}),
    departure:field(79.8589,69.6188,78.5191,8.049,{stretch:7.9124/8.049}),
    arrival:field(259.7778,70.2116,78.5212,8.7271,{stretch:8.1259/8.7271}),
    body:field(39.4868,89.132,31*11.363,11,{lineHeight:13.2*scale,tracking:.363*scale,rows:10}),
    request:field(36.6323,249.8693,301.1,14)
  };
  // This entire region is copied 1:1 from the supplied image, never generated.
  const qr={x:1415,y:937,width:220,height:158};
  const dateFormatter=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric'});
  function dateLabel(value,suffix=''){
    if(value==null||value==='')return '';
    const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
    const parts=Object.fromEntries(dateFormatter.formatToParts(date).map(part=>[part.type,part.value]));
    return `${parts.year}年${parts.month}月${parts.day}日${suffix}`;
  }
  function describe(memory){
    return `思い出の持ち主：${memory.username}。受取人：${memory.recipientUsername||'未定'}。出発日：${dateLabel(memory.registeredAt)||'未登録'}。到着日：${dateLabel(memory.receivedAt)||'未受取'}。思い出：${memory.text}。受け取った人への依頼：${memory.request}`;
  }
  function bodyLines(ctx,source,box,size,keepBreaks){
    const lines=[[]];
    let advance=0;
    ctx.font=`${size}px ${hand}`;
    for(const item of source){
      if(item.text==='\n'&&keepBreaks){lines.push([]);advance=0;continue;}
      const text=item.text==='\n'?' ':item.text;
      const width=Math.min(box.width,ctx.measureText(text).width);
      if(advance+width>box.width+0.01&&lines.at(-1).length){lines.push([]);advance=0;}
      lines.at(-1).push({...item,text,advance});
      advance+=width+box.tracking*size/box.size;
    }
    return lines;
  }
  function layoutBody(ctx,memory,characters=Array.from){
    const parts=memory.parts||[{text:memory.text,erased:false}],source=[],ranges=[];let raw='',newline=false;
    for(const part of parts){const start=raw.length;raw+=part.text;if(part.erased)ranges.push([start,raw.length]);}
    let rawOffset=0;
    for(const text of characters(raw)){
      const start=rawOffset;rawOffset+=text.length;
      if(/^(\r?\n)+$/.test(text)){if(!newline)source.push({text:'\n',erased:false});newline=true;}
      else{source.push({text,erased:ranges.some(([a,b])=>a<rawOffset&&b>start)});newline=false;}
    }
    const box=boxes.body;
    let size=box.size,lineHeight=box.lineHeight;
    let rows=bodyLines(ctx,source,box,size,true);
    // Compact paragraph breaks only when needed to keep the artwork's text area.
    if(rows.length>box.rows)rows=bodyLines(ctx,source,box,size,false);
    while(rows.length*lineHeight>box.rows*box.lineHeight){
      size*=.96;
      lineHeight=box.lineHeight*size/box.size;
      rows=bodyLines(ctx,source,box,size,false);
    }
    const glyphs=rows.flatMap((row,i)=>row.map(({advance,...glyph})=>({
      ...glyph,x:box.x+advance,y:box.y+i*lineHeight
    })));
    return {lines:rows.map(row=>row.map(item=>item.text).join('')),size,lineHeight,glyphs,
      erased:glyphs.filter(char=>char.erased).length};
  }
  function drawGold(ctx,value,box,characters,spread=false){
    const text=String(value||'').replace(/\s*\r?\n\s*/g,' ');
    if(!text)return;
    ctx.font=`${box.size}px ${gold}`;
    ctx.save();
    ctx.translate(box.x,box.y);
    ctx.scale(box.stretch,1);
    const width=box.width/box.stretch;
    const glyphs=characters(text);
    ctx.textAlign='center';
    if(spread&&glyphs.length>1&&ctx.measureText(text).width<=width){
      const pad=box.size/2;
      glyphs.forEach((glyph,i)=>ctx.fillText(glyph,pad+(width-2*pad)*i/(glyphs.length-1),0));
    }else{
      ctx.fillText(text,width/2,0,width);
    }
    ctx.restore();
  }
  function draw(canvas,memory,assets,characters=Array.from){
    canvas.width=WIDTH;canvas.height=HEIGHT;
    const ctx=canvas.getContext('2d'),{original,clean}=assets;
    if(!original?.naturalWidth||!clean?.naturalWidth)throw new Error('Postcard artwork is not ready.');
    // Native Illustrator artwork with only the variable text operators removed.
    ctx.drawImage(clean,0,0,WIDTH,HEIGHT);
    ctx.fillStyle='#090909';ctx.textAlign='left';ctx.textBaseline='alphabetic';
    drawGold(ctx,memory.username,boxes.sender,characters,true);
    drawGold(ctx,memory.recipientUsername,boxes.recipient,characters,true);
    const departure=dateLabel(memory.registeredAt,'発'),arrival=dateLabel(memory.receivedAt,'着');
    const spaceDate=value=>value.replace(/(\d)([年月日])/g,'$1 $2');
    drawGold(ctx,spaceDate(departure),boxes.departure,characters);
    drawGold(ctx,spaceDate(arrival),boxes.arrival,characters);
    const body=layoutBody(ctx,memory,characters);
    ctx.font=`${body.size}px ${hand}`;
    body.glyphs.filter(char=>!char.erased).forEach(char=>ctx.fillText(char.text,char.x,char.y));
    if(body.erased){
      const ink=assets.ink,mask=assets.erasureAlpha;
      if(!ink||!mask?.naturalWidth)throw new Error('Illustrator erasure artwork is not ready.');
      const faded=ink.getContext('2d');faded.globalCompositeOperation='source-over';faded.clearRect(0,0,WIDTH,HEIGHT);
      faded.font=ctx.font;faded.fillStyle='#090909';faded.textAlign='left';faded.textBaseline='alphabetic';
      body.glyphs.filter(char=>char.erased).forEach(char=>faded.fillText(char.text,char.x,char.y));
      faded.globalCompositeOperation='destination-in';faded.drawImage(mask,0,0,WIDTH,HEIGHT);
      faded.globalCompositeOperation='source-over';ctx.drawImage(ink,0,0);
    }
    const requestText=String(memory.request||'').replace(/\r?\n+/g,' ');
    const request={size:boxes.request.size,lines:[requestText]};
    ctx.font=`${request.size}px ${hand}`;
    if(requestText)ctx.fillText(requestText,boxes.request.x,boxes.request.y,boxes.request.width);
    ctx.drawImage(original,qr.x,qr.y,qr.width,qr.height,qr.x,qr.y,qr.width,qr.height);
    canvas.setAttribute('aria-label',describe(memory));
    canvas.dataset.render=JSON.stringify({template:'Postcard0.ai',width:WIDTH,height:HEIGHT,sender:memory.username,recipient:memory.recipientUsername||'',departure,arrival,body:{size:body.size,lines:body.lines.length,erased:body.erased},erasure:'illustrator-mask',request:{size:request.size,lines:request.lines.length},qr:'original'});
    return {body,request};
  }
  function loadImage(src){
    return new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>reject(new Error(`Postcard image failed to load: ${src}`));
      image.src=src;
    });
  }
  async function fontAvailable(family,sample){
    try{
      const faces=await root.document.fonts.load(`34px "${family}"`,sample);
      return faces.length>0;
    }catch{
      return false;
    }
  }
  let ready;
  function load(){
    if(!ready)ready=Promise.all([
      loadImage('postcard/ticket-original.png'),
      loadImage('postcard/ticket-illustrator.png'),
      loadImage('postcard/erasure-alpha.png'),
      fontAvailable('MemoRail Kinkakuji','名前2026年'),
      fontAvailable('MemoRail Hand','思い出'),
      fontAvailable('MemoRail Charifont','思い出')
    ]).then(([original,clean,erasureAlpha,kinkakujiAvailable,,charifontAvailable])=>{
      const ink=root.document.createElement('canvas');ink.width=WIDTH;ink.height=HEIGHT;
      return {original,clean,erasureAlpha,ink,kinkakujiAvailable,charifontAvailable};
    }).catch(error=>{
      ready=undefined;
      throw error;
    });
    return ready;
  }
  const api=Object.freeze({draw,load,layoutBody,dateLabel,describe,boxes,qr,width:WIDTH,height:HEIGHT});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MemoRailPostcard=api;
})(typeof window!=='undefined'?window:globalThis);
