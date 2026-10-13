# 개발 방법

Node.js 24.19.0과 Python 3.10 이상을 사용한다(검증 환경: Python 3.12). 기존 체크아웃에서 `npm ci` 후 `npm run verify`를 실행한다. 앱 실행은 `npm start`다. Windows 절차는 [설정 문서](docs/windows-setup.md)를 따른다.

React는 `frontend/`, Node.js API는 `server.js`와 `lib/`, Python 도메인·SQLite 저장은 `backend/`에서 개발한다. Python은 표준 라이브러리만 사용하므로 pip 설치가 필요 없다. UI 변경을 계속 빌드하려면 별도 터미널에서 `npm run ui:watch`를 실행하고 브라우저를 새로고침한다. Vite 빌드 결과는 `dist/`에 생성하며 Git에 포함하지 않는다.

요구사항은 [requirements.md](docs/requirements.md), 데이터 구조는 [data-model.md](docs/data-model.md), 구현 순서는 [roadmap.md](docs/roadmap.md)를 기준으로 한다. 코드 변경에 맞춰 문서를 갱신하고 현재 기능과 설계만 있는 기능을 구분한다.

회사 원문, 실제 계약 링크, 키, 개인 DB를 테스트나 PR에 넣지 않는다. 가상 데이터로 테스트한다. 기한 계산, 노드 연결, 보존을 위한 데이터 이전, AI 초안 검토 등 실제 오류를 잡는 검증을 수행한다.

PR에는 변경된 사용자 동작, 수행한 검증과 남은 제한을 적는다. 로컬 검증 통과는 GitHub Actions의 실행 성공이나 Windows PC에서의 실제 검증을 뜻하지 않는다.
