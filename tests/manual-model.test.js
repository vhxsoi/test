import test from 'node:test';
import assert from 'node:assert/strict';
import {marked} from 'marked';
import {makeBlock,validateDocument,fromMarkdown,safeLink,moveBlock} from '../public/manual-model.js';
test('legacy Markdown becomes structured blocks with headings, lists and checked items',()=>{
  const source='# 업무 매뉴얼\n\n## 절차\n1. 자료 확인\n2. 변경 기록\n\n- [x] 검토 완료\n- [ ] 파트너 확인\n\n```text\n원문 코드\n```';
  const doc=fromMarkdown(marked.lexer(source),'기본 제목');assert.equal(doc.title,'업무 매뉴얼');assert.equal(validateDocument(doc),true);assert.deepEqual(doc.blocks.map(b=>b.type),['heading1','numbered','numbered','todo','todo','code']);assert.equal(doc.blocks[3].checked,true);assert.equal(doc.blocks[4].checked,false);
});
test('unsafe links and malformed, duplicate or excessive blocks fail validation',()=>{
  assert.equal(safeLink('javascript:alert(1)'),null);assert.equal(safeLink('data:text/html,x'),null);assert.equal(safeLink('file:///C:/private.txt'),null);assert.equal(safeLink('https://example.com/docs'),'https://example.com/docs');
  const b=makeBlock('todo','검토');assert.equal(validateDocument({title:'매뉴얼',icon:'📒',blocks:[b]}),true);assert.equal(validateDocument({title:'매뉴얼',icon:'📒',blocks:[b,b]}),false);assert.equal(validateDocument({title:'매뉴얼',icon:'📒',blocks:[{...b,type:'script'}]}),false);assert.equal(validateDocument({title:'매뉴얼',icon:'📒',blocks:[{...b,text:'a'.repeat(50001)}]}),false);
});
test('moving document blocks preserves original array and block identity',()=>{
  const a=makeBlock('text','A'),b=makeBlock('text','B'),c=makeBlock('text','C');const original=[a,b,c];assert.deepEqual(moveBlock(original,b.id,-1).map(x=>x.text),['B','A','C']);assert.deepEqual(original.map(x=>x.text),['A','B','C']);assert.equal(moveBlock(original,a.id,-1),original);
});
