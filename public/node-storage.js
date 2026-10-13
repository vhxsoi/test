export function loadCollection(key,sample,validate,storage=globalThis.localStorage){
  try{const raw=storage.getItem(key);if(raw===null)return {nodes:structuredClone(sample),error:null,raw:null};const nodes=JSON.parse(raw);if(!Array.isArray(nodes)||!validate(nodes)||new Set(nodes.map(n=>n.id)).size!==nodes.length)throw new Error('Invalid records');return {nodes,error:null,raw};}
  catch{return {nodes:structuredClone(sample),error:'기존 업무 데이터를 읽지 못했습니다. 원본을 보호하기 위해 저장을 중단했습니다.',raw:null};}
}
export function persistCollection(key,nodes,loaded,storage=globalThis.localStorage){
  if(loaded.error)throw new Error(loaded.error);
  let current;try{current=storage.getItem(key);}catch{throw new Error('브라우저 저장소를 읽지 못했습니다. 기존 데이터는 변경하지 않았습니다.');}
  if(current!==loaded.raw)throw new Error('다른 창에서 업무 데이터가 변경되었습니다. 입력 내용을 보관하고 새로고침한 뒤 다시 저장하세요.');
  const raw=JSON.stringify(nodes);
  try{storage.setItem(key,raw);loaded.raw=raw;}
  catch{throw new Error('브라우저에 저장하지 못했습니다. 입력 내용은 유지되며 기존 데이터는 변경하지 않았습니다.');}
}
export function validRoutes(nodes){return nodes.every(n=>n&&typeof n.id==='string'&&typeof n.name==='string'&&Array.isArray(n.codes)&&n.codes.every(x=>typeof x==='string')&&typeof n.region==='string'&&typeof n.group==='string'&&['joint','buy','sell','exchange'].includes(n.type)&&typeof n.start==='string'&&typeof n.end==='string'&&Array.isArray(n.partners)&&n.partners.every(x=>typeof x==='string')&&typeof n.contract==='string'&&n.cycle&&typeof n.cycle.kind==='string'&&typeof n.remark==='string'&&Array.isArray(n.history)&&n.history.every(h=>h&&typeof h.date==='string'&&typeof h.cycle==='string'&&Array.isArray(h.items)&&h.items.every(x=>typeof x==='string')&&typeof h.remark==='string'));}
export function validAdmins(nodes){return nodes.every(n=>n&&typeof n.id==='string'&&typeof n.name==='string'&&n.type==='서무 업무(기타)'&&typeof n.recent==='string'&&n.cycle&&typeof n.cycle.kind==='string'&&typeof n.guide==='string');}
