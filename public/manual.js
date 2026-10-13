import {marked} from './vendor/marked.js';
import {blockTypes,makeBlock,validateDocument,fromMarkdown,safeLink,moveBlock} from './manual-model.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pages=new Map();let selected=null,readOnly=false,menuId=null;
function page(){return pages.get(selected.id);}
function key(){return `worknote-route-page-v2:${selected.id}`;}
function dirty(){return JSON.stringify(page().draft)!==JSON.stringify(page().record.document);}
function dateLabel(value){return value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'아직 저장하지 않음';}
function validRecord(value){return value&&validateDocument(value.document)&&Number.isSafeInteger(value.version)&&value.version>=1&&typeof value.updatedAt==='string'&&Number.isFinite(Date.parse(value.updatedAt));}
export function prepareManual(route){
  selected={id:route.id,title:route.title};readOnly=false;menuId=null;
  if(pages.has(route.id))return;
  let record={document:{title:route.title+' 업무 매뉴얼',icon:'📒',blocks:[makeBlock()]},updatedAt:null,version:0},blocked=false,status='';
  try{
    const raw=localStorage.getItem(key());
    if(raw){const value=JSON.parse(raw);if(!validRecord(value))throw new Error('Invalid page');record=value;}
    else{const old=localStorage.getItem(`worknote-route-manual-v1:${route.id}`);if(old){const value=JSON.parse(old);if(typeof value.text!=='string'||value.text.length>50000)throw new Error('Invalid legacy page');const document=fromMarkdown(marked.lexer(value.text),route.title+' 업무 매뉴얼');if(!validateDocument(document))throw new Error('Invalid converted page');record={document,updatedAt:typeof value.updatedAt==='string'&&Number.isFinite(Date.parse(value.updatedAt))?value.updatedAt:null,version:0};status='기존 매뉴얼을 블록 페이지로 열었습니다. 원본은 보존되며 저장 버튼을 누르면 새 형식으로 저장됩니다.';}}
  }catch{blocked=true;status='기존 문서를 읽지 못했습니다. 내용을 보호하기 위해 저장을 중단했습니다. 현재 작성 내용은 페이지 백업으로 내려받을 수 있습니다.';}
  pages.set(route.id,{record,draft:structuredClone(record.document),blocked,status});
}
function isEmpty(){return page().draft.blocks.every(b=>b.type==='text'&&!b.text.trim()&&!b.href);}
function menuMarkup(){return `<div class="block-menu" role="menu" aria-label="블록 종류">${Object.entries(blockTypes).map(([type,label])=>`<button role="menuitem" data-set-block-type="${type}" data-target-block="${esc(menuId)}"><span>${({text:'T',heading1:'H₁',heading2:'H₂',bullet:'•',numbered:'1.',todo:'☑',callout:'💡',quote:'❝',divider:'―',code:'⌘',link:'↗'})[type]}</span>${label}</button>`).join('')}</div>`;}
function numberAt(index){let number=1;while(--index>=0&&page().draft.blocks[index].type==='numbered')number++;return number;}
function blockMarkup(block,index){
  const content=readOnly?`<div class="block-read">${esc(block.text).replace(/\n/g,'<br>')}</div>`:`<textarea data-block-text="${esc(block.id)}" aria-label="블록 ${index+1} ${blockTypes[block.type]}" rows="1" placeholder="${block.type==='text'?'내용을 입력하세요. / 로 블록 종류 선택':blockTypes[block.type]+' 입력'}" maxlength="50000">${esc(block.text)}</textarea>`;
  const prefix=block.type==='todo'?`<input type="checkbox" data-block-check="${esc(block.id)}" aria-label="체크리스트 ${index+1} 완료" ${block.checked?'checked':''} ${readOnly?'disabled':''}>`:block.type==='bullet'?'<span class="block-prefix">•</span>':block.type==='numbered'?`<span class="block-prefix">${numberAt(index)}.</span>`:block.type==='callout'?'<span class="block-prefix">💡</span>':'';
  return `<div class="page-block type-${block.type} ${block.checked&&block.type==='todo'?'checked':''}" data-block-id="${esc(block.id)}">${!readOnly?`<div class="block-tools"><button data-block-menu="${esc(block.id)}" aria-label="블록 ${index+1} 종류 변경">⋮⋮</button><button data-block-add="${esc(block.id)}" aria-label="블록 ${index+1} 아래 추가">＋</button><button data-block-up="${esc(block.id)}" aria-label="블록 ${index+1} 위로 이동" ${index===0?'disabled':''}>↑</button><button data-block-down="${esc(block.id)}" aria-label="블록 ${index+1} 아래로 이동" ${index===page().draft.blocks.length-1?'disabled':''}>↓</button><button data-block-delete="${esc(block.id)}" aria-label="블록 ${index+1} 삭제">×</button></div>`:''}<div class="block-content">${prefix}${block.type==='divider'?'<hr>':content}</div>${block.type==='link'?`<div class="block-link-row">${!readOnly?`<input data-block-link="${esc(block.id)}" aria-label="블록 ${index+1} 링크 주소" placeholder="https://…" value="${esc(block.href)}">`:''}${safeLink(block.href)?`<a href="${esc(safeLink(block.href))}" target="_blank" rel="noopener noreferrer">참고 링크 열기 ↗</a>`:'<span>HTTP/HTTPS 주소를 입력하세요</span>'}</div>`:''}${menuId===block.id&&!readOnly?menuMarkup():''}</div>`;
}
export function renderManual(){
  if(!selected)return '<p class="empty">항로 상세에서 업무 매뉴얼을 선택하세요.</p>';
  const p=page();
  return `<div id="manual-page" class="notion-page" data-route-id-ref="${esc(selected.id)}"><div class="notion-topbar"><button id="manual-back">← 업무 보드</button><span>나의 페이지 <i>/</i> ${esc(selected.id)}</span><div><button id="manual-read">${readOnly?'편집하기':'읽기 모드'}</button><button id="manual-import">백업 불러오기</button><button id="manual-download">페이지 백업 ↓</button><button class="primary" id="manual-save" ${p.blocked?'disabled':''}>저장</button></div></div><div class="notion-cover" aria-hidden="true"><div class="cover-circle"></div><span>WORK, DOCUMENTED.</span></div><div class="notion-document"><div class="page-icon-row"><button id="manual-icon" aria-label="페이지 아이콘 변경" ${readOnly?'disabled':''}>${p.draft.icon}</button><span class="page-private">개인 페이지 · 로컬 브라우저 저장</span></div>${readOnly?`<h1 class="notion-title-read">${esc(p.draft.title||'제목 없음')}</h1>`:`<textarea id="manual-title" rows="1" maxlength="200" aria-label="페이지 제목" placeholder="제목 없음">${esc(p.draft.title)}</textarea>`}<div class="notion-properties"><div><span>▱ 연결 항로</span><strong>${esc(selected.id)} <small>${esc(selected.title)}</small></strong></div><div><span>▤ 페이지 종류</span><strong><b class="page-property-tag">업무 매뉴얼</b></strong></div><div><span>◷ 매뉴얼 수정</span><strong>${esc(dateLabel(p.record.updatedAt))}</strong></div></div><div class="page-note">💡 <span>업무 절차와 체크리스트를 자유롭게 작성하세요. 계약 업데이트일과 D-day는 따로 관리됩니다.</span></div><div class="page-content-heading"><span>PAGE CONTENT</span>${!readOnly?`<button id="manual-template" ${isEmpty()?'':'disabled'}>기본 템플릿으로 시작 ↗</button>`:''}</div><div id="manual-blocks" class="notion-blocks ${readOnly?'reading':''}">${p.draft.blocks.map(blockMarkup).join('')}</div>${!readOnly?'<button id="manual-add" class="page-add-block">＋ 블록 추가 <span>본문 · 제목 · 목록 · 체크리스트 · 링크</span></button>':''}<div class="page-bottom"><span id="manual-meta">${dirty()?'저장 전 변경사항 있음':'저장된 내용과 동일'}${p.record.version?' · 저장 '+p.record.version+'회':''}</span><span id="manual-feedback" role="status">${esc(p.status)}</span></div><p class="page-storage-note">내용은 이 브라우저에 저장됩니다. 다른 기기로 옮길 때는 페이지 백업을 사용하세요. 외부 AI로 자동 전송하지 않습니다.</p></div><input id="manual-import-file" type="file" accept="application/json,.json" hidden></div>`;
}
function resize(){document.querySelectorAll('#manual-page textarea').forEach(el=>{el.style.height='auto';el.style.height=el.scrollHeight+'px';});}
function refresh(focusId){if(!document.querySelector('#manual-page'))return;document.querySelector('#content').innerHTML=renderManual();resize();if(focusId){const input=document.querySelector(`[data-block-text="${CSS.escape(focusId)}"]`);if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}}}
function feedback(text){page().status=text;const el=document.querySelector('#manual-feedback');if(el)el.textContent=text;}
function metadata(){document.querySelector('#manual-meta').textContent=dirty()?'저장 전 변경사항 있음':'저장된 내용과 동일';document.querySelector('#manual-template')?.toggleAttribute('disabled',!isEmpty());}
function insertAfter(id,type='text'){if(page().draft.blocks.length>=500){feedback('블록은 최대 500개까지 작성할 수 있습니다.');return;}const block=makeBlock(type);const index=page().draft.blocks.findIndex(b=>b.id===id);page().draft.blocks.splice(index<0?page().draft.blocks.length:index+1,0,block);menuId=null;refresh(block.id);}
function template(){return [makeBlock('heading1','업무 목적'),makeBlock('text','이 항로에서 수행할 업무와 확인할 결과를 작성합니다.'),makeBlock('heading1','처리 절차'),makeBlock('numbered','최근 업데이트와 변경 대상 항목을 확인합니다.'),makeBlock('numbered','필요한 자료와 파트너 협의 내용을 검토합니다.'),makeBlock('numbered','확인된 변경 사항을 History에 기록합니다.'),makeBlock('heading1','체크리스트'),makeBlock('todo','원본 자료 확인'),makeBlock('todo','파트너 협의 사항 확인'),makeBlock('todo','변경 내용과 적용 회차 확인'),makeBlock('divider'),makeBlock('heading1','참고 자료'),makeBlock('callout','계약 상세는 연결된 Contract node의 LLM notebook에서 확인합니다. 기밀 계약 원문은 이 페이지에 복사하지 않습니다.'),makeBlock('heading1','예외 상황과 대응'),makeBlock('text','지연, 자료 누락, 추가 확인이 필요한 경우의 대응을 작성합니다.')];}
export function initManual(){
  document.addEventListener('worknote:open-manual',()=>requestAnimationFrame(resize));
  document.addEventListener('input',e=>{
    if(!document.querySelector('#manual-page'))return;
    if(e.target.id==='manual-title')page().draft.title=e.target.value;
    else if(e.target.dataset.blockText){const b=page().draft.blocks.find(b=>b.id===e.target.dataset.blockText);b.text=e.target.value;}
    else if(e.target.dataset.blockLink){const b=page().draft.blocks.find(b=>b.id===e.target.dataset.blockLink);b.href=e.target.value;const row=e.target.closest('.block-link-row');const anchor=row.querySelector('a');anchor?.remove();const hint=row.querySelector('span');hint?.remove();const url=safeLink(b.href);const el=document.createElement(url?'a':'span');el.textContent=url?'참고 링크 열기 ↗':'HTTP/HTTPS 주소를 입력하세요';if(url){el.href=url;el.target='_blank';el.rel='noopener noreferrer';}row.append(el);}
    else return;feedback('');metadata();resize();
  });
  document.addEventListener('keydown',e=>{
    const id=e.target.dataset.blockText;if(!id||readOnly)return;
    const b=page().draft.blocks.find(b=>b.id===id);
    if(e.key==='/'&&!b.text){e.preventDefault();menuId=id;refresh();document.querySelector('.block-menu button')?.focus();}
    if(e.key==='Enter'&&!e.shiftKey&&b.type!=='code'){
      e.preventDefault();if(page().draft.blocks.length>=500){feedback('블록은 최대 500개입니다.');return;}
      const start=e.target.selectionStart,end=e.target.selectionEnd;const tail=b.text.slice(end);b.text=b.text.slice(0,start);const newBlock=makeBlock(['bullet','numbered','todo'].includes(b.type)?b.type:'text',tail);const index=page().draft.blocks.findIndex(b=>b.id===id);page().draft.blocks.splice(index+1,0,newBlock);menuId=null;refresh(newBlock.id);
    }
    if(e.key==='Backspace'&&!b.text&&page().draft.blocks.length>1){e.preventDefault();const index=page().draft.blocks.findIndex(b=>b.id===id);page().draft.blocks.splice(index,1);refresh(page().draft.blocks[Math.max(0,index-1)].id);}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menuId){const id=menuId;menuId=null;refresh(id);}});
  document.addEventListener('change',async e=>{
    if(e.target.dataset.blockCheck){page().draft.blocks.find(b=>b.id===e.target.dataset.blockCheck).checked=e.target.checked;refresh();}
    if(e.target.id==='manual-import-file'){
      const file=e.target.files[0];if(!file)return;
      try{if(file.size>400000)throw new Error('파일이 너무 큽니다.');const data=JSON.parse(await file.text());if(data.routeId!==selected.id||!validateDocument(data.document))throw new Error('현재 Route ID의 올바른 페이지 백업이 필요합니다.');page().draft=structuredClone(data.document);menuId=null;feedback('백업을 편집 초안으로 불러왔습니다. 확인한 뒤 저장하세요.');refresh();}
      catch(error){feedback(error.message||'백업을 읽지 못했습니다.');}
    }
  });
  document.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button||!document.querySelector('#manual-page'))return;
    if(button.id==='manual-back')document.querySelector('[data-view="board"]').click();
    if(button.id==='manual-read'){readOnly=!readOnly;menuId=null;refresh();}
    if(button.id==='manual-icon'){const icons=['📒','🧭','📝','📋'];page().draft.icon=icons[(icons.indexOf(page().draft.icon)+1)%icons.length];refresh();}
    if(button.id==='manual-template'&&isEmpty()){page().draft.blocks=template();feedback('기본 템플릿을 넣었습니다. 각 블록을 클릭해 수정하세요.');refresh();}
    if(button.id==='manual-add')insertAfter(null);
    if(button.dataset.blockAdd)insertAfter(button.dataset.blockAdd);
    if(button.dataset.blockMenu){menuId=menuId===button.dataset.blockMenu?null:button.dataset.blockMenu;refresh();document.querySelector('.block-menu button')?.focus();}
    if(button.dataset.setBlockType){const b=page().draft.blocks.find(b=>b.id===button.dataset.targetBlock);if(b&&Object.hasOwn(blockTypes,button.dataset.setBlockType)){b.type=button.dataset.setBlockType;menuId=null;refresh(b.id);}}
    if(button.dataset.blockUp||button.dataset.blockDown){const id=button.dataset.blockUp||button.dataset.blockDown;page().draft.blocks=moveBlock(page().draft.blocks,id,button.dataset.blockUp?-1:1);refresh(id);}
    if(button.dataset.blockDelete){const blocks=page().draft.blocks;const index=blocks.findIndex(b=>b.id===button.dataset.blockDelete);blocks.splice(index,1);if(!blocks.length)blocks.push(makeBlock());menuId=null;refresh(blocks[Math.min(index,blocks.length-1)].id);}
    if(button.id==='manual-save'&&!page().blocked){
      const p=page();if(!validateDocument(p.draft)){feedback('제목은 200자, 본문·링크는 합계 50,000자, 블록은 500개까지 저장할 수 있습니다.');return;}
      const record={routeId:selected.id,document:structuredClone(p.draft),updatedAt:new Date().toISOString(),version:p.record.version+1};
      try{localStorage.setItem(key(),JSON.stringify(record));p.record=record;feedback('페이지를 이 브라우저에 저장했습니다.');refresh();}catch{feedback('저장하지 못했습니다. 작성 내용은 유지됩니다. 페이지 백업으로 보관하세요.');}
    }
    if(button.id==='manual-download'){const data={format:'worknote-page-v2',routeId:selected.id,document:page().draft,exportedAt:new Date().toISOString()};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${selected.id.replace(/[^A-Za-z0-9_-]/g,'_')}-page.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback('현재 페이지를 백업 파일로 내려받습니다.');}
    if(button.id==='manual-import')document.querySelector('#manual-import-file').click();
  });
}
