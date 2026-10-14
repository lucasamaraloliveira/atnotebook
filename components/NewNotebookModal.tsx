'use client';

import React, { useState } from 'react';
import { X, BookOpen, Plus } from 'lucide-react';

interface NewNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNotebook: (title: string, description: string, emoji: string) => void;
}

const EMOJI_OPTIONS = ['📓', '🏨', '🔬', '📊', '📚', '🏛️', '💼', '💡', '🎓', '📝', '⚡', '🛎️'];

export function NewNotebookModal({
  isOpen,
  onClose,
  onCreateNotebook,
}: NewNotebookModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📓');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreateNotebook(
      title.trim(),
      description.trim() || 'Caderno de estudo e pesquisa independente.',
      selectedEmoji
    );
    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/80">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-slate-900 dark:text-slate-100" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Criar Novo Caderno
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              Ícone
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`w-9 h-9 text-base rounded-lg border flex items-center justify-center transition-all ${
                    selectedEmoji === emoji
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 shadow-2xs font-bold scale-105'
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
              placeholder="Ex: Operações Recepção, Planejamento Q4..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Descrição do Propósito
            </label>
            <textarea
              rows={3}
              placeholder="Descreva o propósito deste caderno e os tipos de sessões e fontes que ele conterá..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition-colors shadow-2xs"
            >
              Criar Caderno
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
