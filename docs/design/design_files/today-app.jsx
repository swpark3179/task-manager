/* global React, ReactDOM, CalendarData, TodayData */
// ============================================================
// Today page — unified hero, schedule card, task card
// Single layout (no A/B/C). Compares Desktop vs Mobile on canvas.
// ============================================================
const { useState, useMemo } = React;
const _CD = window.CalendarData;
const _TD = window.TodayData;
const _TaskEditModal = window.TaskEditModal;
const _ScheduleEditModal = window.ScheduleEditModal;
const _DetailView = window.DetailView;

// ============================================================
// Icons
// ============================================================
const IcChevL = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcChevR = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcChevD = () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcPlus = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>);
const IcTrash = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcSettings = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.6"/></svg>);
const IcTree = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>);
const IcList = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>);
const IcCheck = () => (<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcInbox = () => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.6"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.6"/></svg>);
const IcSync = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-8.06-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 8.06 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 4v4h-4M3 20v-4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcStar = ({ filled }) => (<svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}><path d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 17.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>);
const IcDoc = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v5h5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"/><path d="M9 13h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);

// ============================================================
// Manual sync button (우측 상단)
// ============================================================
function SyncButton() {
  const [state, setState] = useState("idle"); // idle | syncing | done
  const [last, setLast] = useState(null);
  const doSync = () => {
    if (state === "syncing") return;
    setState("syncing");
    window.setTimeout(() => {
      setState("done");
      setLast(new Date());
      window.setTimeout(() => setState("idle"), 1800);
    }, 1100);
  };
  const fmt = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const label = state === "syncing" ? "동기화 중…"
    : state === "done" ? "동기화됨"
    : last ? `${fmt(last)} 동기화` : "동기화";
  return (
    <button className={`td-sync is-${state}`} onClick={doSync} title="수동으로 동기화">
      <span className="td-sync-ic"><IcSync/></span>
      <span className="td-sync-l">{label}</span>
    </button>
  );
}

