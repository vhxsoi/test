export const demoToday='2026-10-13';
function parseDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value?d:null;}
export function dueDate(recentUpdate,cycle,{ended=false}={}){
  if(ended||!cycle)return null;
  const date=parseDate(recentUpdate);if(!date)return null;
  const count=cycle.count??1;if(!Number.isSafeInteger(count)||count<1)return null;
  if(['ships','weeks','vessels'].includes(cycle.kind)){
    if(['ships','vessels'].includes(cycle.kind)&&cycle.count===undefined)return null;
    date.setUTCDate(date.getUTCDate()+count*7);
  }else{
    const interval={monthly:1,quarterly:3,annual:12}[cycle.kind];if(!interval)return null;
    const day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+interval*count);
    const max=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,max));
  }
  if(!Number.isFinite(date.getTime()))return null;
  return date.toISOString().slice(0,10);
}
export function dueState(date,reference,{ended=false}={}){
  if(ended)return {label:'종료',class:'ended',days:null};
  const d=parseDate(date),today=parseDate(reference);
  if(!d||!today)return {label:'기준 정보 없음',class:'unknown',days:null};
  const days=Math.round((d-today)/86400000);
  return days<0?{label:'확인 필요',class:'late',days}:days<=7?{label:'업데이트 임박',class:'soon',days}:{label:'운영 중',class:'running',days};
}
export function dDayLabel(days){return days===null?'미정':days<0?`D+${Math.abs(days)}`:days===0?'D-day':`D-${days}`;}
export function cycleLabel(cycle){return cycle.kind==='weeks'?`${cycle.count??1}주마다`:['ships','vessels'].includes(cycle.kind)?`${cycle.count}주 주기`:({monthly:'매월',quarterly:'분기별',annual:'매년'}[cycle.kind]||'미정');}

export function sortByDueDate(entries){
  const time=e=>parseDate(e.due)?.getTime()??Infinity;
  return [...entries].sort((a,b)=>{const first=time(a),second=time(b);return first===second?String(a.id).localeCompare(String(b.id)):first<second?-1:1;});
}
