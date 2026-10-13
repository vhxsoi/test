const kinds=['route','admin'];
function text(value,max,label){if(value===undefined||value===null)return '';if(typeof value!=='string')throw new Error(`${label} 형식이 올바르지 않습니다.`);const result=value.trim();if(result.length>max)throw new Error(`${label}은 ${max}자까지 입력할 수 있습니다.`);return result;}
function month(value,label){const result=text(value,7,label);if(result&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(result))throw new Error(`${label}은 YYYY-MM 형식으로 입력하세요.`);return result;}
function date(value){const result=text(value,10,'최근 업데이트일');if(result&&(!/^\d{4}-\d{2}-\d{2}$/.test(result)||!Number.isFinite(Date.parse(result+'T00:00:00Z'))||new Date(result+'T00:00:00Z').toISOString().slice(0,10)!==result))throw new Error('최근 업데이트일은 유효한 YYYY-MM-DD 날짜가 필요합니다.');return result;}
function codes(value,label,{required=false}={}){const list=text(value,400,label).toUpperCase().split(/[,/\s-]+/).filter(Boolean);if(required&&!list.length)throw new Error(`${label}을 입력하세요.`);if(list.length>20||list.some(code=>!/^[A-Z0-9_]{1,30}$/.test(code)))throw new Error(`${label}은 대문자 코드로 최대 20개까지 입력하세요.`);if(new Set(list).size!==list.length)throw new Error(`${label}에 같은 코드가 중복되었습니다.`);return list;}
export function suggestNodeId(kind,existingIds){const prefix=kind==='admin'?'AD':'RT';const ids=new Set(existingIds.map(id=>String(id).toUpperCase()));for(let i=1;i<=ids.size+1;i++){const candidate=`${prefix}-${String(i).padStart(3,'0')}`;if(!ids.has(candidate))return candidate;}}
export function validateTermination(end,start,reason=''){
  const terminated=month(end,'Terminate date'),started=month(start,'Start date');
  if(terminated&&started&&terminated<started)throw new Error('종료월은 계약 시작월보다 앞설 수 없습니다.');
  return {end:terminated,endReason:terminated?text(reason,300,'종료 사유'):''};
}
export function buildWorkNode(input,existingIds=[]){
  if(!input||!kinds.includes(input.kind))throw new Error('항로 또는 서무 업무를 선택하세요.');
  const id=text(input.id,80,'고유 ID').toUpperCase(),name=text(input.name,120,'업무명');
  if(!/^[A-Z0-9_-]{1,80}$/.test(id))throw new Error('고유 ID는 영문·숫자·하이픈·밑줄로 입력하세요.');
  if(existingIds.some(existing=>String(existing).toUpperCase()===id))throw new Error('이미 사용 중인 ID입니다. 종료된 항로의 ID도 재사용할 수 없습니다.');
  if(!name)throw new Error('업무명을 입력하세요.');
  const allowed=input.kind==='route'?['none','monthly','quarterly','annual','ships']:['none','monthly','quarterly','annual','weeks'];
  if(!allowed.includes(input.cycle_kind))throw new Error('업무에 맞는 업데이트 주기를 선택하세요.');
  const cycle={kind:input.cycle_kind};
  if(['ships','weeks'].includes(cycle.kind)){const count=Number(input.cycle_count);if(!Number.isInteger(count)||count<1||count>520)throw new Error('선박 수 또는 주 수는 1~520 사이 정수로 입력하세요.');cycle.count=count;}
  const recent=date(input.recent);
  if(input.kind==='admin')return {kind:'admin',node:{id,name,type:'서무 업무(기타)',recent,cycle,guide:text(input.guide,6000,'업무 가이드라인')}};
  const type=input.contract_type;
  if(!['joint','sell','buy','exchange'].includes(type))throw new Error('계약 유형을 선택하세요.');
  const routeCodes=codes(input.codes,'항로 코드',{required:true});
  if(type==='exchange'&&routeCodes.length!==2)throw new Error('교환 항로에는 서로 다른 항로 코드 2개가 필요합니다.');
  const start=month(input.start,'Start date'),termination=validateTermination(input.end,start,input.end_reason);
  const region=text(input.region,80,'권역'),group=text(input.group,80,'상위 권역');
  const items=text(input.updated_items,400,'최근 업데이트 항목').split(',').map(x=>x.trim()).filter(Boolean);
  return {kind:'route',node:{id,name,codes:routeCodes,region:region||'미분류',group:group||'미분류',type,start,...termination,partners:codes(input.partners,'파트너 코드'),contract:text(input.contract_id,80,'Contract ID'),cycle,remark:text(input.remark,2000,'Remark'),history:recent?[{date:recent,cycle:text(input.history_cycle,120,'적용 Cycle')||'미정',items,remark:'노드 등록 시 사용자가 입력한 최근 업데이트 기준'}]:[]}};
}
export function visibleWorkEntries(entries,includeTerminated=false){return includeTerminated?[...entries]:entries.filter(entry=>!entry.ended);}
