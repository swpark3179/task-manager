/* global React, CalendarData */
// ============================================================
// Variation A — Clean Chips
// Goal: most conservative — pure Dashboard theme, minimal cells,
// soft chip per event. Best for low information density days.
// ============================================================
const {
  KOR_DOW, isoDay, sameDay, monthGrid, monthLabel, addDays,
  catById, eventsByDay, holidayMapForYear, formatHMShort,
} = window.CalendarData;

function VariationA({ year, month, today, events, onPrev, onNext, onToday, onPick, viewMode, setViewMode, hidden = new Set() }) {
  const cells = React.useMemo(() => monthGrid(year, month), [year, month]);
  const byDay = React.useMemo(() => eventsByDay(events.filter(e => !hidden.has(e.cat))), [events, hidden]);
  const holidayMap = React.useMemo(() => holidayMapForYear(year), [year]);

  return (
    <div className="cv-shell cv-A">
      <AppBar
        label={monthLabel(year, month)}
        yearLabel={`${year}`}
        onPrev={onPrev} onNext={onNext} onToday={onToday}
        viewMode={viewMode} setViewMode={setViewMode}
      />
      <SubBar events={events} hidden={hidden} onPick={onPick} variant="A" />

      <div className="cv-grid" style={{ gridTemplateRows: `auto repeat(6, 1fr)` }}>
        {KOR_DOW.map((d, i) => (
          <div key={d} className={`cv-dow ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}>{d}</div>
        ))}
        {cells.map((d, i) => {
          const dISO = isoDay(d);
          const inMonth = d.getMonth() === month - 1;
          const isToday = sameDay(d, today);
          const dow = d.getDay();
          const hName = holidayMap[dISO];
          const items = byDay.get(dISO) || [];
          const visible = items.slice(0, 3);
          const hidden_ = items.length - visible.length;
          return (
            <div
              key={i}
              className={`cv-cell ${inMonth ? "" : "is-otherm"} ${isToday ? "is-today" : ""} ${dow === 0 || hName ? "is-sun" : dow === 6 ? "is-sat" : ""}`}
              onClick={() => onPick && onPick(dISO)}
            >
              <div className="cv-dnum-row">
                <span className="cv-dnum">{d.getDate()}</span>
                {hName && inMonth && <span className="cv-holiday-name">{hName}</span>}
              </div>
              {visible.map((seg) => {
                const c = catById(seg.cat);
                return (
                  <div key={seg.id + dISO} className={`cv-chip cat-${seg.cat}`} title={seg.title}>
                    <span className="dot" style={{ background: c.color }} />
                    <span>{seg.startHM ? formatHMShort(seg.startHM) + " " : ""}{seg.title}</span>
                  </div>
                );
              })}
              {hidden_ > 0 && <div className="cv-more">+{hidden_}건 더</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Shared AppBar (top)
// ============================================================
function AppBar({ label, yearLabel, onPrev, onNext, onToday, viewMode, setViewMode }) {
  return (
    <div className="cv-appbar">
      <div className="cv-appbar-title">
        <div className="cv-appbar-y">{yearLabel}</div>
        <div className="cv-appbar-m">{label}</div>
      </div>
      <div className="cv-appbar-nav">
        <button className="cv-nav-btn" onClick={onPrev} aria-label="이전 달">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button className="cv-today-btn" onClick={onToday}>오늘</button>
        <button className="cv-nav-btn" onClick={onNext} aria-label="다음 달">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <div className="cv-spacer" />
      {viewMode && setViewMode && (
        <div className="cv-viewmode" role="tablist">
          {[
            { k: "month", l: "월" },
            { k: "week", l: "주" },
            { k: "day", l: "일" },
            { k: "agenda", l: "Agenda" },
          ].map((v) => (
            <button
              key={v.k}
              className={viewMode === v.k ? "is-on" : ""}
              onClick={() => setViewMode(v.k)}
            >{v.l}</button>
          ))}
        </div>
      )}
      <button className="cv-add-btn">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>
        <span className="cv-add-btn-text">일정 추가</span>
      </button>
    </div>
  );
}

// ============================================================
// Shared SubBar (legend / filters)
// ============================================================
function SubBar({ events, hidden, onToggle, variant }) {
  const counts = {};
  for (const e of events) counts[e.cat] = (counts[e.cat] || 0) + 1;
  const cats = window.CalendarData.CATEGORIES;
  return (
    <div className="cv-subbar">
      {cats.map((c) => {
        const off = hidden && hidden.has(c.id);
        return (
          <button
            key={c.id}
            className={`cv-legend ${off ? "is-off" : ""}`}
            style={{ "--c": c.color }}
            onClick={() => onToggle && onToggle(c.id)}
          >
            <span className="dot" />
            {c.label}
            <span className="n">{counts[c.id] || 0}</span>
          </button>
        );
      })}
    </div>
  );
}

window.VariationA = VariationA;
window.AppBar = AppBar;
window.SubBar = SubBar;
