import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import {templates,validateInput,validateDraft,runWizard} from '../lib/wizard.js';
import {createApp} from '../server.js';
function draft(template='summary'){return {summary:'검토용 요약',fields:templates[template].fields.map(key=>({key,value:null,evidence:null})),missing_information:['기한 미확인'],warnings:[]};}
function output(data){return {status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]};}
test('input rejects missing consent, empty source, unknown template and excessive text',()=>{
  for(const body of [{template:'summary',source:'원문',consent:false},{template:'summary',source:' ',consent:true},{template:'__proto__',source:'원문',consent:true},{template:'route',source:'a'.repeat(12001),consent:true}])assert.throws(()=>validateInput(body));
  assert.equal(validateInput({template:'summary',source:' 원문 ',consent:true}).source,'원문');
});
test('ungrounded extracted values become unknown',()=>{
  const d=draft();d.fields[0]={key:'핵심 내용',value:'임의의 사실',evidence:'없는 인용'};
  const validated=validateDraft(d,{template:'summary',source:'원문'});
  assert.equal(validated.fields[0].value,null);assert.equal(validated.warnings.length,1);
});
test('n vessels produces n estimated weeks and duplicate fields fail',()=>{
  const d=draft('route');d.fields.find(f=>f.key==='cycle_type').value='vessels';d.fields.find(f=>f.key==='cycle_type').evidence='선박 6척';d.fields.find(f=>f.key==='vessel_count').value='6';d.fields.find(f=>f.key==='vessel_count').evidence='선박 6척';
  const validated=validateDraft(d,{template:'route',source:'선박 6척'});assert.equal(validated.fields.find(f=>f.key==='cycle_weeks').value,'6');assert.match(validated.warnings[0],/추정/);
  const bad=draft();bad.fields[1]=bad.fields[0];assert.throws(()=>validateDraft(bad,{template:'summary',source:'원문'}));
});
test('API request uses structured outputs and store:false; only selected source is submitted',async()=>{
  let call;
  const result=await runWizard({template:'summary',source:'기한 확인'},{apiKey:'test-key',fetchImpl:async(url,options)=>{call={url,options};return new Response(JSON.stringify(output(draft())),{status:200});}});
  const body=JSON.parse(call.options.body);assert.equal(call.url,'https://api.openai.com/v1/responses');assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(JSON.parse(body.input).source,'기한 확인');assert.equal(result.template,'summary');assert.equal(JSON.stringify(result).includes('test-key'),false);
});
test('missing key, refusals, incomplete outputs and invalid upstream responses fail clearly',async()=>{
  const input={template:'summary',source:'원문'};
  await assert.rejects(runWizard(input,{apiKey:''}),e=>e.status===503);
  await assert.rejects(runWizard(input,{apiKey:'test',fetchImpl:async()=>new Response('{}',{status:401})}),/인증/);
  await assert.rejects(runWizard(input,{apiKey:'test',fetchImpl:async()=>new Response(JSON.stringify({status:'incomplete'}))}),/완료되지/);
  await assert.rejects(runWizard(input,{apiKey:'test',fetchImpl:async()=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]}))}),e=>e.status===422);
  await assert.rejects(runWizard(input,{apiKey:'test',fetchImpl:async()=>new Response(JSON.stringify(output({}))) }),e=>e.status===502);
});
test('local HTTP API rejects foreign Host/Origin, unauthenticated requests and absent consent',async()=>{
  let calls=0;const app=createApp({configured:()=>true,runner:async input=>{calls++;return {draft:draft(input.template),template:input.template,model:'test'};}});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${app.address().port}`;
  try{
    const get=await fetch(origin+'/api/session');const session=await get.json();assert.equal(session.configured,true);
    assert.equal((await fetch(origin+'/api/session',{headers:{Origin:'https://evil.example'}})).status,403);
    const foreignHostStatus=await new Promise((resolve,reject)=>{const req=http.get(origin+'/api/session',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});
    assert.equal(foreignHostStatus,403);
    assert.equal((await fetch(origin+'/api/wizard',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
    const headers={'Content-Type':'application/json','X-Worknote-Token':session.token,Origin:origin};
    assert.equal((await fetch(origin+'/api/wizard',{method:'POST',headers,body:JSON.stringify({template:'summary',source:'원문',consent:false})})).status,400);
    assert.equal(calls,0);
    const response=await fetch(origin+'/api/wizard',{method:'POST',headers,body:JSON.stringify({template:'summary',source:'원문',consent:true})});assert.equal(response.status,200);assert.equal(calls,1);
    const page=await fetch(origin+'/');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/connect-src 'self'/);assert.equal(page.headers.get('x-content-type-options'),'nosniff');
  }finally{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
});
