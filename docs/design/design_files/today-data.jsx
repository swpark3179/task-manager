/* global React */
// ============================================================
// Sample data for Today page
// ============================================================
const _DT = window.CalendarData;

// Build a sample week (Sun..Sat) anchored to today
const _today = new Date();
const _todayISO = _DT.isoDay(_today);

function buildTodayDemoTasks() {
  // status: 'todo' | 'doing' | 'done' | 'discarded'
  return [
    {
      id: "t1",
      title: "Calendar UI 개편 PR 리뷰 반영",
      status: "doing",
      category: "company",
      detail: "리뷰어 코멘트 5건 처리 후 머지 요청\n• 카테고리 색상 토큰화\n• 모바일 헤더 wrap",
      lowPriority: false,
      favorite: true,
      registeredDate: _DT.addDays(_today, -2),
      children: [
        { id: "t1-1", title: "Lane 컴포넌트 분리", status: "done", category: "company", detail: "", children: [] },
        { id: "t1-2", title: "Agenda 뷰 키보드 네비", status: "doing", category: "company", detail: "Tab/Shift+Tab 이동", children: [] },
        { id: "t1-3", title: "Day 뷰 시간 그리드 정리", status: "todo", category: "company", detail: "", children: [] },
      ],
    },
    {
      id: "t2",
      title: "Q2 OKR 워크숍 자료 정리",
      status: "doing",
      category: "company",
      detail: "팀별 KR 통합 → 슬라이드 8장",
      lowPriority: false,
      children: [],
    },
    {
      id: "t3",
      title: "주간보고 작성",
      status: "todo",
      category: "company",
      detail: "",
      lowPriority: false,
      children: [],
    },
    {
      id: "t4",
      title: "디자인 시스템 v2 토큰 머지",
      status: "done",
      category: "company",
      detail: "완료. release/v2.1에 포함",
      lowPriority: false,
      favorite: true,
      completedDate: _today,
      children: [],
    },
    {
      id: "t5",
      title: "치과 예약 확정",
      status: "done",
      category: "personal",
      detail: "강남 OO치과 18:00",
      lowPriority: false,
      children: [],
    },
    {
      id: "t6",
      title: "필라테스 결제",
      status: "todo",
      category: "personal",
      detail: "",
      lowPriority: true,
      children: [],
    },
    {
      id: "t7",
      title: "사이드 프로젝트 노트 정리",
      status: "todo",
      category: "personal",
      detail: "",
      lowPriority: true,
      children: [],
    },
    {
      id: "t8",
      title: "(폐기) 영업팀 미팅 자료",
      status: "discarded",
      category: "company",
      detail: "취소됨",
      lowPriority: false,
      children: [],
    },
  ];
}

// Today's schedules
function buildTodayDemoSchedules() {
  const D = (hm) => _todayISO + (hm ? "T" + hm : "");
  return [
    { id: "s1", category: "company", title: "팀 위클리 스탠드업",
      start: D("10:00"), end: D("10:30"),
      detail: "스프린트 진행 공유 / 블로커 확인" },
    { id: "s2", category: "company", title: "Calendar v2 디자인 리뷰",
      start: D("14:30"), end: D("15:30"),
      detail: "신규 시안 PM/디자인팀 함께 확인" },
    { id: "s3", category: "company", title: "1:1 with 김PM",
      start: D("16:00"), end: D("16:30"),
      detail: "" },
    { id: "s4", category: "personal", title: "치과 정기검진",
      start: D("18:00"), end: D("18:45"),
      detail: "역삼 OO치과" },
  ];
}

// Today's events (D-day style — anniversaries / deadlines / milestones)
function buildTodayDemoEvents() {
  return [
    { id: "e1", title: "어머니 생신",            dateObj: _DT.addDays(_today, 2),  category: "personal", type: "기념일" },
    { id: "e2", title: "디자인 시스템 v2 릴리스", dateObj: _DT.addDays(_today, 4),  category: "company",  type: "마감" },
    { id: "e3", title: "전사 워크숍",            dateObj: _DT.addDays(_today, 9),  category: "company",  type: "이벤트" },
    { id: "e4", title: "정기 건강검진",          dateObj: _DT.addDays(_today, 18), category: "personal", type: "개인" },
    { id: "e5", title: "분기 실적 마감",          dateObj: _DT.addDays(_today, -1), category: "company",  type: "마감" },
  ];
}

// Weekly summary data (7 days around today)
function buildWeekSummary() {
  const start = _DT.addDays(_today, -_today.getDay()); // Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = _DT.addDays(start, i);
    const dISO = _DT.isoDay(d);
    // Synthetic counts
    const offsets = [
      { total: 3, completed: 3 },
      { total: 6, completed: 5 },
      { total: 5, completed: 2 },
      { total: 0, completed: 0 },   // empty
      { total: 7, completed: 4 },   // could be today
      { total: 4, completed: 0 },
      { total: 2, completed: 0 },
    ];
    return { date: dISO, dateObj: d, ...offsets[i] };
  });
}

function buildHolidays() {
  // For demo, occasionally show an entry
  // return [{ id: "h1", title: "임시공휴일", type: "holiday" }];
  return [];
}

window.TodayData = {
  buildTodayDemoTasks,
  buildTodayDemoSchedules,
  buildTodayDemoEvents,
  buildWeekSummary,
  buildHolidays,
  today: _today,
  todayISO: _todayISO,
};
