'use client';

import React from 'react';
import { NotebookSource } from '@/lib/types';
import { AlertTriangle, Trash2, X, FileText, Globe, Table, BookOpen } from 'lucide-react';

interface DeleteBatchSourcesModalProps {
  isOpen: boolean;
  selectedSources: NotebookSource[];
  onClose: () => void;
  onConfirmDelete: () => void;
}

export function DeleteBatchSourcesModal({
  isOpen,
  selectedSources,
  onClose,
  onConfirmDelete,
}: DeleteBatchSourcesModalProps) {
  if (!isOpen || selectedSources.length === 0) return null;

  const count = selectedSources.length;
  const maxPreview = 4;
  const previewSources = selectedSources.slice(0, maxPreview);
  const remainingCount = count - maxPreview;

  const getSourceIcon = (type: NotebookSource['type']) => {
    switch (type) {
      case 'web_article':
        return <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />;
      case 'table':
        return <Table className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
      case 'transcript':
        return <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 shrink-0" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden transition-all scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Danger Accent */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Excluir {count} {count === 1 ? 'fonte' : 'fontes'} em massa?
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Confirmação de exclusão permanente das fontes selecionadas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            Você está prestes a remover as seguintes {count} {count === 1 ? 'fonte selecionada' : 'fontes selecionadas'}:
          </p>

          {/* Selected Sources List Preview */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 rounded-xl">
            {previewSources.map((source) => (
              <div
                key={source.id}
                className="p-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/60 rounded-lg flex items-center gap-2 text-xs"
              >
                {getSourceIcon(source.type)}
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate flex-1">
                  {source.title}
                </span>
              </div>
            ))}

            {remainingCount > 0 && (
              <div className="p-1.5 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 italic">
                ...e mais {remainingCount} {remainingCount === 1 ? 'fonte selecionada' : 'fontes selecionadas'}
              </div>
            )}
          </div>

          {/* Warning Alert */}
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-semibold">
                Atenção: Esta ação não pode ser desfeita!
              </p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                Estas {count} fontes serão permanentemente desvinculadas das seções e removidas das consultas do Chat com IA.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmDelete}
            className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Sim, excluir {count} {count === 1 ? 'fonte' : 'fontes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
