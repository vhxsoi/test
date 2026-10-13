import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPythonStore } from "../lib/python-store.js";
import { createApp } from "../server.js";

async function start(store) {
  const app = createApp({ store, configured: () => false });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${app.address().port}`;
  const session = await (await fetch(origin + "/api/session")).json();
  const headers = {
    "Content-Type": "application/json",
    "X-Worknote-Token": session.token,
    Origin: origin,
  };
  return {
    origin,
    request: (path, method = "GET", body) =>
      fetch(origin + path, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    close: async () => {
      app.closeAllConnections();
      await new Promise((resolve) => app.close(resolve));
    },
  };
}

test("Node API and actual Python SQLite preserve data across server restarts and reject stale writes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "worknote-ipc-"));
  let server;
  try {
    const store = createPythonStore({ directory });
    assert.equal((await store("init")).count, 0);
    server = await start(store);
    assert.equal((await fetch(server.origin + "/api/nodes")).status, 403);
    assert.equal(
      (
        await server.request("/api/nodes", "POST", {
          kind: "route",
          id: "RT-IPC",
          name: "인도 항로",
          codes: ["IND"],
          type: "joint",
          cycle: { kind: "ships", count: 6 },
          recent: "2026-10-05",
          start: "2026-03",
        })
      ).status,
      200,
    );
    const before = (await (await server.request("/api/nodes")).json()).nodes[0];
    assert.equal(before.due, "2026-11-16");
    assert.equal(before.name, "인도 항로");
    // Enough Unicode data to cross pipe chunks: test actual UTF-8 transport.
    const document = {
      title: "업무 매뉴얼",
      icon: "📒",
      blocks: [
        {
          id: "block-1",
          type: "text",
          text: "한글📋".repeat(7000),
          href: "",
          checked: false,
        },
      ],
    };
    assert.equal(
      (
        await server.request("/api/nodes/RT-IPC/manual", "PUT", {
          document,
          expected_revision: 0,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await server.request("/api/nodes/RT-IPC/manual", "PUT", {
          document,
          expected_revision: 0,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await server.request("/api/nodes/RT-IPC", "PATCH", {
          end: "2027-01",
          endReason: "미갱신",
          remark: "보관",
          expectedUpdatedAt: before.updatedAt,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await server.request("/api/nodes/RT-IPC", "PATCH", {
          end: "",
          expectedUpdatedAt: before.updatedAt,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await server.request("/api/nodes", "POST", {
          kind: "admin",
          id: "rt-ipc",
          name: "충돌",
        })
      ).status,
      409,
    );
    assert.equal((await server.request("/api/demo", "POST", {})).status, 409);
    assert.equal(
      (
        await server.request("/api/nodes/RT-IPC/contracts", "POST", {
          id: "CT-IPC",
          display_name: "계약 참조",
          notebook_url: "https://example.com/notebook",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await server.request("/api/nodes/RT-IPC/contracts", "POST", {
          id: "CT-IPC",
          notebook_url: "https://example.com:invalid",
        })
      ).status,
      400,
    );
    await server.close();
    server = await start(createPythonStore({ directory }));
    const after = (await (await server.request("/api/nodes")).json()).nodes[0];
    assert.equal(after.ended, true);
    assert.equal(after.due, null);
    assert.deepEqual(after.history, before.history);
    assert.equal(
      after.contracts[0].notebook_url,
      "https://example.com/notebook",
    );
    assert.deepEqual(
      (await (await server.request("/api/nodes/RT-IPC/manual")).json())
        .document,
      document,
    );
    const file = await readFile(join(directory, "data", "worknote.db"));
    assert.equal(file.subarray(0, 16).toString(), "SQLite format 3\0");
  } finally {
    if (server) await server.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("Python subprocess import is atomic and malformed nested input never writes partial nodes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "worknote-import-"));
  try {
    const store = createPythonStore({ directory });
    await store("init");
    await assert.rejects(
      store("create", {
        kind: "route",
        id: "RT-BAD",
        name: "잘못된 입력",
        codes: "IND",
        type: "joint",
        cycle: [],
      }),
      (error) => error.status === 400,
    );
    await assert.rejects(
      store("import", {
        nodes: [
          { kind: "admin", id: "AD-NEW", name: "서무" },
          {
            kind: "route",
            id: "RT-BAD",
            name: "항로",
            codes: "IND",
            type: "joint",
            history: [null],
          },
        ],
      }),
      (error) => error.status === 400,
    );
    assert.equal((await store("list")).nodes.length, 0);
    await store("create", {
      kind: "admin",
      id: "AD-KEEP",
      name: "보존",
      recent: "2026-01-31",
      cycle_kind: "monthly",
    });
    await assert.rejects(
      store("import", {
        nodes: [
          { kind: "admin", id: "AD-NEW", name: "서무" },
          { kind: "admin", id: "AD-KEEP", name: "중복" },
        ],
      }),
      (error) => error.status === 409,
    );
    assert.deepEqual(
      (await store("list")).nodes.map((node) => node.id),
      ["AD-KEEP"],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
