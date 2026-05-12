/* global React, ReactDOM, CalendarData */
// ============================================================
// App entry — hosts the three variations on a design canvas
// ============================================================
const { useState, useMemo, useEffect } = React;
const _D = window.CalendarData;

function CalendarHost({ Variation, label }) {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [viewMode, setViewMode] = useState("month");
  const [hidden, setHidden] = useState(new Set());
  const events = useMemo(() => _D.buildDemoEvents(), []);

  const onPrev = () => {
    let y = year, m = month - 1;
    if (m < 1) { m = 12; y -= 1; }
    setYear(y); setMonth(m);
  };
  const onNext = () => {
    let y = year, m = month + 1;
    if (m > 12) { m = 1; y += 1; }
    setYear(y); setMonth(m);
  };
  const onToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  };
  const onPick = (catId) => {
    if (!catId) return;
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };

  return (
    <Variation
      year={year}
      month={month}
      today={today}
      events={events}
      hidden={hidden}
      onPrev={onPrev}
      onNext={onNext}
      onToday={onToday}
      onPick={onPick}
      viewMode={viewMode}
      setViewMode={setViewMode}
    />
  );
}

function App() {
  const tweaksDefaults = /*EDITMODE-BEGIN*/{
    "view": "focus",
    "focus": "B",
    "density": "comfy",
    "weekStart": "sun"
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(tweaksDefaults);

  const variations = [
    { id: "A", label: "A · Clean Chips", sub: "보수적 — 대시보드 톤 1:1, 셀당 색 칩", Comp: window.VariationA },
    { id: "B", label: "B · Lane Bars",   sub: "균형 — 다일정 막대 + 종일 칩, 가장 친숙",        Comp: window.VariationB },
    { id: "C", label: "C · Focus + Agenda", sub: "과감 — 셀은 요약만, 우측 상세 패널",      Comp: window.VariationC },
  ];

  const single = variations.find((v) => v.id === t.focus) || variations[0];

  // Tweaks panel
  const tweaksUI = (
    <TweaksPanel title="Tweaks">
      <TweakSection title="레이아웃">
        <TweakRadio
          label="보기"
          value={t.view}
          options={[
            { value: "canvas", label: "3안 비교" },
            { value: "focus",  label: "단일" },
          ]}
          onChange={(v) => setTweak("view", v)}
        />
        {t.view === "focus" && (
          <TweakRadio
            label="시안"
            value={t.focus}
            options={[
              { value: "A", label: "A" },
              { value: "B", label: "B" },
              { value: "C", label: "C" },
            ]}
            onChange={(v) => setTweak("focus", v)}
          />
        )}
      </TweakSection>
    </TweaksPanel>
  );

  // ----- Single (focus) view -----
  if (t.view === "focus") {
    const Comp = single.Comp;
    return (
      <React.Fragment>
        <div className="cv-page" style={{
          padding: "24px 24px 32px",
          minHeight: "100vh",
          background: "var(--bg-2)",
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            marginBottom: 14,
            maxWidth: 1400,
            margin: "0 auto 14px",
            width: "100%",
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
              {single.label}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg-3)" }}>{single.sub}</div>
          </div>
          <div style={{
            flex: 1,
            minHeight: 720,
            maxWidth: 1400,
            margin: "0 auto",
            width: "100%",
          }}>
            <CalendarHost Variation={Comp} label={single.label} />
          </div>
        </div>
        {tweaksUI}
      </React.Fragment>
    );
  }

  // ----- Design canvas (compare) -----
  return (
    <React.Fragment>
      <DesignCanvas>
        <DCSection
          id="month-views"
          title="월(Month) 뷰"
          subtitle="동일 데이터(이번 달, 17개 일정 · 개인/회사/공휴일) — 시안별 정보 표현 방식만 다름"
        >
          {variations.map((v) => (
            <DCArtboard
              key={v.id}
              id={"ab-" + v.id}
              label={v.label + " — " + v.sub}
              width={v.id === "C" ? 1200 : 880}
              height={760}
            >
              <CalendarHost Variation={v.Comp} label={v.label} />
            </DCArtboard>
          ))}
        </DCSection>

        <DCSection
          id="mobile"
          title="모바일 — 반응형"
          subtitle="동일 시안을 좁은 폭(390px)에서 확인"
        >
          {variations.map((v) => (
            <DCArtboard
              key={"m-" + v.id}
              id={"ab-m-" + v.id}
              label={v.label + " · Mobile (390 × 720)"}
              width={390}
              height={720}
            >
              <CalendarHost Variation={v.Comp} label={v.label} />
            </DCArtboard>
          ))}
        </DCSection>
      </DesignCanvas>
      {tweaksUI}
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
