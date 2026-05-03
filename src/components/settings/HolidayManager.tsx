import { useState, useEffect } from 'react';
import { fetchHolidays, createHoliday, updateHoliday, deleteHoliday } from '../../lib/database';
import type { Holiday, HolidayType } from '../../types';

const TYPE_LABEL: Record<HolidayType, string> = {
  holiday: '휴일',
  anniversary: '기념일',
  birthday: '생일',
};

const TYPE_DEFAULT_COLOR: Record<HolidayType, string> = {
  holiday: '#ef4444',
  anniversary: '#8b5cf6',
  birthday: '#ec4899',
};

const TYPE_ORDER: HolidayType[] = ['holiday', 'anniversary', 'birthday'];

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HolidayManager() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  // 추가 폼 상태
  const [newDate, setNewDate] = useState(todayString());
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<HolidayType>('holiday');
  const [newRecurring, setNewRecurring] = useState(true);
  const [newColor, setNewColor] = useState(TYPE_DEFAULT_COLOR.holiday);

  // 편집 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<HolidayType>('holiday');
  const [editRecurring, setEditRecurring] = useState(true);
  const [editColor, setEditColor] = useState('');

  const load = async () => {
    try {
      const data = await fetchHolidays();
      setHolidays(data);
    } catch (err) {
      console.error('Failed to load holidays', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // 타입을 바꾸면 색상 기본값도 따라가도록 (사용자가 색상을 직접 만지기 전까지)
  const handleNewTypeChange = (t: HolidayType) => {
    if (newColor === TYPE_DEFAULT_COLOR[newType]) {
      setNewColor(TYPE_DEFAULT_COLOR[t]);
    }
    setNewType(t);
  };

  const handleAdd = async () => {
    if (!newTitle.trim() || !newDate) return;
    try {
      await createHoliday({
        date: newDate,
        title: newTitle.trim(),
        type: newType,
        recurring_yearly: newRecurring,
        color: newColor,
      });
      setNewTitle('');
      setNewDate(todayString());
      setNewType('holiday');
      setNewRecurring(true);
      setNewColor(TYPE_DEFAULT_COLOR.holiday);
      await load();
    } catch (err) {
      console.error('Failed to add holiday', err);
    }
  };

  const startEdit = (h: Holiday) => {
    setEditingId(h.id);
    setEditDate(h.date);
    setEditTitle(h.title);
    setEditType(h.type);
    setEditRecurring(h.recurring_yearly);
    setEditColor(h.color || TYPE_DEFAULT_COLOR[h.type]);
  };

  const handleUpdate = async () => {
    if (!editingId || !editTitle.trim() || !editDate) return;
    try {
      await updateHoliday(editingId, {
        date: editDate,
        title: editTitle.trim(),
        type: editType,
        recurring_yearly: editRecurring,
        color: editColor,
      });
      setEditingId(null);
      await load();
    } catch (err) {
      console.error('Failed to update holiday', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return;
    try {
      await deleteHoliday(id);
      await load();
    } catch (err) {
      console.error('Failed to delete holiday', err);
    }
  };

  if (loading) return <div>로딩 중...</div>;

  const sorted = [...holidays].sort((a, b) => {
    // 매년 반복은 (월·일) 기준, 단발성은 (날짜) 기준으로 정렬
    const aKey = a.recurring_yearly ? a.date.slice(5) : a.date;
    const bKey = b.recurring_yearly ? b.date.slice(5) : b.date;
    return aKey.localeCompare(bKey);
  });

  return (
    <div className="holiday-manager">
      <p className="settings-description" style={{ marginTop: 0, marginBottom: '12px' }}>
        한국 공휴일은 자동으로 표시됩니다. 여기서는 사용자 지정 휴일·기념일·생일을 추가합니다.
      </p>

      <div
        className="holiday-add"
        style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '6px' }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="date"
            className="input"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            style={{ flex: '1 1 140px' }}
          />
          <select
            className="input"
            value={newType}
            onChange={e => handleNewTypeChange(e.target.value as HolidayType)}
            style={{ flex: '0 0 100px' }}
          >
            {TYPE_ORDER.map(t => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
          <input
            type="color"
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          />
        </div>
        <input
          className="input"
          placeholder="제목 (예: 결혼기념일, OOO 생일)"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleAdd(); }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={newRecurring}
              onChange={e => setNewRecurring(e.target.checked)}
            />
            매년 반복
          </label>
          <button className="btn btn-primary btn-sm" onClick={handleAdd}>추가</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sorted.length === 0 ? (
          <p className="text-muted" style={{ fontSize: '14px' }}>등록된 항목이 없습니다.</p>
        ) : (
          sorted.map(h => (
            <div
              key={h.id}
              className="holiday-item"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', flexWrap: 'wrap' }}
            >
              {editingId === h.id ? (
                <>
                  <input
                    type="date"
                    className="input"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    style={{ flex: '1 1 140px' }}
                  />
                  <select
                    className="input"
                    value={editType}
                    onChange={e => setEditType(e.target.value as HolidayType)}
                    style={{ flex: '0 0 100px' }}
                  >
                    {TYPE_ORDER.map(t => (
                      <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                    ))}
                  </select>
                  <input
                    type="color"
                    value={editColor}
                    onChange={e => setEditColor(e.target.value)}
                    style={{ width: '32px', height: '32px', padding: '0', border: 'none', cursor: 'pointer' }}
                  />
                  <input
                    className="input"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    style={{ flex: '1 1 100%' }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                    <input
                      type="checkbox"
                      checked={editRecurring}
                      onChange={e => setEditRecurring(e.target.checked)}
                    />
                    매년 반복
                  </label>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                    <button className="btn btn-primary btn-sm" onClick={handleUpdate}>저장</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>취소</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: h.color || TYPE_DEFAULT_COLOR[h.type], flex: '0 0 auto' }} />
                  <span style={{ flex: '0 0 auto', fontSize: '0.85rem', color: 'var(--text-muted)', minWidth: '90px' }}>
                    {h.recurring_yearly ? h.date.slice(5).replace('-', '/') : h.date}
                  </span>
                  <span style={{ flex: '0 0 auto', fontSize: '0.75rem', padding: '2px 6px', background: 'var(--bg-primary)', borderRadius: '3px' }}>
                    {TYPE_LABEL[h.type]}
                  </span>
                  <span style={{ flex: 1, minWidth: '120px' }}>{h.title}</span>
                  {h.recurring_yearly && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>매년</span>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(h)}>수정</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(h.id)} style={{ color: 'var(--nord11)' }}>삭제</button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
