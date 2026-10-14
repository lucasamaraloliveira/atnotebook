'use client';

import React, { useMemo, useState } from 'react';
import { NotebookSource, NotebookSection } from '@/lib/types';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  ExternalLink,
  CheckCircle2,
  FolderOpen,
  ArrowRight,
  Eye,
  Check,
} from 'lucide-react';

interface AuditDuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: NotebookSource[];
  sections: NotebookSection[];
  onDeleteSource: (sourceId: string) => void;
  onBatchDeleteSources?: (sourceIds: string[]) => void;
  onSelectSource?: (source: NotebookSource) => void;
}

interface DuplicateGroup {
  url: string;
  primary: NotebookSource;
  duplicates: NotebookSource[];
}

export function AuditDuplicatesModal({
  isOpen,
  onClose,
  sources,
  sections,
  onDeleteSource,
  onBatchDeleteSources,
  onSelectSource,
}: AuditDuplicatesModalProps) {
  const [confirmBatch, setConfirmBatch] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Helper to extract clean URL from originalOrigin
  const extractUrl = (origin?: string): string => {
    if (!origin) return '';
    return origin.replace(/^Mapeado via URL:\s*/i, '').trim();
  };

  // Group sources by exact URL
  const duplicateGroups: DuplicateGroup[] = useMemo(() => {
    const urlMap = new Map<string, NotebookSource[]>();

    sources.forEach((s) => {
      const url = extractUrl(s.originalOrigin);
      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) return;

      const list = urlMap.get(url) || [];
      list.push(s);
      urlMap.set(url, list);
    });

    const groups: DuplicateGroup[] = [];

    urlMap.forEach((list, url) => {
      if (list.length > 1) {
        // Sort chronologically: oldest is primary
        const sorted = [...list].sort((a, b) => {
          const dateA = new Date(a.migratedAt || 0).getTime();
          const dateB = new Date(b.migratedAt || 0).getTime();
          return dateA - dateB;
        });

        groups.push({
          url,
          primary: sorted[0],
          duplicates: sorted.slice(1),
        });
      }
    });

    return groups;
  }, [sources]);

  if (!isOpen) return null;

  // Calculate statistics
  const totalDuplicateItems = duplicateGroups.reduce(
    (acc, g) => acc + g.duplicates.length,
    0
  );
  const totalAnalyzedUrlSources = sources.filter((s) => {
    const u = extractUrl(s.originalOrigin);
    return u.startsWith('http://') || u.startsWith('https://');
  }).length;

  const getSectionInfo = (sectionId?: string) => {
    if (!sectionId) return 'Sem Seção (Geral)';
    const sec = sections.find((s) => s.id === sectionId);
    return sec ? `${sec.icon || '📁'} ${sec.name}` : 'Sem Seção';
  };

  const handleBatchDeleteAllDuplicates = () => {
    const allDuplicateIds: string[] = [];
    duplicateGroups.forEach((g) => {
      g.duplicates.forEach((d) => allDuplicateIds.push(d.id));
    });

    if (allDuplicateIds.length === 0) return;

    if (onBatchDeleteSources) {
      onBatchDeleteSources(allDuplicateIds);
    } else {
      allDuplicateIds.forEach((id) => onDeleteSource(id));
    }

    setConfirmBatch(false);
    setSuccessNotice(
      `${allDuplicateIds.length} link(s) duplicado(s) removido(s) com sucesso! Apenas as fontes originais foram mantidas.`
    );
    setTimeout(() => {
      setSuccessNotice(null);
    }, 4000);
  };

  const handleDeleteSingle = (duplicateId: string) => {
    onDeleteSource(duplicateId);
    setSuccessNotice('Fonte duplicada removida mantendo a original.');
    setTimeout(() => {
      setSuccessNotice(null);
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center shadow-xs shrink-0 ${
                totalDuplicateItems > 0
                  ? 'bg-amber-500 text-white'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {totalDuplicateItems > 0 ? (
                <ShieldAlert className="w-4.5 h-4.5" />
              ) : (
                <ShieldCheck className="w-4.5 h-4.5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Auditoria e Validação de Links no Caderno</span>
                {totalDuplicateItems > 0 ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-800">
                    {totalDuplicateItems} Duplicada(s) Encontrada(s)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800">
                    Base 100% Íntegra
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Varredura de todas as fontes para validar e eliminar duplicidades por URL exata.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Notification banner */}
          {successNotice && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-in fade-in duration-150">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs">
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Fontes com Link Analisadas
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                {totalAnalyzedUrlSources}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Grupos de Links Repetidos
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                {duplicateGroups.length}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Fontes Excedentes / Duplicadas
              </span>
              <span
                className={`text-sm font-semibold font-mono tabular-nums ${
                  totalDuplicateItems > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {totalDuplicateItems}
              </span>
            </div>
          </div>

          {/* Empty State: 100% Clean */}
          {duplicateGroups.length === 0 && (
            <div className="py-10 px-4 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Nenhum link repetido encontrado
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Todas as fontes cadastradas no caderno ativo possuem links únicos. A janela de contexto da IA está otimizada e livre de redundâncias.
                </p>
              </div>
            </div>
          )}

          {/* Duplicate Groups List */}
          {duplicateGroups.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Links com Múltiplas Ocorrências ({duplicateGroups.length})
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  A fonte original mais antiga é mantida por padrão
                </span>
              </div>

              {duplicateGroups.map((group, groupIndex) => (
                <div
                  key={groupIndex}
                  className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 shadow-2xs"
                >
                  {/* Group URL row */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                        URL:
                      </span>
                      <span
                        className="text-xs font-mono text-blue-600 dark:text-blue-400 truncate max-w-md"
                        title={group.url}
                      >
                        {group.url}
                      </span>
                    </div>
                    <a
                      href={group.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors shrink-0"
                      title="Abrir URL em nova aba"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Primary Item (Kept) */}
                  <div className="flex items-center justify-between gap-3 p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 rounded-lg">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800 shrink-0">
                          Original (Mantida)
                        </span>
                        <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                          {group.primary.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <span>{getSectionInfo(group.primary.sectionId)}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">
                          {group.primary.wordCount?.toLocaleString() || 0} palavras
                        </span>
                      </p>
                    </div>

                    {onSelectSource && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectSource(group.primary);
                          onClose();
                        }}
                        className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-800 rounded transition-colors shrink-0 cursor-pointer flex items-center gap-1"
                        title="Ver conteúdo integral"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Ver</span>
                      </button>
                    )}
                  </div>

                  {/* Duplicate Items (To be removed) */}
                  <div className="space-y-1.5 pl-2">
                    <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      Ocorrências Repetidas ({group.duplicates.length}):
                    </span>

                    {group.duplicates.map((dup) => (
                      <div
                        key={dup.id}
                        className="flex items-center justify-between gap-3 p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-lg"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <span className="text-xs font-normal text-slate-800 dark:text-slate-200 truncate block">
                            {dup.title}
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <span>{getSectionInfo(dup.sectionId)}</span>
                            <span>·</span>
                            <span className="text-amber-600 dark:text-amber-400">
                              Duplicata
                            </span>
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {onSelectSource && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectSource(dup);
                                onClose();
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer"
                              title="Inspecionar duplicata"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteSingle(dup.id)}
                            className="px-2.5 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded transition-colors flex items-center gap-1 cursor-pointer"
                            title="Remover apenas esta duplicata"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remover</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/70 shrink-0">
          <div>
            {totalDuplicateItems > 0 && !confirmBatch && (
              <button
                type="button"
                onClick={() => setConfirmBatch(true)}
                className="px-3.5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Todas as Repetidas ({totalDuplicateItems})</span>
              </button>
            )}

            {confirmBatch && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-700 dark:text-rose-300 font-semibold">
                  Confirmar exclusão de {totalDuplicateItems} duplicatas?
                </span>
                <button
                  type="button"
                  onClick={handleBatchDeleteAllDuplicates}
                  className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg cursor-pointer shadow-2xs"
                >
                  Sim, Excluir
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBatch(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            {totalDuplicateItems === 0 ? 'Concluir' : 'Fechar'}
          </button>
        </div>
      </div>
    </div>
  );
}
