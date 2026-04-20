import { useState, useEffect } from 'react';
import { fetchCategories, createCategory, updateCategory, deleteCategory } from '../../lib/database';
import type { Category } from '../../types';

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6'); // Default color
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [loading, setLoading] = useState(true);

  const loadCategories = async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleAdd = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await createCategory(newCategoryName.trim(), newCategoryColor);
      setNewCategoryName('');
      await loadCategories();
    } catch (err) {
      console.error('Failed to add category', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 카테고리를 삭제하시겠습니까? 관련 할일의 카테고리는 초기화됩니다.')) return;
    try {
      await deleteCategory(id);
      await loadCategories();
    } catch (err) {
      console.error('Failed to delete category', err);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color || '#3b82f6');
  };

  const handleUpdate = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await updateCategory(editingId, { name: editName.trim(), color: editColor });
      setEditingId(null);
      await loadCategories();
    } catch (err) {
      console.error('Failed to update category', err);
    }
  };

  if (loading) return <div>로딩 중...</div>;

  return (
    <div className="category-manager">
      <div className="category-add" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="color"
          value={newCategoryColor}
          onChange={e => setNewCategoryColor(e.target.value)}
          style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        />
        <input
          className="input"
          placeholder="새 카테고리 이름"
          value={newCategoryName}
          onChange={e => setNewCategoryName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={handleAdd}>추가</button>
      </div>

      <div className="category-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {categories.length === 0 ? (
          <p className="text-muted" style={{ fontSize: '14px' }}>등록된 카테고리가 없습니다.</p>
        ) : (
          categories.map(cat => (
            <div key={cat.id} className="category-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
              {editingId === cat.id ? (
                <>
                  <input
                    type="color"
                    value={editColor}
                    onChange={e => setEditColor(e.target.value)}
                    style={{ width: '32px', height: '32px', padding: '0', border: 'none', cursor: 'pointer' }}
                  />
                  <input
                    className="input"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    style={{ flex: 1 }}
                    autoFocus
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleUpdate}>저장</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>취소</button>
                </>
              ) : (
                <>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: cat.color || '#ccc' }} />
                  <span style={{ flex: 1 }}>{cat.name}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(cat)}>수정</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(cat.id)} style={{ color: 'var(--nord11)' }}>삭제</button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
