모바일 환경에서 오늘의 할일, 히스토리, 달력 페이지에 있는 좌우 이동 화살표를 제거하고, 화면을 좌우로 스와이프하여 날짜와 달을 이동할 수 있도록 기능을 추가했습니다.

🎯 변경 사항:
- `useSwipe` 커스텀 훅 추가 (`src/hooks/useSwipe.ts`)
- `TodayPage`, `HistoryPage`, `CalendarPage`에 스와이프 제스처 이벤트 추가
- 스와이프에 따라 각각 전/후 날짜, 전/후 달로 이동하도록 처리
- 화면 너비가 767px 이하인 경우 화살표 버튼(`.date-navigator-btn`)을 숨기도록 `Pages.css` 수정
