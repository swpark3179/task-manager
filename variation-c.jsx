/* global React, CalendarData */
// ============================================================
// Variation C — Focus + Side Agenda
// Goal: most novel. Calendar grid on left shows minimal density
// (date + dot bars). Right rail shows selected day's full agenda
// + per-category bar summary for the month.
// ============================================================
const _C = window.CalendarData;

function VariationC({ year, month, today, events, onPrev, onNext, onToday, viewMode, setViewMode, hidden = new Set() }) {
  const [selected, setSelected] = React.useState(_C.isoDay(today));
  const cells = React.useMemo(() => _C.monthGrid(year, month), [year, month]);
  const filtered = React.useMemo(() => events.filter((e) => !hidden.has(e.cat)), [events, hidden]);
  const byDay = React.useMemo(() => _C.eventsByDay(filtered), [filtered]);
  const holidayMap = React.useMemo(() => _C.holidayMapForYear(year), [year]);

  // Side rail: selected day events, sorted by start
  const dayItems = React.useMemo(() => {
    const list = byDay.get(selected) || [];
    return [...list].sort((a, b) => a.start.localeCompare(b.start));
  }, [byDay, selected]);

  // Month per-category bar summary
  const summary = React.useMemo(() => {
    // Count events per category that occur in the displayed month
    const counts = {};
    for (const e of events) {
      const sM = e.start.slice(0, 7);
      const eM = e.end.slice(0, 7);
      const targetM = `${year}-${_C.pad2(month)}`;
      if (sM === targetM || eM === targetM) {
        counts[e.cat] = (counts[e.cat] || 0) + 1;
      }
    }
    return counts;
  }, [events, year, month]);

  const selDate = _C.dateFromISO(selected);
  const selectedOpts = _C.KOR_DOW[selDate.getDay()];

  return (
    <div className="cv-shell cv-C">
      <window.AppBar
        label={_C.monthLabel(year, month)}
        yearLabel={`${year}`}
        onPrev={onPrev} onNext={onNext} onToday={onToday}
        viewMode={viewMode} setViewMode={setViewMode}
      />
      <window.SubBar events={events} hidden={hidden} onToggle={(c) => {/* parent handles */}} />

      <div className="cv-C-wrap">
        {/* Calendar grid */}
        <div className="cv-C-main">
          <div className="cv-grid" style={{ gridTemplateRows: `auto repeat(6, 1fr)`, borderTop: 0 }}>
            {_C.KOR_DOW.map((d, i) => (
              <div key={d} className={`cv-dow ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}>{d}</div>
            ))}
            {cells.map((d, i) => {
              const dISO = _C.isoDay(d);
              const inMonth = d.getMonth() === month - 1;
              const isToday = _C.sameDay(d, today);
              const isSel = dISO === selected;
              const dow = d.getDay();
              const hName = holidayMap[dISO];
              const items = byDay.get(dISO) || [];
              // group by category for dot bars
              const byCat = {};
              for (const it of items) byCat[it.cat] = (byCat[it.cat] || 0) + 1;
              return (
                <div
                  key={i}
                  className={`cv-cell ${inMonth ? "" : "is-otherm"} ${isToday ? "is-today" : ""} ${dow === 0 || hName ? "is-sun" : dow === 6 ? "is-sat" : ""} ${isSel ? "is-selected" : ""}`}
                  onClick={() => setSelected(dISO)}
                >
                  <div className="cv-dnum-row">
                    <span className="cv-dnum">{d.getDate()}</span>
                    {items.length > 0 && inMonth && (
                      <span className="cv-count-pill">{items.length}</span>
                    )}
                  </div>
                  {hName && inMonth && (
                    <div className="cv-cell-label" style={{ color: "var(--holiday)", fontWeight: 600 }}>
                      {hName}
                    </div>
                  )}
                  {!hName && items.length > 0 && inMonth && (
                    <div className="cv-cell-label" title={items.map((i) => i.title).join(", ")}>
                      {items[0].title}
                    </div>
                  )}
                  <div className="cv-dot-row">
                    {Object.entries(byCat).map(([cat, n]) => {
                      const c = _C.catById(cat);
                      return (
                        <span
                          key={cat}
                          className="cv-dot-bar"
                          style={{
                            background: c.color,
                            flex: `${Math.min(n, 4)} 1 0`,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Side rail */}
        <div className="cv-C-side">
          <div className="cv-side-head">
            <div className="cv-side-day">
              {selDate.getMonth() + 1}월 {selDate.getDate()}일 · {selectedOpts}요일
            </div>
            <div className="cv-side-date">
              {dayItems.length === 0 ? "일정 없음" : `${dayItems.length}건의 일정`}
            </div>
            <div className="cv-side-meta">
              {(() => {
                const tally = {};
                for (const it of dayItems) tally[it.cat] = (tally[it.cat] || 0) + 1;
                return Object.entries(tally).map(([cat, n]) => {
                  const c = _C.catById(cat);
                  return (
                    <span key={cat} className="pill" style={{ "--c": c.color }}>
                      <span className="dot" />
                      {c.label} {n}
                    </span>
                  );
                });
              })()}
            </div>
          </div>

          <div className="cv-side-list">
            {dayItems.length === 0 ? (
              <div className="cv-side-empty">
                <div style={{ fontSize: 26, marginBottom: 8 }}>·</div>
                선택한 날짜에 일정이 없어요
              </div>
            ) : (
              dayItems.map((seg) => {
                const c = _C.catById(seg.cat);
                const isAllDay = !seg.start.includes("T");
                return (
                  <div key={seg.id + selected} className="cv-side-item" style={{ "--c": c.color }}>
                    <div className="cv-side-time">
                      <div className="t1">
                        {isAllDay ? "종일" : _C.formatHMShort(seg.start.slice(11, 16))}
                      </div>
                      {!isAllDay && seg.end.includes("T") && (
                        <div className="t2">~ {_C.formatHMShort(seg.end.slice(11, 16))}</div>
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
              })
            )}
          </div>

          <div className="cv-mini-summary">
            <div className="cv-mini-summary-t">이번 달 카테고리</div>
            <div className="cv-mini-bars" style={{ height: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {_C.CATEGORIES.filter((c) => c.id !== "holiday").map((c) => {
                const n = summary[c.id] || 0;
                const max = Math.max(...Object.values(summary), 1);
                const pct = Math.round((n / max) * 100);
                return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: 99,
                      background: c.color, flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg-2)", minWidth: 32 }}>{c.label}</span>
                    <div style={{
                      flex: 1, height: 6, background: "var(--bg-3)",
                      borderRadius: 99, overflow: "hidden",
                    }}>
                      <div style={{
                        width: pct + "%", height: "100%",
                        background: c.color, borderRadius: 99,
                        transition: "width 0.3s ease",
                      }} />
                    </div>
                    <span style={{
                      fontSize: 11, color: "var(--fg-3)", fontWeight: 700,
                      fontVariantNumeric: "tabular-nums", minWidth: 22, textAlign: "right",
                    }}>{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.VariationC = VariationC;
