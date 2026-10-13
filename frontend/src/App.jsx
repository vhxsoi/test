import React, { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import Board from "./Board.jsx";
import CreateNode from "./CreateNode.jsx";
import NodeDetail from "./NodeDetail.jsx";
import ManualPage from "./ManualPage.jsx";
import Wizard from "./Wizard.jsx";
import LegacyImport from "./LegacyImport.jsx";
export default function App() {
  const [nodes, setNodes] = useState([]),
    [today, setToday] = useState(""),
    [view, setView] = useState("board"),
    [detail, setDetail] = useState(null),
    [manual, setManual] = useState(null),
    [create, setCreate] = useState(false),
    [legacy, setLegacy] = useState(false),
    [seed, setSeed] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  const cache = useRef(new Map());
  async function refresh(note) {
    try {
      const data = await api("/api/nodes");
      setNodes(data.nodes);
      setToday(data.today);
      setLoaded(true);
      setError("");
      if (note) setMessage(note);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  function openManual(node) {
    setDetail(null);
    setManual(node);
    setView("manual");
    window.scrollTo(0, 0);
  }
  function wizard(node) {
    setSeed(
      node
        ? `서무 업무 ID: ${node.id}\n업무명: ${node.name}\n분류: 서무 업무(기타)\n최근 업데이트일: ${node.recent}\n업데이트 주기: ${node.cycle.kind} ${node.cycle.count || ""}\n업무 가이드라인:\n${node.guide}`
        : "",
    );
    setView("wizard");
  }
  async function demo() {
    try {
      await api("/api/demo", "POST", {});
      await refresh("예시 데이터를 로컬 DB에 불러왔습니다.");
    } catch (e) {
      setError(e.message);
    }
  }
  const selected = nodes.find((n) => n.id === detail);
  const titles = {
    board: [
      "업무 노드 보드",
      "항로와 서무 업무를 함께 보고, 가까운 업데이트부터 확인하세요.",
    ],
    wizard: [
      "GPT 정리 마법사",
      "내용을 요약하고, 검토 가능한 업무 초안으로 정리하세요.",
    ],
    manuals: [
      "업무 매뉴얼",
      "항로별 페이지에서 업무 절차와 지식을 정리하세요.",
    ],
  };
  return (
    <>
      <aside className="sidebar">
        <a className="brand" href="/">
          w<span>worknote</span>
        </a>
        <div className="workspace">
          <span className="avatar">W</span>
          <div>
            나의 워크스페이스<small>Personal workspace</small>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="주 메뉴">
          <button
            className={view === "board" || view === "manual" ? "active" : ""}
            onClick={() => setView("board")}
          >
            ▦ <span>업무 노드 보드</span>
          </button>
          <button
            className={view === "manuals" ? "active" : ""}
            onClick={() => setView("manuals")}
          >
            ▤ <span>업무 매뉴얼</span>
          </button>
          <button
            className={view === "wizard" ? "active" : ""}
            onClick={() => wizard()}
          >
            ✧ <span>GPT 정리 마법사</span>
          </button>
          <button onClick={() => setLegacy(true)}>
            ↥ <span>브라우저 자료 이전</span>
          </button>
        </nav>
        <div className="side-bottom">
          <div className="demo-dot" /> 로컬 저장
          <small>개인 PC · 업무와 매뉴얼 보관</small>
          <div className="profile">
            <span className="avatar">나</span>
            <div>
              개인 워크스페이스<small>나의 업무와 지식</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="shell">
        <header>
          <div>
            워크스페이스 <span>/</span>{" "}
            <strong>
              {view === "manual" ? "항로 매뉴얼" : titles[view][0]}
            </strong>
          </div>
          <span className="header-note">작은 기록이, 큰 지식으로.</span>
        </header>
        <main>
          {view !== "manual" && (
            <div className="heading">
              <div>
                <p className="eyebrow">YOUR WORK, CONNECTED</p>
                <h1>{titles[view][0]}</h1>
                <p>{titles[view][1]}</p>
              </div>
            </div>
          )}
          {error && (
            <div className="panel form-error" role="alert">
              {error}
              <button onClick={() => refresh()}>다시 연결</button>
            </div>
          )}
          <div id="content">
            {!loaded && !error ? (
              <p className="hint">로컬 데이터를 불러오는 중…</p>
            ) : view === "board" ? (
              <Board
                nodes={nodes}
                today={today}
                onOpen={(node) => setDetail(node.id)}
                onManual={openManual}
                onWizard={wizard}
                onCreate={() => setCreate(true)}
                onDemo={demo}
                message={message}
              />
            ) : view === "manual" ? (
              <ManualPage
                key={manual.id}
                node={manual}
                onBack={() => setView("board")}
                cache={cache.current}
              />
            ) : view === "wizard" ? (
              <Wizard key={seed} seed={seed} />
            ) : (
              <div className="wiki-grid">
                {nodes
                  .filter((n) => n.kind === "route")
                  .map((n) => (
                    <button
                      key={n.id}
                      className="wiki-card"
                      onClick={() => openManual(n)}
                    >
                      <span className="wiki-icon">▤</span>
                      <span className="node-id">{n.id}</span>
                      <h3>{n.name}</h3>
                      <p>업무 매뉴얼 페이지 열기 ↗</p>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </main>
        <footer>
          WORKNOTE <span>업무를 기록하고, 지식으로 연결하세요.</span>
        </footer>
      </div>
      {(create || selected || legacy) && <div className="react-backdrop" />}
      {create && (
        <CreateNode
          nodes={nodes}
          onClose={() => setCreate(false)}
          onCreated={(id, ended) =>
            refresh(
              ended
                ? `${id}를 종료 항로로 보관했습니다.`
                : `${id} 업무 노드를 등록했습니다.`,
            )
          }
        />
      )}{" "}
      {selected && (
        <NodeDetail
          node={selected}
          onClose={() => setDetail(null)}
          onRefresh={() => refresh()}
          onManual={openManual}
        />
      )}{" "}
      {legacy && (
        <LegacyImport
          existing={nodes}
          onClose={() => setLegacy(false)}
          onDone={refresh}
        />
      )}
    </>
  );
}
