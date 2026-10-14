'use client';

import React, { useState } from 'react';
import { NotebookSection } from '@/lib/types';
import { X, Check } from 'lucide-react';

interface SectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSection: (section: Omit<NotebookSection, 'id' | 'createdAt'>, existingId?: string) => void;
  sectionToEdit?: NotebookSection | null;
}

const SECTION_ICONS = [
  '📁', '🛎️', '🏨', '⚖️', '📊', '🔬', '📚', '💼',
  '🎓', '💬', '⚡', '🛡️', '📋', '🏷️', '📑', '💡',
];

const SECTION_COLORS = [
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#64748b', // Slate
];

export function SectionModal({
  isOpen,
  onClose,
  onSaveSection,
  sectionToEdit,
}: SectionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden transition-colors">
        <SectionFormContent
          key={sectionToEdit ? sectionToEdit.id : 'new'}
          onClose={onClose}
          onSaveSection={onSaveSection}
          sectionToEdit={sectionToEdit}
        />
      </div>
    </div>
  );
}

function SectionFormContent({
  onClose,
  onSaveSection,
  sectionToEdit,
}: {
  onClose: () => void;
  onSaveSection: (section: Omit<NotebookSection, 'id' | 'createdAt'>, existingId?: string) => void;
  sectionToEdit?: NotebookSection | null;
}) {
  const [name, setName] = useState(sectionToEdit?.name || '');
  const [icon, setIcon] = useState(sectionToEdit?.icon || '📁');
  const [description, setDescription] = useState(sectionToEdit?.description || '');
  const [color, setColor] = useState(sectionToEdit?.color || '#3b82f6');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSaveSection(
      {
        name: name.trim(),
        icon,
        description: description.trim() || undefined,
        color,
      },
      sectionToEdit?.id
    );
    onClose();
  };

  return (
    <>
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0 border border-slate-200/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800"
            style={{
              backgroundColor: `${color}18`,
              borderColor: `${color}40`,
            }}
          >
            <span>{icon}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {sectionToEdit ? 'Editar Seção' : 'Nova Seção Temática'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Organize fontes e diretrizes por tópico
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
            Nome da Seção *
          </label>
          <input
            type="text"
            required
            placeholder="Ex: Modalidade Recepção, Financeiro, Jurídico..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
            Ícone da Seção
          </label>
          <div className="grid grid-cols-8 gap-1.5">
            {SECTION_ICONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                className={`w-9 h-9 text-base rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                  icon === emoji
                    ? 'border-blue-600 bg-blue-50 dark:bg-slate-800 dark:border-blue-500 scale-105 shadow-2xs font-bold text-slate-900 dark:text-slate-100'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
            Cor de Identificação
          </label>
          <div className="flex items-center gap-2">
            {SECTION_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 rounded-full transition-transform flex items-center justify-center cursor-pointer ${
                  color === c ? 'scale-110 ring-2 ring-offset-2 ring-slate-900 dark:ring-slate-100 dark:ring-offset-slate-900' : 'hover:scale-105 opacity-90 hover:opacity-100'
                }`}
              >
                {color === c && <Check className="w-3.5 h-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
            Descrição do Propósito (Opcional)
          </label>
          <textarea
            rows={2}
            placeholder="Ex: Documentos normativos e fluxos operacionais de recepção..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sectionToEdit ? 'Atualizar Seção' : 'Criar Seção'}
          </button>
        </div>
      </form>
    </>
  );
}
