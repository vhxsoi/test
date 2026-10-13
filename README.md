# Worknote — 항로·서무 업무 관리

Windows 개인 PC에서 항로와 서무 업무를 함께 관리하고, 업데이트 이력과 업무 매뉴얼을 기록하는 앱이다. 계약 상세는 외부 LLM notebook 링크로 확인하고, GPT는 선택한 원문을 요약·정형화하는 검토용 초안을 만든다.

## 핵심 구조

- **Route node / 서무 업무 node**: 같은 보드의 동등한 업무 단위. Due date 순으로 혼합 정렬한다.
- **Contract node**: 고유 ID와 Notebook 참조 정보. 기밀 계약 원문을 저장하지 않는다.
- **History node**: Route 내부의 업데이트 날짜·Cycle·항목·Remark 기록.
- **업무 매뉴얼**: Route ID에 연결된 Notion 스타일 블록 페이지. 편집이 계약 업데이트·D-day를 바꾸지 않는다.
- **GPT 마법사**: 원문 확인·전송 동의 → 요약·정형화 → 근거 검토·수정 → 사용자 승인.

Due date는 **최근 업데이트일 + 주기**다. 매월·분기별·연간 및 선박 n척을 n주로 환산하는 추정 주기를 지원한다. 정렬은 오래 경과한 기한 → 당일 → 가까운 기한 → 미정·종료 순이며 동일 기한은 ID 순이다.

## 현재 구현과 다음 단계

| 구성 | 현재 상태 |
| --- | --- |
| 통합 보드·검색·필터·기한 계산 | 예시 데이터로 구현. 예시 기준일은 2026-10-13 |
| Route History·서무 가이드 | 브라우저 저장 기반 UI |
| 블록 매뉴얼·페이지 백업 | 구현. 이전 Markdown 원본 보존 |
| GPT 호출 코드·검토·내보내기 | 구현. API 키 필요, 실제 호출·품질 검증 미완료 |
| Contract Notebook 링크 | 요구사항·DB 스키마 정의. UI는 연결 ID 안내만 제공 |
| SQLite 저장 | 초기 스키마와 검증 제공. 앱 DB 연결·개인 데이터 이전은 미구현 |
| Windows 키 보호·암호화 백업·알림·설치 파일 | 구현 예정 |
| Gmail·실제 Notion 동기화 | 후속 범위 |

현재 브라우저 저장을 Windows DB 저장 완료로 간주하지 않는다. SQLite 목표 위치는 `%LOCALAPPDATA%\Worknote\data\worknote.db`다. `config/worknote.defaults.json`은 검증 가능한 목표 설정이며 현재 서버가 자동으로 읽어 적용하는 설정 파일은 아니다.

## 시작하기

Node.js **24.19.0**을 권장하며 24.19.0 이상의 24.x 계열을 지원한다.

```bash
npm ci
npm run verify
npm start
```

서버는 `127.0.0.1:3000`에만 접속을 허용한다. `PORT`로 포트를 변경할 수 있다. API 키 없이 UI를 사용할 수 있다.

Windows PowerShell에서:

```powershell
.\scripts\setup-windows.ps1
.\scripts\start-windows.ps1
# GPT 실행을 사용할 때만:
.\scripts\start-windows.ps1 -WithAI
```

[Windows 설정 방법](docs/windows-setup.md)에 보안 입력과 스크립트 실행 정책에 따른 대체 명령을 정리했다. `.env.example`은 비밀 없는 예시이며 자동 로딩하지 않는다. API 키는 서버 프로세스 환경에서만 사용한다. ChatGPT 구독과 OpenAI API 사용료는 별도다.

## 저장소 구성

```text
public/                    통합 보드·블록 매뉴얼·마법사 UI
lib/                       서버 측 GPT 처리
server.js                  로컬 HTTP·API 서버
config/                    목표 기본 설정
database/migrations/      로컬 SQLite 초기 스키마
docs/                      요구사항·설계·Windows 설정·구현 계획
scripts/                   구문·설정 검증, Windows 실행
tests/                    도메인·보안·스키마 검증
.github/workflows/         Linux·Windows CI
AGENTS.md                  Codex 개발 지침
SECURITY.md                보안·자료 보관 기준
CONTRIBUTING.md            개발·검증 방법
```

## 설계 문서

- [확정 요구사항](docs/requirements.md): 사용자 정의와 최신 제품 범위
- [아키텍처](docs/architecture.md): 현재 구성과 로컬 저장 계층 계획
- [데이터 모델](docs/data-model.md): 노드 연결·History·매뉴얼 분리
- [초기 DB 스키마](database/migrations/001_initial.sql): 아직 앱에 적용하지 않은 저장 계층
- [구현 순서](docs/roadmap.md): 단계별 작업과 완료 기준
- [보안 기준](SECURITY.md): 계약 기밀·API 키·백업·외부 전송
- [이전 개발 계획](docs/initial-development-plan.md): 기존 README 보존본. 최신 기술·범위는 위 문서를 따른다.

## 검증과 보안

`npm run verify`는 JavaScript 구문, 목표 설정과 테스트를 검증한다. `npm run db:check`는 메모리 SQLite에 초기 스키마를 적용하고 노드 관계·제약·매뉴얼 분리를 검사한다. 실제 개인 DB 파일을 생성하거나 변경하지 않는다. GitHub Actions는 Linux와 Windows에서 같은 검증을 실행하도록 정의되어 있으며 실제 CI 실행·Windows PC 검증은 별도다.

원문과 키는 로그에 남기지 않고, 계약 Notebook을 자동 조회하지 않는다. 매뉴얼과 전체 DB를 GPT로 자동 전송하지 않는다. AI 제안은 사용자 검토 없이 데이터 변경이나 업무 실행을 수행하지 않는다. 현재 페이지 백업은 평문 JSON이므로 정책에 맞게 보관한다.
