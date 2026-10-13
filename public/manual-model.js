export const blockTypes={text:'본문',heading1:'큰 제목',heading2:'작은 제목',bullet:'글머리 목록',numbered:'번호 목록',todo:'체크리스트',callout:'안내 상자',quote:'인용',divider:'구분선',code:'코드',link:'링크'};
export function makeBlock(type='text',text='',extra={}){return {id:crypto.randomUUID(),type,text,checked:false,href:'',...extra};}
export function validateDocument(doc){
  if(!doc||typeof doc.title!=='string'||doc.title.length>200||!['📒','🧭','📝','📋'].includes(doc.icon)||!Array.isArray(doc.blocks)||doc.blocks.length>500)return false;
  const ids=new Set();let length=doc.title.length;
  for(const b of doc.blocks){if(!b||typeof b.id!=='string'||!b.id||b.id.length>80||ids.has(b.id)||!Object.hasOwn(blockTypes,b.type)||typeof b.text!=='string'||typeof b.checked!=='boolean'||typeof b.href!=='string')return false;ids.add(b.id);length+=b.text.length+b.href.length;}
  return length<=50000;
}
function inlineText(tokens,fallback=''){
  if(!tokens)return fallback;
  return tokens.map(t=>t.type==='br'?'\n':t.type==='image'?`[이미지: ${t.text||''}]${t.href?' ('+t.href+')':''}`:t.type==='link'?`${inlineText(t.tokens,t.text||'')} (${t.href})`:t.tokens?inlineText(t.tokens,t.text||''):t.text??t.raw??'').join('');
}
export function fromMarkdown(tokens,defaultTitle){
  const doc={title:defaultTitle,icon:'📒',blocks:[]};let titleSeen=false;
  function convert(list){for(const t of list){
    if(t.type==='space')continue;
    if(t.type==='heading'){const text=inlineText(t.tokens,t.text);if(t.depth===1&&!titleSeen){doc.title=text;titleSeen=true;}else doc.blocks.push(makeBlock(t.depth<=2?'heading1':'heading2',text));}
    else if(t.type==='paragraph'||t.type==='text'){if(t.tokens?.length===1&&t.tokens[0].type==='link'){const link=t.tokens[0];doc.blocks.push(makeBlock('link',inlineText(link.tokens,link.text),{href:link.href}));}else doc.blocks.push(makeBlock('text',inlineText(t.tokens,t.text)));}
    else if(t.type==='list'){for(const item of t.items){const text=item.tokens?.filter(x=>x.type!=='list').map(x=>inlineText(x.tokens,x.text||'')).join('\n')||item.text;doc.blocks.push(makeBlock(item.task?'todo':t.ordered?'numbered':'bullet',text,{checked:Boolean(item.checked)}));for(const nested of item.tokens||[])if(nested.type==='list')convert([nested]);}}
    else if(t.type==='blockquote')doc.blocks.push(makeBlock('quote',inlineText(t.tokens?.flatMap(x=>x.tokens||[]),t.text)));
    else if(t.type==='hr')doc.blocks.push(makeBlock('divider'));
    else if(t.type==='code')doc.blocks.push(makeBlock('code',t.text));
    else if(t.type==='table')doc.blocks.push(makeBlock('code',[t.header.map(c=>inlineText(c.tokens,c.text)).join('\t'),...t.rows.map(row=>row.map(c=>inlineText(c.tokens,c.text)).join('\t'))].join('\n')));
    else doc.blocks.push(makeBlock('text',t.text??t.raw??''));
  }}
  convert(tokens);if(!doc.blocks.length)doc.blocks.push(makeBlock());return doc;
}
export function safeLink(value){try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:null;}catch{return null;}}
export function moveBlock(blocks,id,direction){const index=blocks.findIndex(b=>b.id===id),target=index+direction;if(index<0||target<0||target>=blocks.length)return blocks;const copy=[...blocks];[copy[index],copy[target]]=[copy[target],copy[index]];return copy;}
