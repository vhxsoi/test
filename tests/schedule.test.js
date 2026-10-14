import test from 'node:test';
import assert from 'node:assert/strict';
import {dueDate,dueState,dDayLabel,cycleLabel} from '../public/schedule.js';
import {validateDraft,templates} from '../lib/wizard.js';
test('monthly, quarterly and annual deadlines preserve calendar boundaries',()=>{
  assert.equal(dueDate('2026-01-31',{kind:'monthly'}),'2026-02-28');
  assert.equal(dueDate('2024-01-31',{kind:'monthly'}),'2024-02-29');
  assert.equal(dueDate('2026-10-31',{kind:'quarterly'}),'2027-01-31');
  assert.equal(dueDate('2024-02-29',{kind:'annual'}),'2025-02-28');
});
test('ship/weekly deadlines and D-day distinguish upcoming, today and overdue',()=>{
  assert.equal(dueDate('2026-09-07',{kind:'ships',count:6}),'2026-10-19');
  assert.equal(dueDate('2026-10-13',{kind:'weeks',count:2}),'2026-10-27');
  assert.equal(dDayLabel(dueState('2026-10-15','2026-10-13').days),'D-2');
  assert.equal(dDayLabel(dueState('2026-10-13','2026-10-13').days),'D-day');
  assert.equal(dDayLabel(dueState('2026-10-12','2026-10-13').days),'D+1');
});
test('imported Excel day intervals preserve fractional month conversion without calendar rounding',()=>{
  assert.equal(dueDate('2026-01-31',{kind:'legacy_days',count:30}),'2026-03-02');
  assert.equal(dueDate('2026-09-07',{kind:'legacy_days',count:36}),'2026-10-13');
  assert.equal(cycleLabel({kind:'legacy_days',count:36}),'엑셀 36일 주기');
  assert.equal(dueDate('2026-01-31',{kind:'legacy_days',count:366001}),null);
  assert.equal(dueDate('2026-01-31',{kind:'legacy_days'}),null);
});
test('missing/invalid dates or cycles and terminated contracts do not invent deadlines',()=>{
  for(const date of [null,'','2026-02-30','2026-02','2026-13-01'])assert.equal(dueDate(date,{kind:'monthly'}),null);
  for(const cycle of [{kind:'ships'},{kind:'weeks',count:0},{kind:'weeks',count:-1},{kind:'weeks',count:1.5},{kind:'unknown'}])assert.equal(dueDate('2026-10-13',cycle),null);
  assert.equal(dueDate('2026-10-13',{kind:'monthly'},{ended:true}),null);
  assert.equal(dueState(null,'2026-10-13').label,'기준 정보 없음');
});
test('wizard deadlines are calculated from recent update and are not accepted from GPT',()=>{
  for(const template of ['route','admin']){
    const d={summary:'일정 예시',fields:templates[template].fields.map(key=>({key,value:null,evidence:null})),missing_information:[],warnings:[]};
    const field=key=>d.fields.find(f=>f.key===key);
    field('recent_update_date').value='2026-10-13';field('recent_update_date').evidence='2026-10-13';
    field('cycle_type').value='monthly';field('cycle_type').evidence='매월';
    field('due_date').value='2099-01-01';field('due_date').evidence='2099-01-01';
    const result=validateDraft(d,{template,source:'2026-10-13 매월 2099-01-01'});
    const due=result.fields.find(f=>f.key==='due_date');assert.equal(due.value,'2026-11-13');assert.equal(due.derived,true);assert.equal(due.evidence,null);
  }
});

test('mixed work nodes sort by deadline with ties and missing/ended entries last',async()=>{
  const {sortByDueDate}=await import('../public/schedule.js');
  const entries=[{id:'RT-ENDED',due:null},{id:'RT-6',due:'2026-10-19'},{id:'AD-TODAY',due:'2026-10-13'},{id:'AD-UNKNOWN',due:''},{id:'RT-LATE',due:'2026-10-12'},{id:'AD-LATE',due:'2026-10-12'},{id:'RT-INVALID',due:'2026-02-30'}];
  const order=entries.map(e=>e.id);
  assert.deepEqual(sortByDueDate(entries).map(e=>e.id),['AD-LATE','RT-LATE','AD-TODAY','RT-6','AD-UNKNOWN','RT-ENDED','RT-INVALID']);
  assert.deepEqual(entries.map(e=>e.id),order);
});
