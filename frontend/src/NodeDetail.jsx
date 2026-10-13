import React, { useState } from "react";
import { api } from "./api.js";
import { cycleLabel } from "../../public/schedule.js";
export default function NodeDetail({ node, onClose, onRefresh, onManual }) {
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function update(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = Object.fromEntries(new FormData(e.currentTarget));
      await api(`/api/nodes/${encodeURIComponent(node.id)}`, "PATCH", {
        ...body,
        expectedUpdatedAt: node.updatedAt,
      });
      await onRefresh();
      setMessage(
        body.end
          ? "종료 항로로 보관했습니다. 종료 항로 포함 옵션에서 확인하세요."
          : "변경을 저장했습니다.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function history(e) {
    e.preventDefault();
    const form = e.currentTarget;
    setError("");
    try {
      const body = Object.fromEntries(new FormData(form));
      await api(`/api/nodes/${node.id}/history`, "POST", body);
      await onRefresh();
      form.reset();
      setMessage("History를 기록하고 기한을 다시 계산했습니다.");
    } catch (e) {
      setError(e.message);
    }
  }
  async function contract(e) {
    e.preventDefault();
    setError("");
    try {
      await api(
        `/api/nodes/${node.id}/contracts`,
        "POST",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      await onRefresh();
      setMessage("Notebook 참조를 저장했습니다.");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <dialog open className="route-dialog react-dialog">
      <div className="route-detail-heading">
        <div>
          <span className="node-id">
            {node.kind === "route" ? "ROUTE" : "ADMIN"} NODE / {node.id}
          </span>
          <h2>{node.name}</h2>
          <p>
            {cycleLabel(node.cycle)} · {node.due || "기한 미정"}
          </p>
        </div>
        <button onClick={onClose} aria-label="업무 상세 닫기">
          ×
        </button>
      </div>
      {node.kind === "route" ? (
        <>
          <section className="route-history">
            <div className="detail-section-heading">
              <h3>History node</h3>
              <span>{node.history.length}건</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Update date</th>
                    <th>Cycle</th>
                    <th>업데이트 항목</th>
                    <th>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {node.history.map((h) => (
                    <tr key={h.id}>
                      <td>{h.date}</td>
                      <td>{h.cycle}</td>
                      <td>{h.items.join(", ")}</td>
                      <td>{h.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <details className="detail-section">
            <summary>＋ 업데이트 이력 기록</summary>
            <form onSubmit={history}>
              <div className="node-form-grid">
                <label>
                  업데이트 날짜
                  <input type="date" name="date" required />
                </label>
                <label>
                  Cycle
                  <input name="cycle" maxLength={120} />
                </label>
                <label>
                  업데이트 항목
                  <input name="items" placeholder="선복료, BSA" />
                </label>
                <label>
                  History Remark
                  <input name="remark" maxLength={2000} />
                </label>
              </div>
              <button className="primary">History 저장</button>
            </form>
          </details>
          <section className="route-manual-entry">
            <div>
              <h3>업무 매뉴얼</h3>
              <p>페이지 블록으로 업무 절차를 기록합니다.</p>
            </div>
            <button className="primary" onClick={() => onManual(node)}>
              ▤ 업무 매뉴얼 페이지 열기
            </button>
          </section>
          <details className="detail-section">
            <summary>연결된 Contract node · Notebook 참조</summary>
            {node.contracts.map((c) => (
              <div className="contract-reference" key={c.id}>
                <strong>
                  {c.id} · {c.display_name}
                </strong>
                {c.notebook_url ? (
                  <a
                    href={c.notebook_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    계약 Notebook 열기 ↗
                  </a>
                ) : (
                  <small>Notebook 링크 미설정</small>
                )}
              </div>
            ))}
            <form onSubmit={contract}>
              <div className="node-form-grid">
                <label>
                  Contract ID
                  <input
                    name="id"
                    required
                    maxLength={80}
                    defaultValue={node.contract || ""}
                  />
                </label>
                <label>
                  계약 표시명
                  <input name="display_name" maxLength={120} />
                </label>
              </div>
              <label>
                HTTPS Notebook 링크
                <input name="notebook_url" type="url" placeholder="https://…" />
              </label>
              <label>
                기밀 제외 비고
                <input name="remark" maxLength={2000} />
              </label>
              <p className="hint">
                계약 원문을 저장하거나 링크 내용을 자동으로 읽지 않습니다.
              </p>
              <button className="primary">계약 참조 저장</button>
            </form>
          </details>
          <form onSubmit={update}>
            <div className="node-form-grid">
              <label>
                Terminate date · 종료월
                <input
                  type="month"
                  name="end"
                  aria-label="항로 종료월"
                  defaultValue={node.end}
                />
              </label>
              <label>
                종료 사유
                <input
                  name="endReason"
                  aria-label="항로 종료 사유"
                  defaultValue={node.endReason}
                  maxLength={300}
                />
              </label>
            </div>
            <label>
              Remark
              <textarea
                name="remark"
                aria-label="항로 Remark"
                rows={3}
                maxLength={2000}
                defaultValue={node.remark}
              />
            </label>
            <p className="hint">
              종료월을 입력하면 즉시 기본 보드에서 제외됩니다. 지우면 다시
              표시됩니다. History와 매뉴얼은 보존됩니다.
            </p>
            <button className="primary" disabled={busy}>
              항로 정보 저장
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={update}>
          <label>
            Recent update date
            <input type="date" name="recent" defaultValue={node.recent} />
          </label>
          <div className="node-form-grid">
            <label>
              업데이트 주기
              <select
                name="cycle_kind"
                aria-label="업데이트 주기"
                defaultValue={node.cycle.kind}
              >
                <option value="none">미정</option>
                <option value="weeks">주 단위</option>
                <option value="monthly">매월</option>
                <option value="quarterly">분기별</option>
                <option value="annual">매년</option>
              </select>
            </label>
            <label>
              주 수
              <input
                name="cycle_count"
                type="number"
                min="1"
                max="520"
                defaultValue={node.cycle.count || 1}
              />
            </label>
          </div>
          <label>
            업무 가이드라인
            <textarea
              name="guide"
              aria-label="업무 가이드라인"
              rows={7}
              maxLength={6000}
              defaultValue={node.guide}
            />
          </label>
          <button className="primary" disabled={busy}>
            가이드라인 저장
          </button>
        </form>
      )}
      <p role="alert" className="form-error">
        {error}
      </p>
      <p role="status" className="hint">
        {message}
      </p>
    </dialog>
  );
}
