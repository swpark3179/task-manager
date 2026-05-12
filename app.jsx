/* global React, ReactDOM, marked */
const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ============================================================
// Sample data
// ============================================================
const todayISO = () => new Date().toISOString().slice(0, 10);
const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const seedTasks = [
  {
    id: "t1",
    title: "Q2 OKR 초안 검토",
    status: "doing",
    detail:
      "## 검토 포인트\n- **목표 3개**가 너무 많지 않은지\n- KR이 _측정 가능_한지\n- 우선순위 정렬\n\n> 금주 목요일까지 PM과 1:1 필요",
    todayLog: [todayISO(), daysFromNow(-1), daysFromNow(-3)],
    children: [
      {
        id: "t1-1",
        title: "프로덕트팀 KR 정리",
        status: "doing",
        detail: "각 팀 리더 인터뷰 결과 통합",
        todayLog: [todayISO()],
        children: [
          {
            id: "t1-1-1",
            title: "엔지니어링 KR",
            status: "done",
            detail: "",
            todayLog: [daysFromNow(-2)],
            children: [],
          },
          {
            id: "t1-1-2",
            title: "디자인 KR",
            status: "doing",
            detail: "지표 정의 필요",
            todayLog: [todayISO()],
            children: [],
          },
        ],
      },
      {
        id: "t1-2",
        title: "재무팀 검토 요청",
        status: "todo",
        detail: "",
        todayLog: [],
        children: [],
      },
    ],
  },
  {
    id: "t2",
    title: "디자인 시스템 v2 마이그레이션",
    status: "doing",
    detail:
      "토큰 이름 충돌 해결 → 컴포넌트별 단계 적용\n\n- [x] 컬러 토큰\n- [x] 타이포\n- [ ] 컴포넌트 (진행중)",
    todayLog: [todayISO(), daysFromNow(-2), daysFromNow(-4), daysFromNow(-7)],
    children: [
      {
        id: "t2-1",
        title: "Button 컴포넌트",
        status: "done",
        detail: "",
        todayLog: [daysFromNow(-2)],
        children: [],
      },
      {
        id: "t2-2",
        title: "Input/Form 컴포넌트",
        status: "doing",
        detail: "에러 상태 토큰 누락",
        todayLog: [todayISO()],
        children: [],
      },
      {
        id: "t2-3",
        title: "Modal/Sheet 컴포넌트",
        status: "todo",
        detail: "",
        todayLog: [],
        children: [],
      },
    ],
  },
  {
    id: "t3",
    title: "주간 보고 작성",
    status: "todo",
    detail: "이번 주 진행/이슈/다음주 계획",
    todayLog: [],
    children: [],
  },
  {
    id: "t4",
    title: "신규 입사자 온보딩 문서",
    status: "done",
    detail: "노션 정리 완료, 링크 공유함",
    todayLog: [daysFromNow(-1), daysFromNow(-3)],
    children: [],
  },
  {
    id: "t5",
    title: "사이드 프로젝트: 가계부 앱 와이어프레임",
    status: "todo",
    detail: "주말 작업 예정",
    todayLog: [],
    children: [],
  },
];

const seedSchedules = [
  {
    id: "s1",
    title: "팀 위클리",
    start: todayISO() + "T10:00",
    end: todayISO() + "T11:00",
    detail: "회의실 4-B / 어젠다: 스프린트 회고",
  },
  {
    id: "s2",
    title: "디자인 리뷰",
    start: todayISO() + "T14:30",
    end: todayISO() + "T15:30",
    detail: "v2 컴포넌트 데모 + 피드백 수집",
  },
  {
    id: "s3",
    title: "고객사 미팅 (Acme Co.)",
    start: daysFromNow(1) + "T11:00",
    end: daysFromNow(1) + "T12:30",
    detail: "POC 결과 공유, 차기 단계 논의",
  },
  {
    id: "s4",
    title: "분기 OKR 워크숍",
    start: daysFromNow(3) + "T09:00",
    end: daysFromNow(3) + "T17:00",
    detail: "전사 워크숍 / 외부 시설\n점심 제공",
  },
  {
    id: "s5",
    title: "치과 정기검진",
    start: daysFromNow(5) + "T18:00",
    end: daysFromNow(5) + "T19:00",
    detail: "강남역 OO치과",
  },
];