// ============================================================
// Hero (unified date + weekly strip + progress)
// ============================================================
function Hero({ today, weekData, total, completed }) {
  const dateLabel = `${today.getMonth() + 1}월 ${today.getDate()}일`;
  const dowLabel = `${_CD.KOR_DOW[today.getDay()]}요일`;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="td-hero">
      <div className="td-hero-left">
        <div className="td-hero-eyebrow">오늘의 할일</div>
        <div className="td-hero-date">
          <span>{dateLabel}</span>
          <span className="td-hero-date-sub">{today.getFullYear()} · {dowLabel}</span>
        </div>
        <div className="td-hero-progress">
          <div className="td-hero-prog-bar">
            <div className="td-hero-prog-fill" style={{ width: pct + "%" }} />
          </div>
          <span className="td-hero-prog-txt">{completed}/{total} · {pct}%</span>
        </div>
      </div>
      <div className="td-hero-right">
        <SyncButton />
        <div className="td-week-wrap">
          <button className="td-week-nav" aria-label="이전 주"><IcChevL/></button>
          <div className="td-week">
            {weekData.map((d) => {
              const dow = d.dateObj.getDay();
              const isToday = d.date === _TD.todayISO;
              return (
                <button
                  key={d.date}
                  className={`td-day ${isToday ? "is-today" : ""} ${dow === 0 ? "is-sun" : ""} ${dow === 6 ? "is-sat" : ""}`}
                >
                  <span className="td-day-dow">{_CD.KOR_DOW[dow]}</span>
                  <span className="td-day-num">{d.dateObj.getDate()}</span>
                </button>
              );
            })}
          </div>
          <button className="td-week-nav" aria-label="다음 주"><IcChevR/></button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Schedule list (body only — card chrome lives in TabbedCard)
// ============================================================
function ScheduleList({ schedules, onEdit, onView, onAdd }) {
  return (
    <React.Fragment>
      {schedules.length === 0 ? (
        <div className="td-sched-empty">
          오늘 예정된 일정이 없습니다.
          <button className="td-sched-add" onClick={() => onAdd && onAdd()}><IcPlus/> 일정 추가</button>
        </div>
      ) : (
        schedules.map((s) => {
            const cat = _CD.catById(s.category);
            const isAllDay = !s.start.includes("T");
            const startHM = isAllDay ? null : s.start.slice(11, 16);
            const endHM = isAllDay ? null : s.end.slice(11, 16);
          return (
            <div
              key={s.id}
              className="td-sched"
              style={{ "--c": cat.color, "--c-soft": cat.soft, "--c-dark": cat.dark }}
            >
              <div className="td-sched-time">
                {isAllDay ? (
                  <span className="allday">종일</span>
                ) : (
                  <React.Fragment>
                    <span className="t1">{_CD.formatHMShort(startHM)}</span>
                    <span className="t2">{_CD.formatHMShort(endHM)}</span>
                  </React.Fragment>
                )}
              </div>
              <div className="td-sched-bar" />
              <div className="td-sched-body" onClick={() => onView && onView(s)} style={{ cursor: "pointer" }}>
                <div className="td-sched-title">
                  <span className="td-sched-cat">{cat.label}</span>
                  {s.title}
                </div>
                {s.detail && <div className="td-sched-note">{s.detail}</div>}
              </div>
              <div className="td-sched-act">
                <button title="상세보기" onClick={() => onView && onView(s)}><IcDoc/></button>
                <button title="설정" onClick={() => onEdit && onEdit(s)}><IcSettings/></button>
              </div>
            </div>
          );
        })
      )}
      {schedules.length > 0 && (
        <button className="td-sched-add" onClick={() => onAdd && onAdd()}><IcPlus/> 일정 추가</button>
      )}
    </React.Fragment>
  );
}

// ============================================================
// Event list (D-day style — anniversaries / deadlines)
// ============================================================
function EventList({ events }) {
  if (!events || events.length === 0) {
    return <div className="td-sched-empty">등록된 이벤트가 없습니다.</div>;
  }
  const stripe = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const todayMs = stripe(_TD.today);
  const sorted = [...events].sort((a, b) => stripe(a.dateObj) - stripe(b.dateObj));
  return (
    <React.Fragment>
      {sorted.map((e) => {
        const cat = _CD.catById(e.category);
        const diff = Math.round((stripe(e.dateObj) - todayMs) / 86400000);
        const dlabel = diff === 0 ? "D-DAY" : diff > 0 ? `D-${diff}` : `D+${-diff}`;
        const md = `${e.dateObj.getMonth() + 1}월 ${e.dateObj.getDate()}일 (${_CD.KOR_DOW[e.dateObj.getDay()]})`;
        return (
          <div
            key={e.id}
            className={`td-event ${diff < 0 ? "is-past" : ""}`}
            style={{ "--c": cat.color, "--c-soft": cat.soft, "--c-dark": cat.dark }}
          >
            <div className={`td-event-dday ${diff === 0 ? "is-today" : ""}`}>{dlabel}</div>
            <div className="td-event-bar" />
            <div className="td-event-body">
              <div className="td-event-title"><span className="td-event-type">{e.type}</span>{e.title}</div>
              <div className="td-event-date">{md}</div>
            </div>
          </div>
        );
      })}
    </React.Fragment>
  );
}

// ============================================================
// Task Card
// ============================================================
function TaskBody({ tasks, setTasks, viewMode, variant, onEditTask, onViewTask }) {
  const [filter, setFilter] = useState(null);  // null | 'todo' | 'doing' | 'done' | 'discarded'
  const [input, setInput] = useState("");

  const flatten = (list) => {
    const out = [];
    const walk = (l) => { for (const t of l) { out.push(t); if (t.children) walk(t.children); } };
    walk(list);
    return out;
  };
  const flat = useMemo(() => flatten(tasks), [tasks]);

  const summary = useMemo(() => {
    const s = { total: 0, todo: 0, doing: 0, done: 0, discarded: 0 };
    for (const t of flat) { s.total++; s[t.status]++; }
    return s;
  }, [flat]);

  const visible = useMemo(() => {
    let base = tasks;
    if (viewMode === "leaf") {
      base = flat.filter((t) => !t.children || t.children.length === 0)
                 .map((t) => ({ ...t, children: [] }));
    }
    if (filter) {
      const filterNode = (n) => {
        if (n.status === filter) return n;
        const kids = (n.children || []).map(filterNode).filter(Boolean);
        if (kids.length) return { ...n, children: kids };
        return null;
      };
      base = base.map(filterNode).filter(Boolean);
    }
    return base;
  }, [tasks, viewMode, filter, flat]);

  const cycleStatus = (id) => {
    const NEXT = { todo: "doing", doing: "done", done: "todo", discarded: "todo" };
    const walk = (list) => list.map((t) => {
      if (t.id === id) return { ...t, status: NEXT[t.status] };
      return t.children?.length ? { ...t, children: walk(t.children) } : t;
    });
    setTasks((prev) => walk(prev));
  };

  const toggleFav = (id) => {
    const walk = (list) => list.map((t) => {
      if (t.id === id) return { ...t, favorite: !t.favorite };
      return t.children?.length ? { ...t, children: walk(t.children) } : t;
    });
    setTasks((prev) => walk(prev));
  };

  const submitAdd = () => {
    const title = input.trim();
    if (!title) return;
    setTasks((prev) => [{
      id: "n" + Math.random().toString(36).slice(2, 8),
      title, status: "todo", category: "personal",
      detail: "", favorite: false, lowPriority: variant === "later", children: [],
    }, ...prev]);
    setInput("");
  };

  const pills = [
    { k: "doing", l: "진행", n: summary.doing, kind: "doing" },
    { k: "todo",  l: "대기", n: summary.todo, kind: "todo" },
    { k: "done",  l: "완료", n: summary.done, kind: "done" },
    { k: "discarded", l: "폐기", n: summary.discarded, kind: "discard", hideWhenZero: true },
  ];

  return (
    <div>
      {variant === "active" && (
        <div className="td-quick">
          <input
            className="td-quick-in"
            placeholder="새 할일을 입력하고 Enter — 빠르게 추가"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); }}
          />
          <button className="td-quick-btn" onClick={submitAdd}>
            <IcPlus/> 추가
          </button>
        </div>
      )}

      {variant === "active" && (
        <div className="td-task-summary">
          {pills.filter((p) => !(p.hideWhenZero && p.n === 0)).map((p) => (
            <button
              key={p.k}
              className={`td-pill kind-${p.kind} ${filter === p.k ? "is-on" : ""}`}
              onClick={() => setFilter(filter === p.k ? null : p.k)}
            >
              <span className="dot" />
              {p.l} {p.n}
            </button>
          ))}
          {filter && (
            <button className="td-pill" onClick={() => setFilter(null)} style={{ marginLeft: "auto" }}>
              필터 해제
            </button>
          )}
        </div>
      )}

      {variant === "later" && (
        <div className="td-later-note">
          우선순위가 낮아 나중에 처리할 할일입니다. 준비되면 다시 작업 탭으로 올릴 수 있어요.
        </div>
      )}

      {visible.length === 0 ? (
        <div className="td-empty">
          <div className="td-empty-icon"><IcInbox/></div>
          <div className="td-empty-title">{variant === "later" ? "나중에 할일이 없어요" : "표시할 할일이 없어요"}</div>
          <div className="td-empty-desc">{variant === "later" ? "급하지 않은 할일을 여기에 모아두세요" : "위 입력란에 할일을 적고 Enter를 눌러 추가해보세요"}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {visible.map((t) => (
            <TaskNode key={t.id} task={t} depth={0} cycleStatus={cycleStatus} toggleFav={toggleFav} onEdit={onEditTask} onView={onViewTask} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TabbedCard — unified 작업 / 일정 in a single card with tabs
// ============================================================
function TabbedCard({ tasks, setTasks, schedules, setSchedules, events, onAddSchedule }) {
  const [tab, setTab] = useState("tasks"); // 'tasks' | 'schedules' | 'events' | 'later'
  const [viewMode, setViewMode] = useState("tree");
  const [modal, setModal] = useState(null); // {type:'task-edit'|'task-view'|'sched-edit'|'sched-view', item}

  const updateTask = (updated) => {
    const walk = (list) => list.map((t) => (t.id === updated.id ? { ...t, ...updated } : (t.children?.length ? { ...t, children: walk(t.children) } : t)));
    setTasks((prev) => walk(prev));
  };
  const updateSchedule = (updated) => {
    setSchedules && setSchedules((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const flatten = (list) => {
    const out = [];
    const walk = (l) => { for (const t of l) { out.push(t); if (t.children) walk(t.children); } };
    walk(list);
    return out;
  };
  const activeTasks = useMemo(() => tasks.filter((t) => !t.lowPriority), [tasks]);
  const laterTasks = useMemo(() => tasks.filter((t) => t.lowPriority), [tasks]);
  const activeFlat = flatten(activeTasks);
  const aDone = activeFlat.filter((t) => t.status === "done").length;
  const aDiscarded = activeFlat.filter((t) => t.status === "discarded").length;
  const totalExcl = activeFlat.length - aDiscarded;
  const pct = totalExcl > 0 ? Math.round((aDone / totalExcl) * 100) : 0;

  const TABS = [
    { k: "tasks", l: "작업", n: activeTasks.length },
    { k: "schedules", l: "일정", n: schedules.length },
    { k: "events", l: "이벤트", n: events.length },
    { k: "later", l: "나중에 할일", n: laterTasks.length },
  ];

  return (
    <div className="td-card">
      <div className="td-tabs">
        {TABS.map((t) => (
          <button
            key={t.k}
            className={`td-tab ${tab === t.k ? "is-on" : ""}`}
            onClick={() => setTab(t.k)}
            role="tab"
            aria-selected={tab === t.k}
          >
            <span className="td-tab-l">{t.l}</span>
            <span className="td-tab-n">{t.n}</span>
          </button>
        ))}

        <div className="td-tabs-spacer" />

        {tab === "tasks" && (
          <React.Fragment>
            <span className="td-tabs-meta">{aDone}/{totalExcl} · {pct}%</span>
            <div className="td-vm" role="tablist">
              <button className={viewMode === "tree" ? "is-on" : ""} onClick={() => setViewMode("tree")} title="트리 뷰"><IcTree/></button>
              <button className={viewMode === "leaf" ? "is-on" : ""} onClick={() => setViewMode("leaf")} title="리스트 뷰"><IcList/></button>
            </div>
          </React.Fragment>
        )}
        {tab === "schedules" && (
          <button className="td-quick-btn" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => (onAddSchedule ? onAddSchedule() : setModal({ type: "sched-edit", item: null }))}><IcPlus/> 일정 등록</button>
        )}
        {tab === "events" && (
          <button className="td-quick-btn" style={{ padding: "6px 12px", fontSize: 12 }}><IcPlus/> 이벤트 추가</button>
        )}
      </div>

      <div className="td-card-body">
        {tab === "tasks" && <TaskBody tasks={activeTasks} setTasks={setTasks} viewMode={viewMode} variant="active" onEditTask={(t) => setModal({ type: "task-edit", item: t })} onViewTask={(t) => setModal({ type: "task-view", item: t })} />}
        {tab === "schedules" && <ScheduleList schedules={schedules} onEdit={(s) => setModal({ type: "sched-edit", item: s })} onView={(s) => setModal({ type: "sched-view", item: s })} onAdd={() => (onAddSchedule ? onAddSchedule() : setModal({ type: "sched-edit", item: null }))} />}
        {tab === "events" && <EventList events={events} />}
        {tab === "later" && <TaskBody tasks={laterTasks} setTasks={setTasks} viewMode="tree" variant="later" onEditTask={(t) => setModal({ type: "task-edit", item: t })} onViewTask={(t) => setModal({ type: "task-view", item: t })} />}
      </div>

      {modal && modal.type === "task-edit" && _TaskEditModal && (
        <_TaskEditModal task={modal.item} onClose={() => setModal(null)} onSave={(t) => { updateTask(t); setModal(null); }} />
      )}
      {modal && modal.type === "task-view" && _DetailView && (
        <_DetailView kind="task" item={modal.item} onClose={() => setModal(null)} onSaveDetail={(d) => { updateTask({ ...modal.item, detail: d }); setModal((m) => (m ? { ...m, item: { ...m.item, detail: d } } : m)); }} />
      )}
      {modal && modal.type === "sched-edit" && _ScheduleEditModal && (
        <_ScheduleEditModal sched={modal.item} onClose={() => setModal(null)} onSave={(s) => { if (modal.item) { updateSchedule(s); } else if (setSchedules) { setSchedules((prev) => [...prev, s]); } setModal(null); }} />
      )}
      {modal && modal.type === "sched-view" && _DetailView && (
        <_DetailView kind="sched" item={modal.item} onClose={() => setModal(null)} onSaveDetail={(d) => { updateSchedule({ ...modal.item, detail: d }); setModal((m) => (m ? { ...m, item: { ...m.item, detail: d } } : m)); }} />
      )}
    </div>
  );
}

// ============================================================
// Task Node (recursive)
// ============================================================
function TaskNode({ task, depth, cycleStatus, toggleFav, dimmed, onEdit, onView }) {
  const [expanded, setExpanded] = useState(false);
  const cat = _CD.catById(task.category);
  const isParent = (task.children || []).length > 0;
  const isDone = task.status === "done";
  const isDoing = task.status === "doing";
  const isDiscarded = task.status === "discarded";

  return (
    <div>
      <div
        className={`td-task ${isDoing ? "is-doing" : ""} ${isDone ? "is-done" : ""} ${isDiscarded ? "is-discarded" : ""} ${expanded ? "is-expanded" : ""}`}
        style={dimmed ? { opacity: 0.7 } : undefined}
      >
        <button
          className={`td-chk ${isDone ? "is-done" : ""} ${isDoing ? "is-doing" : ""} ${isParent ? "is-parent" : ""}`}
          onClick={(e) => { e.stopPropagation(); if (!isParent) cycleStatus(task.id); }}
          title={isParent ? "하위 작업으로 상태가 자동 결정됩니다" : "상태 전환 (대기→진행→완료)"}
        >
          {isDone ? <IcCheck/> : null}
        </button>
        <div className="td-task-cat" style={{ background: cat.color }} />

        <div className="td-task-body" onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer" }}>
          <div className="td-task-row">
            <span className="td-task-title">{task.title}</span>
            {task.lowPriority && <span className="td-task-low">낮음</span>}
            {isParent && (
              <span className="td-task-cnt">
                {(task.children || []).filter((c) => c.status === "done").length}/{(task.children || []).length}
              </span>
            )}
          </div>
          {(task.registeredDate || task.completedDate) && !isDiscarded && (
            <div className="td-task-meta">
              {task.registeredDate && (
                <span className="td-task-meta-chip" title="등록일">
                  등록 {task.registeredDate.getMonth() + 1}/{task.registeredDate.getDate()}
                </span>
              )}
              {task.completedDate && isDone && (
                <span className="td-task-meta-chip" title="완료일">
                  완료 {task.completedDate.getMonth() + 1}/{task.completedDate.getDate()}
                </span>
              )}
            </div>
          )}
        </div>

        <button
          className={`td-task-fav ${task.favorite ? "is-fav" : ""}`}
          onClick={(e) => { e.stopPropagation(); toggleFav && toggleFav(task.id); }}
          title={task.favorite ? "즐겨찾기 해제" : "즐겨찾기"}
        >
          <IcStar filled={task.favorite} />
        </button>
        <div className="td-task-act">
          <button title={expanded ? "접기" : "펼치기"} onClick={() => setExpanded(!expanded)}>
            <span className="td-task-caret"><IcChevD/></span>
          </button>
          <button title="상세보기" onClick={(e) => { e.stopPropagation(); onView && onView(task); }}><IcDoc/></button>
          <button title="설정" onClick={(e) => { e.stopPropagation(); onEdit && onEdit(task); }}><IcSettings/></button>
          <button className="btn-danger" title="삭제"><IcTrash/></button>
        </div>
      </div>

      {expanded && (
        <React.Fragment>
          <div className={`td-task-detail ${!task.detail ? "is-empty" : ""}`}>
            {task.detail || "상세 내용 없음 — 클릭해서 추가"}
          </div>
          {isParent && (
            <div className="td-task-children">
              {task.children.map((c) => (
                <TaskNode key={c.id} task={c} depth={depth + 1} cycleStatus={cycleStatus} toggleFav={toggleFav} onEdit={onEdit} onView={onView} />
              ))}
            </div>
          )}
        </React.Fragment>
      )}
    </div>
  );
}

// ============================================================
// Page composer (used both for desktop + mobile artboards)
// ============================================================
function TodayPage({ density }) {
  const today = _TD.today;
  const weekData = useMemo(() => _TD.buildWeekSummary(), []);
  const [tasks, setTasks] = useState(() => _TD.buildTodayDemoTasks());
  const [schedules, setSchedules] = useState(() => _TD.buildTodayDemoSchedules());
  const [events] = useState(() => _TD.buildTodayDemoEvents());
  const holidays = _TD.buildHolidays();

  const flatten = (list) => {
    const out = [];
    const walk = (l) => { for (const t of l) { out.push(t); if (t.children) walk(t.children); } };
    walk(list);
    return out;
  };
  // Hero progress reflects ACTIVE (non-low-priority) tasks only.
  const activeFlat = flatten(tasks.filter((t) => !t.lowPriority));
  const heroTotal = activeFlat.filter((t) => t.status !== "discarded").length;
  const heroDone = activeFlat.filter((t) => t.status === "done").length;

  return (
    <div className="td-page" data-density={density === "compact" ? "compact" : undefined}>
      <Hero today={today} weekData={weekData} total={heroTotal} completed={heroDone} />
      {holidays.length > 0 && (
        <div className="td-holiday-band">
          {holidays.map((h) => (
            <span key={h.id} className="td-holiday-chip">
              <span className="dot" />
              {h.title}
              <span className="type">{h.type}</span>
            </span>
          ))}
        </div>
      )}
      <TabbedCard tasks={tasks} setTasks={setTasks} schedules={schedules} setSchedules={setSchedules} events={events} />
    </div>
  );
}

// ============================================================
// Reusable: just the tabbed area (작업/일정/이벤트/나중에할일)
// with its own demo state — used by the mobile calendar sheet.
// ============================================================
function TodayTabsStandalone({ onAddSchedule }) {
  const [tasks, setTasks] = useState(() => _TD.buildTodayDemoTasks());
  const [schedules, setSchedules] = useState(() => _TD.buildTodayDemoSchedules());
  const [events] = useState(() => _TD.buildTodayDemoEvents());
  return <TabbedCard tasks={tasks} setTasks={setTasks} schedules={schedules} setSchedules={setSchedules} events={events} onAddSchedule={onAddSchedule} />;
}
window.TodayTabs = TodayTabsStandalone;
window.TodayPage = TodayPage;

// ============================================================
// App: hosts TodayPage on a design canvas (desktop + mobile)
// ============================================================
function App() {
  const tweaksDefaults = /*EDITMODE-BEGIN*/{
    "view": "focus",
    "density": "comfortable"
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(tweaksDefaults);

  const tweaksUI = (
    <TweaksPanel title="Tweaks">
      <TweakSection label="레이아웃">
        <TweakRadio
          label="보기"
          value={t.view}
          options={[
            { value: "focus", label: "단일" },
            { value: "canvas", label: "데스크탑 + 모바일" },
          ]}
          onChange={(v) => setTweak("view", v)}
        />
        <TweakRadio
          label="밀도"
          value={t.density}
          options={[
            { value: "comfortable", label: "여유" },
            { value: "compact", label: "조밀" },
          ]}
          onChange={(v) => setTweak("density", v)}
        />
      </TweakSection>
    </TweaksPanel>
  );

  if (t.view === "focus") {
    return (
      <React.Fragment>
        <TodayPage density={t.density} />
        {tweaksUI}
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      <DesignCanvas>
        <DCSection
          id="today-views"
          title="오늘의 할일 — 데스크탑 + 모바일"
          subtitle="Calendar B안과 동일 톤. 하나의 히어로(날짜+주간+진행률), 카드 2장(일정·작업)으로 단순화."
        >
          <DCArtboard id="ab-today-desktop" label="Desktop" width={1180} height={900}>
            <TodayPage density={t.density} />
          </DCArtboard>
          <DCArtboard id="ab-today-mobile" label="Mobile (390 × 820)" width={390} height={820}>
            <TodayPage density={t.density} />
          </DCArtboard>
        </DCSection>
      </DesignCanvas>
      {tweaksUI}
    </React.Fragment>
  );
}

if (!window.__TODAY_NO_AUTORENDER && document.getElementById("root")) {
  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
}
