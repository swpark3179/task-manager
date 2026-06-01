/* global React */
// ============================================================
// MobileCalendar — 모바일 달력 (Phase 4, v3)
// 풀스크린 월간 그리드 + 멀티데이 레인바 + 우선순위 항목
// + 월/연 빠른 이동 · 좌우 스와이프(월 이동) · 롱프레스 기간선택 · 일정등록 모달
// ============================================================
const _MU = window.CalendarData;
const { useState, useRef, useMemo } = React;

const MAX_LANES = 2;
const ITEM_BUDGET = 5;
const LONG_MS = 3000;       // 롱프레스(기간선택) 임계 3초
const SWIPE_RATIO = 0.24;   // 월 이동 확정 임계(그리드 폭 대비)

// ---- Filter popover ----
function MobileFilter({ showSpecials, setShowSpecials, catOn, toggleCat, counts }) {
  const [open, setOpen] = useState(false);
  const cats = _MU.CATEGORIES.filter((c) => c.id !== "holiday");
  const anyOff = !showSpecials || cats.some((c) => !catOn.has(c.id));
  return (
    <div className="mfilter">
      <button className={`mfilter-btn ${anyOff ? "is-active" : ""}`} onClick={() => setOpen((o) => !o)} aria-label="필터">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
      </button>
      {open && (
        <React.Fragment>
          <div className="mfilter-scrim" onClick={() => setOpen(false)} />
          <div className="mfilter-pop" role="menu">
            <div className="mfilter-grp">기념일 · 공휴일 · 생일</div>
            <button className="mfilter-row" onClick={() => setShowSpecials((v) => !v)}>
              <span className="sw" style={{ background: "var(--holiday)" }} />
              <span className="lb">공휴일 · 기념일 · 생일</span>
              <span className={`mtoggle ${showSpecials ? "on" : ""}`} />
            </button>
            <div className="mfilter-grp">일정 · 작업 카테고리</div>
            {cats.map((c) => (
              <button key={c.id} className="mfilter-row" onClick={() => toggleCat(c.id)}>
                <span className="sw" style={{ background: c.color }} />
                <span className="lb">{c.label}</span>
                <span className="cnt">{counts[c.id] || 0}</span>
                <span className={`mtoggle ${catOn.has(c.id) ? "on" : ""}`} />
              </button>
            ))}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

// ---- Month / Year quick picker ----
function MonthYearPicker({ year, month, onPick, onClose }) {
  const [y, setY] = useState(year);
  const today = new Date();
  return (
    <div className="mpick-wrap" onClick={onClose}>
      <div className="mpick" onClick={(e) => e.stopPropagation()}>
        <div className="mpick-year">
          <button onClick={() => setY((v) => v - 1)} aria-label="이전 해"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          <span>{y}</span>
          <button onClick={() => setY((v) => v + 1)} aria-label="다음 해"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
        </div>
        <div className="mpick-grid">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const isCur = y === year && m === month;
            const isToday = y === today.getFullYear() && m === today.getMonth() + 1;
            return (
              <button
                key={m}
                className={`mpick-m ${isCur ? "is-cur" : ""} ${isToday ? "is-today" : ""}`}
                onClick={() => onPick(y, m)}
              >{m}월</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- Schedule registration modal ----
function ScheduleModal({ startISO, endISO, onClose, onSave }) {
  const a = startISO <= endISO ? startISO : endISO;
  const b = startISO <= endISO ? endISO : startISO;
  const multi = a !== b;
  const [title, setTitle] = useState("");
  const [cat, setCat] = useState("company");
  const [allDay, setAllDay] = useState(multi);
  const [s, setS] = useState("10:00");
  const [e, setE] = useState("11:00");
  const cats = _MU.CATEGORIES.filter((c) => c.id !== "holiday");
  const fmt = (iso) => { const d = _MU.dateFromISO(iso); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${_MU.KOR_DOW[d.getDay()]})`; };

  const save = () => {
    const start = allDay ? a : `${a}T${s}`;
    const end = allDay ? b : `${multi ? b : a}T${e}`;
    onSave({ id: "ne" + Math.random().toString(36).slice(2, 7), cat, title: title.trim() || "(제목 없음)", start, end, detail: "" });
  };

  return (
    <div className="msm-wrap">
      <div className="msm-backdrop" onClick={onClose} />
      <div className="msm">
        <div className="msm-head">
          <span>일정 등록</span>
          <button className="msm-x" onClick={onClose} aria-label="닫기"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button>
        </div>
        <div className="msm-body">
          <div className="msm-period">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7"/><path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            {multi ? <span>{fmt(a)} <b>~</b> {fmt(b)}</span> : <span>{fmt(a)}</span>}
          </div>
          <input className="msm-input" placeholder="일정 제목" value={title} onChange={(ev) => setTitle(ev.target.value)} autoFocus />
          <div className="msm-field">
            <label>카테고리</label>
            <div className="msm-seg">
              {cats.map((c) => (
                <button key={c.id} className={cat === c.id ? "on" : ""} onClick={() => setCat(c.id)} style={{ "--c": c.color }}>
                  <span className="dot" style={{ background: c.color }} />{c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="msm-field">
            <label>종일</label>
            <button className={`mtoggle ${allDay ? "on" : ""}`} onClick={() => setAllDay((v) => !v)} />
          </div>
          {!allDay && (
            <div className="msm-field">
              <label>시간</label>
              <div className="msm-time">
                <input type="time" value={s} onChange={(ev) => setS(ev.target.value)} />
                <span>~</span>
                <input type="time" value={e} onChange={(ev) => setE(ev.target.value)} />
              </div>
            </div>
          )}
        </div>
        <div className="msm-foot">
          <button className="msm-cancel" onClick={onClose}>취소</button>
          <button className="msm-save" onClick={save}>등록</button>
        </div>
      </div>
    </div>
  );
}

// ---- Bottom sheet with drag-to-dismiss ----
function MobileSheet({ open, dateISO, onClose, onAddSchedule }) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const startY = useRef(0);
  const dragYRef = useRef(0);

  const onDown = (e) => {
    draggingRef.current = true; setDragging(true);
    startY.current = e.clientY; dragYRef.current = 0;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const onMove = (e) => {
    if (!draggingRef.current) return;
    const dy = Math.max(0, e.clientY - startY.current);
    dragYRef.current = dy; setDragY(dy);
  };
  const onUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false; setDragging(false);
    if (dragYRef.current > 120) onClose();
    dragYRef.current = 0; setDragY(0);
  };

  const d = dateISO ? _MU.dateFromISO(dateISO) : new Date();
  const dateLabel = `${d.getMonth() + 1}월 ${d.getDate()}일 · ${_MU.KOR_DOW[d.getDay()]}요일`;
  const TodayTabs = window.TodayTabs;

  return (
    <React.Fragment>
      <div className="msheet-backdrop"
        style={{ opacity: open ? Math.max(0, 0.42 - dragY / 600) : 0, pointerEvents: open ? "auto" : "none", transition: dragging ? "none" : "opacity .3s ease" }}
        onClick={onClose} />
      <div className="msheet"
        style={{ transform: open ? `translateY(${dragY}px)` : "translateY(110%)", transition: dragging ? "none" : "transform .32s cubic-bezier(.32,.72,0,1)" }}>
        <div className="msheet-grab" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="msheet-handle" />
          <div className="msheet-date">{dateLabel}</div>
        </div>
        <div className="msheet-body">
          {open && TodayTabs ? <TodayTabs onAddSchedule={onAddSchedule} /> : null}
        </div>
      </div>
    </React.Fragment>
  );
}

// ---- Month grid (lane bars + priority items + range highlight) ----
function MobileMonthGrid({ weeks, month, today, multiEvents, singleByDay, tasksMap, specialsMap, selected, weeksRef, gesture, swipeDX, swipeAnim, ranging, rangeA, rangeB }) {
  const SPECIAL = {
    holiday:  { cls: "sp-holiday",  ic: null },
    birthday: { cls: "sp-birthday", ic: "🎂" },
    anniv:    { cls: "sp-anniv",    ic: null },
  };
  const inRange = (iso) => rangeA && rangeB && iso >= rangeA && iso <= rangeB;

  return (
    <div className={`mgrid ${ranging ? "is-ranging" : ""}`}>
      <div className="mgrid-dow">
        {_MU.KOR_DOW.map((dw, i) => (
          <div key={dw} className={i === 0 ? "sun" : i === 6 ? "sat" : ""}>{dw}</div>
        ))}
      </div>
      <div
        className="mgrid-weeks"
        ref={weeksRef}
        onPointerDown={gesture.onDown}
        onPointerMove={gesture.onMove}
        onPointerUp={gesture.onUp}
        onPointerCancel={gesture.onUp}
        style={{ transform: `translateX(${swipeDX}px)`, transition: swipeAnim ? "transform .24s ease" : "none" }}
      >
        {weeks.map((weekDates) => {
          const bars = _MU.weekLanes(multiEvents, weekDates);
          const shownBars = bars.filter((b) => b.lane < MAX_LANES);
          const bandLanes = shownBars.length ? Math.min(MAX_LANES, Math.max(...shownBars.map((b) => b.lane)) + 1) : 0;
          const bandH = bandLanes * 17;
          return (
            <div key={_MU.isoDay(weekDates[0])} className="mweek">
              <div className="mweek-cells">
                {weekDates.map((dt, di) => {
                  const dISO = _MU.isoDay(dt);
                  const inMonth = dt.getMonth() === month - 1;
                  const isToday = _MU.sameDay(dt, today);
                  const isSel = dISO === selected;
                  const dow = dt.getDay();
                  const specials = specialsMap.get(dISO) || [];
                  const sEvents = singleByDay.get(dISO) || [];
                  const tks = tasksMap.get(dISO) || [];
                  const hiddenBars = bars.filter((b) => b.lane >= MAX_LANES && b.startCol <= di && b.endCol >= di).length;
                  const rng = inRange(dISO);

                  const items = [
                    ...specials.map((s) => ({ kind: "special", data: s })),
                    ...sEvents.map((e) => ({ kind: "event", data: e })),
                    ...tks.map((t) => ({ kind: "task", data: t })),
                  ];
                  const remaining = Math.max(1, ITEM_BUDGET - bandLanes);
                  const overflowed = items.length + hiddenBars > remaining;
                  const visN = overflowed ? Math.max(0, remaining - 1) : items.length;
                  const hidden = items.length - visN + hiddenBars;

                  return (
                    <div
                      key={di}
                      data-iso={dISO}
                      className={`mcell ${inMonth ? "" : "is-otherm"} ${isToday ? "is-today" : ""} ${isSel ? "is-sel" : ""} ${dow === 0 ? "sun" : dow === 6 ? "sat" : ""} ${rng ? "is-range" : ""} ${rng && dISO === rangeA ? "is-range-l" : ""} ${rng && dISO === rangeB ? "is-range-r" : ""}`}
                    >
                      <span className="mcell-num">{dt.getDate()}</span>
                      {bandH > 0 && <div className="mcell-band" style={{ height: bandH }} />}
                      <div className="mcell-items">
                        {items.slice(0, visN).map((it, k) => {
                          if (it.kind === "special") {
                            const sp = SPECIAL[it.data.kind] || SPECIAL.holiday;
                            return (
                              <div key={"s" + k} className={`mitem msp ${sp.cls}`}>
                                {sp.ic && <span className="ic">{sp.ic}</span>}
                                <span className="tx">{it.data.title}</span>
                              </div>
                            );
                          }
                          if (it.kind === "event") {
                            const c = _MU.catById(it.data.cat);
                            return (
                              <div key={"e" + k} className="mitem mevt" style={{ "--c": c.color, "--c-soft": c.soft, "--c-dark": c.dark }}>
                                <span className="tx">{it.data.start.includes("T") ? _MU.formatHMShort(it.data.start.slice(11, 16)) + " " : ""}{it.data.title}</span>
                              </div>
                            );
                          }
                          const c = _MU.catById(it.data.cat);
                          const stColor = { todo: "--todo", doing: "--doing", done: "--done", discarded: "--discard" }[it.data.status];
                          return (
                            <div key={"t" + k} className={`mitem mtask st-${it.data.status}`}>
                              <span className="dot" style={{ background: `var(${stColor})` }} />
                              <span className="tx">{it.data.title}</span>
                            </div>
                          );
                        })}
                        {hidden > 0 && <div className="mmore">+{hidden}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {bandLanes > 0 && (
                <div className="mweek-bars" style={{ top: 22 }}>
                  {shownBars.map((b, i) => {
                    const span = b.endCol - b.startCol + 1;
                    const c = _MU.catById(b.evt.cat);
                    return (
                      <div key={b.evt.id + "-" + i}
                        className={`mbar ${b.isContL ? "cl" : ""} ${b.isContR ? "cr" : ""}`}
                        style={{ gridColumn: `${b.startCol + 1} / span ${span}`, gridRow: b.lane + 1, background: c.color }}
                        title={b.evt.title}>
                        <span>{b.evt.title}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Controller ----
function MobileCalendar() {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selected, setSelected] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showSpecials, setShowSpecials] = useState(true);
  const [catOn, setCatOn] = useState(() => new Set(["personal", "company"]));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [extraEvents, setExtraEvents] = useState([]);
  const [modal, setModal] = useState(null); // { startISO, endISO } | null

  // gesture state
  const [swipeDX, setSwipeDX] = useState(0);
  const [swipeAnim, setSwipeAnim] = useState(false);
  const [ranging, setRanging] = useState(false);
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const weeksRef = useRef(null);
  const gs = useRef({ mode: null, startX: 0, startY: 0, startISO: null, timer: null });
  const reRef = useRef(null); // live rangeEnd

  const allEventsBase = useMemo(() => _MU.buildDemoEvents().filter((e) => e.cat !== "holiday"), []);
  const allTasks = useMemo(() => _MU.buildDemoTasks(), []);
  const allEvents = useMemo(() => [...allEventsBase, ...extraEvents], [allEventsBase, extraEvents]);

  const changeMonth = (delta) => {
    setMonth((m) => {
      let nm = m + delta, ny = year;
      if (nm < 1) { nm = 12; ny -= 1; } else if (nm > 12) { nm = 1; ny += 1; }
      if (ny !== year) setYear(ny);
      return nm;
    });
  };
  const onPrev = () => changeMonth(-1);
  const onNext = () => changeMonth(1);
  const onToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); };
  const toggleCat = (id) => setCatOn((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const weeks = useMemo(() => _MU.monthWeeks(year, month), [year, month]);
  const events = useMemo(() => allEvents.filter((e) => catOn.has(e.cat)), [allEvents, catOn]);
  const tasks = useMemo(() => allTasks.filter((t) => catOn.has(t.cat)), [allTasks, catOn]);
  const multiEvents = useMemo(() => events.filter((e) => e.start.slice(0, 10) !== e.end.slice(0, 10)), [events]);
  const singleByDay = useMemo(() => _MU.eventsByDay(events.filter((e) => e.start.slice(0, 10) === e.end.slice(0, 10))), [events]);
  const tasksMap = useMemo(() => _MU.tasksByDay(tasks), [tasks]);
  const specialsMap = useMemo(() => (showSpecials ? _MU.specialsByDay(year, month) : new Map()), [showSpecials, year, month]);

  const counts = {};
  for (const e of allEvents) counts[e.cat] = (counts[e.cat] || 0) + 1;
  for (const t of allTasks) counts[t.cat] = (counts[t.cat] || 0) + 1;

  const openSheet = (iso) => { setSelected(iso); setSheetOpen(true); };
  const isoFromPoint = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const cell = el && el.closest ? el.closest(".mcell") : null;
    return cell ? cell.getAttribute("data-iso") : null;
  };

  const gesture = {
    onDown: (e) => {
      if (sheetOpen || pickerOpen || modal) return;
      const iso = (e.target.closest && e.target.closest(".mcell")?.getAttribute("data-iso")) || isoFromPoint(e.clientX, e.clientY);
      gs.current = { mode: "pending", startX: e.clientX, startY: e.clientY, startISO: iso, timer: null };
      setSwipeAnim(false);
      try { weeksRef.current.setPointerCapture(e.pointerId); } catch (_) {}
      gs.current.timer = setTimeout(() => {
        if (gs.current.mode === "pending" && iso) {
          gs.current.mode = "ranging";
          reRef.current = iso;
          setRanging(true); setRangeStart(iso); setRangeEnd(iso);
        }
      }, LONG_MS);
    },
    onMove: (e) => {
      const g = gs.current; if (!g.mode) return;
      const dx = e.clientX - g.startX, dy = e.clientY - g.startY;
      if (g.mode === "pending") {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          g.mode = "swiping"; clearTimeout(g.timer); setSwipeDX(dx);
        } else if (Math.abs(dy) > 16) {
          clearTimeout(g.timer); g.mode = "dead";
        }
      } else if (g.mode === "swiping") {
        setSwipeDX(e.clientX - g.startX);
      } else if (g.mode === "ranging") {
        const iso = isoFromPoint(e.clientX, e.clientY);
        if (iso) { reRef.current = iso; setRangeEnd(iso); }
      }
    },
    onUp: (e) => {
      const g = gs.current; clearTimeout(g.timer);
      const W = weeksRef.current ? weeksRef.current.offsetWidth : 340;
      if (g.mode === "swiping") {
        const dx = e.clientX - g.startX;
        setSwipeAnim(true);
        if (Math.abs(dx) > W * SWIPE_RATIO) {
          const dir = dx < 0 ? 1 : -1;
          setSwipeDX(dir * -W);
          setTimeout(() => { setSwipeAnim(false); setSwipeDX(0); changeMonth(dir); }, 230);
        } else {
          setSwipeDX(0);
        }
      } else if (g.mode === "ranging") {
        const a = g.startISO, b = reRef.current || g.startISO;
        const s = a <= b ? a : b, en = a <= b ? b : a;
        setRanging(false); setRangeStart(null); setRangeEnd(null);
        setModal({ startISO: s, endISO: en });
      } else if (g.mode === "pending" && g.startISO) {
        openSheet(g.startISO);
      }
      gs.current = { mode: null };
    },
  };

  const rangeA = rangeStart && rangeEnd ? (rangeStart <= rangeEnd ? rangeStart : rangeEnd) : null;
  const rangeB = rangeStart && rangeEnd ? (rangeStart <= rangeEnd ? rangeEnd : rangeStart) : null;

  const onSaveSchedule = (evt) => { setExtraEvents((p) => [...p, evt]); setModal(null); };

  return (
    <div className="mcal2">
      <header className="mcal2-top">
        <button className="mcal2-month" onClick={() => setPickerOpen(true)}>
          <span className="y">{year}</span>
          <span className="m">{month}월</span>
          <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div className="mcal2-actions">
          <button className="mcal2-nav" onClick={onPrev} aria-label="이전 달"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          <button className="mcal2-nav t" onClick={onToday}>오늘</button>
          <button className="mcal2-nav" onClick={onNext} aria-label="다음 달"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          <MobileFilter showSpecials={showSpecials} setShowSpecials={setShowSpecials} catOn={catOn} toggleCat={toggleCat} counts={counts} />
        </div>
      </header>

      {ranging && <div className="mrange-hint">기간을 드래그해 선택하세요 · 손을 떼면 일정 등록</div>}

      <MobileMonthGrid
        weeks={weeks} month={month} today={today}
        multiEvents={multiEvents} singleByDay={singleByDay} tasksMap={tasksMap} specialsMap={specialsMap}
        selected={selected} weeksRef={weeksRef} gesture={gesture}
        swipeDX={swipeDX} swipeAnim={swipeAnim} ranging={ranging} rangeA={rangeA} rangeB={rangeB}
      />

      <MobileSheet open={sheetOpen} dateISO={selected} onClose={() => setSheetOpen(false)}
        onAddSchedule={() => setModal({ startISO: selected || _MU.isoDay(today), endISO: selected || _MU.isoDay(today) })} />

      {pickerOpen && (
        <MonthYearPicker year={year} month={month}
          onPick={(y, m) => { setYear(y); setMonth(m); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)} />
      )}

      {modal && (
        <ScheduleModal startISO={modal.startISO} endISO={modal.endISO}
          onClose={() => setModal(null)} onSave={onSaveSchedule} />
      )}
    </div>
  );
}

window.MobileCalendar = MobileCalendar;
