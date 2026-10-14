'use client';

import React from 'react';
import { NotebookSection } from '@/lib/types';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteSectionModalProps {
  isOpen: boolean;
  section: NotebookSection | null;
  sourcesCount: number;
  onClose: () => void;
  onConfirmDelete: (section: NotebookSection) => void;
}

export function DeleteSectionModal({
  isOpen,
  section,
  sourcesCount,
  onClose,
  onConfirmDelete,
}: DeleteSectionModalProps) {
  if (!isOpen || !section) return null;

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
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-rose-50/60 dark:bg-rose-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Excluir Seção Definitivamente?
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Confirmação de exclusão do agrupador temático
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Target Section Preview Card */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xl shrink-0 shadow-2xs"
              style={{
                backgroundColor: section.color ? `${section.color}18` : undefined,
                borderColor: section.color ? `${section.color}40` : undefined,
              }}
            >
              <span>{section.icon || '📁'}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {section.name}
              </h4>
              {section.description ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {section.description}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 dark:text-slate-500">Sem descrição adicional</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300">
                {sourcesCount} {sourcesCount === 1 ? 'fonte' : 'fontes'}
              </span>
            </div>
          </div>

          {/* Explanation Alert */}
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 leading-relaxed">
              <p className="font-semibold text-rose-950 dark:text-rose-100">
                {sourcesCount > 0 ? (
                  <>
                    Atenção: Ao excluir esta seção, todas as suas{' '}
                    <strong>
                      {sourcesCount} {sourcesCount === 1 ? 'fonte vinculada' : 'fontes vinculadas'}
                    </strong>{' '}
                    serão <strong>excluídas permanentemente</strong> do caderno.
                  </>
                ) : (
                  <>Esta seção não possui fontes vinculadas e será removida da lista.</>
                )}
              </p>
              <p className="text-[11px] text-rose-800/90 dark:text-rose-300">
                Você terá uma tolerância de <strong>10 segundos</strong> na notificação flutuante para{' '}
                <strong>desfazer</strong> a ação caso mude de ideia, restaurando a seção e suas fontes.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmDelete(section)}
            className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Excluir Seção {sourcesCount > 0 ? `e ${sourcesCount} ${sourcesCount === 1 ? 'Fonte' : 'Fontes'}` : ''}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
