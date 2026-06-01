# Handoff: Task Manager 디자인 개선 (통합 토큰 + 오늘·캘린더·설정)

## Overview
이 패키지는 **Task Manager** 앱의 디자인 개선 결과물입니다. 분열돼 있던 두 디자인 언어(프로덕션의 Nord 테마 / 프로토타입의 Dashboard 테마)를 **하나의 토큰 시스템**으로 통합하고, 그 위에 핵심 화면 5개를 다시 설계했습니다:

1. **Today (오늘의 할일)** — 히어로(날짜·주간·진행률) + 탭 카드(작업/일정/이벤트/나중에 할일)
2. **통합 캘린더 (데스크톱)** — 월간 레인바(B) + 선택일 사이드 어젠다(C)
3. **모바일 캘린더** — 풀스크린 월간 그리드 + 바텀시트 상세 + 기간선택/일정등록
4. **설정 (데스크톱)** — 테마·밀도·동기화·알림·카테고리·특별한 날 관리
5. **모바일 설정** — 위와 동일, 폰 프레임 + 네이티브 스크롤

## About the Design Files
이 번들의 파일은 **HTML로 만든 디자인 레퍼런스**입니다 — 최종 모양과 동작을 보여주는 프로토타입이며, 그대로 복사해 배포할 코드가 아닙니다. 프로토타입은 브라우저에서 바로 열리도록 **React 18 + Babel(in-browser) + 전역 `window.*` 컴포넌트** 방식으로 작성돼 있습니다.

**목표:** 이 디자인을 대상 저장소(`swpark3179/task-manager` — **Tauri v2 + React 19 + TypeScript + Vite**)의 기존 환경·패턴에 맞춰 **재구현**하는 것입니다. 즉:
- in-browser Babel/`window.*` 전역 패턴 → 정식 **`.tsx` 컴포넌트 + ES 모듈 import/export**로 옮깁니다.
- CSS는 그대로 가져다 쓸 수 있습니다(아래 "CSS 이식 전략" 참고). 클래스명 기반이라 기존 컴포넌트 CSS 컨벤션(`src/components/**/**.css`)에 잘 맞습니다.
- 목업 데이터(`*-data.jsx`, `buildDemo*`)는 실제 데이터 레이어(Supabase 등 기존 소스)로 교체합니다.

## Fidelity
**High-fidelity (hifi).** 최종 색·타이포·간격·반경·그림자·인터랙션이 모두 확정돼 있습니다. 픽셀 단위로 동일하게 재현하되, 값은 모두 **`tokens.css`의 CSS 변수**에서 나옵니다 — 하드코딩하지 말고 토큰을 단일 소스로 사용하세요. 상세 토큰표는 **`TOKENS.md`** 참고.

---

## CSS 이식 전략 (중요)
모든 스타일은 **CSS 커스텀 프로퍼티(토큰)** 위에 세워져 있습니다.

- **`tokens.css`** — 단일 소스. `:root`에 라이트 토큰, `[data-theme="dark"]`에 다크 오버라이드, `[data-density="compact"]`에 밀도 오버라이드. 베이스 컴포넌트(`.ui-btn`, `.ui-input`, `.ui-badge`, `.ui-chk`, `.ui-switch`, `.ui-tabs`)도 포함. **이 파일을 전역으로 1회 로드**하세요(기존 `src/index.css`를 대체/병합).
- 화면별 CSS(`calendar-styles.css`, `today-styles.css`, `settings-styles.css`)는 토큰 변수만 참조하므로 그대로 가져와 컴포넌트 스타일로 둘 수 있습니다.
- **테마 전환** = 루트(또는 임의 래퍼)의 `data-theme="dark"` 속성 토글. **밀도 전환** = `data-density="compact"`. JS는 이 속성만 바꾸면 됩니다.
- 폰트는 **Pretendard** 단일. 한글 안전을 위해 본문은 `word-break: keep-all`, UI 크롬(버튼/탭/뱃지/라벨)은 `white-space: nowrap`가 기본값으로 들어가 있습니다.

> 기존 프로덕션의 Nord 토큰(`--accent-primary`, `--text-primary`, `--nord*`)은 이 통합 토큰(`--accent`, `--fg`, `--bg` 등)으로 매핑/대체하세요. 다크 테마 값은 Nord 팔레트를 재활용해 `tokens.css`에 이미 들어 있습니다.

---

## Files (이 번들)
`design_files/` 안에 프로토타입과 의존 파일이 모두 들어 있습니다. 각 HTML을 브라우저에서 바로 열어 동작을 확인할 수 있습니다.

### 진입 HTML (화면)
| 파일 | 화면 |
|---|---|
| `Today.html` | 오늘의 할일 (데스크톱+모바일 캔버스, Tweaks로 단일/밀도 토글) |
| `통합 캘린더.html` | 캘린더 데스크톱 (B 레인바 + C 사이드 어젠다) |
| `모바일 캘린더.html` | 모바일 캘린더 (폰 프레임, 인터랙티브) |
| `설정.html` | 설정 데스크톱+모바일 캔버스 |
| `모바일 설정.html` | 모바일 설정 (폰 프레임, 네이티브 스크롤) |

### 공통 / 토큰
- `tokens.css` — **통합 토큰 + 베이스 컴포넌트** (최우선 이식 대상)

