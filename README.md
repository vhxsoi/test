# Worknote — 항로·서무 업무 관리

Windows 개인 PC에서 항로와 서무 업무를 함께 관리하고, 업데이트 이력과 업무 매뉴얼을 기록하는 앱이다. **Python으로 도메인 규칙과 SQLite 저장을 처리하고, React로 UI를 구성하며, Node.js로 로컬 API 서버를 실행한다.** 계약 상세는 외부 LLM notebook 링크로 확인하고 GPT는 사용자가 선택한 원문의 검토용 초안을 만든다.

## 업무 구조와 구현 상태

| 구성 | 현재 동작 |
| --- | --- |
| Route / 서무 업무 node | 새 업무 생성, 고유 ID 검증, 한 보드에서 Due date 순으로 혼합 정렬 |
| 종료 항로 | Terminate date 입력 즉시 기본 보드에서 제외. ‘종료 항로 포함’으로 조회하고 종료월을 지우면 복원 |
| History | Route 내부에 날짜·Cycle·변경 항목·Remark 추가. 가장 최근 기록으로 기한 계산 |
| 업무 매뉴얼 | Route ID별 Notion 스타일 블록 페이지, SQLite 저장, JSON 백업·불러오기 |
| Contract node | 최소 참조 정보와 HTTPS Notebook 링크 저장·열기. 계약 원문 수집 없음 |
| SQLite | 실제 연결 완료. 브라우저 새로고침·서버 재시작 후 유지 |
| 기존 브라우저 자료 | 이전 화면에서 대상 확인 후 DB로 가져오기. 원본 보존, 중복 ID 거절 |
| GPT 마법사 | 명시적 전송 동의, 요약·정형화 초안 검토·JSON 내보내기. 실제 호출은 API 키 필요 |
| 후속 작업 | Windows 키 보호, 암호화 DB 백업·복원, 확인 알림, 설치 파일, Gmail 연동 |

Due date는 **최근 업데이트일 + 주기**다. 매월·분기·연간은 달력 기준이며 선박 n척은 n주로 추정한다. 기한 경과 → 당일 → 가까운 미래 → 미정 순으로 정렬하고 같은 기한은 ID 순이다. 종료 항로는 기록을 삭제하지 않으며 미래 종료월도 입력하면 즉시 제외한다. 매뉴얼 편집은 History·최근 업데이트일·D-day를 바꾸지 않는다.

검토한 Excel 자료의 기존 주기는 선택적 `imported_route_schedules` 테이블로 보존할 수 있다. 해당 항로는 원문 `Month × 30`을 반올림한 일수를 사용하고 화면에 ‘엑셀 N일 주기’로 표시한다. 일반 노드의 달력·선박 규칙은 그대로 사용한다. [Excel 수입 저장 구조](database/imports/excel_sources.sql)는 출처 페이지와 History의 원본 행도 보존하며 자동 Excel 업로드 기능은 아니다. 개인 데이터 파일은 Git에 포함하지 않는다.

## 시작하기

Node.js **24.19.0 이상 24.x**와 **Python 3.10 이상**을 설치한다. Python은 표준 라이브러리만 사용하여 pip 설치가 필요 없다.

```bash
npm ci
npm run verify
npm start
```

`npm start`는 React를 빌드하고 서버를 실행한다. 사용자 PC의 브라우저에서 **http://127.0.0.1:3000** 을 연다. 첫 실행은 빈 DB이며 새 업무를 만들거나 화면에서 가상 예시 데이터를 불러올 수 있다. 예시는 기존 데이터가 있는 DB를 덮어쓰지 않는다. API 키 없이 모든 로컬 업무 기능을 사용할 수 있다.

Windows PowerShell에서도 위 명령을 사용하거나 다음 스크립트를 실행한다.

```powershell
.\scripts\setup-windows.ps1
.\scripts\start-windows.ps1
# GPT를 사용할 때만:
.\scripts\start-windows.ps1 -WithAI
```

[Windows 실행 안내](docs/windows-setup.md)에 Python 설치, 저장 위치, 보안 키 입력과 대체 실행 방법을 정리했다. `.env.example`은 예시이며 자동으로 읽지 않는다. ChatGPT 구독과 OpenAI API 사용료는 별도다.

## 저장 위치와 구조

Windows 기본 DB는 **`%LOCALAPPDATA%\Worknote\data\worknote.db`**다. Linux는 `${XDG_DATA_HOME:-~/.local/share}/Worknote/data/worknote.db`다. `WORKNOTE_DATA_DIR`로 Worknote 폴더를, `WORKNOTE_PYTHON`으로 Python 실행 파일을, `PORT`로 서버 포트를 바꿀 수 있다. DB와 실행 중 WAL 파일은 Git에 넣지 않는다. `config/worknote.defaults.json`은 기본 설계를 검증하기 위한 문서이며 런타임 설정 로더는 아니다.

```text
frontend/                  React 업무 보드·상세·블록 매뉴얼·마법사
backend/                   Python 도메인 검증·SQLite 저장·가상 예시
lib/                       Node → Python 연결 및 GPT API 처리
server.js                  127.0.0.1 HTTP·API 서버
public/                    공유 모델·스타일과 이전 UI 소스
database/migrations/       실제 적용되는 SQLite 초기 스키마
config/                    기본 설계 설정
docs/                      요구사항·아키텍처·Windows 안내·개발 계획
scripts/                   빌드·검증·Windows 실행 지원
tests/                     Node API·도메인·보안·스키마 검증
.github/workflows/         Linux·Windows CI 정의
```

## 개발 계획과 검증

- [확정 요구사항](docs/requirements.md)
- [아키텍처와 처리 흐름](docs/architecture.md)
- [노드 데이터 모델](docs/data-model.md)
- [개발 업무 목록과 완료 기준](docs/roadmap.md)
- [보안·자료 보관 기준](SECURITY.md)
- [이전 개발 계획 보존본](docs/initial-development-plan.md)

`npm run verify`는 React 프로덕션 빌드, JavaScript 구문·설정 검사, Node 테스트와 Python 테스트를 실행한다. Python과 Node 연동 테스트는 임시 SQLite 파일에서 저장·재접속·충돌 방지를 확인한다. `npm run db:check`는 초기 스키마 제약을 메모리 DB에서 검사한다. 테스트에 실제 회사 자료를 사용하지 않는다.

로컬 검증 통과와 실제 Windows·GitHub CI·GPT 호출 검증은 별개다. API 키가 없는 검증 환경에서는 GPT 응답을 모의 검사한다. SQLite와 JSON 백업은 평문이며 디스크 보호·암호화 백업 도구는 별도다. 앱은 Notebook·매뉴얼·전체 DB를 GPT로 자동 전송하지 않고 초안을 자동 적용하지 않는다.
