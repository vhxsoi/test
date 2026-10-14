"""Python business rules. No network calls or sensitive logging."""
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
import re

class DomainError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status

def today_korea():
    return datetime.now(timezone(timedelta(hours=9))).date().isoformat()

def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec='microseconds').replace('+00:00', 'Z')

def text(value, label, limit=2000):
    if value is None:
        return ''
    if not isinstance(value, str) or len(value.strip()) > limit:
        raise DomainError(f'{label} 형식을 확인하세요. 최대 {limit}자입니다.')
    return value.strip()

def parse_date(value, label='최근 업데이트일'):
    result = text(value, label, 10)
    if result:
        try:
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', result):
                raise ValueError()
            date.fromisoformat(result)
        except ValueError:
            raise DomainError(f'{label}은 유효한 YYYY-MM-DD 날짜가 필요합니다.')
    return result

def parse_month(value, label):
    result = text(value, label, 7)
    if result and (not re.fullmatch(r'[0-9]{4}-(0[1-9]|1[0-2])', result) or result.startswith('0000-')):
        raise DomainError(f'{label}은 YYYY-MM 형식으로 입력하세요.')
    return result

def termination(end, start, reason=''):
    end = parse_month(end, '종료월')
    start = parse_month(start, '계약 시작월')
    if end and start and end < start:
        raise DomainError('종료월은 계약 시작월보다 앞설 수 없습니다.')
    return end, text(reason, '종료 사유', 300) if end else ''

def cycle_data(kind, count, node_kind):
    if kind in (None, '', 'none'):
        return None, None
    if kind == 'ships':
        kind = 'vessels'
    allowed = ['monthly', 'quarterly', 'annual', 'vessels'] if node_kind == 'route' else ['monthly', 'quarterly', 'annual', 'weeks']
    if kind not in allowed:
        raise DomainError('업무에 맞는 업데이트 주기를 선택하세요.')
    if kind in ('weeks', 'vessels'):
        try:
            if isinstance(count, bool) or str(int(count)) != str(count):
                raise ValueError()
            count = int(count)
            if not 1 <= count <= 520:
                raise ValueError()
        except (TypeError, ValueError):
            raise DomainError('선박 수 또는 주 수는 1~520 사이 정수여야 합니다.')
    else:
        count = 1
    return kind, count

def due_date(recent, kind, count=None, ended=False):
    if ended or not recent or not kind:
        return None
    try:
        start = date.fromisoformat(recent)
        if kind == 'legacy_days':
            if isinstance(count, bool) or not isinstance(count, int) or not 1 <= count <= 366000:
                return None
            return (start + timedelta(days=count)).isoformat()
        if kind in ('ships', 'vessels', 'weeks'):
            if not isinstance(count, int) or count < 1:
                return None
            return (start + timedelta(weeks=count)).isoformat()
        months = {'monthly': 1, 'quarterly': 3, 'annual': 12}.get(kind)
        if not months:
            return None
        offset = start.year * 12 + start.month - 1 + months
        year, month_zero = divmod(offset, 12)
        month = month_zero + 1
        return date(year, month, min(start.day, monthrange(year, month)[1])).isoformat()
    except (TypeError, ValueError, OverflowError):
        return None

def deadline_state(due, ended=False, reference=None):
    if ended:
        return {'days': None, 'label': '종료', 'state': 'ended'}
    if not due:
        return {'days': None, 'label': '기준 정보 없음', 'state': 'unknown'}
    days = (date.fromisoformat(due) - date.fromisoformat(reference or today_korea())).days
    return {'days': days, 'label': '확인 필요' if days < 0 else '업데이트 임박' if days <= 7 else '운영 중', 'state': 'late' if days < 0 else 'soon' if days <= 7 else 'running'}

def code_list(value, label, required=False):
    if isinstance(value, list):
        if any(not isinstance(x, str) for x in value):
            raise DomainError(f'{label} 형식을 확인하세요.')
        value = ','.join(value)
    values = re.split(r'[,/\s-]+', text(value, label, 400).upper())
    values = [x for x in values if x]
    if required and not values:
        raise DomainError(f'{label}을 입력하세요.')
    if len(values) > 20 or any(not re.fullmatch(r'[A-Z0-9_]{1,30}', x) for x in values):
        raise DomainError(f'{label}은 대문자 코드로 최대 20개까지 입력하세요.')
    if len(set(values)) != len(values):
        raise DomainError(f'{label}에 중복 코드가 있습니다.')
    return values

def validate_document(doc):
    allowed = {'text', 'heading1', 'heading2', 'bullet', 'numbered', 'todo', 'callout', 'quote', 'divider', 'code', 'link'}
    if not isinstance(doc, dict) or not isinstance(doc.get('title'), str) or len(doc['title']) > 200 or doc.get('icon') not in ['📒', '🧭', '📝', '📋'] or not isinstance(doc.get('blocks'), list) or len(doc['blocks']) > 500:
        raise DomainError('페이지 형식이나 블록 수를 확인하세요.')
    ids, total = set(), len(doc['title'])
    for block in doc['blocks']:
        if not isinstance(block, dict) or not isinstance(block.get('id'), str) or not 1 <= len(block['id']) <= 80 or block['id'] in ids or block.get('type') not in allowed or not isinstance(block.get('text'), str) or not isinstance(block.get('href'), str) or not isinstance(block.get('checked'), bool):
            raise DomainError('페이지 블록 형식이 올바르지 않습니다.')
        ids.add(block['id'])
        total += len(block['text']) + len(block['href'])
    if total > 50000:
        raise DomainError('페이지는 합계 50,000자까지 저장할 수 있습니다.')
    return doc
