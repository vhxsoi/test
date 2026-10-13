import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
export function dataDirectory() {
  return resolve(
    process.env.WORKNOTE_DATA_DIR ||
      join(
        process.platform === "win32"
          ? process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local")
          : process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"),
        "Worknote",
      ),
  );
}
export function createPythonStore({
  directory = dataDirectory(),
  python = process.env.WORKNOTE_PYTHON ||
    (process.platform === "win32" ? "python" : "python3"),
} = {}) {
  const dbPath = join(directory, "data", "worknote.db");
  const worker = fileURLToPath(
    new URL("../backend/worker.py", import.meta.url),
  );
  return (action, payload = {}) =>
    new Promise((resolve, reject) => {
      const { OPENAI_API_KEY, ...environment } = process.env;
      const child = spawn(python, [worker], {
        shell: false,
        windowsHide: true,
        env: { ...environment, PYTHONUTF8: "1" },
        stdio: ["pipe", "pipe", "pipe"],
      });
      let output = "",
        done = false;
      const finish = (error, result) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        error ? reject(error) : resolve(result);
      };
      const error = (message, status = 500) =>
        Object.assign(new Error(message), { status });
      const timer = setTimeout(() => {
        child.kill();
        finish(error("로컬 저장 작업의 응답 시간이 초과되었습니다."));
      }, 30000);
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        output += chunk;
        if (Buffer.byteLength(output) > 8 * 1024 * 1024) {
          child.kill();
          finish(error("저장 응답이 너무 큽니다."));
        }
      });
      // Never forward subprocess stderr, environment, documents, or keys to logs.
      child.stderr.resume();
      child.on("error", () =>
        finish(
          error(
            "Python 실행기를 찾지 못했습니다. Python 3.10 이상을 설치하고 WORKNOTE_PYTHON을 확인하세요.",
          ),
        ),
      );
      child.stdin.on("error", () => {});
      child.on("close", (code) => {
        if (done) return;
        if (code !== 0) {
          finish(error("Python 저장 작업을 완료하지 못했습니다."));
          return;
        }
        try {
          const data = JSON.parse(output);
          if (!data.ok) finish(error(data.error, data.status));
          else finish(null, data.result);
        } catch {
          finish(error("로컬 저장 응답을 읽지 못했습니다."));
        }
      });
      child.stdin.end(JSON.stringify({ action, payload, db_path: dbPath }));
    });
}
