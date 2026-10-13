import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const schema=readFileSync(new URL('../database/migrations/001_initial.sql',import.meta.url),'utf8');
function database(){const db=new DatabaseSync(':memory:');db.exec(schema);return db;}
function route(db,id,name='동일 이름 항로'){
  db.prepare("INSERT INTO work_nodes(id,kind,name,cycle_type,cycle_count) VALUES (?,'route',?,'vessels',6)").run(id,name);
  db.prepare("INSERT INTO route_nodes(node_id,contract_type,start_month) VALUES (?,'joint','2026-03')").run(id);
}
test('schema creates separate route identities and rejects wrong subtypes or unknown foreign keys',()=>{
  const db=database();try{
    route(db,'RT-001');route(db,'RT-002');assert.equal(db.prepare('SELECT COUNT(*) AS count FROM work_nodes').get().count,2);
    db.exec("INSERT INTO work_nodes(id,kind,name,cycle_type,cycle_count) VALUES ('AD-001','admin','서무','monthly',1)");
    assert.throws(()=>db.exec("INSERT INTO route_nodes(node_id,contract_type) VALUES ('AD-001','joint')"));
    assert.throws(()=>db.exec("INSERT INTO admin_nodes(node_id) VALUES ('RT-001')"));
    assert.throws(()=>db.exec("INSERT INTO route_contracts(route_id,contract_id) VALUES ('RT-001','MISSING')"));
    assert.throws(()=>db.exec("UPDATE work_nodes SET kind='admin' WHERE id='RT-001'"));
    assert.equal(db.prepare('SELECT version FROM schema_migrations').get().version,'001_initial');
  }finally{db.close();}
});
test('contract nodes store reference metadata and prohibit non-HTTPS references',()=>{
  const db=database();try{
    route(db,'RT-001');db.exec("INSERT INTO contract_nodes(id,display_name,notebook_url) VALUES ('CT-001','예시 계약','https://example.com/notebook')");
    db.exec("INSERT INTO route_contracts(route_id,contract_id) VALUES ('RT-001','CT-001')");
    assert.throws(()=>db.exec("INSERT INTO contract_nodes(id,display_name,notebook_url) VALUES ('CT-002','예시','http://example.com')"));
    const columns=db.prepare('PRAGMA table_info(contract_nodes)').all().map(c=>c.name);assert.deepEqual(columns,['id','display_name','notebook_url','remark','updated_at']);
  }finally{db.close();}
});
test('history controls route recency while manual saves do not change work update basis',()=>{
  const db=database();try{
    route(db,'RT-001');
    db.exec("INSERT INTO history_nodes(id,route_id,update_date,cycle) VALUES ('H-NEW','RT-001','2026-10-05','제1차'),('H-OLD','RT-001','2026-09-01','이전 회차')");
    const before=db.prepare("SELECT recent_update_date FROM work_node_summary WHERE id='RT-001'").get().recent_update_date;assert.equal(before,'2026-10-05');
    db.exec("INSERT INTO manual_pages(route_id,title,blocks_json) VALUES ('RT-001','업무 매뉴얼','[]')");
    db.exec("UPDATE manual_pages SET title='수정한 매뉴얼',revision=2 WHERE route_id='RT-001'");
    assert.equal(db.prepare("SELECT recent_update_date FROM work_node_summary WHERE id='RT-001'").get().recent_update_date,before);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM history_nodes').get().count,2);
    assert.throws(()=>db.exec("INSERT INTO manual_pages(route_id,title,blocks_json) VALUES ('RT-001','중복 페이지','[]')"));
  }finally{db.close();}
});
test('administrative category and cycle values are constrained; node removal preserves attached records',()=>{
  const db=database();try{
    assert.throws(()=>db.exec("INSERT INTO work_nodes(id,kind,name,cycle_type,cycle_count) VALUES ('BAD','admin','업무','vessels',6)"));
    assert.throws(()=>db.exec("INSERT INTO work_nodes(id,kind,name,cycle_type,cycle_count) VALUES ('BAD','route','항로','vessels',0)"));
    assert.throws(()=>db.exec("INSERT INTO work_nodes(id,kind,name,cycle_type,cycle_count) VALUES ('BAD','route','항로','monthly',NULL)"));
    assert.throws(()=>db.exec("INSERT INTO work_nodes(id,kind,name,cycle_type,cycle_count) VALUES ('BAD','route','항로',NULL,1)"));
    db.exec("INSERT INTO work_nodes(id,kind,name,cycle_type,cycle_count) VALUES ('AD-001','admin','서무','weeks',2)");
    assert.throws(()=>db.exec("INSERT INTO admin_nodes(node_id,category) VALUES ('AD-001','항로')"));
    db.exec("INSERT INTO admin_nodes(node_id,recent_update_date,guideline) VALUES ('AD-001','2026-10-13','자료를 확인한다')");
    assert.equal(db.prepare("SELECT recent_update_date FROM work_node_summary WHERE id='AD-001'").get().recent_update_date,'2026-10-13');
    assert.throws(()=>db.exec("DELETE FROM work_nodes WHERE id='AD-001'"));
  }finally{db.close();}
});
