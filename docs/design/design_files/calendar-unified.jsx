/* global React, ReactDOM */
// ============================================================
// Calendar — 단일 채택안 (Phase 4)
// B(레인바 월간) + C(선택일 사이드 어젠다)를 한 화면에 결합.
// 통합 tokens.css + calendar-styles.css(cv-*) 기반. 신규 색 없음.
// ============================================================
const { useState, useMemo } = React;
const _U = window.CalendarData;
const AppBar = window.AppBar;   // from variation-a.jsx
const SubBar = window.SubBar;   // from variation-a.jsx

// ------------------------------------------------------------
// Month grid with lane bars (B) — selection-aware
// ------------------------------------------------------------
function MonthGrid({ weeks, filtered, month, today, holidayMap, selected, onSelect, tasksMap }) {
  const LANE_H = 20;
  return (
    <div className="cv-grid" style={{ gridTemplateRows: "auto repeat(6, 1fr)" }}>
      {_U.KOR_DOW.map((d, i) => (
        <div key={d} className={`cv-dow ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}>{d}</div>
      ))}
      {weeks.map((weekDates) => {
        const bars = _U.weekLanes(filtered, weekDates);
        return (
          <div
            key={_U.isoDay(weekDates[0])}
            style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(7, 1fr)", position: "relative", minHeight: 0 }}
          >
            {weekDates.map((d, di) => {
              const dISO = _U.isoDay(d);
              const inMonth = d.getMonth() === month - 1;
              const isToday = _U.sameDay(d, today);
              const isSel = dISO === selected;
              const dow = d.getDay();
              const hName = holidayMap[dISO];
              const touching = bars.filter((b) => b.startCol <= di && b.endCol >= di);
              const overflow = touching.filter((b) => b.lane >= 3).length;
              return (
                <div
                  key={di}
                  className={`cv-cell ${inMonth ? "" : "is-otherm"} ${isToday ? "is-today" : ""} ${isSel ? "is-selected" : ""} ${dow === 0 || hName ? "is-sun" : dow === 6 ? "is-sat" : ""}`}
                  onClick={() => onSelect(dISO)}
                  style={{ paddingTop: 6, paddingBottom: 4 }}
                >
                  <div className="cv-cell-inner">
                    <div className="cv-dnum-row">
                      <span className="cv-dnum">{d.getDate()}</span>
                      {hName && inMonth && <span className="cv-holiday-name">{hName}</span>}
                    </div>
                    <div style={{ height: LANE_H * 3 + 4 }} />
                    {overflow > 0 && <div className="cv-more">+{overflow}건 더</div>}
                    {(() => {
                      const tlist = (tasksMap && tasksMap.get(dISO)) || [];
                      if (!tlist.length || !inMonth) return null;
                      const open = tlist.filter((t) => t.status === "todo" || t.status === "doing").length;
                      return (
                        <div className="cv-taskchip" title={`작업 ${tlist.length}개 (미완료 ${open})`}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M4 12.5l5 5 11-11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          <span>할일 {tlist.length}{open > 0 ? ` · 미완 ${open}` : ""}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}

            {/* Lane bars overlay */}
            <div style={{ position: "absolute", top: 30, left: 0, right: 0, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", pointerEvents: "none", padding: "0 4px" }}>
              {bars.filter((b) => b.lane < 3).map((b, i) => {
                const span = b.endCol - b.startCol + 1;
                const isMulti = b.evt.start.slice(0, 10) !== b.evt.end.slice(0, 10);
                return (
                  <div
                    key={b.evt.id + "-" + i}
                    className={`cv-lane cat-${b.evt.cat} ${b.isContL ? "is-cont-l" : ""} ${b.isContR ? "is-cont-r" : ""} ${!isMulti ? "cv-lane-soft" : ""}`}
                    style={{ gridColumn: `${b.startCol + 1} / span ${span}`, gridRow: b.lane + 1, marginTop: b.lane * 20, marginBottom: 2, pointerEvents: "auto" }}
                    title={b.evt.title}
                    onClick={() => onSelect(b.evt.start.slice(0, 10))}
                  >
                    {!isMulti && b.evt.start.includes("T") && (
                      <span className="cv-lane-time">{_U.formatHMShort(b.evt.start.slice(11, 16))}</span>
                    )}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{b.evt.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------
// Side agenda (C) — selected day events + month summary
// ------------------------------------------------------------
function SideRail({ selected, dayItems, dayTasks, summary }) {
  const selDate = _U.dateFromISO(selected);
  const tally = {};
  for (const it of dayItems) tally[it.cat] = (tally[it.cat] || 0) + 1;
  const maxN = Math.max(...Object.values(summary), 1);
  const STATUS = {
    todo:      { l: "대기", v: "--todo" },
    doing:     { l: "진행", v: "--doing" },
    done:      { l: "완료", v: "--done" },
    discarded: { l: "폐기", v: "--discard" },
  };
  const openTasks = dayTasks.filter((t) => t.status === "todo" || t.status === "doing").length;

  return (
    <div className="cv-C-side">
      <div className="cv-side-head">
        <div className="cv-side-day">
          {selDate.getMonth() + 1}월 {selDate.getDate()}일 · {_U.KOR_DOW[selDate.getDay()]}요일
        </div>
        <div className="cv-side-date">
          {dayItems.length === 0 && dayTasks.length === 0
            ? "일정·할일 없음"
            : `일정 ${dayItems.length} · 할일 ${dayTasks.length}${openTasks > 0 ? ` (미완 ${openTasks})` : ""}`}
        </div>
        <div className="cv-side-meta">
          {Object.entries(tally).map(([cat, n]) => {
            const c = _U.catById(cat);
            return (
              <span key={cat} className="pill" style={{ "--c": c.color }}>
                <span className="dot" />{c.label} {n}
              </span>
            );
          })}
        </div>
      </div>

      <div className="cv-side-list">
        {dayItems.length === 0 && dayTasks.length === 0 ? (
          <div className="cv-side-empty">
            <div style={{ fontSize: 26, marginBottom: 8 }}>·</div>
            선택한 날짜에 일정·할일이 없어요
          </div>
        ) : (
          <React.Fragment>
            {dayItems.length > 0 && (
              <div className="cv-side-section">
                <div className="cv-side-section-h"><span>일정</span><span className="n">{dayItems.length}</span></div>
                {dayItems.map((seg) => {
                  const c = _U.catById(seg.cat);
                  const isAllDay = !seg.start.includes("T");
                  return (
                    <div key={seg.id + selected} className="cv-side-item" style={{ "--c": c.color }}>
                      <div className="cv-side-time">
                        <div className="t1">{isAllDay ? "종일" : _U.formatHMShort(seg.start.slice(11, 16))}</div>
                        {!isAllDay && seg.end.includes("T") && (
                          <div className="t2">~ {_U.formatHMShort(seg.end.slice(11, 16))}</div>
                        )}
                      </div>
                      <div className="cv-side-body">
                        <div className="cv-side-title">
                          <span style={{ "--c-soft": c.soft, "--c-dark": c.dark }} className="cv-side-cat-tag">{c.label}</span>
                          {seg.title}
                        </div>
                        {seg.detail && <div className="cv-side-note">{seg.detail}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {dayTasks.length > 0 && (
              <div className="cv-side-section">
                <div className="cv-side-section-h"><span>할일</span><span className="n">{dayTasks.length}</span></div>
                {dayTasks.map((t) => {
                  const c = _U.catById(t.cat);
                  const st = STATUS[t.status];
                  return (
                    <div key={t.id + selected} className={`cv-task-row st-${t.status}`}>
                      <span className="cv-task-dot" style={{ background: `var(${st.v})` }} />
                      <span className="cv-task-title">{t.title}</span>
                      <span className="cv-task-meta">
                        <span className="cv-task-cat" style={{ background: c.color }} />
                        {st.l}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </React.Fragment>
        )}
      </div>

      <div className="cv-mini-summary">
        <div className="cv-mini-summary-t">이번 달 카테고리</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {_U.CATEGORIES.filter((c) => c.id !== "holiday").map((c) => {
            const n = summary[c.id] || 0;
            const pct = Math.round((n / maxN) * 100);
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: c.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg-2)", minWidth: 32 }}>{c.label}</span>
                <div style={{ flex: 1, height: 6, background: "var(--bg-3)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: pct + "%", height: "100%", background: c.color, borderRadius: 99, transition: "width 0.3s ease" }} />
                </div>
                <span style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 700, fontVariantNumeric: "tabular-nums", minWidth: 22, textAlign: "right" }}>{n}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// CalendarUnified — controller
// ------------------------------------------------------------
function CalendarUnified() {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [hidden, setHidden] = useState(new Set());
  const [selected, setSelected] = useState(_U.isoDay(today));
  const events = useMemo(() => _U.buildDemoEvents(), []);
  const tasks = useMemo(() => _U.buildDemoTasks(), []);

  const onPrev = () => { let y = year, m = month - 1; if (m < 1) { m = 12; y -= 1; } setYear(y); setMonth(m); };
  const onNext = () => { let y = year, m = month + 1; if (m > 12) { m = 1; y += 1; } setYear(y); setMonth(m); };
  const onToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); setSelected(_U.isoDay(today)); };
  const toggleCat = (catId) => {
    if (!catId) return;
    setHidden((prev) => { const n = new Set(prev); n.has(catId) ? n.delete(catId) : n.add(catId); return n; });
  };

  const weeks = useMemo(() => _U.monthWeeks(year, month), [year, month]);
  const filtered = useMemo(() => events.filter((e) => !hidden.has(e.cat)), [events, hidden]);
  const holidayMap = useMemo(() => _U.holidayMapForYear(year), [year]);
  const byDay = useMemo(() => _U.eventsByDay(filtered), [filtered]);
  const tasksMap = useMemo(() => _U.tasksByDay(tasks), [tasks]);
  const dayTasks = useMemo(() => tasksMap.get(selected) || [], [tasksMap, selected]);
  const dayItems = useMemo(() => {
    const l = byDay.get(selected) || [];
    return [...l].sort((a, b) => a.start.localeCompare(b.start));
  }, [byDay, selected]);
  const summary = useMemo(() => {
    const c = {};
    const tM = `${year}-${_U.pad2(month)}`;
    for (const e of events) {
      if (e.start.slice(0, 7) === tM || e.end.slice(0, 7) === tM) c[e.cat] = (c[e.cat] || 0) + 1;
    }
    return c;
  }, [events, year, month]);

  return (
    <div className="cv-shell cv-B cv-C cv-U">
      <AppBar label={_U.monthLabel(year, month)} yearLabel={`${year}`} onPrev={onPrev} onNext={onNext} onToday={onToday} />
      <SubBar events={events} hidden={hidden} onToggle={toggleCat} />
      <div className="cv-C-wrap">
        <div className="cv-C-main">
          <MonthGrid weeks={weeks} filtered={filtered} month={month} today={today} holidayMap={holidayMap} selected={selected} onSelect={setSelected} tasksMap={tasksMap} />
        </div>
        <SideRail selected={selected} dayItems={dayItems} dayTasks={dayTasks} summary={summary} />
      </div>
    </div>
  );
}

window.CalendarUnified = CalendarUnified;

if (!window.__CAL_NO_AUTORENDER && document.getElementById("root")) {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <div style={{ padding: 24, minHeight: "100vh", background: "var(--bg-2)", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, minHeight: 720, maxWidth: 1440, margin: "0 auto", width: "100%" }}>
        <CalendarUnified />
      </div>
    </div>
  );
}
