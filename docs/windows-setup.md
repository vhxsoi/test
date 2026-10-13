# Windows 실행

Node.js 24.19.0과 Git을 설치하고 저장소 폴더에서 PowerShell을 연다. 관리자 권한은 필요하지 않다.

```powershell
.\scripts\setup-windows.ps1
.\scripts\start-windows.ps1
```

GPT를 사용할 때만 API 키를 서버에 제공한다. 키가 이미 환경에 있으면 재사용하고 없으면 화면에 표시하지 않는 입력을 요청한다.

```powershell
.\scripts\start-windows.ps1 -WithAI
```

`-Port 3001`로 포트를 바꿀 수 있다. `.env.example`은 비밀 없는 예시이며 자동으로 읽지 않는다. 기본 모델을 바꾸려면 `$env:OPENAI_MODEL`을 지정한다. ChatGPT 구독과 API 사용료는 별도다. 회사의 외부 AI 사용 정책을 확인한다.

PowerShell 정책이 로컬 스크립트를 막으면 시스템 정책을 낮추지 말고 아래 명령으로 직접 실행한다. 회사 장치의 정책 변경은 회사 절차를 따른다.

```powershell
npm ci
npm run verify
npm start
```

현재 데이터는 브라우저에 저장된다. DB 목표 위치 `%LOCALAPPDATA%\Worknote\data\worknote.db`는 아직 앱이 생성하거나 사용하지 않는다. 블록 페이지는 페이지 백업으로 내보낼 수 있으며 평문 JSON이므로 정책에 맞게 보관한다.

[보안 기준](../SECURITY.md)의 Windows 디스크 보호·자격 증명·백업 계획을 따른다. Linux에서 수행한 Node 검증은 이 PowerShell 스크립트를 Windows에서 실행했다는 의미가 아니다. 실제 Windows 검증과 CI 실행 결과는 별도로 확인한다.
