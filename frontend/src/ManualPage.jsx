import React, { useEffect, useRef, useState } from "react";
import { api, download } from "./api.js";
import {
  blockTypes,
  makeBlock,
  validateDocument,
  safeLink,
  moveBlock,
} from "../../public/manual-model.js";
function numberAt(blocks, index) {
  let number = 1;
  while (--index >= 0 && blocks[index].type === "numbered") number++;
  return number;
}
function template() {
  return [
    makeBlock("heading1", "업무 목적"),
    makeBlock("text", "이 항로에서 수행할 업무와 확인할 결과를 작성합니다."),
    makeBlock("heading1", "처리 절차"),
    makeBlock("numbered", "최근 업데이트와 변경 대상 항목을 확인합니다."),
    makeBlock("numbered", "필요한 자료와 파트너 협의 내용을 검토합니다."),
    makeBlock("numbered", "확인된 변경 사항을 History에 기록합니다."),
    makeBlock("heading1", "체크리스트"),
    makeBlock("todo", "원본 자료 확인"),
    makeBlock("todo", "파트너 협의 사항 확인"),
    makeBlock("divider"),
    makeBlock("heading1", "참고 자료"),
    makeBlock(
      "callout",
      "계약 상세는 연결된 Contract node의 LLM notebook에서 확인합니다. 기밀 원문은 복사하지 않습니다.",
    ),
    makeBlock("heading1", "예외 상황과 대응"),
    makeBlock("text", "지연이나 자료 누락이 발생한 경우의 대응을 작성합니다."),
  ];
}
export default function ManualPage({ node, onBack, cache }) {
  const initial = cache.get(node.id);
  const [doc, setDoc] = useState(initial?.doc || null),
    [record, setRecord] = useState(initial?.record || null),
    [read, setRead] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const file = useRef(),
    canvas = useRef();
  useEffect(() => {
    let alive = true;
    if (!initial)
      api(`/api/nodes/${node.id}/manual`)
        .then((data) => {
          if (!alive) return;
          const loaded = data || {
            document: {
              title: node.name + " 업무 매뉴얼",
              icon: "📒",
              blocks: [makeBlock()],
            },
            version: 0,
            updatedAt: null,
          };
          setRecord(loaded);
          setDoc(structuredClone(loaded.document));
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    return () => {
      alive = false;
    };
  }, [node.id]);
  useEffect(() => {
    if (doc && record) cache.set(node.id, { doc, record });
    canvas.current?.querySelectorAll("textarea").forEach((el) => {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    });
  }, [doc, record, read]);
  function update(id, values) {
    setDoc((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.id === id ? { ...b, ...values } : b)),
    }));
    setError("");
  }
  function insert(index, type = "text", value = "") {
    if (doc.blocks.length >= 500) {
      setError("블록은 최대 500개입니다.");
      return;
    }
    const b = makeBlock(type, value);
    setDoc((d) => ({
      ...d,
      blocks: [
        ...d.blocks.slice(0, index + 1),
        b,
        ...d.blocks.slice(index + 1),
      ],
    }));
    requestAnimationFrame(() =>
      canvas.current?.querySelector(`[data-block-text="${b.id}"]`)?.focus(),
    );
  }
  async function save() {
    if (!validateDocument(doc)) {
      setError("페이지는 500개 블록, 합계 50,000자까지 저장할 수 있습니다.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await api(`/api/nodes/${node.id}/manual`, "PUT", {
        document: doc,
        expected_revision: record.version,
      });
      setRecord(saved);
      setMessage("매뉴얼을 로컬 DB에 저장했습니다.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function restore(e) {
    const selected = e.target.files[0];
    if (!selected) return;
    try {
      if (selected.size > 400000) throw new Error("백업 파일이 너무 큽니다.");
      const data = JSON.parse(await selected.text());
      if (data.routeId !== node.id || !validateDocument(data.document))
        throw new Error("현재 Route ID의 올바른 페이지 백업이 필요합니다.");
      setDoc(data.document);
      setMessage("백업을 초안으로 불러왔습니다. 확인 후 저장하세요.");
    } catch (e) {
      setError(e.message);
    }
  }
  if (!doc)
    return (
      <section className="panel">
        <p role="alert">{error || "매뉴얼을 불러오는 중…"}</p>
        <button onClick={onBack}>업무 보드로</button>
      </section>
    );
  const empty = doc.blocks.every((b) => b.type === "text" && !b.text.trim());
  return (
    <div id="manual-page" className="notion-page" ref={canvas}>
      <div className="notion-topbar">
        <button onClick={onBack}>← 업무 보드</button>
        <span>나의 페이지 / {node.id}</span>
        <div>
          <button onClick={() => setRead(!read)}>
            {read ? "편집하기" : "읽기 모드"}
          </button>
          <button onClick={() => file.current.click()}>백업 불러오기</button>
          <button
            onClick={() =>
              download(
                `${node.id}-page.json`,
                JSON.stringify(
                  {
                    format: "worknote-page-v2",
                    routeId: node.id,
                    document: doc,
                  },
                  null,
                  2,
                ),
              )
            }
          >
            페이지 백업 ↓
          </button>
          <button className="primary" onClick={save} disabled={saving}>
            저장
          </button>
        </div>
      </div>
      <div className="notion-cover">
        <div className="cover-circle" />
        <span>WORK, DOCUMENTED.</span>
      </div>
      <div className="notion-document">
        <div className="page-icon-row">
          <button
            aria-label="페이지 아이콘 변경"
            disabled={read}
            onClick={() => {
              const icons = ["📒", "🧭", "📝", "📋"];
              setDoc({
                ...doc,
                icon: icons[(icons.indexOf(doc.icon) + 1) % 4],
              });
            }}
          >
            {doc.icon}
          </button>
          <span className="page-private">개인 페이지 · 로컬 저장</span>
        </div>
        {read ? (
          <h1 className="notion-title-read">{doc.title}</h1>
        ) : (
          <textarea
            id="manual-title"
            aria-label="페이지 제목"
            rows={1}
            maxLength={200}
            value={doc.title}
            onChange={(e) => setDoc({ ...doc, title: e.target.value })}
          />
        )}
        <div className="notion-properties">
          <div>
            <span>▱ 연결 항로</span>
            <strong>
              {node.id} <small>{node.name}</small>
            </strong>
          </div>
          <div>
            <span>▤ 페이지 종류</span>
            <strong>
              <b className="page-property-tag">업무 매뉴얼</b>
            </strong>
          </div>
          <div>
            <span>◷ 매뉴얼 수정</span>
            <strong>
              {record.updatedAt
                ? new Date(record.updatedAt).toLocaleString("ko-KR")
                : "아직 저장하지 않음"}
            </strong>
          </div>
        </div>
        <div className="page-note">
          💡 업무 절차와 체크리스트를 작성하세요. 계약 업데이트와 D-day는 따로
          관리됩니다.
        </div>
        <div className="page-content-heading">
          <span>PAGE CONTENT</span>
          {!read && (
            <button
              disabled={!empty}
              onClick={() => setDoc({ ...doc, blocks: template() })}
            >
              기본 템플릿으로 시작 ↗
            </button>
          )}
        </div>
        <div className="notion-blocks">
          {doc.blocks.map((b, index) => (
            <div
              key={b.id}
              data-block-id={b.id}
              className={`page-block type-${b.type} ${b.checked && b.type === "todo" ? "checked" : ""}`}
            >
              {!read && (
                <div className="block-tools">
                  <select
                    aria-label={`블록 ${index + 1} 종류`}
                    value={b.type}
                    onChange={(e) => update(b.id, { type: e.target.value })}
                  >
                    {Object.entries(blockTypes).map(([type, label]) => (
                      <option value={type} key={type}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    aria-label={`블록 ${index + 1} 아래 추가`}
                    onClick={() => insert(index)}
                  >
                    ＋
                  </button>
                  <button
                    aria-label={`블록 ${index + 1} 위로 이동`}
                    disabled={!index}
                    onClick={() =>
                      setDoc({
                        ...doc,
                        blocks: moveBlock(doc.blocks, b.id, -1),
                      })
                    }
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`블록 ${index + 1} 아래로 이동`}
                    disabled={index === doc.blocks.length - 1}
                    onClick={() =>
                      setDoc({ ...doc, blocks: moveBlock(doc.blocks, b.id, 1) })
                    }
                  >
                    ↓
                  </button>
                  <button
                    aria-label={`블록 ${index + 1} 삭제`}
                    onClick={() => {
                      const blocks = doc.blocks.filter((x) => x.id !== b.id);
                      setDoc({
                        ...doc,
                        blocks: blocks.length ? blocks : [makeBlock()],
                      });
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="block-content">
                {b.type === "todo" && (
                  <input
                    type="checkbox"
                    aria-label={`체크리스트 ${index + 1} 완료`}
                    checked={b.checked}
                    disabled={read}
                    onChange={(e) =>
                      update(b.id, { checked: e.target.checked })
                    }
                  />
                )}
                <span className="block-prefix">
                  {b.type === "bullet"
                    ? "•"
                    : b.type === "numbered"
                      ? `${numberAt(doc.blocks, index)}.`
                      : b.type === "callout"
                        ? "💡"
                        : ""}
                </span>
                {b.type === "divider" ? (
                  <hr />
                ) : read ? (
                  <div className="block-read">{b.text}</div>
                ) : (
                  <textarea
                    rows={1}
                    data-block-text={b.id}
                    aria-label={`블록 ${index + 1} ${blockTypes[b.type]}`}
                    value={b.text}
                    placeholder={
                      b.type === "text"
                        ? "내용을 입력하세요"
                        : blockTypes[b.type]
                    }
                    maxLength={50000}
                    onChange={(e) => update(b.id, { text: e.target.value })}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        b.type !== "code"
                      ) {
                        e.preventDefault();
                        const start = e.target.selectionStart,
                          end = e.target.selectionEnd;
                        const tail = b.text.slice(end);
                        update(b.id, { text: b.text.slice(0, start) });
                        insert(
                          index,
                          ["todo", "bullet", "numbered"].includes(b.type)
                            ? b.type
                            : "text",
                          tail,
                        );
                      }
                    }}
                  />
                )}
              </div>
              {b.type === "link" && (
                <div className="block-link-row">
                  {!read && (
                    <input
                      aria-label={`블록 ${index + 1} 링크 주소`}
                      value={b.href}
                      placeholder="https://…"
                      onChange={(e) => update(b.id, { href: e.target.value })}
                    />
                  )}{" "}
                  {safeLink(b.href) ? (
                    <a
                      href={safeLink(b.href)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      참고 링크 열기 ↗
                    </a>
                  ) : (
                    <small>HTTP/HTTPS 링크를 입력하세요</small>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {!read && (
          <button
            className="page-add-block"
            onClick={() => insert(doc.blocks.length - 1)}
          >
            ＋ 블록 추가
          </button>
        )}
        <div className="page-bottom">
          <span>
            {JSON.stringify(doc) !== JSON.stringify(record.document)
              ? "저장 전 변경사항 있음"
              : "저장된 내용과 동일"}{" "}
            · 저장 {record.version}회
          </span>
          <span role="status">{message}</span>
        </div>
        <p role="alert" className="form-error">
          {error}
        </p>
        <p className="page-storage-note">
          매뉴얼은 항로 기록과 별도로 로컬 SQLite 파일에 저장됩니다. 외부 AI로
          자동 전송하지 않습니다.
        </p>
      </div>
      <input
        type="file"
        ref={file}
        hidden
        accept="application/json,.json"
        onChange={restore}
      />
    </div>
  );
}
