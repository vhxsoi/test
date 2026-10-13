import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, sep, extname } from "node:path";
import { runWizard, validateInput, WizardError } from "./lib/wizard.js";
import { createPythonStore } from "./lib/python-store.js";
const dist = fileURLToPath(new URL("./dist/", import.meta.url));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}
async function readBody(req, max = 2 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max)
      throw Object.assign(new Error("전송 데이터가 너무 큽니다."), {
        status: 413,
      });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("올바른 JSON 요청이 필요합니다."), {
      status: 400,
    });
  }
}
export function createApp({
  runner = runWizard,
  configured = () => Boolean(process.env.OPENAI_API_KEY),
  store = createPythonStore(),
} = {}) {
  const token = randomBytes(32).toString("hex");
  let busy = false;
  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    const port = req.socket.localPort;
    if (
      ![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)
    ) {
      json(res, 403, { error: "허용되지 않은 호스트입니다." });
      return;
    }
    let path;
    try {
      path = decodeURIComponent(
        new URL(req.url, `http://${req.headers.host}`).pathname,
      );
    } catch {
      json(res, 400, { error: "올바른 경로가 필요합니다." });
      return;
    }
    if (path.startsWith("/api/")) {
      if (
        (req.headers.origin &&
          req.headers.origin !== `http://${req.headers.host}`) ||
        req.headers["sec-fetch-site"] === "cross-site"
      ) {
        json(res, 403, { error: "외부 웹사이트의 접근을 허용하지 않습니다." });
        return;
      }
      if (path === "/api/session" && req.method === "GET") {
        json(res, 200, {
          token,
          configured: configured(),
          model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        });
        return;
      }
      if (req.headers["x-worknote-token"] !== token) {
        json(res, 403, {
          error: "앱 인증이 만료되었습니다. 화면을 새로고침하세요.",
        });
        return;
      }
      if (path === "/api/wizard") {
        if (req.method !== "POST") {
          json(res, 405, { error: "POST 요청이 필요합니다." });
          return;
        }
        if (!req.headers["content-type"]?.startsWith("application/json")) {
          json(res, 415, { error: "JSON 형식으로 전송하세요." });
          return;
        }
        if (busy) {
          json(res, 429, { error: "정리 작업이 진행 중입니다." });
          return;
        }
        busy = true;
        try {
          json(
            res,
            200,
            await runner(validateInput(await readBody(req, 65536))),
          );
        } catch (e) {
          json(res, e.status || 500, {
            error:
              e instanceof WizardError
                ? e.message
                : "정리 요청을 처리하지 못했습니다.",
          });
        } finally {
          busy = false;
        }
        return;
      }
      try {
        let action,
          payload = {};
        const match = path.match(
          /^\/api\/nodes\/([^/]+)(?:\/(manual|history|contracts))?$/,
        );
        if (path === "/api/nodes" && req.method === "GET") action = "list";
        else if (path === "/api/nodes" && req.method === "POST")
          action = "create";
        else if (path === "/api/demo" && req.method === "POST") action = "demo";
        else if (path === "/api/import" && req.method === "POST")
          action = "import";
        else if (match) {
          payload.id = match[1];
          if (!match[2] && req.method === "PATCH") action = "update";
          else if (match[2] === "manual" && req.method === "GET")
            action = "manual_get";
          else if (match[2] === "manual" && req.method === "PUT")
            action = "manual_save";
          else if (match[2] === "history" && req.method === "POST")
            action = "history";
          else if (match[2] === "contracts" && req.method === "POST")
            action = "contract";
        }
        if (!action) {
          json(res, 404, { error: "지원하지 않는 API입니다." });
          return;
        }
        if (!["GET", "HEAD"].includes(req.method)) {
          if (!req.headers["content-type"]?.startsWith("application/json")) {
            json(res, 415, { error: "JSON 형식으로 전송하세요." });
            return;
          }
          const body = await readBody(req);
          if (!body || typeof body !== "object" || Array.isArray(body))
            throw Object.assign(new Error("올바른 요청 객체가 필요합니다."), {
              status: 400,
            });
          payload =
            action === "contract"
              ? { ...body, route_id: match[1] }
              : { ...body, ...payload };
        }
        json(res, 200, await store(action, payload));
      } catch (e) {
        json(res, e.status || 500, {
          error: e.status ? e.message : "로컬 저장 요청을 처리하지 못했습니다.",
        });
      }
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    const target = resolve(dist, path === "/" ? "index.html" : "." + path);
    if (!target.startsWith(dist.endsWith(sep) ? dist : dist + sep)) {
      res.writeHead(404);
      res.end();
      return;
    }
    try {
      if (!(await stat(target)).isFile() || !mime[extname(target)])
        throw new Error();
      const data = await readFile(target);
      res.writeHead(200, {
        "Content-Type": mime[extname(target)],
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      res.writeHead(404);
      res.end("Build the React UI with npm run build.");
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const store = createPythonStore();
  try {
    await store("init");
    const server = createApp({ store });
    server.on("error", () => {
      console.error("서버를 시작하지 못했습니다. 포트를 확인하세요.");
      process.exitCode = 1;
    });
    server.listen(Number(process.env.PORT || 3000), "127.0.0.1", () =>
      console.log(
        "Worknote · React + Node.js + Python + SQLite · port " +
          server.address().port,
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
