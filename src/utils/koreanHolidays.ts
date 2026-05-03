import type { Holiday } from '../types';

// =============================================
// 한국 공휴일 (빌트인)
// =============================================
//
// 양력 고정 공휴일은 매년 자동 반복(recurring_yearly=true)됩니다.
// 음력 기반 공휴일(설날·부처님오신날·추석 등)은 양력 변환이 필요해
// 연도별 표를 직접 명시합니다. 표는 2024 ~ 2030 까지 제공합니다.
//
// 사용자가 끄거나 색상을 바꾸지 못하는 빌트인 항목으로, DB 에는 저장되지
// 않고 캘린더에서만 매번 합쳐서 노출됩니다. 사용자 지정 휴일은 별도의
// holidays 테이블에서 관리됩니다.

interface FixedHoliday {
  month: number; // 1-12
  day: number;
  title: string;
}

interface DatedHoliday {
  date: string; // YYYY-MM-DD
  title: string;
}

const FIXED_KOREAN_HOLIDAYS: FixedHoliday[] = [
  { month: 1, day: 1, title: '신정' },
  { month: 3, day: 1, title: '삼일절' },
  { month: 5, day: 5, title: '어린이날' },
  { month: 6, day: 6, title: '현충일' },
  { month: 8, day: 15, title: '광복절' },
  { month: 10, day: 3, title: '개천절' },
  { month: 10, day: 9, title: '한글날' },
  { month: 12, day: 25, title: '성탄절' },
];

// 음력·관측 기반 공휴일을 미리 계산해 둔 표 (양력 기준).
// 부정확한 추정이 아닌 실제 달력 기준으로 채워 넣었습니다.
const LUNAR_KOREAN_HOLIDAYS: Record<number, DatedHoliday[]> = {
  2024: [
    { date: '2024-02-09', title: '설날 연휴' },
    { date: '2024-02-10', title: '설날' },
    { date: '2024-02-11', title: '설날 연휴' },
    { date: '2024-02-12', title: '대체공휴일(설날)' },
    { date: '2024-04-10', title: '국회의원선거일' },
    { date: '2024-05-15', title: '부처님오신날' },
    { date: '2024-05-06', title: '대체공휴일(어린이날)' },
    { date: '2024-09-16', title: '추석 연휴' },
    { date: '2024-09-17', title: '추석' },
    { date: '2024-09-18', title: '추석 연휴' },
  ],
  2025: [
    { date: '2025-01-28', title: '설날 연휴' },
    { date: '2025-01-29', title: '설날' },
    { date: '2025-01-30', title: '설날 연휴' },
    { date: '2025-05-05', title: '부처님오신날' }, // 어린이날과 겹침
    { date: '2025-10-05', title: '추석 연휴' },
    { date: '2025-10-06', title: '추석' },
    { date: '2025-10-07', title: '추석 연휴' },
    { date: '2025-10-08', title: '대체공휴일(추석)' },
  ],
  2026: [
    { date: '2026-02-16', title: '설날 연휴' },
    { date: '2026-02-17', title: '설날' },
    { date: '2026-02-18', title: '설날 연휴' },
    { date: '2026-05-24', title: '부처님오신날' },
    { date: '2026-05-25', title: '대체공휴일(부처님오신날)' },
    { date: '2026-09-24', title: '추석 연휴' },
    { date: '2026-09-25', title: '추석' },
    { date: '2026-09-26', title: '추석 연휴' },
  ],
  2027: [
    { date: '2027-02-06', title: '설날 연휴' },
    { date: '2027-02-07', title: '설날' },
    { date: '2027-02-08', title: '설날 연휴' },
    { date: '2027-02-09', title: '대체공휴일(설날)' },
    { date: '2027-05-13', title: '부처님오신날' },
    { date: '2027-09-14', title: '추석 연휴' },
    { date: '2027-09-15', title: '추석' },
    { date: '2027-09-16', title: '추석 연휴' },
  ],
  2028: [
    { date: '2028-01-26', title: '설날 연휴' },
    { date: '2028-01-27', title: '설날' },
    { date: '2028-01-28', title: '설날 연휴' },
    { date: '2028-05-02', title: '부처님오신날' },
    { date: '2028-10-02', title: '추석 연휴' },
    { date: '2028-10-03', title: '추석' }, // 개천절과 겹침
    { date: '2028-10-04', title: '추석 연휴' },
  ],
  2029: [
    { date: '2029-02-12', title: '설날 연휴' },
    { date: '2029-02-13', title: '설날' },
    { date: '2029-02-14', title: '설날 연휴' },
    { date: '2029-05-20', title: '부처님오신날' },
    { date: '2029-05-21', title: '대체공휴일(부처님오신날)' },
    { date: '2029-09-21', title: '추석 연휴' },
    { date: '2029-09-22', title: '추석' },
    { date: '2029-09-23', title: '추석 연휴' },
  ],
  2030: [
    { date: '2030-02-02', title: '설날 연휴' },
    { date: '2030-02-03', title: '설날' },
    { date: '2030-02-04', title: '설날 연휴' },
    { date: '2030-02-05', title: '대체공휴일(설날)' },
    { date: '2030-05-09', title: '부처님오신날' },
    { date: '2030-09-11', title: '추석 연휴' },
    { date: '2030-09-12', title: '추석' },
    { date: '2030-09-13', title: '추석 연휴' },
  ],
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function builtin(date: string, title: string): Holiday {
  return {
    id: `builtin-${date}-${title}`,
    user_id: '',
    date,
    title,
    type: 'holiday',
    recurring_yearly: false,
    color: null,
    created_at: '',
    updated_at: '',
    is_builtin: true,
  };
}

/**
 * 지정한 연도의 빌트인 한국 공휴일 목록을 반환합니다.
 * 양력 고정 공휴일과, LUNAR 표에 등록된 음력 기반 공휴일을 합칩니다.
 */
export function getKoreanHolidaysForYear(year: number): Holiday[] {
  const out: Holiday[] = [];
  for (const f of FIXED_KOREAN_HOLIDAYS) {
    out.push(builtin(`${year}-${pad(f.month)}-${pad(f.day)}`, f.title));
  }
  const lunar = LUNAR_KOREAN_HOLIDAYS[year];
  if (lunar) {
    for (const l of lunar) {
      out.push(builtin(l.date, l.title));
    }
  }
  return out;
}