// ============================================================
// Utilities
// ============================================================
const KOR_DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const formatToday = () => {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${
    KOR_DAYS[d.getDay()]
  })`;
};
const formatTime = (iso) => {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "오후" : "오전";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${hh}:${String(m).padStart(2, "0")}`;
};
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const formatDay = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const tom = new Date();
  tom.setDate(today.getDate() + 1);
  if (sameDay(d, today)) return "오늘";
  if (sameDay(d, tom)) return "내일";
  return `${d.getMonth() + 1}/${d.getDate()} (${KOR_DAYS[d.getDay()]})`;
};

// Count tasks recursively
const countAll = (tasks) => {
  let total = 0, done = 0, doing = 0, todo = 0;
  const walk = (list) => {
    for (const t of list) {
      total++;
      if (t.status === "done") done++;
      else if (t.status === "doing") doing++;
      else todo++;
      if (t.children?.length) walk(t.children);
    }
  };
  walk(tasks);
  return { total, done, doing, todo };
};

// Tree manipulation (immutable)
const updateTree = (tasks, id, updater) => {
  return tasks.map((t) => {
    if (t.id === id) return updater(t);
    if (t.children?.length) {
      return { ...t, children: updateTree(t.children, id, updater) };
    }
    return t;
  });
};
const removeFromTree = (tasks, id) => {
  return tasks
    .filter((t) => t.id !== id)
    .map((t) =>
      t.children?.length
        ? { ...t, children: removeFromTree(t.children, id) }
        : t
    );
};
const addToTree = (tasks, parentId, newTask) => {
  if (parentId === null) return [...tasks, newTask];
  return tasks.map((t) => {
    if (t.id === parentId) {
      return { ...t, children: [...(t.children || []), newTask] };
    }
    if (t.children?.length) {
      return { ...t, children: addToTree(t.children, parentId, newTask) };
    }
    return t;
  });
};
const newId = () => "x" + Math.random().toString(36).slice(2, 9);

