'use client';

import React, { useState, useEffect } from 'react';
import { X, BookOpen, Check, Pencil } from 'lucide-react';
import { Notebook } from '@/lib/types';

interface EditNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  notebook: Notebook | null;
  onSaveNotebook: (
    id: string,
    updates: { title: string; description: string; emoji: string }
  ) => void;
}

const EMOJI_OPTIONS = ['📓', '🏨', '🔬', '📊', '📚', '🏛️', '💼', '💡', '🎓', '📝', '⚡', '🛎️', '📂', '🎯', '📌', '🧠'];

export function EditNotebookModal({
  isOpen,
  onClose,
  notebook,
  onSaveNotebook,
}: EditNotebookModalProps) {
  const [prevId, setPrevId] = useState(notebook?.id);
  const [title, setTitle] = useState(notebook?.title || '');
  const [description, setDescription] = useState(notebook?.description || '');
  const [selectedEmoji, setSelectedEmoji] = useState(notebook?.emoji || '📓');

  if (notebook && notebook.id !== prevId) {
    setPrevId(notebook.id);
    setTitle(notebook.title || '');
    setDescription(notebook.description || '');
    setSelectedEmoji(notebook.emoji || '📓');
  }

  if (!isOpen || !notebook) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSaveNotebook(notebook.id, {
      title: title.trim(),
      description: description.trim(),
      emoji: selectedEmoji,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/80">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Editar Nome e Detalhes do Caderno
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              Ícone do Caderno
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`w-9 h-9 text-base rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                    selectedEmoji === emoji
                      ? 'border-slate-900 dark:border-slate-100 bg-slate-100 dark:bg-slate-800 shadow-2xs font-bold scale-105'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Nome do Caderno *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Ex: Operações Recepção, Planejamento Q4..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-600"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Descrição do Propósito
            </label>
            <textarea
              rows={3}
              placeholder="Descreva o propósito deste caderno e suas fontes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-600 resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {notebook.sources.length} {notebook.sources.length === 1 ? 'fonte vinculada' : 'fontes vinculadas'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
