/* global React */
// ============================================================
// Settings — 설정 화면 (Phase 4 + 관리 기능)
// 테마/밀도(tokens 연동) · 동기화 · 알림
// + 카테고리 추가/삭제 · 특별한 날(휴일/기념일/생일) 추가/수정/삭제
// ============================================================
const { useState: _useState } = React;

const _SWATCHES = ["#4f7cff", "#51a36e", "#2f9bb0", "#d97a2c", "#c14040", "#8b5cf6", "#e06b9e", "#8a93a6"];

const _SP_TYPES = [
  { id: "holiday",  label: "휴일",   color: "var(--holiday)", soft: "var(--holiday-soft)", fg: "var(--holiday-dark)" },
  { id: "anniv",    label: "기념일", color: "var(--warn)",    soft: "var(--warn-soft)",    fg: "#a85b1c" },
  { id: "birthday", label: "생일",   color: "#e06b9e",        soft: "rgba(224,107,158,.16)", fg: "#b03a72" },
];
const _spType = (id) => _SP_TYPES.find((t) => t.id === id) || _SP_TYPES[0];

function _todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function _fmtDate(iso, yearly) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return yearly ? `매년 ${m}월 ${d}일` : `${y}년 ${m}월 ${d}일`;
}

// ---- small controls ----
function Seg({ value, onChange, options }) {
  return (
    <div className="set-seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)} role="tab" aria-selected={value === o.value}>
          {o.ic ? <span className="ic">{o.ic}</span> : null}{o.label}
        </button>
      ))}
    </div>
  );
}
function Switch({ on, onToggle }) {
  return <button className="ui-switch" role="switch" aria-checked={on ? "true" : "false"} onClick={onToggle} />;
}
const SunIc = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8"/><path d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>);
const MoonIc = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>);
const TrashIc = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const PlusIc = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/></svg>);

