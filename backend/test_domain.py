import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from domain import DomainError, due_date, deadline_state, validate_document
from worker import connect, handle

class DomainTests(unittest.TestCase):
    def test_calendar_and_vessel_deadlines(self):
        self.assertEqual(due_date('2026-01-31','monthly',1),'2026-02-28')
        self.assertEqual(due_date('2024-02-29','annual',1),'2025-02-28')
        self.assertEqual(due_date('2026-09-07','vessels',6),'2026-10-19')
        self.assertIsNone(due_date('2026-09-07','vessels',6,True))
        self.assertEqual(deadline_state('2026-10-12',reference='2026-10-13')['days'],-1)
    def test_invalid_page(self):
        with self.assertRaises(DomainError):validate_document({'title':'x','icon':'📒','blocks':[{'id':'x','type':'script','text':'bad','checked':False,'href':''}]})
    def test_imported_legacy_days_differ_from_calendar_months(self):
        self.assertEqual(due_date('2026-01-31','legacy_days',30),'2026-03-02')
        self.assertEqual(due_date('2026-09-07','legacy_days',36),'2026-10-13')
        for count in [0,True,1.2,366001]:self.assertIsNone(due_date('2026-01-31','legacy_days',count))

class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.path=str(Path(self.temp.name)/'data/worknote.db');self.db=connect(self.path)
    def tearDown(self):
        self.db.close();self.temp.cleanup()
    def create(self,node_id='RT-001'):
        return handle(self.db,'create',{'kind':'route','id':node_id,'name':'인도 항로','codes':'IND','contract_type':'joint','cycle_kind':'ships','cycle_count':'6','recent':'2026-10-05','start':'2026-03'})
    def test_real_sqlite_persistence_and_duplicate_identity(self):
        self.create();self.db.close();self.db=connect(self.path)
        rows=handle(self.db,'list',{})['nodes'];self.assertEqual(rows[0]['due'],'2026-11-16')
        self.create('RT-002');self.assertEqual(len(handle(self.db,'list',{})['nodes']),2)
        with self.assertRaises(DomainError):self.create('rt-001')
        self.assertEqual(len(handle(self.db,'list',{})['nodes']),2)
    def test_termination_restore_and_manual_independence(self):
        self.create();before=handle(self.db,'list',{})['nodes'][0];doc={'title':'업무 매뉴얼','icon':'📒','blocks':[]}
        handle(self.db,'manual_save',{'id':'RT-001','document':doc,'expected_revision':0})
        self.assertEqual(handle(self.db,'list',{})['nodes'][0]['due'],before['due'])
        handle(self.db,'update',{'id':'RT-001','end':'2027-01','endReason':'미갱신','remark':'보관','expectedUpdatedAt':before['updatedAt']})
        current=handle(self.db,'list',{})['nodes'][0];self.assertTrue(current['ended']);self.assertIsNone(current['due']);self.assertEqual(current['history'],before['history'])
        self.assertEqual(handle(self.db,'manual_get',{'id':'RT-001'})['document'],doc)
        handle(self.db,'update',{'id':'RT-001','end':'','remark':'복원','expectedUpdatedAt':current['updatedAt']})
        self.assertEqual(handle(self.db,'list',{})['nodes'][0]['due'],before['due'])
    def test_atomic_import_conflict_rolls_back_all_rows(self):
        self.create();payload={'nodes':[{'kind':'admin','id':'AD-001','name':'서무','cycle_kind':'monthly'},{'kind':'route','id':'RT-001','name':'중복','codes':'IND','contract_type':'joint'}],'manuals':[]}
        with self.assertRaises(DomainError):handle(self.db,'import',payload)
        self.assertEqual([n['id'] for n in handle(self.db,'list',{})['nodes']],['RT-001'])
    def test_history_and_optimistic_revision(self):
        self.create();handle(self.db,'history',{'id':'RT-001','date':'2026-10-12','cycle':'제2차','items':['BSA'],'remark':'협의 확인'})
        self.assertEqual(handle(self.db,'list',{})['nodes'][0]['recent'],'2026-10-12')
        doc={'title':'가이드','icon':'📒','blocks':[]};handle(self.db,'manual_save',{'id':'RT-001','document':doc,'expected_revision':0})
        with self.assertRaises(DomainError):handle(self.db,'manual_save',{'id':'RT-001','document':doc,'expected_revision':0})
    def test_demo_never_overwrites_existing_data_and_url_validation(self):
        handle(self.db,'demo',{});self.assertEqual(len(handle(self.db,'list',{})['nodes']),9)
        with self.assertRaises(DomainError):handle(self.db,'demo',{})
        with self.assertRaises(DomainError):handle(self.db,'contract',{'route_id':'RT-001','id':'CT-SEC','notebook_url':'http://example.com'})
        self.assertIsNone(self.db.execute("SELECT id FROM contract_nodes WHERE id='CT-SEC'").fetchone())
    def test_imported_schedule_shared_history_manual_and_termination(self):
        self.create()
        root=Path(__file__).resolve().parent.parent
        self.db.executescript((root/'database/imports/excel_sources.sql').read_text(encoding='utf-8'))
        self.db.execute("UPDATE work_nodes SET cycle_type=NULL,cycle_count=NULL WHERE id='RT-001'")
        self.db.execute("INSERT INTO imported_route_schedules(route_id,period_raw,interval_days) VALUES ('RT-001','1.2 Month',36)")
        self.db.commit()
        before=handle(self.db,'list',{})['nodes'][0]
        self.assertEqual(before['cycle'],{'kind':'legacy_days','count':36,'source':'excel','raw':'1.2 Month'})
        self.assertEqual(before['due'],'2026-11-10')
        handle(self.db,'manual_save',{'id':'RT-001','document':{'title':'절차','icon':'📒','blocks':[]},'expected_revision':0})
        self.assertEqual(handle(self.db,'list',{})['nodes'][0]['due'],before['due'])
        handle(self.db,'history',{'id':'RT-001','date':'2026-10-12','cycle':'다음 회차','items':['BSA']})
        current=handle(self.db,'list',{})['nodes'][0]
        self.assertEqual(current['due'],'2026-11-17')
        self.assertEqual(len(current['history']),2)
        handle(self.db,'update',{'id':'RT-001','end':'2027-01','expectedUpdatedAt':current['updatedAt']})
        self.assertIsNone(handle(self.db,'list',{})['nodes'][0]['due'])

if __name__=='__main__':unittest.main()
