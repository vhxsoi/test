import { spawnSync } from "node:child_process";
const python =
  process.env.WORKNOTE_PYTHON ||
  (process.platform === "win32" ? "python" : "python3");
const result = spawnSync(
  python,
  ["-m", "unittest", "discover", "-s", "backend", "-p", "test_*.py", "-v"],
  {
    stdio: "inherit",
    env: { ...process.env, PYTHONUTF8: "1", PYTHONDONTWRITEBYTECODE: "1" },
  },
);
if (result.error) {
  console.error(
    "Python 3.10 이상 실행기를 찾지 못했습니다. WORKNOTE_PYTHON을 확인하세요.",
  );
  process.exit(1);
}
process.exit(result.status ?? 1);
