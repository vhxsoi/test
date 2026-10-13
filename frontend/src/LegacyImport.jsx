import React, { useState } from "react";
import { marked } from "marked";
import { api } from "./api.js";
import { fromMarkdown, validateDocument } from "../../public/manual-model.js";
export default function LegacyImport({ existing, onClose, onDone }) {
  const [data] = useState(() => {
    try {
      const read = (key) => JSON.parse(localStorage.getItem(key) || "[]");
      const routes = read("worknote-routes-v1"),
        admins = read("worknote-admin-v1");
      if (!Array.isArray(routes) || !Array.isArray(admins)) throw new Error();
      return {
        nodes: [
          ...routes.map((n) => ({ ...n, kind: "route" })),
          ...admins.map((n) => ({ ...n, kind: "admin" })),
        ],
        error: "",
      };
    } catch {
      return {
        nodes: [],
        error:
          "기존 브라우저 업무 데이터를 읽지 못했습니다. 원본은 유지됩니다.",
      };
    }
  });
  const ids = new Set(existing.map((n) => n.id));
  const [selected, setSelected] = useState(
      new Set(data.nodes.filter((n) => !ids.has(n.id)).map((n) => n.id)),
    ),
    [error, setError] = useState(data.error),
    [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const nodes = data.nodes.filter((n) => selected.has(n.id)),
        manuals = [];
      for (const n of nodes.filter((n) => n.kind === "route")) {
        const raw = localStorage.getItem(`worknote-route-page-v2:${n.id}`),
          legacy = localStorage.getItem(`worknote-route-manual-v1:${n.id}`);
        if (raw || legacy) {
          const document = raw
            ? JSON.parse(raw).document
            : fromMarkdown(
                marked.lexer(JSON.parse(legacy).text),
                n.name + " 업무 매뉴얼",
              );
          if (!validateDocument(document))
            throw new Error(
              "기존 매뉴얼 형식을 확인하세요. 원본은 유지됩니다.",
            );
          manuals.push({ routeId: n.id, document });
        }
      }
      const result = await api("/api/import", "POST", { nodes, manuals });
      await onDone(
        `기존 업무 ${result.imported}개와 매뉴얼 ${result.manuals}개를 이전했습니다.`,
      );
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog open className="react-dialog route-dialog">
      <div className="dialog-heading">
        <h2>브라우저 자료 이전</h2>
        <button onClick={onClose} aria-label="이전 창 닫기">
          ×
        </button>
      </div>
      <p className="hint">
        이 브라우저의 이전 업무를 미리 확인하고 로컬 DB로 옮깁니다. 원본 저장
        키는 삭제하지 않으며 같은 ID를 덮어쓰지 않습니다.
      </p>
      <div className="legacy-list">
        {data.nodes.map((n, i) => (
          <label key={n.id + "-" + i}>
            <input
              type="checkbox"
              checked={selected.has(n.id)}
              disabled={ids.has(n.id)}
              onChange={(e) =>
                setSelected((s) => {
                  const next = new Set(s);
                  e.target.checked ? next.add(n.id) : next.delete(n.id);
                  return next;
                })
              }
            />
            <span>
              {n.id} · {n.name} {ids.has(n.id) ? "· 이미 DB에 있음" : ""}
            </span>
          </label>
        ))}
      </div>
      {!data.nodes.length && <p>이전할 브라우저 업무가 없습니다.</p>}
      <p className="form-error" role="alert">
        {error}
      </p>
      <button
        className="primary"
        onClick={submit}
        disabled={busy || !selected.size || Boolean(data.error)}
      >
        {busy ? "이전 중…" : `선택한 ${selected.size}개 이전`}
      </button>
    </dialog>
  );
}
