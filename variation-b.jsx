/* global React, CalendarData */
// ============================================================
// Variation B — Lane Bars
// Goal: events that span multiple days are visualized as bars
// flowing across cells. Single-day events use soft tint with time prefix.
// Industry-familiar, but with Dashboard tone.
// ============================================================
const _B = window.CalendarData;

function VariationB({ year, month, today, events, onPrev, onNext, onToday, onPick, viewMode, setViewMode, hidden = new Set() }) {
  const weeks = React.useMemo(() => _B.monthWeeks(year, month), [year, month]);
  const filtered = React.useMemo(() => events.filter(e => !hidden.has(e.cat)), [events, hidden]);
  const holidayMap = React.useMemo(() => _B.holidayMapForYear(year), [year]);

  // Anchor date used by Week/Day views — today if in this month, else 1st of month
  const anchorDate = React.useMemo(() => {
    if (today.getFullYear() === year && today.getMonth() === month - 1) return today;
    return new Date(year, month - 1, 1);
  }, [year, month, today]);

  const renderBody = () => {
    if (viewMode === "week") {
      return <window.WeekViewB anchorDate={anchorDate} today={today} events={events} hidden={hidden} />;
    }
    if (viewMode === "day") {
      return <window.DayViewB anchorDate={anchorDate} today={today} events={events} hidden={hidden} />;
    }
    if (viewMode === "agenda") {
      return <window.AgendaViewB year={year} month={month} today={today} events={events} hidden={hidden} />;
    }
    return renderMonthGrid();
  };

  const renderMonthGrid = () => (
    <div className="cv-grid" style={{ gridTemplateRows: `auto repeat(6, 1fr)` }}>
        {_B.KOR_DOW.map((d, i) => (
          <div key={d} className={`cv-dow ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}>{d}</div>
        ))}
        {weeks.flatMap((weekDates) => {
          const bars = _B.weekLanes(filtered, weekDates);
          // Per-week lane height = 20px (18 + 2 gap)
          const LANE_H = 20;
          // For each cell in week, decide visible bars (up to 3 lanes)
          const cells = weekDates.map((d, di) => {
            const dISO = _B.isoDay(d);
            const inMonth = d.getMonth() === month - 1;
            const isToday = _B.sameDay(d, today);
            const dow = d.getDay();
            const hName = holidayMap[dISO];
            // Single-day events on this day (not spanning) we can render as soft chips too
            // But for visual clarity here, render ALL bars in the bars[] absolute layer.
            // Hidden count: bars beyond lane 3 that touch this day
            const touching = bars.filter((b) => b.startCol <= di && b.endCol >= di);
            const overflow = touching.filter((b) => b.lane >= 3).length;
            return { d, dISO, inMonth, isToday, dow, hName, overflow };
          });

          return (
            <div
              key={_B.isoDay(weekDates[0])}
              style={{
                gridColumn: "1 / -1",
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                position: "relative",
                minHeight: 0,
              }}
            >
              {/* cells with date numbers */}
              {cells.map((c, di) => (
                <div
                  key={di}
                  className={`cv-cell ${c.inMonth ? "" : "is-otherm"} ${c.isToday ? "is-today" : ""} ${c.dow === 0 || c.hName ? "is-sun" : c.dow === 6 ? "is-sat" : ""}`}
                  onClick={() => onPick && onPick(c.dISO)}
                  style={{ paddingTop: 6, paddingBottom: 4 }}
                >
                  <div className="cv-cell-inner">
                    <div className="cv-dnum-row">
                      <span className="cv-dnum">{c.d.getDate()}</span>
                      {c.hName && c.inMonth && <span className="cv-holiday-name">{c.hName}</span>}
                    </div>
                    {/* placeholder spacer for lanes (height ≈ 3 lanes) */}
                    <div style={{ height: LANE_H * 3 + 4 }} />
                    {c.overflow > 0 && (
                      <div className="cv-more">+{c.overflow}건 더</div>
                    )}
                  </div>
                </div>
              ))}

              {/* Lane bars overlay */}
              <div
                style={{
                  position: "absolute",
                  top: 30, // below dnum row
                  left: 0, right: 0,
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  pointerEvents: "none",
                  padding: "0 4px",
                }}
              >
                {bars
                  .filter((b) => b.lane < 3)
                  .map((b, i) => {
                    const c = _B.catById(b.evt.cat);
                    const span = b.endCol - b.startCol + 1;
                    const isMulti = b.evt.start.slice(0, 10) !== b.evt.end.slice(0, 10);
                    return (
                      <div
                        key={b.evt.id + "-" + i}
                        className={`cv-lane cat-${b.evt.cat} ${b.isContL ? "is-cont-l" : ""} ${b.isContR ? "is-cont-r" : ""} ${!isMulti ? "cv-lane-soft" : ""}`}
                        style={{
                          gridColumn: `${b.startCol + 1} / span ${span}`,
                          gridRow: b.lane + 1,
                          marginTop: b.lane * 20,
                          marginBottom: 2,
                          pointerEvents: "auto",
                        }}
                        title={b.evt.title}
                      >
                        {!isMulti && b.evt.start.includes("T") && (
                          <span className="cv-lane-time">{_B.formatHMShort(b.evt.start.slice(11, 16))}</span>
                        )}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                          {b.evt.title}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
  );

  return (
    <div className="cv-shell cv-B">
      <window.AppBar
        label={_B.monthLabel(year, month)}
        yearLabel={`${year}`}
        onPrev={onPrev} onNext={onNext} onToday={onToday}
        viewMode={viewMode} setViewMode={setViewMode}
      />
      <window.SubBar events={events} hidden={hidden} onToggle={onPick} />
      {renderBody()}
    </div>
  );
}

window.VariationB = VariationB;
