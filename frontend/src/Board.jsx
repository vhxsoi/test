import React, { useState } from "react";
import { dDayLabel, cycleLabel } from "../../public/schedule.js";
const types = {
  joint: "공동운항",
  sell: "판매",
  buy: "구매",
  exchange: "교환",
};
function Card({ node, onOpen, onManual, onWizard }) {
  const route = node.kind === "route";
  return (
    <article
      className={`route-card ${route ? "" : "admin-card"} ${node.state}`}
    >
      <button
        className="card-open"
        onClick={() => onOpen(node)}
        aria-label={`${node.id} 상세 보기`}
      >
        <div className="route-card-top">
          <span className="node-id">
            {node.id} <em className="node-kind">{route ? "항로" : "서무"}</em>
          </span>
          <span className={`route-state ${node.state}`}>
            <i />
            {node.label}
          </span>
        </div>
        {route ? (
          <>
            <div className="route-name">
              <h2>{node.codes.join(node.type === "exchange" ? "-" : " / ")}</h2>
              <span className={`contract-type ${node.type}`}>
                {types[node.type]}
              </span>
            </div>
            <p className="route-korean">{node.name}</p>
            <div className="route-location">
              {node.group} / {node.region}
            </div>
            <div className="route-fields">
              <div>
                <span>PARTNERS</span>
                <strong>{node.partners.join(" · ") || "미입력"}</strong>
              </div>
              <div>
                <span>계약 기간</span>
                <strong>
                  {node.start || "미정"} → {node.end || "진행 중"}
                </strong>
              </div>
            </div>
            <div className="route-update">
              <div>
                <span>최근 업데이트</span>
                <strong>{node.recent || "기록 없음"}</strong>
              </div>
              <div className="update-tags">
                {node.history[0]?.items.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <span className="admin-type">서무 업무(기타)</span>
            <h2>{node.name}</h2>
            <div className="admin-update">
              <span>Recent update date</span>
              <strong>{node.recent || "미정"}</strong>
            </div>
          </>
        )}
        <div className="route-schedule">
          <div>
            <strong>↻ {cycleLabel(node.cycle)}</strong>
            <small>
              {node.cycle.kind === "ships"
                ? `${node.cycle.count}척 × 1주 · 추정`
                : "최근 업데이트일 + 주기"}
            </small>
          </div>
          <div className="next-date">
            <small>
              Due date{node.cycle.kind === "ships" ? " · 추정" : ""}
            </small>
            <strong>
              {node.due || "미정"}{" "}
              <span className={`days ${node.state}`}>
                {node.ended ? "종료" : dDayLabel(node.days)}
              </span>
            </strong>
          </div>
        </div>
        <p className={route ? "route-remark" : "admin-guide-preview"}>
          {route ? node.remark : node.guide}
        </p>
      </button>
      <div className="admin-actions">
        {route ? (
          <>
            <button onClick={() => onOpen(node)}>
              ◷ History {node.history.length}
            </button>
            <button onClick={() => onManual(node)}>▤ 업무 매뉴얼</button>
          </>
        ) : (
          <>
            <button onClick={() => onOpen(node)}>▤ 가이드라인</button>
            <button onClick={() => onWizard(node)}>✧ 자동화 마법사</button>
          </>
        )}
      </div>
    </article>
  );
}
export default function Board({
  nodes,
  today,
  onOpen,
  onManual,
  onWizard,
  onCreate,
  onDemo,
  message,
}) {
  const [kind, setKind] = useState("all"),
    [search, setSearch] = useState(""),
    [region, setRegion] = useState("all"),
    [type, setType] = useState("all"),
    [ended, setEnded] = useState(false);
  const active = nodes.filter((n) => ended || !n.ended);
  const list = active.filter(
    (n) =>
      (kind === "all" || n.kind === kind) &&
      (region === "all" || (n.group || n.type) === region) &&
      (type === "all" || (n.kind === "route" ? n.type : "admin") === type) &&
      [n.id, n.name, ...(n.codes || []), ...(n.partners || [])]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div id="work-board" className="work-board">
      <div className="route-intro">
        <span>WORK NODES</span>
        <p>항로와 서무, 같은 업무 단위로 함께 관리</p>
        <div>
          로컬 저장 <b>{today} 기준</b>
        </div>
        <button id="new-work-node" className="primary" onClick={onCreate}>
          ＋ 새 업무 노드
        </button>
      </div>
      <div className="route-summary">
        {[
          ["전체 업무 노드", active.length],
          ["오늘 업데이트", active.filter((n) => n.days === 0).length],
          [
            "업데이트 임박 · 7일 이내",
            active.filter((n) => n.state === "soon").length,
          ],
          [
            "기한 경과 · 확인 필요",
            active.filter((n) => n.state === "late").length,
          ],
        ].map(([label, count], i) => (
          <div key={label} className={i === 3 ? "attention" : ""}>
            <span>{label}</span>
            <strong>
              {count}
              <small>개</small>
            </strong>
          </div>
        ))}
      </div>
      <div className="board-kind-tabs">
        <div>
          {[
            ["all", "전체 업무"],
            ["route", "항로"],
            ["admin", "서무"],
          ].map(([value, label]) => (
            <button
              data-board-kind={value}
              key={value}
              className={kind === value ? "selected" : ""}
              onClick={() => {
                setKind(value);
                setRegion("all");
                setType("all");
              }}
            >
              {label}{" "}
              <span>
                {
                  active.filter((n) => value === "all" || n.kind === value)
                    .length
                }
              </span>
            </button>
          ))}
        </div>
        <span className="board-sort">↓ D-day 순 · 기한 경과 먼저</span>
      </div>
      <div className="route-toolbar">
        <label className="route-search">
          <span>⌕</span>
          <input
            aria-label="업무 노드 검색"
            placeholder="업무명, 항로, ID, 파트너 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="업무 권역 필터"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          <option value="all">전체 권역·분류</option>
          {[...new Set(nodes.map((n) => n.group || n.type))].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select
          aria-label="업무 계약 유형 필터"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">전체 업무·계약 유형</option>
          {Object.entries(types).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
          <option value="admin">서무 업무(기타)</option>
        </select>
        <span className="route-results">{list.length}개 업무</span>
      </div>
      <div className="board-archive-toggle">
        <label>
          <input
            id="include-terminated"
            type="checkbox"
            checked={ended}
            onChange={(e) => setEnded(e.target.checked)}
          />
          종료 항로 포함{" "}
          <span>{nodes.filter((n) => n.ended).length}개 보관</span>
        </label>
        <span role="status">{message}</span>
      </div>
      {nodes.length === 0 ? (
        <div className="panel empty-board">
          <h2>첫 업무 노드를 만들어 보세요</h2>
          <p>
            항로와 서무 업무를 등록하면 기한 순서로 한곳에서 확인할 수 있습니다.
          </p>
          <button className="primary" onClick={onCreate}>
            ＋ 첫 업무 등록
          </button>
          <button onClick={onDemo}>예시 데이터 불러오기</button>
        </div>
      ) : (
        <div className="route-grid">
          {list.map((n) => (
            <div
              className="work-item"
              key={n.id}
              data-node-id={n.id}
              data-node-kind={n.kind}
              data-due={n.due || ""}
            >
              <Card
                node={n}
                onOpen={onOpen}
                onManual={onManual}
                onWizard={onWizard}
              />
            </div>
          ))}
          {!list.length && (
            <p className="empty">조건에 맞는 업무가 없습니다.</p>
          )}
        </div>
      )}
      <div className="route-legend">
        <span>Due date = 최근 업데이트일 + 주기</span>
        <span>선박 n척 = n주 추정</span>
        <span>종료 항로는 보관하며 기본 화면에서 제외</span>
      </div>
    </div>
  );
}
