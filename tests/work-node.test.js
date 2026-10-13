import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorkNode,suggestNodeId,validateTermination,visibleWorkEntries} from '../public/work-node-model.js';
import {dueDate} from '../public/schedule.js';
import {loadCollection,persistCollection,validRoutes,validAdmins} from '../public/node-storage.js';
const route={kind:'route',id:'RT-007',name:'인도 항로',codes:'ind',contract_type:'joint',cycle_kind:'ships',cycle_count:'6',recent:'2026-10-05',start:'2026-03'};
function memory(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}
test('new routes normalize codes and preserve identity for identical route names',()=>{
  const result=buildWorkNode(route,['RT-001']);assert.equal(result.node.id,'RT-007');assert.deepEqual(result.node.codes,['IND']);assert.equal(result.node.name,'인도 항로');assert.equal(validRoutes([result.node]),true);assert.equal(dueDate(result.node.history[0].date,result.node.cycle),'2026-11-16');
  assert.throws(()=>buildWorkNode({...route,id:'rt-001'},['RT-001']),/이미 사용/);
  assert.throws(()=>buildWorkNode({...route,id:'AD-001'},['AD-001']),/이미 사용/);
  assert.equal(suggestNodeId('route',['RT-001','RT-002','RT-003']),'RT-004');
});
test('exchange requires two distinct codes; optional update basis remains unknown',()=>{
  assert.throws(()=>buildWorkNode({...route,contract_type:'exchange'}),/2개/);
  assert.throws(()=>buildWorkNode({...route,codes:'IND,IND'}),/중복/);
  assert.deepEqual(buildWorkNode({...route,contract_type:'exchange',codes:'JPN-CHN'}).node.codes,['JPN','CHN']);
  assert.deepEqual(buildWorkNode({...route,recent:''}).node.history,[]);
  assert.throws(()=>buildWorkNode({...route,recent:'2026-02-30'}),/유효한/);
  assert.throws(()=>buildWorkNode({...route,cycle_count:'1.5'}),/정수/);
});
test('administrative work has fixed category and works with weekly cycles',()=>{
  const result=buildWorkNode({kind:'admin',id:'AD-004',name:'점검',cycle_kind:'weeks',cycle_count:'2',recent:'2026-10-13',guide:'자료 확인'});
  assert.equal(validAdmins([result.node]),true);assert.equal(result.node.type,'서무 업무(기타)');assert.equal(dueDate(result.node.recent,result.node.cycle),'2026-10-27');
  assert.throws(()=>buildWorkNode({kind:'admin',id:'AD-004',name:'점검',cycle_kind:'ships',cycle_count:'2'}),/주기/);
});
test('terminated routes are excluded without removal, including future end months; clearing restores visibility',()=>{
  assert.throws(()=>validateTermination('2026-02','2026-03'),/앞설/);
  assert.throws(()=>validateTermination('2026-13','2026-03'),/YYYY-MM/);
  const termination=validateTermination('2027-01','2026-03','미갱신');assert.equal(termination.end,'2027-01');
  const all=[{id:'RT-001',ended:true},{id:'AD-001',ended:false}];assert.deepEqual(visibleWorkEntries(all).map(n=>n.id),['AD-001']);assert.equal(visibleWorkEntries(all,true).length,2);assert.equal(all.length,2);
  assert.deepEqual(validateTermination('','2026-03','이전 사유'),{end:'',endReason:''});
});
test('storage errors, corrupt records and stale tabs preserve existing data',()=>{
  const storage=memory();const node=buildWorkNode(route).node;storage.setItem('routes',JSON.stringify([node]));const loaded=loadCollection('routes',[],validRoutes,storage);assert.equal(loaded.error,null);
  persistCollection('routes',[node,{...node,id:'RT-008'}],loaded,storage);assert.equal(JSON.parse(storage.getItem('routes')).length,2);
  const original=storage.getItem('routes');assert.throws(()=>persistCollection('routes',[],loaded,{getItem:storage.getItem,setItem:()=>{throw new Error('quota');}}),/저장하지/);assert.equal(storage.getItem('routes'),original);
  storage.setItem('routes','{invalid');const corrupt=loadCollection('routes',[node],validRoutes,storage);assert.ok(corrupt.error);assert.throws(()=>persistCollection('routes',[],corrupt,storage),/원본/);assert.equal(storage.getItem('routes'),'{invalid');
  storage.setItem('routes',original);const previous=loadCollection('routes',[],validRoutes,storage);storage.setItem('routes','[]');assert.throws(()=>persistCollection('routes',[node],previous,storage),/다른 창/);assert.equal(storage.getItem('routes'),'[]');
});
