import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Trash2, Save, X, Tag } from 'lucide-react';
import { useTranslation } from '../../i18n';
import './Notes.css';

const CATEGORIES = [
  { id: 'personnel', color: '#3b82f6', labelKey: 'outils.catPersonal' },
  { id: 'travail', color: '#22c55e', labelKey: 'outils.catWork' },
  { id: 'idees', color: '#a855f7', labelKey: 'outils.catIdeas' },
  { id: 'urgent', color: '#ef4444', labelKey: 'outils.catUrgent' },
  { id: 'autre', color: '#6b7280', labelKey: 'outils.catOther' },
];

function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem('outils_notes') || '[]');
  } catch {
    return [];
  }
}

function saveNotes(notes) {
  localStorage.setItem('outils_notes', JSON.stringify(notes));
}

function Notes() {
  const { t } = useTranslation();
  const [notes, setNotes] = useState(loadNotes);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState(null);
  const [editing, setEditing] = useState(null); // note object or null
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Sauvegarder à chaque changement
  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  const filteredNotes = useMemo(() => {
    let result = notes;
    if (filterCategory) {
      result = result.filter(n => n.category === filterCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, search, filterCategory]);

  const handleNew = () => {
    setEditing({
      id: Date.now().toString(),
      title: '',
      content: '',
      category: 'personnel',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isNew: true,
    });
  };

  const handleEdit = (note) => {
    setEditing({ ...note, isNew: false });
  };

  const handleSave = () => {
    if (!editing || !editing.title.trim()) return;
    const noteData = {
      id: editing.id,
      title: editing.title.trim(),
      content: editing.content,
      category: editing.category,
      createdAt: editing.createdAt,
      updatedAt: Date.now(),
    };

    if (editing.isNew) {
      setNotes(prev => [noteData, ...prev]);
    } else {
      setNotes(prev => prev.map(n => n.id === noteData.id ? noteData : n));
    }
    setEditing(null);
  };

  const handleDelete = (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    setConfirmDelete(null);
    if (editing && editing.id === id) setEditing(null);
  };

  const getCategoryColor = (catId) => {
    return CATEGORIES.find(c => c.id === catId)?.color || '#6b7280';
  };

  return (
    <div className="notes-section">
      {/* Colonne gauche : recherche + filtres */}
      <div className="notes-left">
        <div className="notes-search">
          <Search size={18} />
          <input
            type="text"
            placeholder={t('outils.searchNotes')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="notes-filters">
          <button
            className={`notes-filter-btn ${!filterCategory ? 'active' : ''}`}
            onClick={() => setFilterCategory(null)}
          >
            {t('outils.allCategories')}
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`notes-filter-btn ${filterCategory === cat.id ? 'active' : ''}`}
              onClick={() => setFilterCategory(filterCategory === cat.id ? null : cat.id)}
              style={filterCategory === cat.id ? { background: cat.color, borderColor: cat.color } : {}}
            >
              <span className="filter-dot" style={{ background: cat.color }} />
              {t(cat.labelKey)}
            </button>
          ))}
        </div>

        <button className="notes-new-btn" onClick={handleNew}>
          <Plus size={20} />
          <span>{t('outils.newNote')}</span>
        </button>
      </div>

      {/* Colonne droite : liste ou éditeur */}
      <div className="notes-right">
        {editing ? (
          <div className="note-editor">
            <input
              className="note-editor-title"
              type="text"
              placeholder={t('outils.noteTitle')}
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              maxLength={100}
            />

            <div className="note-editor-category">
              <Tag size={16} />
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  className={`note-cat-btn ${editing.category === cat.id ? 'active' : ''}`}
                  style={editing.category === cat.id ? { background: cat.color, borderColor: cat.color, color: 'white' } : {}}
                  onClick={() => setEditing({ ...editing, category: cat.id })}
                >
                  {t(cat.labelKey)}
                </button>
              ))}
            </div>

            <textarea
              className="note-editor-content"
              placeholder={t('outils.noteContent')}
              value={editing.content}
              onChange={(e) => setEditing({ ...editing, content: e.target.value })}
            />

            <div className="note-editor-actions">
              <button className="note-action-btn cancel" onClick={() => setEditing(null)}>
                <X size={16} />
                {t('common.cancel')}
              </button>
              {!editing.isNew && (
                <button className="note-action-btn delete" onClick={() => setConfirmDelete(editing.id)}>
                  <Trash2 size={16} />
                  {t('common.delete')}
                </button>
              )}
              <button
                className="note-action-btn save"
                onClick={handleSave}
                disabled={!editing.title.trim()}
              >
                <Save size={16} />
                {t('common.save')}
              </button>
            </div>
          </div>
        ) : filteredNotes.length > 0 ? (
          <div className="notes-grid">
            {filteredNotes.map(note => (
              <div
                key={note.id}
                className="note-card"
                onClick={() => handleEdit(note)}
              >
                <div className="note-card-header">
                  <span className="note-card-title">{note.title}</span>
                  <span
                    className="note-card-badge"
                    style={{ background: getCategoryColor(note.category) }}
                  >
                    {t(CATEGORIES.find(c => c.id === note.category)?.labelKey || 'outils.catOther')}
                  </span>
                </div>
                <p className="note-card-content">{note.content}</p>
                <span className="note-card-date">
                  {new Date(note.updatedAt).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="notes-empty">
            <span className="notes-empty-icon">📝</span>
            <p>{t('outils.noNotes')}</p>
            <small>{t('outils.noNotesHint')}</small>
          </div>
        )}
      </div>

      {/* Modal confirmation suppression */}
      {confirmDelete && (
        <div className="notes-confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="notes-confirm-dialog" onClick={e => e.stopPropagation()}>
            <p>{t('outils.deleteNoteConfirm')}</p>
            <div className="notes-confirm-actions">
              <button className="notes-confirm-cancel" onClick={() => setConfirmDelete(null)}>
                {t('common.cancel')}
              </button>
              <button className="notes-confirm-yes" onClick={() => handleDelete(confirmDelete)}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Notes;