// ============================================================
// Top-level App
// ============================================================
function App() {
  const tweaksDefaults = /*EDITMODE-BEGIN*/ {
    theme: "light",
    accent: "indigo",
    density: "comfy",
    widgetSize: "medium",
  } /*EDITMODE-END*/;

  const t = useTweaks(tweaksDefaults);
  const setTweak = t.set;

  const [tasks, setTasks] = useState(seedTasks);
  const [schedules, setSchedules] = useState(seedSchedules);
  const [tab, setTab] = useState("tasks"); // tasks | schedules
  const [filter, setFilter] = useState("all"); // all | doing | todo | done
  const [collapsed, setCollapsed] = useState(false);

  const counts = useMemo(() => countAll(tasks), [tasks]);

  const accentMap = {
    indigo: { h: 250, c: 0.16 },
    blue: { h: 240, c: 0.14 },
    green: { h: 155, c: 0.13 },
    amber: { h: 60, c: 0.14 },
    rose: { h: 10, c: 0.16 },
  };
  const widthMap = { small: 340, medium: 400, large: 460 };
  const heightMap = { small: 560, medium: 680, large: 760 };

  const a = accentMap[t.accent] || accentMap.indigo;
  const width = widthMap[t.widgetSize] || widthMap.medium;
  const height = heightMap[t.widgetSize] || heightMap.medium;

  // Apply theme CSS vars to widget root
  const themeVars = useMemo(() => {
    if (t.theme === "dark") {
      return {
        "--bg": "oklch(0.18 0.005 260)",
        "--bg-2": "oklch(0.22 0.006 260)",
        "--bg-3": "oklch(0.26 0.007 260)",
        "--fg": "oklch(0.96 0.005 260)",
        "--fg-2": "oklch(0.78 0.008 260)",
        "--fg-3": "oklch(0.58 0.008 260)",
        "--border": "oklch(0.32 0.008 260)",
        "--border-2": "oklch(0.38 0.008 260)",
        "--accent": `oklch(0.72 ${a.c} ${a.h})`,
        "--accent-soft": `oklch(0.32 ${a.c * 0.6} ${a.h})`,
        "--accent-fg": "oklch(0.12 0 0)",
        "--done": "oklch(0.7 0.13 155)",
        "--doing": `oklch(0.74 ${a.c} ${a.h})`,
        "--todo": "oklch(0.6 0.008 260)",
        "--shadow":
          "0 24px 60px -12px rgba(0,0,0,0.55), 0 8px 24px -8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
        "--scrim": "rgba(255,255,255,0.04)",
      };
    }
    return {
      "--bg": "oklch(0.995 0.002 260)",
      "--bg-2": "oklch(0.975 0.003 260)",
      "--bg-3": "oklch(0.955 0.004 260)",
      "--fg": "oklch(0.22 0.008 260)",
      "--fg-2": "oklch(0.42 0.008 260)",
      "--fg-3": "oklch(0.6 0.008 260)",
      "--border": "oklch(0.92 0.005 260)",
      "--border-2": "oklch(0.86 0.006 260)",
      "--accent": `oklch(0.52 ${a.c} ${a.h})`,
      "--accent-soft": `oklch(0.95 ${a.c * 0.35} ${a.h})`,
      "--accent-fg": "oklch(1 0 0)",
      "--done": "oklch(0.58 0.13 155)",
      "--doing": `oklch(0.52 ${a.c} ${a.h})`,
      "--todo": "oklch(0.65 0.008 260)",
      "--shadow":
        "0 24px 60px -12px rgba(15,23,42,0.18), 0 8px 24px -8px rgba(15,23,42,0.10), 0 0 0 1px rgba(15,23,42,0.04)",
      "--scrim": "rgba(15,23,42,0.04)",
    };
  }, [t.theme, t.accent]);

  // ----- Task ops -----
  const addRootTask = (title) => {
    if (!title.trim()) return;
    setTasks((prev) => [
      {
        id: newId(),
        title: title.trim(),
        status: "todo",
        detail: "",
        todayLog: [],
        children: [],
      },
      ...prev,
    ]);
  };
  const addChildTask = (parentId, title) => {
    if (!title.trim()) return;
    setTasks((prev) =>
      addToTree(prev, parentId, {
        id: newId(),
        title: title.trim(),
        status: "todo",
        detail: "",
        todayLog: [],
        children: [],
      })
    );
  };
  const updateTask = (id, patch) => {
    setTasks((prev) => updateTree(prev, id, (t) => ({ ...t, ...patch })));
  };
  const removeTask = (id) => {
    setTasks((prev) => removeFromTree(prev, id));
  };
  const toggleDone = (id) => {
    setTasks((prev) =>
      updateTree(prev, id, (t) => ({
        ...t,
        status: t.status === "done" ? "todo" : "done",
      }))
    );
  };
  const cycleStatus = (id) => {
    setTasks((prev) =>
      updateTree(prev, id, (t) => {
        const next = t.status === "todo" ? "doing" : t.status === "doing" ? "done" : "todo";
        return { ...t, status: next };
      })
    );
  };
  const markTodayProgress = (id) => {
    setTasks((prev) =>
      updateTree(prev, id, (t) => {
        const today = todayISO();
        const log = t.todayLog || [];
        return log.includes(today) ? t : { ...t, todayLog: [today, ...log] };
      })
    );
  };

  // ----- Schedule ops -----
  const addSchedule = (sched) => setSchedules((s) => [...s, sched]);
  const updateSchedule = (id, patch) =>
    setSchedules((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeSchedule = (id) => setSchedules((s) => s.filter((x) => x.id !== id));

  // ----- Filtering -----
  const visibleRoots = useMemo(() => {
    if (filter === "all") return tasks;
    return tasks.filter((t) => {
      const walk = (n) => {
        if (n.status === filter) return true;
        return (n.children || []).some(walk);
      };
      return walk(t);
    });
  }, [tasks, filter]);

  // Tweaks panel
  const tweaksUI = (
    <TweaksPanel title="Tweaks">
      <TweakSection title="모드">
        <TweakRadio
          label="테마"
          value={t.theme}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
          onChange={(v) => setTweak("theme", v)}
        />
        <TweakRadio
          label="크기"
          value={t.widgetSize}
          options={[
            { value: "small", label: "S" },
            { value: "medium", label: "M" },
            { value: "large", label: "L" },
          ]}
          onChange={(v) => setTweak("widgetSize", v)}
        />
      </TweakSection>
      <TweakSection title="포인트 컬러">
        <TweakColor
          label="액센트"
          value={t.accent}
          options={["indigo", "blue", "green", "amber", "rose"].map((k) => {
            const m = accentMap[k];
            const color =
              t.theme === "dark"
                ? `oklch(0.72 ${m.c} ${m.h})`
                : `oklch(0.52 ${m.c} ${m.h})`;
            return color;
          })}
          onChange={(v) => {
            const idx = ["indigo", "blue", "green", "amber", "rose"];
            const colors = idx.map((k) => {
              const m = accentMap[k];
              return t.theme === "dark"
                ? `oklch(0.72 ${m.c} ${m.h})`
                : `oklch(0.52 ${m.c} ${m.h})`;
            });
            const i = colors.indexOf(v);
            setTweak("accent", idx[i] ?? "indigo");
          }}
        />
      </TweakSection>
    </TweaksPanel>
  );

  // ----- Render -----
  return (
    <React.Fragment>
      {/* Desktop / faux backdrop is in index.html */}
      <div
        className="widget"
        style={{
          ...themeVars,
          width: width + "px",
          height: collapsed ? "auto" : height + "px",
        }}
      >
        <WidgetHeader
          counts={counts}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          theme={t.theme}
          onToggleTheme={() => setTweak("theme", t.theme === "light" ? "dark" : "light")}
        />
        {!collapsed && (
          <React.Fragment>
            <TabBar
              tab={tab}
              setTab={setTab}
              taskCount={counts.total}
              scheduleCount={schedules.length}
            />
            {tab === "tasks" ? (
              <TasksPane
                tasks={visibleRoots}
                filter={filter}
                setFilter={setFilter}
                counts={counts}
                addRootTask={addRootTask}
                addChildTask={addChildTask}
                updateTask={updateTask}
                removeTask={removeTask}
                toggleDone={toggleDone}
                cycleStatus={cycleStatus}
                markTodayProgress={markTodayProgress}
              />
            ) : (
              <SchedulesPane
                schedules={schedules}
                addSchedule={addSchedule}
                updateSchedule={updateSchedule}
                removeSchedule={removeSchedule}
              />
            )}
          </React.Fragment>
        )}
      </div>
      {tweaksUI}
    </React.Fragment>
  );
}

// ============================================================
// Header
// ============================================================
function WidgetHeader({ counts, collapsed, onToggleCollapse, theme, onToggleTheme }) {
  const pct = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;
  return (
    <div className="hdr">
      <div className="hdr-top">
        <div className="hdr-date">
          <div className="hdr-date-main">{formatToday()}</div>
          <div className="hdr-date-sub">
            오늘 진행 {counts.doing}건 · 대기 {counts.todo}건
          </div>
        </div>
        <div className="hdr-actions">
          <IconBtn
            label={theme === "light" ? "다크모드" : "라이트모드"}
            onClick={onToggleTheme}
          >
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </IconBtn>
          <IconBtn
            label={collapsed ? "펼치기" : "접기"}
            onClick={onToggleCollapse}
          >
            {collapsed ? <ExpandIcon /> : <CollapseIcon />}
          </IconBtn>
        </div>
      </div>
      <div className="hdr-stats">
        <Stat label="전체" value={counts.total} kind="all" />
        <Stat label="완료" value={counts.done} kind="done" />
        <Stat label="진행" value={counts.doing} kind="doing" />
        <Stat label="대기" value={counts.todo} kind="todo" />
        <div className="hdr-prog">
          <div className="hdr-prog-bar">
            <div
              className="hdr-prog-fill"
              style={{ width: pct + "%" }}
            />
          </div>
          <div className="hdr-prog-txt">{pct}%</div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, kind }) {
  return (
    <div className={`stat stat-${kind}`}>
      <div className="stat-val">{value}</div>
      <div className="stat-lbl">{label}</div>
    </div>
  );
}

// ============================================================
// Tabs
// ============================================================
function TabBar({ tab, setTab, taskCount, scheduleCount }) {
  return (
    <div className="tabbar">
      <button
        className={"tab " + (tab === "tasks" ? "tab-on" : "")}
        onClick={() => setTab("tasks")}
      >
        작업 <span className="tab-cnt">{taskCount}</span>
      </button>
      <button
        className={"tab " + (tab === "schedules" ? "tab-on" : "")}
        onClick={() => setTab("schedules")}
      >
        일정 <span className="tab-cnt">{scheduleCount}</span>
      </button>
    </div>
  );
}

// ============================================================
// Tasks Pane
// ============================================================
function TasksPane({
  tasks,
  filter,
  setFilter,
  counts,
  addRootTask,
  addChildTask,
  updateTask,
  removeTask,
  toggleDone,
  cycleStatus,
  markTodayProgress,
}) {
  const [input, setInput] = useState("");
  const submit = () => {
    if (!input.trim()) return;
    addRootTask(input);
    setInput("");
  };
  return (
    <div className="pane">
      <div className="quick">
        <input
          className="quick-in"
          placeholder="빠른 작업 추가 — 엔터로 등록"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <button className="quick-btn" onClick={submit} aria-label="추가">
          <PlusIcon />
        </button>
      </div>
      <div className="filters">
        {[
          { k: "all", l: "전체", n: counts.total },
          { k: "doing", l: "진행", n: counts.doing },
          { k: "todo", l: "대기", n: counts.todo },
          { k: "done", l: "완료", n: counts.done },
        ].map((f) => (
          <button
            key={f.k}
            className={"filter " + (filter === f.k ? "filter-on" : "")}
            onClick={() => setFilter(f.k)}
          >
            {f.l} <span className="filter-n">{f.n}</span>
          </button>
        ))}
      </div>
      <div className="list">
        {tasks.length === 0 ? (
          <EmptyState
            title={
              filter === "all" ? "작업이 없어요" : `${filterLabel(filter)} 항목이 없어요`
            }
            sub={filter === "all" ? "위에서 한 줄로 추가해보세요" : ""}
          />
        ) : (
          tasks.map((t) => (
            <TaskNode
              key={t.id}
              task={t}
              depth={0}
              maxDepth={4}
              addChildTask={addChildTask}
              updateTask={updateTask}
              removeTask={removeTask}
              toggleDone={toggleDone}
              cycleStatus={cycleStatus}
              markTodayProgress={markTodayProgress}
            />
          ))
        )}
      </div>
    </div>
  );
}

function filterLabel(k) {
  return { all: "전체", doing: "진행", todo: "대기", done: "완료" }[k] || k;
}

// ============================================================
// Task Node (recursive)
// ============================================================
function TaskNode({
  task,
  depth,
  maxDepth,
  addChildTask,
  updateTask,
  removeTask,
  toggleDone,
  cycleStatus,
  markTodayProgress,
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("detail"); // detail | log
  const [childInput, setChildInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [editingDetail, setEditingDetail] = useState(false);
  const [detailDraft, setDetailDraft] = useState(task.detail || "");

  const hasChildren = (task.children?.length || 0) > 0;
  const canAddChild = depth < maxDepth - 1;
  const todayMarked = (task.todayLog || []).includes(todayISO());

  const submitChild = () => {
    if (!childInput.trim()) return;
    addChildTask(task.id, childInput);
    setChildInput("");
    setAdding(false);
    setOpen(true);
  };

  return (
    <div className={`node node-d${depth}`}>
      <div className={`row row-${task.status}`}>
        <button
          className={"chk chk-" + task.status}
          onClick={() => cycleStatus(task.id)}
          title="상태 전환 (대기→진행→완료)"
        >
          {task.status === "done" ? <CheckIcon /> : task.status === "doing" ? <DotIcon /> : null}
        </button>
        <button
          className="row-main"
          onClick={() => setOpen((o) => !o)}
        >
          <span className={"title " + (task.status === "done" ? "title-done" : "")}>
            {editingTitle ? (
              <input
                autoFocus
                className="title-edit"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  updateTask(task.id, { title: titleDraft.trim() || task.title });
                  setEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.target.blur();
                  if (e.key === "Escape") {
                    setTitleDraft(task.title);
                    setEditingTitle(false);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingTitle(true);
                }}
              >
                {task.title}
              </span>
            )}
          </span>
          <span className="row-meta">
            {todayMarked && <span className="pin">오늘</span>}
            {hasChildren && (
              <span className="cnt">
                {task.children.filter((c) => c.status === "done").length}/
                {task.children.length}
              </span>
            )}
            <span className={"caret " + (open ? "caret-on" : "")}>
              <ChevronIcon />
            </span>
          </span>
        </button>
        <div className="row-actions">
          <IconBtn
            label="삭제"
            small
            onClick={() => {
              if (confirm(`"${task.title}" 삭제할까요?`)) removeTask(task.id);
            }}
          >
            <TrashIcon />
          </IconBtn>
        </div>
      </div>

      {open && (
        <div className="open">
          <div className="open-tabs">
            <button
              className={"otab " + (view === "detail" ? "otab-on" : "")}
              onClick={() => setView("detail")}
            >
              상세
            </button>
            <button
              className={"otab " + (view === "log" ? "otab-on" : "")}
              onClick={() => setView("log")}
            >
              진행로그 <span className="otab-n">{(task.todayLog || []).length}</span>
            </button>
            <div className="otab-sp" />
            <button
              className={"today-btn " + (todayMarked ? "today-on" : "")}
              onClick={() => markTodayProgress(task.id)}
              disabled={todayMarked}
              title="오늘 진행했음을 기록"
            >
              {todayMarked ? "✓ 오늘 기록됨" : "오늘 진행 기록"}
            </button>
          </div>

          {view === "detail" && (
            <div className="detail">
              {editingDetail ? (
                <React.Fragment>
                  <textarea
                    className="detail-edit"
                    value={detailDraft}
                    onChange={(e) => setDetailDraft(e.target.value)}
                    placeholder="마크다운으로 상세 내용 작성…"
                    autoFocus
                  />
                  <div className="detail-act">
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        setDetailDraft(task.detail || "");
                        setEditingDetail(false);
                      }}
                    >
                      취소
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        updateTask(task.id, { detail: detailDraft });
                        setEditingDetail(false);
                      }}
                    >
                      저장
                    </button>
                  </div>
                </React.Fragment>
              ) : (
                <div onClick={() => setEditingDetail(true)}>
                  {task.detail ? (
                    <div
                      className="md"
                      dangerouslySetInnerHTML={{
                        __html: marked.parse(task.detail),
                      }}
                    />
                  ) : (
                    <div className="md-empty">
                      <span>상세 내용 없음 — 클릭해서 마크다운으로 추가</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {view === "log" && (
            <div className="log">
              {(task.todayLog || []).length === 0 ? (
                <div className="md-empty">아직 진행 기록이 없어요</div>
              ) : (
                <ul className="log-list">
                  {task.todayLog
                    .slice()
                    .sort()
                    .reverse()
                    .map((d, i) => (
                      <li key={d + i} className="log-item">
                        <span className="log-dot" />
                        <span className="log-day">{formatDay(d)}</span>
                        <span className="log-date">{d}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}

          {/* Children */}
          {hasChildren && (
            <div className="children">
              {task.children.map((c) => (
                <TaskNode
                  key={c.id}
                  task={c}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                  addChildTask={addChildTask}
                  updateTask={updateTask}
                  removeTask={removeTask}
                  toggleDone={toggleDone}
                  cycleStatus={cycleStatus}
                  markTodayProgress={markTodayProgress}
                />
              ))}
            </div>
          )}

          {/* Add child */}
          {canAddChild && (
            <div className="add-child">
              {adding ? (
                <div className="add-child-form">
                  <input
                    autoFocus
                    className="add-child-in"
                    placeholder="하위 작업 제목"
                    value={childInput}
                    onChange={(e) => setChildInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitChild();
                      if (e.key === "Escape") {
                        setAdding(false);
                        setChildInput("");
                      }
                    }}
                  />
                  <button className="btn-primary btn-sm" onClick={submitChild}>
                    추가
                  </button>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      setAdding(false);
                      setChildInput("");
                    }}
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  className="add-child-btn"
                  onClick={() => setAdding(true)}
                >
                  <PlusIcon /> 하위 작업
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Schedules Pane
// ============================================================
function SchedulesPane({ schedules, addSchedule, updateSchedule, removeSchedule }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    start: todayISO() + "T09:00",
    end: todayISO() + "T10:00",
    detail: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  // group by day
  const grouped = useMemo(() => {
    const g = {};
    [...schedules]
      .sort((a, b) => a.start.localeCompare(b.start))
      .forEach((s) => {
        const day = s.start.slice(0, 10);
        (g[day] = g[day] || []).push(s);
      });
    return g;
  }, [schedules]);

  const submit = () => {
    if (!draft.title.trim()) return;
    addSchedule({ ...draft, id: newId(), title: draft.title.trim() });
    setDraft({
      title: "",
      start: todayISO() + "T09:00",
      end: todayISO() + "T10:00",
      detail: "",
    });
    setAdding(false);
  };

  return (
    <div className="pane">
      <div className="sch-head">
        <div className="sch-head-l">예정된 일정</div>
        <button
          className="btn-primary btn-sm"
          onClick={() => setAdding((a) => !a)}
        >
          {adding ? "취소" : "+ 일정 추가"}
        </button>
      </div>

      {adding && (
        <div className="sch-form">
          <input
            className="sch-in"
            placeholder="일정 제목"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            autoFocus
          />
          <div className="sch-row">
            <label className="sch-lbl">시작</label>
            <input
              type="datetime-local"
              className="sch-in sch-in-dt"
              value={draft.start}
              onChange={(e) => setDraft({ ...draft, start: e.target.value })}
            />
          </div>
          <div className="sch-row">
            <label className="sch-lbl">종료</label>
            <input
              type="datetime-local"
              className="sch-in sch-in-dt"
              value={draft.end}
              onChange={(e) => setDraft({ ...draft, end: e.target.value })}
            />
          </div>
          <textarea
            className="sch-in sch-ta"
            placeholder="세부 내용"
            value={draft.detail}
            onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
          />
          <div className="sch-act">
            <button className="btn-primary" onClick={submit}>
              저장
            </button>
          </div>
        </div>
      )}

      <div className="sch-list">
        {Object.keys(grouped).length === 0 ? (
          <EmptyState title="일정이 없어요" sub="‘+ 일정 추가’로 등록해보세요" />
        ) : (
          Object.entries(grouped).map(([day, items]) => (
            <div key={day} className="sch-group">
              <div className="sch-day">
                <span className="sch-day-l">{formatDay(day)}</span>
                <span className="sch-day-d">{day}</span>
                <span className="sch-day-n">{items.length}건</span>
              </div>
              {items.map((s) =>
                editingId === s.id ? (
                  <div key={s.id} className="sch-form sch-form-in">
                    <input
                      className="sch-in"
                      value={editDraft.title}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, title: e.target.value })
                      }
                    />
                    <div className="sch-row">
                      <label className="sch-lbl">시작</label>
                      <input
                        type="datetime-local"
                        className="sch-in sch-in-dt"
                        value={editDraft.start}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, start: e.target.value })
                        }
                      />
                    </div>
                    <div className="sch-row">
                      <label className="sch-lbl">종료</label>
                      <input
                        type="datetime-local"
                        className="sch-in sch-in-dt"
                        value={editDraft.end}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, end: e.target.value })
                        }
                      />
                    </div>
                    <textarea
                      className="sch-in sch-ta"
                      value={editDraft.detail}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, detail: e.target.value })
                      }
                    />
                    <div className="sch-act">
                      <button
                        className="btn-ghost"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft(null);
                        }}
                      >
                        취소
                      </button>
                      <button
                        className="btn-primary"
                        onClick={() => {
                          updateSchedule(s.id, editDraft);
                          setEditingId(null);
                          setEditDraft(null);
                        }}
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <ScheduleCard
                    key={s.id}
                    sched={s}
                    onEdit={() => {
                      setEditingId(s.id);
                      setEditDraft(s);
                    }}
                    onRemove={() => {
                      if (confirm(`"${s.title}" 삭제할까요?`)) removeSchedule(s.id);
                    }}
                  />
                )
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ScheduleCard({ sched, onEdit, onRemove }) {
  const [open, setOpen] = useState(false);
  const sameDayEnd = sched.start.slice(0, 10) === sched.end.slice(0, 10);
  return (
    <div className="sch-card">
      <button className="sch-card-top" onClick={() => setOpen((o) => !o)}>
        <div className="sch-card-time">
          <div className="sch-card-t1">{formatTime(sched.start)}</div>
          <div className="sch-card-t2">
            {sameDayEnd ? `~ ${formatTime(sched.end)}` : `~ ${formatDay(sched.end)} ${formatTime(sched.end)}`}
          </div>
        </div>
        <div className="sch-card-body">
          <div className="sch-card-title">{sched.title}</div>
          {!open && sched.detail && (
            <div className="sch-card-prev">{sched.detail.split("\n")[0]}</div>
          )}
        </div>
        <span className={"caret " + (open ? "caret-on" : "")}>
          <ChevronIcon />
        </span>
      </button>
      {open && (
        <div className="sch-card-open">
          {sched.detail && (
            <div className="sch-card-detail">{sched.detail}</div>
          )}
          <div className="sch-card-act">
            <button className="btn-ghost btn-sm" onClick={onEdit}>
              수정
            </button>
            <button className="btn-ghost btn-sm btn-danger" onClick={onRemove}>
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Small UI pieces
// ============================================================
function IconBtn({ children, label, onClick, small }) {
  return (
    <button
      className={"iconbtn " + (small ? "iconbtn-sm" : "")}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
function EmptyState({ title, sub }) {
  return (
    <div className="empty">
      <div className="empty-t">{title}</div>
      {sub && <div className="empty-s">{sub}</div>}
    </div>
  );
}

// ============================================================
// Icons (small inline SVG)
// ============================================================
const ChevronIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const DotIcon = () => (
  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="6" />
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);
const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const CollapseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M4 14h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const ExpandIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// ============================================================
// Mount
// ============================================================
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
