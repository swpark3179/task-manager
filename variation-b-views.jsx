/* global React, CalendarData */
// ============================================================
// Variation B — Week / Day / Agenda views
// Shares Lane Bars vocabulary (category colors, soft fills for single-day,
// solid bars for multi-day) with the month grid.
// ============================================================
const _BV = window.CalendarData;

// Window of hours rendered in week/day. 6 → 22 covers most events.
const HOUR_START = 6;
const HOUR_END = 22; // exclusive (renders 6..21 = 16 rows)
const ROW_PX = 44;

function startOfWeek(d /* Date */) {
  // Sunday start
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}

function eventsTouchingDay(events, dISO) {
  return events.filter((e) => e.start.slice(0, 10) <= dISO && e.end.slice(0, 10) >= dISO);
}

// Convert "HH:MM" → minutes since midnight
function hmToMin(hm) {
  if (!hm) return null;
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

// ============================================================
// Week view
// ============================================================
function WeekViewB({ anchorDate, today, events, hidden }) {
  const start = React.useMemo(() => startOfWeek(anchorDate), [anchorDate]);
  const days = React.useMemo(() => Array.from({ length: 7 }, (_, i) => _BV.addDays(start, i)), [start]);
  const filtered = React.useMemo(() => events.filter(e => !hidden.has(e.cat)), [events, hidden]);

  const hours = React.useMemo(() => {
    const out = [];
    for (let h = HOUR_START; h < HOUR_END; h++) out.push(h);
    return out;
  }, []);

  // Position a timed event within a day column. Returns null if not timed.
  const positionForDay = (evt, d) => {
    if (!evt.start.includes("T")) return null;
    const dISO = _BV.isoDay(d);
    const segStartISO = evt.start.slice(0, 10);
    const segEndISO = evt.end.slice(0, 10);
    if (dISO < segStartISO || dISO > segEndISO) return null;

    const startMin = dISO === segStartISO ? hmToMin(evt.start.slice(11, 16)) : HOUR_START * 60;
    const endMin = dISO === segEndISO ? hmToMin(evt.end.slice(11, 16)) : HOUR_END * 60;
    if (endMin <= HOUR_START * 60 || startMin >= HOUR_END * 60) return null;

    const top = Math.max(0, (startMin - HOUR_START * 60)) / 60 * ROW_PX;
    const height = Math.max(20, (Math.min(endMin, HOUR_END * 60) - Math.max(startMin, HOUR_START * 60)) / 60 * ROW_PX - 2);
    return { top, height, startMin, endMin };
  };

  // All-day / multi-day strip: events without time or spanning multiple days at this week
  const allDayPerDay = React.useMemo(() => {
    const map = new Map();
    for (const d of days) map.set(_BV.isoDay(d), []);
    for (const e of filtered) {
      const sISO = e.start.slice(0, 10);
      const eISO = e.end.slice(0, 10);
      const isMulti = sISO !== eISO;
      const isAllDay = !e.start.includes("T");
      if (!isAllDay && !isMulti) continue;
      for (const d of days) {
        const dISO = _BV.isoDay(d);
        if (dISO >= sISO && dISO <= eISO) map.get(dISO).push(e);
      }
    }
    return map;
  }, [filtered, days]);

  return (
    <div className="cv-week-wrap">
      {/* Header: day names + numbers */}
      <div className="cv-week-head-row">
        <div className="cv-week-head-corner" />
        {days.map((d, i) => {
          const isToday = _BV.sameDay(d, today);
          const dow = d.getDay();
          return (
            <div
              key={i}
              className={`cv-week-head ${isToday ? "is-today" : ""} ${dow === 0 ? "is-sun" : dow === 6 ? "is-sat" : ""}`}
            >
              <div className="d">{_BV.KOR_DOW[dow]}</div>
              <div className="n">{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      {/* All-day band */}
      <div className="cv-week-allday">
        <div className="cv-week-allday-axis">종일</div>
        {days.map((d, i) => {
          const items = allDayPerDay.get(_BV.isoDay(d)) || [];
          return (
            <div key={i} className="cv-week-allday-cell">
              {items.slice(0, 3).map((e) => {
                const c = _BV.catById(e.cat);
                return (
                  <div
                    key={e.id + "-" + i}
                    className={`cv-lane cat-${e.cat}`}
                    style={{ background: c.color }}
                    title={e.title}
                  >
                    {e.title}
                  </div>
                );
              })}
              {items.length > 3 && <div className="cv-more">+{items.length - 3}</div>}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="cv-week-grid">
        <div className="cv-week-hour-axis">
          {hours.map((h) => (
            <div key={h} className="cv-week-hour-tick">{String(h).padStart(2, "0")}</div>
          ))}
        </div>
        {days.map((d, di) => {
          const dISO = _BV.isoDay(d);
          const dayEvents = filtered.filter((e) => {
            if (!e.start.includes("T")) return false;
            const sISO = e.start.slice(0, 10);
            const eISO = e.end.slice(0, 10);
            return dISO >= sISO && dISO <= eISO;
          });
          // Now-line if today
          const isToday = _BV.sameDay(d, today);
          const nowMin = today.getHours() * 60 + today.getMinutes();
          const nowTop = (nowMin - HOUR_START * 60) / 60 * ROW_PX;
          return (
            <div key={di} className="cv-week-col">
              {hours.map((h) => <div key={h} className="cv-week-row" />)}
              {dayEvents.map((e) => {
                const pos = positionForDay(e, d);
                if (!pos) return null;
                const c = _BV.catById(e.cat);
                return (
                  <div
                    key={e.id + "-" + di}
                    className={`cv-week-evt cat-${e.cat}`}
                    style={{
                      top: pos.top,
                      height: pos.height,
                      background: c.color,
                    }}
                    title={e.title}
                  >
                    <span className="t">
                      {_BV.formatHMShort(e.start.slice(11, 16))}
                      {e.end.includes("T") ? " – " + _BV.formatHMShort(e.end.slice(11, 16)) : ""}
                    </span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.title}
                    </span>
                  </div>
                );
              })}
              {isToday && nowTop >= 0 && nowTop <= (HOUR_END - HOUR_START) * ROW_PX && (
                <div className="cv-week-nowline" style={{ top: nowTop }}>
                  <span className="dot" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Day view (compact 1-column variant of Week)
// ============================================================
function DayViewB({ anchorDate, today, events, hidden }) {
  const filtered = React.useMemo(() => events.filter(e => !hidden.has(e.cat)), [events, hidden]);
  const dISO = _BV.isoDay(anchorDate);
  const hours = React.useMemo(() => {
    const out = [];
    for (let h = HOUR_START; h < HOUR_END; h++) out.push(h);
    return out;
  }, []);
  const dayEvents = filtered.filter((e) => {
    const sISO = e.start.slice(0, 10);
    const eISO = e.end.slice(0, 10);
    return dISO >= sISO && dISO <= eISO;
  });
  const allDay = dayEvents.filter((e) => !e.start.includes("T") || e.start.slice(0,10) !== e.end.slice(0,10));
  const timed = dayEvents.filter((e) => e.start.includes("T") && e.start.slice(0,10) === e.end.slice(0,10));
  const isToday = _BV.sameDay(anchorDate, today);
  const nowMin = today.getHours() * 60 + today.getMinutes();
  const nowTop = (nowMin - HOUR_START * 60) / 60 * ROW_PX;

  return (
    <div className="cv-week-wrap cv-day-wrap">
      <div className="cv-week-head-row cv-day-head-row">
        <div className="cv-week-head-corner" />
        <div className={`cv-week-head ${isToday ? "is-today" : ""} ${anchorDate.getDay() === 0 ? "is-sun" : anchorDate.getDay() === 6 ? "is-sat" : ""}`}>
          <div className="d">{_BV.KOR_DOW[anchorDate.getDay()]}</div>
          <div className="n">{anchorDate.getDate()}</div>
        </div>
      </div>
      {allDay.length > 0 && (
        <div className="cv-week-allday cv-day-allday">
          <div className="cv-week-allday-axis">종일</div>
          <div className="cv-week-allday-cell">
            {allDay.map((e) => {
              const c = _BV.catById(e.cat);
              return (
                <div key={e.id} className={`cv-lane cat-${e.cat}`} style={{ background: c.color }}>
                  {e.title}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="cv-week-grid cv-day-grid">
        <div className="cv-week-hour-axis">
          {hours.map((h) => (
            <div key={h} className="cv-week-hour-tick">{String(h).padStart(2, "0")}</div>
          ))}
        </div>
        <div className="cv-week-col">
          {hours.map((h) => <div key={h} className="cv-week-row" />)}
          {timed.map((e) => {
            const sM = hmToMin(e.start.slice(11, 16));
            const eM = hmToMin(e.end.slice(11, 16));
            const top = Math.max(0, sM - HOUR_START * 60) / 60 * ROW_PX;
            const height = Math.max(24, (eM - sM) / 60 * ROW_PX - 2);
            const c = _BV.catById(e.cat);
            return (
              <div
                key={e.id}
                className={`cv-week-evt cat-${e.cat}`}
                style={{ top, height, background: c.color, left: 8, right: 8 }}
              >
                <span className="t">
                  {_BV.formatHMShort(e.start.slice(11, 16))} – {_BV.formatHMShort(e.end.slice(11, 16))}
                </span>
                <span>{e.title}</span>
                {e.detail && <span className="d-note">{e.detail}</span>}
              </div>
            );
          })}
          {isToday && nowTop >= 0 && nowTop <= (HOUR_END - HOUR_START) * ROW_PX && (
            <div className="cv-week-nowline" style={{ top: nowTop }}>
              <span className="dot" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Agenda view (list grouped by day)
// ============================================================
function AgendaViewB({ year, month, today, events, hidden }) {
  const filtered = React.useMemo(() => events.filter(e => !hidden.has(e.cat)), [events, hidden]);

  // Build map dayISO → items, only for days that actually have events in displayed month
  const days = React.useMemo(() => {
    const map = new Map();
    for (const e of filtered) {
      const sd = _BV.dateFromISO(e.start.slice(0, 10));
      const ed = _BV.dateFromISO(e.end.slice(0, 10));
      let d = sd;
      while (d <= ed) {
        if (d.getFullYear() === year && d.getMonth() === month - 1) {
          const k = _BV.isoDay(d);
          const arr = map.get(k) || [];
          arr.push(e);
          map.set(k, arr);
        }
        d = _BV.addDays(d, 1);
      }
    }
    // sort entries by date and sort items within by start
    const entries = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [, arr] of entries) arr.sort((a, b) => a.start.localeCompare(b.start));
    return entries;
  }, [filtered, year, month]);

  if (days.length === 0) {
    return (
      <div className="cv-agenda">
        <div className="cv-side-empty">이번 달에 표시할 일정이 없어요.</div>
      </div>
    );
  }

  return (
    <div className="cv-agenda">
      {days.map(([dISO, items]) => {
        const d = _BV.dateFromISO(dISO);
        const isToday = _BV.sameDay(d, today);
        const dow = d.getDay();
        return (
          <div key={dISO} className="cv-agenda-day">
            <div className="cv-agenda-date">
              <div className={`cv-agenda-dnum ${isToday ? "is-today" : ""}`}>{d.getDate()}</div>
              <div className={`cv-agenda-dow ${dow === 0 ? "sun" : dow === 6 ? "sat" : ""}`}>
                {_BV.KOR_DOW[dow]}요일
              </div>
            </div>
            <div className="cv-agenda-items">
              {items.map((e) => {
                const c = _BV.catById(e.cat);
                const isMulti = e.start.slice(0, 10) !== e.end.slice(0, 10);
                const isAllDay = !e.start.includes("T");
                return (
                  <div key={e.id + dISO} className="cv-agenda-item" style={{ "--c": c.color, "--c-soft": c.soft, "--c-dark": c.dark }}>
                    <div className="cv-agenda-time">
                      {isAllDay || isMulti ? (
                        <span className="t-allday">종일</span>
                      ) : (
                        <React.Fragment>
                          <span className="t1">{_BV.formatHMShort(e.start.slice(11, 16))}</span>
                          <span className="t2">{_BV.formatHMShort(e.end.slice(11, 16))}</span>
                        </React.Fragment>
                      )}
                    </div>
                    <div className="cv-agenda-bar" style={{ background: c.color }} />
                    <div className="cv-agenda-body">
                      <div className="cv-agenda-title">
                        <span className="cv-side-cat-tag" style={{ background: c.soft, color: c.dark }}>{c.label}</span>
                        {e.title}
                      </div>
                      {e.detail && <div className="cv-agenda-note">{e.detail}</div>}
                    </div>
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

window.WeekViewB = WeekViewB;
window.DayViewB = DayViewB;
window.AgendaViewB = AgendaViewB;