// ---- Category add/edit modal ----
function CategoryModal({ initial, onClose, onSave, onDelete }) {
  const editing = !!initial;
  const [label, setLabel] = _useState(initial ? initial.label : "");
  const [color, setColor] = _useState(initial ? initial.color : _SWATCHES[0]);
  return (
    <div className="set-modal-wrap">
      <div className="set-modal-backdrop" onClick={onClose} />
      <div className="set-modal">
        <div className="set-modal-head">
          <span>{editing ? "카테고리 편집" : "카테고리 추가"}</span>
          <button className="set-modal-x" onClick={onClose} aria-label="닫기"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button>
        </div>
        <div className="set-modal-body">
          <input className="set-modal-input" placeholder="카테고리 이름" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
          <div className="set-modal-field">
            <label>색상</label>
            <div className="set-swatches">
              {_SWATCHES.map((c) => (
                <button key={c} className={`set-swatch ${color === c ? "on" : ""}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
              ))}
            </div>
          </div>
        </div>
        <div className="set-modal-foot">
          {editing
            ? <button className="set-modal-del" onClick={() => onDelete(initial.id)}>삭제</button>
            : <button className="set-modal-cancel" onClick={onClose}>취소</button>}
          <button className="set-modal-save" onClick={() => onSave({ id: initial ? initial.id : "c" + Math.random().toString(36).slice(2, 7), label: label.trim() || "새 카테고리", color })}>
            {editing ? "저장" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Special day add/edit modal (휴일/기념일/생일) ----
function SpecialModal({ initial, onClose, onSave, onDelete }) {
  const editing = !!initial;
  const [date, setDate] = _useState(initial ? initial.date : _todayISO());
  const [type, setType] = _useState(initial ? initial.type : "holiday");
  const [title, setTitle] = _useState(initial ? initial.title : "");
  const [yearly, setYearly] = _useState(initial ? !!initial.yearly : false);
  return (
    <div className="set-modal-wrap">
      <div className="set-modal-backdrop" onClick={onClose} />
      <div className="set-modal">
        <div className="set-modal-head">
          <span>{editing ? "특별한 날 편집" : "특별한 날 추가"}</span>
          <button className="set-modal-x" onClick={onClose} aria-label="닫기"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button>
        </div>
        <div className="set-modal-body">
          <div className="set-modal-field">
            <label>구분</label>
            <Seg value={type} onChange={setType} options={_SP_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
          </div>
          <input className="set-modal-input" placeholder="제목 (예: 어머니 생신)" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <div className="set-modal-field">
            <label>날짜</label>
            <input type="date" className="set-modal-date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="set-modal-field">
            <label>매년 반복</label>
            <Switch on={yearly} onToggle={() => setYearly((v) => !v)} />
          </div>
        </div>
        <div className="set-modal-foot">
          {editing
            ? <button className="set-modal-del" onClick={() => onDelete(initial.id)}>삭제</button>
            : <button className="set-modal-cancel" onClick={onClose}>취소</button>}
          <button className="set-modal-save" onClick={() => onSave({ id: initial ? initial.id : "s" + Math.random().toString(36).slice(2, 7), date, type, title: title.trim() || "(제목 없음)", yearly })}>
            {editing ? "저장" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Settings() {
  const [theme, setTheme] = _useState("light");
  const [density, setDensity] = _useState("comfortable");
  const [autoSync, setAutoSync] = _useState(true);
  const [interval, setInterval_] = _useState("15");
  const [syncing, setSyncing] = _useState(false);
  const [lastSync, setLastSync] = _useState("방금 전");
  const [evtNotify, setEvtNotify] = _useState(true);
  const [evtLead, setEvtLead] = _useState("10");
  const [dueNotify, setDueNotify] = _useState(true);
  const [weekStart, setWeekStart] = _useState("sun");

  const [cats, setCats] = _useState(() => {
    const base = window.CalendarData && window.CalendarData.CATEGORIES
      ? window.CalendarData.CATEGORIES.filter((c) => c.id !== "holiday").map((c) => ({ id: c.id, label: c.label, color: c.color }))
      : [{ id: "personal", label: "개인", color: "#51a36e" }, { id: "company", label: "회사", color: "#4f7cff" }];
    return base;
  });
  const [specials, setSpecials] = _useState(() => {
    const y = new Date().getFullYear(), m = String(new Date().getMonth() + 1).padStart(2, "0");
    return [
      { id: "s1", date: `${y}-01-01`, type: "holiday", title: "신정", yearly: true },
      { id: "s2", date: `${y}-${m}-12`, type: "birthday", title: "어머니 생신", yearly: true },
      { id: "s3", date: `${y}-${m}-17`, type: "anniv", title: "결혼기념일", yearly: true },
    ];
  });

  const [catModal, setCatModal] = _useState(null);     // { initial } | null  (initial undefined → add)
  const [spModal, setSpModal] = _useState(null);

  const doSync = () => { if (syncing) return; setSyncing(true); window.setTimeout(() => { setSyncing(false); setLastSync("방금 전"); }, 1100); };

  const sortedSpecials = [...specials].sort((a, b) => a.date.slice(5).localeCompare(b.date.slice(5)));

  return (
    <div className="set-root" data-theme={theme} data-density={density === "compact" ? "compact" : undefined}>
      <div className="set-inner">
        <div className="set-head">
          <h1>설정</h1>
          <p>화면·동기화·알림·카테고리를 관리합니다.</p>
        </div>

        {/* 화면 */}
        <div className="set-section">
          <div className="set-section-title">화면</div>
          <div className="set-card">
            <div className="set-row">
              <div className="set-row-l"><div className="t">테마</div><div className="d">라이트 / 다크 모드</div></div>
              <div className="set-row-c">
                <Seg value={theme} onChange={setTheme} options={[{ value: "light", label: "라이트", ic: <SunIc /> }, { value: "dark", label: "다크", ic: <MoonIc /> }]} />
              </div>
            </div>
            <div className="set-row">
              <div className="set-row-l"><div className="t">밀도</div><div className="d">목록 간격</div></div>
              <div className="set-row-c">
                <Seg value={density} onChange={setDensity} options={[{ value: "comfortable", label: "여유" }, { value: "compact", label: "조밀" }]} />
              </div>
            </div>
            <div className="set-row">
              <div className="set-row-l"><div className="t">주 시작 요일</div></div>
              <div className="set-row-c">
                <Seg value={weekStart} onChange={setWeekStart} options={[{ value: "sun", label: "일요일" }, { value: "mon", label: "월요일" }]} />
              </div>
            </div>
          </div>
        </div>

        {/* 동기화 */}
        <div className="set-section">
          <div className="set-section-title">동기화</div>
          <div className="set-card">
            <div className="set-row">
              <div className="set-row-l"><div className="t">자동 동기화</div><div className="d">백그라운드에서 주기적으로 동기화</div></div>
              <div className="set-row-c"><Switch on={autoSync} onToggle={() => setAutoSync((v) => !v)} /></div>
            </div>
            <div className={`set-row ${autoSync ? "" : "is-disabled"}`}>
              <div className="set-row-l"><div className="t">동기화 주기</div></div>
              <div className="set-row-c">
                <select className="set-select" value={interval} onChange={(e) => setInterval_(e.target.value)}>
                  <option value="5">5분마다</option><option value="15">15분마다</option><option value="60">1시간마다</option>
                </select>
              </div>
            </div>
            <div className="set-row">
              <div className="set-row-l"><div className="t">수동 동기화</div><div className="d">마지막 동기화 · {lastSync}</div></div>
              <div className="set-row-c"><button className="ui-btn ui-btn--secondary ui-btn--sm" onClick={doSync}>{syncing ? "동기화 중…" : "지금 동기화"}</button></div>
            </div>
          </div>
        </div>

        {/* 알림 */}
        <div className="set-section">
          <div className="set-section-title">알림</div>
          <div className="set-card">
            <div className="set-row">
              <div className="set-row-l"><div className="t">일정 시작 알림</div><div className="d">일정 시작 전 미리 알림</div></div>
              <div className="set-row-c">
                {evtNotify && (
                  <select className="set-select" value={evtLead} onChange={(e) => setEvtLead(e.target.value)}>
                    <option value="5">5분 전</option><option value="10">10분 전</option><option value="30">30분 전</option>
                  </select>
                )}
                <Switch on={evtNotify} onToggle={() => setEvtNotify((v) => !v)} />
              </div>
            </div>
            <div className="set-row">
              <div className="set-row-l"><div className="t">할일 마감 알림</div><div className="d">마감일 당일 아침 알림</div></div>
              <div className="set-row-c"><Switch on={dueNotify} onToggle={() => setDueNotify((v) => !v)} /></div>
            </div>
          </div>
        </div>

        {/* 카테고리 */}
        <div className="set-section">
          <div className="set-section-title">카테고리</div>
          <div className="set-card">
            {cats.map((c) => (
              <div key={c.id} className="set-row">
                <div className="set-row-c"><span className="set-cat-dot" style={{ background: c.color }} /></div>
                <div className="set-row-l"><div className="t">{c.label}</div></div>
                <div className="set-row-c">
                  <button className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setCatModal({ initial: c })}>편집</button>
                  <button className="set-icon-btn" aria-label="삭제" onClick={() => setCats((p) => p.filter((x) => x.id !== c.id))}><TrashIc /></button>
                </div>
              </div>
            ))}
            <button className="set-add-row" onClick={() => setCatModal({ initial: null })}><PlusIc /> 카테고리 추가</button>
          </div>
        </div>

        {/* 특별한 날 */}
        <div className="set-section">
          <div className="set-section-title">휴일 · 기념일 · 생일</div>
          <div className="set-card">
            {sortedSpecials.map((s) => {
              const t = _spType(s.type);
              return (
                <div key={s.id} className="set-row set-sp-row" onClick={() => setSpModal({ initial: s })}>
                  <div className="set-row-c"><span className="set-sp-badge" style={{ background: t.soft, color: t.fg }}>{t.label}</span></div>
                  <div className="set-row-l">
                    <div className="t">{s.title}</div>
                    <div className="d">{_fmtDate(s.date, s.yearly)}</div>
                  </div>
                  <div className="set-row-c">
                    <button className="set-icon-btn" aria-label="삭제" onClick={(e) => { e.stopPropagation(); setSpecials((p) => p.filter((x) => x.id !== s.id)); }}><TrashIc /></button>
                  </div>
                </div>
              );
            })}
            {sortedSpecials.length === 0 && <div className="set-empty">등록된 날이 없습니다</div>}
            <button className="set-add-row" onClick={() => setSpModal({ initial: null })}><PlusIc /> 추가</button>
          </div>
        </div>

        {/* 계정 */}
        <div className="set-section">
          <div className="set-section-title">계정</div>
          <div className="set-card">
            <div className="set-acct">
              <div className="set-acct-avatar">박</div>
              <div className="set-acct-info"><div className="n">박상우</div><div className="e">swpark@example.com</div></div>
              <button className="ui-btn ui-btn--ghost ui-btn--sm">프로필</button>
            </div>
            <div className="set-row">
              <div className="set-row-l"><div className="t">로그아웃</div></div>
              <div className="set-row-c"><button className="set-link">로그아웃</button></div>
            </div>
          </div>
        </div>

        <div className="set-meta">Task Manager · v2.1.0</div>
      </div>

      {catModal && (
        <CategoryModal
          initial={catModal.initial}
          onClose={() => setCatModal(null)}
          onSave={(cat) => { setCats((p) => (catModal.initial ? p.map((x) => (x.id === cat.id ? cat : x)) : [...p, cat])); setCatModal(null); }}
          onDelete={(id) => { setCats((p) => p.filter((x) => x.id !== id)); setCatModal(null); }}
        />
      )}
      {spModal && (
        <SpecialModal
          initial={spModal.initial}
          onClose={() => setSpModal(null)}
          onSave={(sp) => { setSpecials((p) => (spModal.initial ? p.map((x) => (x.id === sp.id ? sp : x)) : [...p, sp])); setSpModal(null); }}
          onDelete={(id) => { setSpecials((p) => p.filter((x) => x.id !== id)); setSpModal(null); }}
        />
      )}
    </div>
  );
}

window.Settings = Settings;