### 화면별 스타일
- `today-styles.css` — `td-*` (히어로/탭/태스크 행/일정 행/이벤트) + `tm-*`(편집·상세 모달) + `.md`(마크다운 렌더)
- `calendar-styles.css` — `cv-*`(데스크톱 캘린더) + `mcal2-*`/`mgrid`/`mweek`/`mcell`/`mbar`/`msheet`/`mpick`/`msm`(모바일 캘린더)
- `settings-styles.css` — `set-*` (설정 행/세그먼트/모달/스와치)

### 로직 (React, in-browser Babel — 재구현 대상)
- `calendar-data.jsx` — 날짜 유틸 + 카테고리/공휴일/일정/작업/특별한날 목업 + `weekLanes`/`eventsByDay`/`tasksByDay`/`specialsByDay` 등 헬퍼. **데이터 계산 로직은 그대로 이식 가치가 높음.**
- `today-data.jsx` — Today 화면 목업 데이터 빌더
- `today-app.jsx` — Hero, ScheduleList, EventList, TaskBody, TaskNode, TabbedCard, TodayPage
- `today-modals.jsx` — `mdToHtml`(경량 마크다운) + TaskEditModal / ScheduleEditModal / DetailView
- `calendar-unified.jsx` — 데스크톱 캘린더(MonthGrid + SideRail + 컨트롤러)
- `calendar-mobile.jsx` — 모바일 캘린더(필터/그리드/바텀시트/피커/기간선택/일정모달 + 제스처)
- `settings-app.jsx` — 설정 화면 + 카테고리/특별한날 모달
- `variation-a.jsx` — 캘린더 공용 `AppBar`/`SubBar`
- `design-canvas.jsx`, `tweaks-panel.jsx` — **프리뷰 전용 스캐폴드. 실제 앱에는 이식하지 마세요**(데스크톱/모바일을 나란히 보여주거나 토글하기 위한 도구일 뿐). 실제 앱에서는 각 화면을 라우트/뷰로 직접 렌더하면 됩니다.

자세한 화면별 명세는 **`SCREENS.md`**, 토큰 값은 **`TOKENS.md`** 를 참고하세요.

---

## 상위 정보 구조 / 데이터 모델

### Task (작업)
```ts
interface Task {
  id: string;
  title: string;
  status: "todo" | "doing" | "done" | "discarded";  // 대기/진행/완료/폐기
  category: string;            // 카테고리 id (예: "personal" | "company")
  detail: string;             // 마크다운 본문
  favorite: boolean;          // 즐겨찾기(별)
  lowPriority: boolean;       // true → "나중에 할일" 탭으로 분리
  children?: Task[];          // 하위 작업(트리). 부모 상태는 자식들로 자동 결정
  registeredDate?: Date;
  completedDate?: Date;
}
```
- 상태 순환: 체크박스 클릭 시 `todo → doing → done → todo` (폐기는 별도). 부모 노드는 클릭으로 직접 토글하지 않고 자식 완료수(`n/m`)를 표시.
- 트리/리스트 뷰 전환, 상태 필터(진행/대기/완료/폐기), 빠른 추가(Enter).

### Schedule (일정)
```ts
interface Schedule {
  id: string;
  title: string;
  category: string;
  start: string;  // ISO. 종일이면 "YYYY-MM-DD", 시간 있으면 "YYYY-MM-DDTHH:mm"
  end: string;    // 동일 규칙. start≠end(날짜) → 멀티데이(달력에서 막대)
  detail: string; // 마크다운
  alarm?: { on: boolean; mode: "before" | "at"; at: string; before: number };
}
```

### SpecialDay (휴일·기념일·생일) — 설정에서 관리
```ts
interface SpecialDay {
  id: string;
  date: string;                       // "YYYY-MM-DD"
  type: "holiday" | "anniv" | "birthday";  // 휴일 / 기념일 / 생일
  title: string;
  yearly: boolean;                    // 매년 반복
}
```

### Category (카테고리) — 설정에서 추가/삭제/편집
```ts
interface Category { id: string; label: string; color: string; }  // 기본: 개인(초록)/회사(파랑)
```

---

## 구현 순서 제안
1. **`tokens.css` 이식** — `src/index.css`를 통합 토큰으로 교체/병합. 라이트+다크+밀도 변수, 베이스 컴포넌트. 기존 Nord 변수는 새 토큰으로 매핑.
2. **공통 컴포넌트** — Button/Input/Badge/Checkbox/Switch/Tabs를 `.ui-*` 스펙대로 `.tsx`화.
3. **Today** → **캘린더(데스크톱/모바일)** → **설정** 순으로 화면 재구현.
4. 목업 데이터(`buildDemo*`)를 실제 데이터 레이어로 교체. 날짜/레인 계산 헬퍼(`calendar-data.jsx`)는 로직 그대로 이식.
5. 마크다운: 프로토타입은 의존성 없는 `mdToHtml`를 씀. 프로덕션에서는 기존/표준 마크다운 라이브러리로 교체 가능(렌더 결과 `.md` 클래스 스타일 재사용).

## Assets
- **폰트**: Pretendard (CDN: `cdn.jsdelivr.net/gh/orioncactus/pretendard`). 프로덕션에서는 self-host 권장.
- **아이콘**: 모두 인라인 SVG(외부 아이콘 라이브러리 없음). 그대로 사용하거나 코드베이스의 아이콘 세트로 치환.
- 이미지/래스터 에셋 없음.
- 이모지: 생일 표시에 🎂 1곳만 사용(`calendar-mobile.jsx`). 원치 않으면 SVG로 교체.
