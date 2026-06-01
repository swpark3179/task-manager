/* global React */
// ============================================================
// today-modals.jsx — 작업/일정 편집 & 상세보기 팝업 (Phase 4)
// + 경량 마크다운 렌더러 (의존성 없음)
// window.TaskEditModal / ScheduleEditModal / DetailView 로 노출
// ============================================================
(function () {
  const { useState } = React;
  const CD = window.CalendarData;
  const CATS = (CD && CD.CATEGORIES ? CD.CATEGORIES.filter((c) => c.id !== "holiday")
    : [{ id: "personal", label: "개인", color: "#51a36e" }, { id: "company", label: "회사", color: "#4f7cff" }]);
  const catColor = (id) => (CD && CD.catById ? CD.catById(id).color : "#4f7cff");

  // ---- tiny markdown → html ----
  function mdToHtml(src) {
    if (!src || !src.trim()) return "";
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const inline = (s) => esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const lines = src.replace(/\r\n/g, "\n").split("\n");
    let html = "", i = 0, listType = null;
    const closeList = () => { if (listType) { html += `</${listType}>`; listType = null; } };
    while (i < lines.length) {
      let ln = lines[i];
      if (/^```/.test(ln)) {
        closeList(); i++; let code = "";
        while (i < lines.length && !/^```/.test(lines[i])) { code += lines[i] + "\n"; i++; }
        i++; html += `<pre><code>${esc(code.replace(/\n$/, ""))}</code></pre>`; continue;
      }
      const h = ln.match(/^(#{1,4})\s+(.*)$/);
      if (h) { closeList(); const lv = h[1].length; html += `<h${lv}>${inline(h[2])}</h${lv}>`; i++; continue; }
      if (/^>\s?/.test(ln)) { closeList(); html += `<blockquote>${inline(ln.replace(/^>\s?/, ""))}</blockquote>`; i++; continue; }
      const ul = ln.match(/^[-*]\s+(.*)$/);
      const ol = ln.match(/^\d+\.\s+(.*)$/);
      if (ul) { if (listType !== "ul") { closeList(); html += "<ul>"; listType = "ul"; } html += `<li>${inline(ul[1])}</li>`; i++; continue; }
      if (ol) { if (listType !== "ol") { closeList(); html += "<ol>"; listType = "ol"; } html += `<li>${inline(ol[1])}</li>`; i++; continue; }
      if (/^(---|\*\*\*)\s*$/.test(ln)) { closeList(); html += "<hr/>"; i++; continue; }
      if (!ln.trim()) { closeList(); i++; continue; }
      closeList(); html += `<p>${inline(ln)}</p>`; i++;
    }
    closeList();
    return html;
  }

  // ---- shared controls ----
  function Seg({ value, onChange, options }) {
    return (
      <div className="tm-seg">
        {options.map((o) => (
          <button key={o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
            {o.dot ? <span className="dot" style={{ background: o.dot }} /> : null}{o.label}
          </button>
        ))}
      </div>
    );
  }
  function Switch({ on, onToggle }) {
    return <button className="ui-switch" role="switch" aria-checked={on ? "true" : "false"} onClick={onToggle} />;
  }
  function CatSeg({ value, onChange }) {
    return <Seg value={value} onChange={onChange} options={CATS.map((c) => ({ value: c.id, label: c.label, dot: c.color }))} />;
  }

  // ---- markdown editor field (작성 / 미리보기) ----
  function MarkdownField({ value, onChange }) {
    const [tab, setTab] = useState("write");
    return (
      <div className="tm-md">
        <div className="tm-md-tabs">
          <button className={tab === "write" ? "on" : ""} onClick={() => setTab("write")}>작성</button>
          <button className={tab === "preview" ? "on" : ""} onClick={() => setTab("preview")}>미리보기</button>
          <span className="tm-md-hint">{tab === "write" ? "마크다운 지원" : (value.trim() ? value.length + "자" : "내용 없음")}</span>
        </div>
        {tab === "write" ? (
          <textarea className="tm-md-editor" value={value} onChange={(e) => onChange(e.target.value)}
            placeholder={"# 제목\n\n- 항목\n- 항목\n\n**굵게** *기울임* `코드`\n\n> 인용"} spellCheck={false} />
        ) : (
          value.trim()
            ? <div className="tm-md-preview md" dangerouslySetInnerHTML={{ __html: mdToHtml(value) }} />
            : <div className="tm-md-blank">미리볼 내용이 없습니다</div>
        )}
      </div>
    );
  }

  // ---- modal shell ----
  function Shell({ title, onClose, children, foot }) {
    return (
      <div className="tm-wrap" role="dialog" aria-label={title}>
        <div className="tm-backdrop" onClick={onClose} />
        <div className="tm-modal">
          <div className="tm-head">
            <span>{title}</span>
            <button className="tm-x" onClick={onClose} aria-label="닫기"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button>
          </div>
          <div className="tm-body">{children}</div>
          <div className="tm-foot">{foot}</div>
        </div>
      </div>
    );
  }

  // ---- Task edit (메타데이터만 — 상세내용은 상세보기에서 별도 편집) ----
  function TaskEditModal({ task, onClose, onSave }) {
    const [title, setTitle] = useState(task.title || "");
    const [category, setCategory] = useState(task.category || "personal");
    const [later, setLater] = useState(!!task.lowPriority);
    return (
      <Shell title="작업 편집" onClose={onClose} foot={
        <React.Fragment>
          <button className="tm-cancel" onClick={onClose}>취소</button>
          <button className="tm-save" onClick={() => onSave({ ...task, title: title.trim() || task.title, category, lowPriority: later })}>저장</button>
        </React.Fragment>
      }>
        <input className="tm-input" placeholder="작업 이름" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <div className="tm-field"><label>카테고리</label><CatSeg value={category} onChange={setCategory} /></div>
        <div className="tm-field"><label>나중에 할일</label><Switch on={later} onToggle={() => setLater((v) => !v)} /></div>
        <div className="tm-hint-row">상세 내용은 ‘상세보기’에서 편집할 수 있어요.</div>
      </Shell>
    );
  }

  // ---- Schedule edit ----
  function ScheduleEditModal({ sched, onClose, onSave }) {
    const init = sched || {};
    const sIso = (init.start || "").slice(0, 10);
    const eIso = (init.end || init.start || "").slice(0, 10);
    const hasTimeInit = (init.start || "").includes("T");
    const [title, setTitle] = useState(init.title || "");
    const [category, setCategory] = useState(init.category || "company");
    const [startDate, setStartDate] = useState(sIso || _today());
    const [endDate, setEndDate] = useState(eIso || sIso || _today());
    const [hasTime, setHasTime] = useState(hasTimeInit);
    const [startTime, setStartTime] = useState(hasTimeInit ? init.start.slice(11, 16) : "10:00");
    const [endTime, setEndTime] = useState(hasTimeInit && (init.end || "").includes("T") ? init.end.slice(11, 16) : "11:00");
    const [alarmOn, setAlarmOn] = useState(!!(init.alarm && init.alarm.on));
    const [alarmMode, setAlarmMode] = useState(init.alarm ? init.alarm.mode || "before" : "before");
    const [alarmAt, setAlarmAt] = useState(init.alarm ? init.alarm.at || "09:00" : "09:00");
    const [alarmBefore, setAlarmBefore] = useState(init.alarm ? String(init.alarm.before || "10") : "10");

    function _today() { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }

    const save = () => {
      const start = hasTime ? `${startDate}T${startTime}` : startDate;
      const end = hasTime ? `${endDate}T${endTime}` : endDate;
      const alarm = { on: alarmOn, mode: alarmMode, at: alarmAt, before: Number(alarmBefore) };
      onSave({ ...init, id: init.id || "s" + Math.random().toString(36).slice(2, 7), title: title.trim() || "(제목 없음)", category, start, end, alarm });
    };

    return (
      <Shell title={sched ? "일정 편집" : "일정 등록"} onClose={onClose} foot={
        <React.Fragment>
          <button className="tm-cancel" onClick={onClose}>취소</button>
          <button className="tm-save" onClick={save}>저장</button>
        </React.Fragment>
      }>
        <input className="tm-input" placeholder="일정 제목" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <div className="tm-field"><label>카테고리</label><CatSeg value={category} onChange={setCategory} /></div>
        <div className="tm-field"><label>시작일</label><input type="date" className="tm-date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div className="tm-field"><label>종료일</label><input type="date" className="tm-date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        <div className="tm-field"><label>예정 시간</label><Switch on={hasTime} onToggle={() => setHasTime((v) => !v)} /><span className="tm-opt">선택</span></div>
        {hasTime && (
          <div className="tm-field tm-field-indent">
            <div className="tm-time"><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /><span>~</span><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
        )}
        <div className="tm-field"><label>알림</label><Switch on={alarmOn} onToggle={() => setAlarmOn((v) => !v)} /></div>
        {alarmOn && (
          <div className="tm-field tm-field-indent tm-field-col">
            <Seg value={alarmMode} onChange={setAlarmMode} options={[{ value: "before", label: "예정시간 전" }, { value: "at", label: "특정 시각" }]} />
            {alarmMode === "before" ? (
              <select className="tm-select" value={alarmBefore} onChange={(e) => setAlarmBefore(e.target.value)} disabled={!hasTime}>
                <option value="5">5분 전</option><option value="10">10분 전</option><option value="30">30분 전</option><option value="60">1시간 전</option>
              </select>
            ) : (
              <input type="time" className="tm-time-single" value={alarmAt} onChange={(e) => setAlarmAt(e.target.value)} />
            )}
            {alarmMode === "before" && !hasTime && <span className="tm-warn">예정 시간을 먼저 설정하세요</span>}
          </div>
        )}
        <div className="tm-hint-row">상세 내용은 ‘상세보기’에서 편집할 수 있어요.</div>
      </Shell>
    );
  }

  // ---- Detail view (read + 별도 마크다운 편집) ----
  function DetailView({ kind, item, onClose, onSaveDetail }) {
    const isTask = kind === "task";
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(item.detail || "");
    const cat = CATS.find((c) => c.id === item.category);
    let when = "";
    if (!isTask) {
      const sd = (item.start || "").slice(0, 10), ed = (item.end || "").slice(0, 10);
      const t = (item.start || "").includes("T") ? ` ${item.start.slice(11, 16)}${(item.end || "").includes("T") ? "~" + item.end.slice(11, 16) : ""}` : " 종일";
      when = sd === ed ? `${sd}${t}` : `${sd} ~ ${ed}`;
    }
    const foot = editing ? (
      <React.Fragment>
        <button className="tm-cancel" onClick={() => { setDraft(item.detail || ""); setEditing(false); }}>취소</button>
        <button className="tm-save" onClick={() => { onSaveDetail && onSaveDetail(draft); setEditing(false); }}>저장</button>
      </React.Fragment>
    ) : (
      <React.Fragment>
        <button className="tm-cancel" onClick={onClose}>닫기</button>
        <button className="tm-save" onClick={() => { setDraft(item.detail || ""); setEditing(true); }}>상세 편집</button>
      </React.Fragment>
    );
    return (
      <Shell title={isTask ? "작업 상세" : "일정 상세"} onClose={onClose} foot={foot}>
        <div className="tm-dv-title">{item.title}</div>
        <div className="tm-dv-meta">
          {cat && <span className="tm-dv-cat" style={{ background: catColor(item.category) }} />}
          {cat && <span>{cat.label}</span>}
          {when && <span className="tm-dv-when">· {when}</span>}
          {isTask && item.lowPriority && <span className="tm-dv-low">나중에 할일</span>}
        </div>
        <div className="tm-dv-detail">
          {editing ? (
            <MarkdownField value={draft} onChange={setDraft} />
          ) : (item.detail && item.detail.trim()
            ? <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(item.detail) }} />
            : <div className="tm-md-blank">상세 내용이 없습니다 — ‘상세 편집’으로 추가하세요</div>)}
        </div>
      </Shell>
    );
  }

  window.mdToHtml = mdToHtml;
  window.TaskEditModal = TaskEditModal;
  window.ScheduleEditModal = ScheduleEditModal;
  window.DetailView = DetailView;
})();
