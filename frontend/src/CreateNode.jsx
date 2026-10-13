import React, { useState } from "react";
import { api } from "./api.js";
import { suggestNodeId } from "../../public/work-node-model.js";
export default function CreateNode({ nodes, onClose, onCreated }) {
  const [kind, setKind] = useState("route"),
    [id, setId] = useState(
      suggestNodeId(
        "route",
        nodes.map((n) => n.id),
      ),
    ),
    [cycle, setCycle] = useState("none"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        ...Object.fromEntries(new FormData(e.currentTarget)),
        kind,
        id,
        cycle_kind: cycle,
      };
      const result = await api("/api/nodes", "POST", body);
      await onCreated(result.id, Boolean(body.end));
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function changeKind(value) {
    const previous = suggestNodeId(
      kind,
      nodes.map((n) => n.id),
    );
    if (id === previous)
      setId(
        suggestNodeId(
          value,
          nodes.map((n) => n.id),
        ),
      );
    setKind(value);
    setCycle("none");
  }
  return (
    <dialog open className="node-create-dialog react-dialog">
      <div className="dialog-heading">
        <div>
          <span className="node-id">NEW WORK NODE</span>
          <h2>새 업무 노드</h2>
        </div>
        <button onClick={onClose} aria-label="새 업무 노드 닫기">
          ×
        </button>
      </div>
      <form onSubmit={submit}>
        <label>
          업무 종류
          <select
            aria-label="업무 종류 선택"
            value={kind}
            onChange={(e) => changeKind(e.target.value)}
          >
            <option value="route">항로 노드</option>
            <option value="admin">서무 업무 노드</option>
          </select>
        </label>
        <div className="node-form-grid">
          <label>
            고유 ID
            <input
              aria-label="고유 ID"
              required
              maxLength={80}
              value={id}
              onChange={(e) => setId(e.target.value)}
            />
          </label>
          <label>
            업무명·한글 표시명
            <input
              name="name"
              aria-label="업무명·한글 표시명"
              required
              maxLength={120}
            />
          </label>
        </div>
        {kind === "route" ? (
          <fieldset>
            <legend>항로 정보</legend>
            <div className="node-form-grid">
              <label>
                항로 코드
                <input
                  name="codes"
                  aria-label="항로 코드"
                  required
                  placeholder="IND 또는 JPN-CHN"
                />
              </label>
              <label>
                계약 유형
                <select name="contract_type" aria-label="새 노드 계약 유형">
                  <option value="joint">공동운항</option>
                  <option value="sell">판매</option>
                  <option value="buy">구매</option>
                  <option value="exchange">교환</option>
                </select>
              </label>
              <label>
                권역
                <input name="region" aria-label="새 노드 권역" maxLength={80} />
              </label>
              <label>
                상위 권역
                <input name="group" aria-label="상위 권역" maxLength={80} />
              </label>
              <label>
                계약 시작월
                <input name="start" aria-label="계약 시작월" type="month" />
              </label>
              <label>
                종료월
                <input name="end" aria-label="새 노드 종료월" type="month" />
              </label>
              <label>
                종료 사유
                <input
                  name="end_reason"
                  aria-label="새 노드 종료 사유"
                  maxLength={300}
                />
              </label>
              <label>
                파트너 코드
                <input
                  name="partners"
                  aria-label="파트너 코드"
                  placeholder="OWN, P01"
                />
              </label>
              <label>
                Contract ID
                <input
                  name="contract_id"
                  aria-label="연결 Contract ID"
                  maxLength={80}
                />
              </label>
              <label>
                최근 적용 Cycle
                <input
                  name="history_cycle"
                  aria-label="최근 적용 Cycle"
                  maxLength={120}
                />
              </label>
            </div>
            <label>
              최근 업데이트 항목
              <input
                name="updated_items"
                aria-label="최근 업데이트 항목"
                placeholder="선복료, BSA"
              />
            </label>
            <label>
              Remark
              <textarea
                name="remark"
                aria-label="새 노드 Remark"
                maxLength={2000}
                rows={2}
              />
            </label>
          </fieldset>
        ) : (
          <fieldset>
            <legend>서무 업무(기타)</legend>
            <label>
              업무 가이드라인
              <textarea
                name="guide"
                aria-label="새 노드 업무 가이드라인"
                maxLength={6000}
                rows={4}
              />
            </label>
          </fieldset>
        )}
        <div className="node-form-grid">
          <label>
            최근 업데이트일
            <input
              name="recent"
              aria-label="새 노드 최근 업데이트일"
              type="date"
            />
          </label>
          <label>
            업데이트 주기
            <select
              aria-label="새 노드 업데이트 주기"
              value={cycle}
              onChange={(e) => setCycle(e.target.value)}
            >
              <option value="none">미정</option>
              <option value="monthly">매월</option>
              <option value="quarterly">분기별</option>
              <option value="annual">매년</option>
              <option value={kind === "route" ? "ships" : "weeks"}>
                {kind === "route" ? "선박 n척 → n주" : "주 단위"}
              </option>
            </select>
          </label>
          {["ships", "weeks"].includes(cycle) && (
            <label>
              {kind === "route" ? "선박 수" : "주 수"}
              <input
                type="number"
                name="cycle_count"
                aria-label="선박 수·주 수"
                min="1"
                max="520"
                required
                defaultValue="1"
              />
            </label>
          )}
        </div>
        <p className="hint">
          기준 정보가 없으면 Due date는 미정입니다. 종료월이 입력된 항로는 기본
          보드에서 제외됩니다.
        </p>
        <div role="alert" className="form-error">
          {error}
        </div>
        <button className="primary" disabled={busy}>
          {busy ? "저장 중…" : "업무 노드 등록"}
        </button>
      </form>
    </dialog>
  );
}
