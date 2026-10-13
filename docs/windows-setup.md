# Windows 실행

Node.js **24.19.0 이상 24.x**, Python **3.10 이상**, Git을 설치한다. Python 설치 시 PATH 추가를 선택한다. 저장소 폴더의 PowerShell에서 다음을 실행한다. 관리자 권한은 필요하지 않다.

```powershell
node --version
python --version
.\scripts\setup-windows.ps1
.\scripts\start-windows.ps1
```

브라우저에서 http://127.0.0.1:3000 을 연다. `npm start`는 React를 빌드하고 Node 서버를 실행하며 Python이 실제 SQLite를 읽고 쓴다. Python 외부 패키지 설치는 필요 없다. 서버를 중지하려면 실행 터미널에서 Ctrl+C를 누른다. 클라우드 환경의 localhost는 사용자 PC의 localhost와 다른 주소이므로 사용자 PC에서 직접 실행해야 한다.

PowerShell 정책이 스크립트를 막으면 아래 명령으로 직접 실행한다. 시스템 실행 정책을 변경할 필요가 없다.

```powershell
npm ci
npm run verify
npm start
```

Python 실행기가 PATH에 없으면 실제 설치 경로를 지정한다. 데이터 폴더를 바꿀 때는 앱이 새 위치의 DB를 열며 기존 DB를 자동 이동하지 않는다.

```powershell
$env:WORKNOTE_PYTHON = 'C:\Users\사용자\AppData\Local\Programs\Python\Python312\python.exe'
# 필요한 경우에만, 회사 정책에 맞는 로컬 폴더 사용:
$env:WORKNOTE_DATA_DIR = 'D:\Worknote'
```

기본 저장 파일은 **`%LOCALAPPDATA%\Worknote\data\worknote.db`**다. 앱을 종료해도 노드·History·매뉴얼·Notebook 참조는 유지된다. 첫 실행은 빈 DB다. 화면의 새 업무 버튼 또는 가상 예시 불러오기를 사용한다. 종료월을 입력한 항로는 기본 보드에서 숨기고 ‘종료 항로 포함’에서 다시 확인한다. 이력·매뉴얼은 보존된다.

기존 버전 사용자는 먼저 서버를 중지하고 다음과 같이 코드를 갱신한다. 기존 브라우저 자료를 옮기려면 같은 브라우저에서 기존과 같은 주소·포트로 접속한 뒤 ‘브라우저 자료 이전’에서 대상을 확인한다. `localhost`와 `127.0.0.1`은 브라우저 저장 Origin이 다르다.

```powershell
git switch codex/worknote-demo
git pull --ff-only
npm ci
npm run verify
npm start
```

## GPT와 보관

GPT를 사용할 때만 API 키를 제공한다. 스크립트는 이미 환경에 있는 키를 재사용하거나 화면에 표시하지 않는 입력을 요청한다.

```powershell
.\scripts\start-windows.ps1 -WithAI
```

`-Port 3001`로 포트를 바꿀 수 있다. `.env.example`은 자동으로 읽지 않는다. `$env:OPENAI_MODEL`로 모델을 지정할 수 있다. ChatGPT 구독과 API 사용료는 별도다. 회사 정책에 맞는 선택 원문만 보내며 Notebook과 DB를 자동으로 전송하지 않는다.

SQLite와 페이지 JSON 백업은 암호화되어 있지 않다. [보안 기준](../SECURITY.md)에 따라 디스크 보호를 사용한다. 수동 DB 보관은 서버를 중지한 뒤 `data` 폴더 전체를 복사한다. 자동 암호화 백업·복원은 후속 구현이다. 실제 Windows 실행과 GPT 호출은 별도 검증이 필요하며 Linux 테스트 성공으로 대체하지 않는다.
