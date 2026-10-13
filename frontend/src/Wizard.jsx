import React, { useEffect, useState } from "react";
import { api, getSession, download } from "./api.js";
const labels = {
  summary: "내용 요약",
  route: "Route node 정형화",
  history: "History node 정형화",
  admin: "서무 업무 자동화 절차 초안",
};
export default function Wizard({ seed }) {
  const [source, setSource] = useState(seed || ""),
    [template, setTemplate] = useState(seed ? "admin" : "route"),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [configured, setConfigured] = useState(null);
  useEffect(() => {
    getSession()
      .then((s) => setConfigured(s.configured))
      .catch((e) => setError(e.message));
  }, []);
  async function submit(e) {
    e.preventDefault();
    if (!source.trim()) {
      setError("정리할 원문을 입력하세요.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await api("/api/wizard", "POST", { source, template, consent }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setConsent(false);
    }
  }
  function edit(index, value) {
    setResult((r) => ({
      ...r,
      user_edited: true,
      draft: {
        ...r.draft,
        fields: r.draft.fields.map((f, i) =>
          i === index ? { ...f, value: value || null, user_edited: true } : f,
        ),
      },
    }));
  }
  return (
    <div>
      <div className="wizard-steps">
        <span className="active">01 원문</span>
        <i>→</i>
        <span>02 GPT 정리</span>
        <i>→</i>
        <span>03 검토 · 내보내기</span>
      </div>
      <div className="wizard-grid">
        <section className="panel wizard-input">
          <h2>정리할 문서</h2>
          <form onSubmit={submit}>
            <label>
              정리 유형
              <select
                id="wizard-template"
                value={template}
                disabled={busy}
                onChange={(e) => {
                  setTemplate(e.target.value);
                  setResult(null);
                  setConsent(false);
                }}
              >
                {Object.entries(labels).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              원문
              <textarea
                id="wizard-source"
                value={source}
                maxLength={12000}
                rows={16}
                disabled={busy}
                onChange={(e) => {
                  setSource(e.target.value);
                  setConsent(false);
                  setResult(null);
                }}
              />
            </label>
            <div className="wizard-privacy">
              <strong>선택한 원문만 OpenAI API로 전송합니다.</strong>
              <p>
                전체 DB나 Notebook·매뉴얼을 자동 전송하지 않습니다. 기밀 정보는
                전송 전에 제외하세요.
              </p>
            </div>
            <label className="wizard-consent">
              <input
                type="checkbox"
                id="wizard-consent"
                checked={consent}
                required
                disabled={busy}
                onChange={(e) => setConsent(e.target.checked)}
              />
              외부 전송할 내용을 확인했습니다.
            </label>
            <p className="hint">
              {configured === null
                ? "설정 확인 중…"
                : configured
                  ? "API 설정 있음 · 호출 시 연결 확인"
                  : "API 키 미설정 · UI와 로컬 저장은 사용 가능"}
            </p>
            <p className="form-error" role="alert">
              {error}
            </p>
            <button className="primary wizard-run" disabled={busy}>
              {busy ? "정리 중…" : "✧ GPT로 정리하기"}
            </button>
            <p className="hint">API 사용료는 ChatGPT 구독과 별도입니다.</p>
          </form>
        </section>
        <section className="panel wizard-output">
          <h2>정리 결과</h2>
          {result ? (
            <>
              <label>
                내용 요약
                <textarea
                  value={result.draft.summary}
                  onChange={(e) =>
                    setResult({
                      ...result,
                      user_edited: true,
                      draft: { ...result.draft, summary: e.target.value },
                    })
                  }
                />
              </label>
              <div className="wizard-fields">
                {result.draft.fields.map((f, index) => (
                  <label className="wizard-field" key={f.key}>
                    <span>{f.key}</span>
                    <textarea
                      value={f.value || ""}
                      placeholder="미확인"
                      rows={2}
                      onChange={(e) => edit(index, e.target.value)}
                    />
                    <small className="evidence">
                      {f.derived
                        ? "주기에서 계산한 값"
                        : f.evidence || "원문 근거 없음"}
                    </small>
                  </label>
                ))}
              </div>
              <div className="wizard-notice">
                {[
                  ...result.draft.missing_information,
                  ...result.draft.warnings,
                ].map((message, i) => (
                  <p key={i}>{message}</p>
                ))}
              </div>
              <p className="hint">
                검토한 초안이며 기존 노드에 자동 적용하지 않습니다.
              </p>
              <button
                className="primary"
                onClick={() =>
                  download(
                    `worknote-${template}-draft.json`,
                    JSON.stringify({ ...result, reviewed: true }, null, 2),
                  )
                }
              >
                검토 후 JSON 내려받기
              </button>
            </>
          ) : (
            <div className="wizard-empty">
              <span>✧</span>
              <h3>정리할 내용을 입력해 주세요</h3>
              <p>원문 근거와 누락 정보를 함께 확인합니다.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
