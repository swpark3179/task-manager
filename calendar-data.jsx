/* global React */
// ============================================================
// Calendar data + utilities (shared by all variations)
// ============================================================
const { useState, useMemo, useEffect } = React;

// ---- Date helpers ----
const KOR_DOW = ["일", "월", "화", "수", "목", "금", "토"];

const pad2 = (n) => String(n).padStart(2, "0");
const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayISO = () => isoDay(new Date());
const dateFromISO = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// Returns 6 × 7 grid of Date objects, week start = Sunday
const monthGrid = (year, month /* 1-12 */) => {
  const first = new Date(year, month - 1, 1);
  const startOffset = first.getDay(); // 0=Sun
  const gridStart = addDays(first, -startOffset);
  const cells = [];
  for (let i = 0; i < 42; i++) cells.push(addDays(gridStart, i));
  return cells;
};

// Returns weeks for a given month grid (array of 6 weeks, each = 7 Date)
const monthWeeks = (year, month) => {
  const cells = monthGrid(year, month);
  const weeks = [];
  for (let i = 0; i < 6; i++) weeks.push(cells.slice(i * 7, i * 7 + 7));
  return weeks;
};

const formatHM = (hm) => {
  // hm = "HH:MM"
  if (!hm) return "";
  const [h, m] = hm.split(":").map(Number);
  const ap = h >= 12 ? "오후" : "오전";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${hh}:${pad2(m)}`;
};
const formatHMShort = (hm) => {
  if (!hm) return "";
  const [h, m] = hm.split(":").map(Number);
  return `${pad2(h)}:${pad2(m)}`;
};
const monthLabel = (y, m) => `${y}년 ${m}월`;

// ---- Demo data ----
// Single category model: 개인 / 회사 / 공휴일
const CATEGORIES = [
  { id: "personal", label: "개인",  color: "#51a36e", soft: "#e6f3eb", dark: "#2f6b46" },
  { id: "company",  label: "회사",  color: "#4f7cff", soft: "#e6edff", dark: "#2a4cba" },
  { id: "holiday",  label: "공휴일", color: "#c14040", soft: "#fbeaea", dark: "#8c2a2a" },
];
const catById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[1];

// Anchor the demo to the current month so it always feels live.
const buildDemoEvents = () => {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1; // 1-12
  const D = (day, hm) => `${y}-${pad2(m)}-${pad2(day)}${hm ? "T" + hm : ""}`;
  // Try to keep day numbers ≤28 so they exist in any month
  return [
    // ---- 회사 ----
    { id: "e1", cat: "company", title: "팀 위클리 스탠드업",
      start: D(2, "10:00"), end: D(2, "10:30"),
      detail: "스프린트 진행 공유 / 블로커 확인" },
    { id: "e2", cat: "company", title: "Q2 OKR 워크숍",
      start: D(5, "09:00"), end: D(7, "17:00"),
      detail: "외부 시설 / 3일 워크숍, 점심 제공" },
    { id: "e3", cat: "company", title: "디자인 리뷰",
      start: D(8, "14:30"), end: D(8, "15:30"),
      detail: "Calendar v2 시안 데모" },
    { id: "e4", cat: "company", title: "고객사 미팅 (Acme)",
      start: D(11, "11:00"), end: D(11, "12:30"),
      detail: "POC 결과 공유" },
    { id: "e5", cat: "company", title: "사내 해커톤",
      start: D(15, "09:00"), end: D(16, "18:00"),
      detail: "2일 / 본관 5층" },
    { id: "e6", cat: "company", title: "1:1 with 김PM",
      start: D(18, "16:00"), end: D(18, "16:30"), detail: "" },
    { id: "e7", cat: "company", title: "전사 타운홀",
      start: D(22, "15:00"), end: D(22, "16:30"),
      detail: "분기 결산 + Q&A" },
    { id: "e8", cat: "company", title: "코드 리뷰 슬롯",
      start: D(25, "13:00"), end: D(25, "14:00"), detail: "" },
    { id: "e15", cat: "company", title: "스프린트 회고",
      start: D(26, "16:00"), end: D(26, "17:00"), detail: "" },

    // ---- 개인 ----
    { id: "e9",  cat: "personal", title: "필라테스",
      start: D(3, "07:30"), end: D(3, "08:30"), detail: "강남점 6관" },
    { id: "e10", cat: "personal", title: "치과 정기검진",
      start: D(9, "18:00"), end: D(9, "18:45"), detail: "역삼 OO치과" },
    { id: "e11", cat: "personal", title: "주말 여행",
      start: D(13, "09:00"), end: D(14, "20:00"),
      detail: "강릉 1박 2일" },
    { id: "e12", cat: "personal", title: "가족 저녁",
      start: D(20, "19:00"), end: D(20, "21:00"), detail: "" },
    { id: "e13", cat: "personal", title: "독서 모임",
      start: D(24, "20:00"), end: D(24, "22:00"),
      detail: "이번 달 책: 디자인 시스템 인 프랙티스" },
    { id: "e14", cat: "personal", title: "러닝",
      start: D(27, "06:30"), end: D(27, "07:15"), detail: "한강 5km" },
    { id: "e16", cat: "personal", title: "필라테스",
      start: D(10, "07:30"), end: D(10, "08:30"), detail: "" },
    { id: "e17", cat: "personal", title: "필라테스",
      start: D(17, "07:30"), end: D(17, "08:30"), detail: "" },

    // ---- 공휴일 (sample, anchored to mid-month so visible) ----
    { id: "h1", cat: "holiday", title: "임시공휴일",
      start: D(19, ""), end: D(19, ""), allDay: true, detail: "" },
  ];
};

// ---- Event splitting / week-bar layout ----
// Splits a single event into per-day segments {dateISO, isStart, isEnd, ...}
const expandEvent = (evt) => {
  const startD = dateFromISO(evt.start.slice(0, 10));
  const endD = dateFromISO(evt.end.slice(0, 10));
  const out = [];
  let d = startD;
  while (d <= endD) {
    out.push({
      ...evt,
      dateISO: isoDay(d),
      isStart: sameDay(d, startD),
      isEnd: sameDay(d, endD),
      startHM: sameDay(d, startD) && evt.start.includes("T")
        ? evt.start.slice(11, 16) : null,
      endHM: sameDay(d, endD) && evt.end.includes("T")
        ? evt.end.slice(11, 16) : null,
    });
    d = addDays(d, 1);
  }
  return out;
};

// For each cell, returns events touching that day (sorted: multi-day first, then by start time)
const eventsByDay = (events) => {
  const map = new Map();
  for (const e of events) {
    for (const seg of expandEvent(e)) {
      const arr = map.get(seg.dateISO) || [];
      arr.push(seg);
      map.set(seg.dateISO, arr);
    }
  }
  // sort within each day
  for (const arr of map.values()) {
    arr.sort((a, b) => {
      const aSpan = (dateFromISO(a.end.slice(0, 10)) - dateFromISO(a.start.slice(0, 10)));
      const bSpan = (dateFromISO(b.end.slice(0, 10)) - dateFromISO(b.start.slice(0, 10)));
      if (aSpan !== bSpan) return bSpan - aSpan;
      return a.start.localeCompare(b.start);
    });
  }
  return map;
};

// Compute lane positions for events in a single week (B variation).
// Returns array of bars: { evt, startCol(0-6), endCol(0-6), lane(0..), isContL, isContR }
const weekLanes = (events, weekDates) => {
  const weekStartISO = isoDay(weekDates[0]);
  const weekEndISO = isoDay(weekDates[6]);
  // Find events that overlap week
  const intersecting = events
    .filter((e) => {
      const s = e.start.slice(0, 10);
      const en = e.end.slice(0, 10);
      return !(en < weekStartISO || s > weekEndISO);
    })
    .sort((a, b) => {
      // Longer events first, then by start
      const aSpan = (dateFromISO(a.end.slice(0, 10)) - dateFromISO(a.start.slice(0, 10)));
      const bSpan = (dateFromISO(b.end.slice(0, 10)) - dateFromISO(b.start.slice(0, 10)));
      if (aSpan !== bSpan) return bSpan - aSpan;
      return a.start.localeCompare(b.start);
    });

  const bars = [];
  const laneEnds = []; // for each lane, the col index it's free after

  for (const e of intersecting) {
    const sISO = e.start.slice(0, 10);
    const enISO = e.end.slice(0, 10);
    const startCol = Math.max(0, weekDates.findIndex((d) => isoDay(d) >= sISO));
    let endCol = weekDates.findIndex((d) => isoDay(d) >= enISO);
    if (endCol === -1) endCol = 6;
    if (isoDay(weekDates[endCol]) > enISO) endCol = Math.max(startCol, endCol);

    // find lane
    let lane = 0;
    while (laneEnds[lane] !== undefined && laneEnds[lane] >= startCol) lane++;
    laneEnds[lane] = endCol;

    bars.push({
      evt: e,
      startCol,
      endCol,
      lane,
      isContL: sISO < weekStartISO,
      isContR: enISO > weekEndISO,
    });
  }
  return bars;
};

// Korean holidays - simplified built-ins for the current year (for visual only).
const holidayMapForYear = (y) => {
  const fixed = [
    [1, 1, "신정"],
    [3, 1, "삼일절"],
    [5, 5, "어린이날"],
    [6, 6, "현충일"],
    [8, 15, "광복절"],
    [10, 3, "개천절"],
    [10, 9, "한글날"],
    [12, 25, "성탄절"],
  ];
  const map = {};
  for (const [m, d, name] of fixed) {
    map[`${y}-${pad2(m)}-${pad2(d)}`] = name;
  }
  return map;
};

// Expose globally for sibling Babel scripts
window.CalendarData = {
  KOR_DOW, pad2, isoDay, todayISO, dateFromISO, addDays, sameDay,
  monthGrid, monthWeeks, formatHM, formatHMShort, monthLabel,
  CATEGORIES, catById, buildDemoEvents, expandEvent, eventsByDay, weekLanes,
  holidayMapForYear,
};
