"""One JSON request on stdin; one JSON result on stdout. SQLite stays local."""
import json
import os
from pathlib import Path
import sqlite3
import sys
import uuid
from urllib.parse import urlparse
from domain import DomainError, text, parse_date, parse_month, termination, cycle_data, due_date, deadline_state, today_korea, utc_now, code_list, validate_document

ROOT = Path(__file__).resolve().parent.parent

def connect(path):
    target = Path(path).resolve()
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if os.name != 'nt':
        os.umask(0o077)
    db = sqlite3.connect(target, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    tables = db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()
    if not tables:
        db.executescript((ROOT / 'database/migrations/001_initial.sql').read_text(encoding='utf-8'))
    elif not any(row['name'] == 'schema_migrations' for row in tables):
        db.close()
        raise DomainError('지원하지 않는 DB 형식입니다. 원본을 보존하고 저장 경로를 확인하세요.', 409)
    versions = [r[0] for r in db.execute('SELECT version FROM schema_migrations')]
    if versions != ['001_initial']:
        db.close()
        raise DomainError('지원하지 않는 DB 버전입니다.', 409)
    db.execute('PRAGMA journal_mode=WAL')
    return db

def exists(db, node_id, kind=None):
    row = db.execute('SELECT * FROM work_nodes WHERE id=?', (node_id,)).fetchone()
    if not row or (kind and row['kind'] != kind):
        raise DomainError('업무 노드를 찾을 수 없습니다.', 404)
    return row

def add_node(db, payload):
    if not isinstance(payload, dict) or payload.get('kind') not in ('route', 'admin'):
        raise DomainError('항로 또는 서무 업무를 선택하세요.')
    kind = payload['kind']
    node_id = text(payload.get('id'), 'ID', 80).upper()
    import re
    if not re.fullmatch(r'[A-Z0-9_-]{1,80}', node_id):
        raise DomainError('ID는 영문·숫자·하이픈·밑줄로 입력하세요.')
    if db.execute('SELECT 1 FROM work_nodes WHERE upper(id)=?', (node_id,)).fetchone():
        raise DomainError('이미 사용 중인 ID입니다. 종료 항로의 ID도 재사용할 수 없습니다.', 409)
    name = text(payload.get('name'), '업무명', 120)
    if not name:
        raise DomainError('업무명을 입력하세요.')
    raw_cycle = payload.get('cycle', {})
    if not isinstance(raw_cycle, dict):
        raise DomainError('업데이트 주기 형식을 확인하세요.')
    cycle, count = cycle_data(payload.get('cycle_kind', raw_cycle.get('kind')), payload.get('cycle_count', raw_cycle.get('count')), kind)
    recent = parse_date(payload.get('recent', ''))
    db.execute('INSERT INTO work_nodes(id,kind,name,cycle_type,cycle_count) VALUES (?,?,?,?,?)', (node_id, kind, name, cycle, count))
    if kind == 'admin':
        db.execute('INSERT INTO admin_nodes(node_id,recent_update_date,guideline) VALUES (?,?,?)', (node_id, recent or None, text(payload.get('guide'), '가이드라인', 6000)))
        return node_id
    contract_type = payload.get('contract_type', payload.get('type'))
    if contract_type not in ('joint', 'sell', 'buy', 'exchange'):
        raise DomainError('계약 유형을 선택하세요.')
    codes = code_list(payload.get('codes'), '항로 코드', True)
    if contract_type == 'exchange' and len(codes) != 2:
        raise DomainError('교환 항로에는 서로 다른 코드 2개가 필요합니다.')
    start = parse_month(payload.get('start'), '계약 시작월')
    end, reason = termination(payload.get('end'), start, payload.get('end_reason', payload.get('endReason', '')))
    region = text(payload.get('region'), '권역', 80) or '미분류'
    group = text(payload.get('group'), '상위 권역', 80) or '미분류'
    region_row = db.execute("SELECT id FROM regions WHERE name=? AND group_name=? AND classification_label='권역'", (region, group)).fetchone()
    region_id = region_row['id'] if region_row else str(uuid.uuid4())
    if not region_row:
        db.execute('INSERT INTO regions(id,name,group_name) VALUES (?,?,?)', (region_id, region, group))
    db.execute('INSERT INTO route_nodes(node_id,region_id,contract_type,start_month,terminate_month,termination_reason,remark) VALUES (?,?,?,?,?,?,?)', (node_id, region_id, contract_type, start or None, end or None, reason, text(payload.get('remark'), 'Remark')))
    for position, code in enumerate(codes):
        db.execute('INSERT INTO route_codes(route_id,code,position) VALUES (?,?,?)', (node_id, code, position))
    for code in code_list(payload.get('partners'), '파트너 코드'):
        db.execute('INSERT OR IGNORE INTO partners(code,name) VALUES (?,?)', (code, '선사명 미등록'))
        role = {'joint':'operator','sell':'buyer','buy':'seller','exchange':'exchange_partner'}[contract_type]
        db.execute('INSERT INTO route_partners(route_id,partner_code,role) VALUES (?,?,?)', (node_id, code, role))
    contract_id = text(payload.get('contract_id', payload.get('contract')), 'Contract ID', 80)
    if contract_id:
        db.execute('INSERT OR IGNORE INTO contract_nodes(id,display_name) VALUES (?,?)', (contract_id, contract_id))
        db.execute('INSERT INTO route_contracts(route_id,contract_id) VALUES (?,?)', (node_id, contract_id))
    history = payload.get('history')
    if history is not None:
        if not isinstance(history, list) or len(history) > 500:
            raise DomainError('업데이트 이력 형식을 확인하세요.')
        for item in history:
            append_history(db, node_id, item)
    elif recent:
        append_history(db, node_id, {'date':recent,'cycle':payload.get('history_cycle') or '미정','items':payload.get('updated_items','').split(','),'remark':'등록 시 사용자가 입력한 기준 기록'})
    return node_id

def append_history(db, node_id, payload):
    if not isinstance(payload, dict):
        raise DomainError('업데이트 이력 형식을 확인하세요.')
    exists(db, node_id, 'route')
    updated = parse_date(payload.get('date'))
    if not updated:
        raise DomainError('업데이트 날짜를 입력하세요.')
    cycle = text(payload.get('cycle'), 'Cycle', 120) or '미정'
    items = payload.get('items', [])
    if isinstance(items, str):
        items = items.split(',')
    if not isinstance(items, list) or len(items) > 20:
        raise DomainError('업데이트 항목을 확인하세요.')
    items = list(dict.fromkeys(text(item, '업데이트 항목', 80) for item in items if item))
    history_id = str(uuid.uuid4())
    db.execute('INSERT INTO history_nodes(id,route_id,update_date,cycle,remark) VALUES (?,?,?,?,?)', (history_id, node_id, updated, cycle, text(payload.get('remark'), 'History Remark')))
    for item in items:
        if item:
            db.execute('INSERT INTO history_items(history_id,item) VALUES (?,?)', (history_id, item))
    db.execute('UPDATE work_nodes SET updated_at=? WHERE id=?', (utc_now(), node_id))
    return history_id

def list_nodes(db):
    records = []
    for row in db.execute('SELECT * FROM work_node_summary'):
        parent = db.execute('SELECT updated_at FROM work_nodes WHERE id=?', (row['id'],)).fetchone()
        cycle = {'kind':'ships' if row['cycle_type']=='vessels' else row['cycle_type'] or 'none'}
        if row['cycle_type'] in ('weeks','vessels'):
            cycle['count'] = row['cycle_count']
        record = {'id':row['id'],'kind':row['kind'],'name':row['name'],'cycle':cycle,'recent':row['recent_update_date'] or '', 'updatedAt':parent['updated_at']}
        if row['kind'] == 'admin':
            data = db.execute('SELECT * FROM admin_nodes WHERE node_id=?', (row['id'],)).fetchone()
            record.update(type=data['category'],guide=data['guideline'],ended=False)
        else:
            data = db.execute('SELECT r.*,g.name AS region,g.group_name FROM route_nodes r LEFT JOIN regions g ON g.id=r.region_id WHERE node_id=?', (row['id'],)).fetchone()
            history = []
            for h in db.execute('SELECT * FROM history_nodes WHERE route_id=? ORDER BY update_date DESC,created_at DESC', (row['id'],)):
                history.append({'id':h['id'],'date':h['update_date'],'cycle':h['cycle'],'remark':h['remark'],'items':[x[0] for x in db.execute('SELECT item FROM history_items WHERE history_id=? ORDER BY item', (h['id'],))]})
            contracts = [dict(c) for c in db.execute('SELECT c.* FROM contract_nodes c JOIN route_contracts rc ON c.id=rc.contract_id WHERE rc.route_id=? ORDER BY c.id', (row['id'],))]
            record.update(type=data['contract_type'],region=data['region'] or '미분류',group=data['group_name'] or '미분류',start=data['start_month'] or '',end=data['terminate_month'] or '',endReason=data['termination_reason'] or '',remark=data['remark'],codes=[x[0] for x in db.execute('SELECT code FROM route_codes WHERE route_id=? ORDER BY position',(row['id'],))],partners=[x[0] for x in db.execute('SELECT DISTINCT partner_code FROM route_partners WHERE route_id=? ORDER BY partner_code',(row['id'],))],contracts=contracts,contract=contracts[0]['id'] if contracts else '',history=history,ended=bool(data['terminate_month']))
        record['due'] = due_date(record['recent'],row['cycle_type'],row['cycle_count'],record['ended'])
        record.update(deadline_state(record['due'],record['ended']))
        records.append(record)
    return sorted(records,key=lambda n:(n['due'] is None,n['due'] or '',n['id']))

def save_manual(db, node_id, payload, importing=False):
    exists(db,node_id,'route')
    doc = validate_document(payload.get('document'))
    previous = db.execute('SELECT revision FROM manual_pages WHERE route_id=?',(node_id,)).fetchone()
    version = previous['revision'] if previous else 0
    if importing and previous:
        raise DomainError('이미 매뉴얼이 있는 항로입니다. 원본을 덮어쓰지 않았습니다.',409)
    if not importing and payload.get('expected_revision') != version:
        raise DomainError('다른 창에서 페이지가 변경되었습니다. 초안을 백업한 뒤 화면을 새로고침하세요.',409)
    updated = utc_now()
    db.execute('INSERT INTO manual_pages(route_id,title,icon,blocks_json,revision,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(route_id) DO UPDATE SET title=excluded.title,icon=excluded.icon,blocks_json=excluded.blocks_json,revision=excluded.revision,updated_at=excluded.updated_at',(node_id,doc['title'],doc['icon'],json.dumps(doc['blocks'],ensure_ascii=False),version+1,updated))
    return {'document':doc,'version':version+1,'updatedAt':updated}

def handle(db, action, payload):
    if not isinstance(payload, dict):
        raise DomainError('올바른 요청 객체가 필요합니다.')
    if action == 'init':
        return {'ready':True,'count':db.execute('SELECT COUNT(*) FROM work_nodes').fetchone()[0]}
    if action == 'list':
        return {'nodes':list_nodes(db),'today':today_korea(),'storage':'sqlite'}
    if action == 'manual_get':
        exists(db,payload['id'],'route')
        row=db.execute('SELECT * FROM manual_pages WHERE route_id=?',(payload['id'],)).fetchone()
        return None if not row else {'document':{'title':row['title'],'icon':row['icon'],'blocks':json.loads(row['blocks_json'])},'version':row['revision'],'updatedAt':row['updated_at']}
    db.execute('BEGIN IMMEDIATE')
    try:
        if action == 'create':
            result={'id':add_node(db,payload)}
        elif action == 'update':
            node_id=payload['id'];row=exists(db,node_id)
            if payload.get('expectedUpdatedAt') != row['updated_at']:
                raise DomainError('다른 창에서 업무가 변경되었습니다. 입력 내용을 보관한 뒤 화면을 새로고침하세요.',409)
            if row['kind']=='route':
                start=db.execute('SELECT start_month FROM route_nodes WHERE node_id=?',(node_id,)).fetchone()[0]
                end,reason=termination(payload.get('end'),start,payload.get('endReason'))
                db.execute('UPDATE route_nodes SET terminate_month=?,termination_reason=?,remark=? WHERE node_id=?',(end or None,reason,text(payload.get('remark'),'Remark'),node_id))
            else:
                cycle,count=cycle_data(payload.get('cycle_kind'),payload.get('cycle_count'),'admin')
                db.execute('UPDATE work_nodes SET cycle_type=?,cycle_count=? WHERE id=?',(cycle,count,node_id))
                db.execute('UPDATE admin_nodes SET recent_update_date=?,guideline=? WHERE node_id=?',(parse_date(payload.get('recent')) or None,text(payload.get('guide'),'가이드라인',6000),node_id))
            db.execute('UPDATE work_nodes SET updated_at=? WHERE id=?',(utc_now(),node_id));result={'id':node_id}
        elif action == 'history':
            result={'id':append_history(db,payload['id'],payload)}
        elif action == 'manual_save':
            result=save_manual(db,payload['id'],payload)
        elif action == 'contract':
            exists(db,payload['route_id'],'route')
            cid=text(payload.get('id'),'Contract ID',80)
            if not cid: raise DomainError('Contract ID를 입력하세요.')
            url=text(payload.get('notebook_url'),'Notebook 링크',2048)
            try:
                parsed=urlparse(url)
                port=parsed.port
                valid=parsed.scheme=='https' and parsed.hostname and not parsed.username and not parsed.password and not any(c.isspace() or ord(c)<32 for c in url) and '\\' not in url
            except ValueError:
                valid=False
            if url and not valid:
                raise DomainError('인증정보가 포함되지 않은 HTTPS Notebook 링크가 필요합니다.')
            db.execute('INSERT INTO contract_nodes(id,display_name,notebook_url,remark) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,notebook_url=excluded.notebook_url,remark=excluded.remark,updated_at=excluded.updated_at',(cid,text(payload.get('display_name'),'표시명',120) or cid,url or None,text(payload.get('remark'),'비고')))
            db.execute('INSERT OR IGNORE INTO route_contracts(route_id,contract_id) VALUES (?,?)',(payload['route_id'],cid));result={'id':cid}
        elif action == 'demo':
            if db.execute('SELECT COUNT(*) FROM work_nodes').fetchone()[0]:
                raise DomainError('빈 DB에서만 예시 데이터를 불러올 수 있습니다.',409)
            data=json.loads((ROOT/'backend/demo.json').read_text(encoding='utf-8'))
            for n in data['routes']:add_node(db,{**n,'kind':'route'})
            for n in data['admins']:add_node(db,{**n,'kind':'admin'})
            result={'imported':len(data['routes'])+len(data['admins'])}
        elif action == 'import':
            nodes=payload.get('nodes',[]);manuals=payload.get('manuals',[])
            if not isinstance(nodes,list) or not isinstance(manuals,list) or len(nodes)>500 or len(manuals)>500:
                raise DomainError('이전 데이터 형식을 확인하세요.')
            for n in nodes:add_node(db,n)
            for m in manuals:save_manual(db,m['routeId'],m,True)
            result={'imported':len(nodes),'manuals':len(manuals)}
        else:raise DomainError('지원하지 않는 작업입니다.',404)
        db.commit();return result
    except Exception:
        db.rollback();raise

def main():
    sys.stdin.reconfigure(encoding='utf-8');sys.stdout.reconfigure(encoding='utf-8')
    db=None
    try:
        request=json.load(sys.stdin);db=connect(request['db_path']);result=handle(db,request['action'],request.get('payload',{}));response={'ok':True,'result':result}
    except DomainError as error:
        response={'ok':False,'status':error.status,'error':str(error)}
    except sqlite3.IntegrityError:
        response={'ok':False,'status':409,'error':'노드 연결 또는 데이터 제약을 확인하세요. 변경은 저장하지 않았습니다.'}
    except Exception:
        response={'ok':False,'status':500,'error':'로컬 저장 작업을 처리하지 못했습니다. Python 버전과 저장 경로 권한을 확인하세요.'}
    finally:
        if db:db.close()
    print(json.dumps(response,ensure_ascii=False))

if __name__=='__main__':main()
