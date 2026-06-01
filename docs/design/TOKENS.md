# TOKENS.md — 통합 디자인 토큰 레퍼런스

모든 값은 `design_files/tokens.css`에 정의되어 있습니다. 화면/컴포넌트는 **이 변수만 참조**합니다(하드코딩 금지). 라이트가 `:root` 기본, 다크는 `[data-theme="dark"]`, 밀도는 `[data-density="compact"]` 오버라이드.

## 1. 표면 & 텍스트 (라이트 / 다크)
| 토큰 | 역할 | Light | Dark |
|---|---|---|---|
| `--bg` | 카드 표면 | `#ffffff` | `#1c2230` |
| `--bg-2` | 앱 배경 | `#f6f7f9` | `#161b26` |
| `--bg-3` | 칩/입력 채움 | `#eef0f4` | `#262d3b` |
| `--bg-4` | 호버 채움 | `#e6e9ef` | `#323a4a` |
| `--fg` | 본문 텍스트 | `#1c2230` | `#eceff4` |
| `--fg-2` | 보조 텍스트 | `#4a5366` | `#c8cedb` |
| `--fg-3` | 힌트/아이콘 | `#8a93a6` | `#8a93a6` |
| `--fg-4` | 흐린/비활성 | `#b5bcca` | `#5a6373` |
| `--border` | 헤어라인 | `#e6e9ef` | `#2c3340` |
| `--border-2` | 강조 경계 | `#d3d7e0` | `#3a4252` |
| `--scrim` | 오버레이 틴트 | `rgba(15,23,42,.04)` | `rgba(255,255,255,.05)` |

## 2. 브랜드 액센트
| 토큰 | Light | Dark | 용도 |
|---|---|---|---|
| `--accent` | `#4f7cff` | `#6b91ff` | 기본/포커스/CTA |
| `--accent-soft` | `#e6edff` | `rgba(107,145,255,.16)` | 선택 배경 |
| `--accent-dark` | `#2a4cba` | `#aac1ff` | soft 위 텍스트 |
| `--accent-fg` | `#ffffff` | `#0e1422` | 솔리드 액센트 위 텍스트 |

## 3. 작업 상태 4색 (액센트와 분리)
각 색은 `*-soft`(배경), `*-fg`(텍스트) 변형이 있음.
| 상태 | 토큰 | Light | soft / fg (Light) |
|---|---|---|---|
| 미수행 todo | `--todo` | `#b5bcca` | `#eef0f4` / `#5a6373` |
| 진행 doing | `--doing` | `#2f9bb0` (틸) | `#e2f3f6` / `#1d6b7a` |
| 완료 done | `--done` | `#51a36e` | `#e6f3eb` / `#2f6b46` |
| 폐기 discard | `--discard` | `#d97a2c` | `#fdf0e3` / `#a85b1c` |

> "진행 중"은 의도적으로 **틸**(액센트 블루와 분리)입니다. 액센트 = 강조 전용, 상태색 = 의미 전용.

## 4. 카테고리 & 경고
| 토큰 | Light | soft / dark |
|---|---|---|
| `--personal` (개인) | `#51a36e` | `#e6f3eb` / `#2f6b46` |
| `--company` (회사) | `#4f7cff` | `#e6edff` / `#2a4cba` |
| `--holiday` (공휴일) | `#c14040` | `#fbeaea` / `#8c2a2a` |
| `--warn` | `#d97a2c` | `#fdf0e3` |
| `--danger` | `#c14040` | `#fbeaea` |
| `--star` (즐겨찾기) | `#e8a93a` | `--star-soft` `#fbf0d8` |

특별한 날 배지 색: 휴일=`--holiday`, 기념일=`--warn` 계열, 생일=`#e06b9e`(핑크).

## 5. 타이포그래피
- 폰트: `--font-sans: "Pretendard", -apple-system, ...` / `--font-mono: "SF Mono", ui-monospace, ...`
- 스케일: `--text-xs 11.5px` · `--text-sm 12.5px` · `--text-base 13.5px`(compact 13px) · `--text-md 15px` · `--text-lg 17px` · `--text-xl 22px` · `--text-2xl 28px` · `--text-3xl 40px`
- 라인높이: `--lh-tight 1.2` · `--lh-snug 1.4` · `--lh-normal 1.6`
- 숫자: `font-feature-settings: 'tnum'` (표 정렬용 tabular numerals)

## 6. 간격 (4px 베이스)
`--space-1 4` · `--space-2 8` · `--space-3 12` · `--space-4 16` · `--space-5 24` · `--space-6 32` · `--space-7 48` (px)

## 7. 반경
`--r-xs 4` · `--r-sm 6` · `--r-md 10` · `--r-lg 14` · `--r-xl 18` · `--r-full 9999` (px)

## 8. 그림자 (다크에서 자동 재계산)
- `--shadow-1` 헤어라인+미세 그림자 (카드 기본)
- `--shadow-2` 부드러운 떠 있는 카드
- `--shadow-3` 모달/팝오버 큰 그림자

## 9. 모션
`--t-fast 150ms ease` · `--t-normal 250ms ease`

## 10. 밀도 (`[data-density="compact"]`)
| 토큰 | comfortable | compact |
|---|---|---|
| `--row-pad-y` | 9px | 5px |
| `--row-gap` | 10px | 6px |
| `--tab-pad-y` | 11px | 8px |
| `--chk-size` | 19px | 17px |
| `--card-pad` | 18px | 12px |
| `--text-base` | 13.5px | 13px |

## 베이스 컴포넌트 클래스 (tokens.css에 포함)
- `.ui-btn` + `--primary`/`--secondary`/`--ghost`/`--danger`/`--sm`
- `.ui-input` (포커스 시 액센트 링 `0 0 0 3px var(--accent-soft)`)
- `.ui-card` (반경 `--r-xl`, 그림자 `--shadow-2`)
- `.ui-badge` + `--todo`/`--doing`/`--done`/`--discard` (상태 뱃지)
- `.ui-chk` (상태 체크박스, `--chk-size`), `.ui-switch` (토글 44×24)
- `.ui-tabs` / `.ui-tab[aria-selected]` (밑줄 탭)

## 한글 안전 규칙 (tokens.css 기본값)
```css
body { word-break: keep-all; }
button, .ui-btn, .ui-tab, .ui-badge, .ui-pill, .ui-chip, label, th { white-space: nowrap; }
```
좁은 폭에서 "작업"·"추가" 등이 음절 단위로 깨지지 않도록 UI 크롬은 항상 `nowrap`.
