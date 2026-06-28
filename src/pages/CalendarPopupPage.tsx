import { useEffect } from 'react';
import CalendarPage from './CalendarPage';

// 대시보드의 달력 아이콘으로 여는 독립 팝업 창. 사이드바 같은 앱 크롬 없이
// 달력만 전체 높이로 보여 주어 "잠깐 달력 현황만 확인"하는 용도에 맞춘다.
export default function CalendarPopupPage() {
  useEffect(() => {
    document.title = '달력';
  }, []);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
      }}
    >
      <CalendarPage />
    </div>
  );
}
