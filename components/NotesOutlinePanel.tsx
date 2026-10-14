'use client';

import React, { useState } from 'react';
import {
  Notebook,
  NotebookNote,
  NotebookSection,
  UserRole,
} from '@/lib/types';
import { formatDisplayDate } from '@/lib/utils';
import {
  Bookmark,
  Plus,
  Trash2,
  BookOpen,
  FolderOpen,
  ShieldAlert,
  Sparkles,
  Layers,
  ShieldCheck,
  FileText,
  Clock,
  Eye,
  Lock,
  PanelRightClose,
} from 'lucide-react';

interface NotesOutlinePanelProps {
  notebook: Notebook;
  userRole: UserRole;
  onAddNote: (title: string, content: string, sectionId?: string) => void;
  onDeleteNote: (id: string) => void;
  onConvertNoteToSource: (note: NotebookNote) => void;
  onSelectSectionFilter?: (sectionId: string | null) => void;
  activeSectionFilter?: string | null;
  onOpenSectionModal: () => void;
  onOpenAddSource?: (sectionId?: string) => void;
  onCollapseEntirePanel?: () => void;
}

export function NotesOutlinePanel({
  notebook,
  userRole,
  onAddNote,
  onDeleteNote,
  onConvertNoteToSource,
  onSelectSectionFilter,
  activeSectionFilter,
  onOpenSectionModal,
  onOpenAddSource,
  onCollapseEntirePanel,
}: NotesOutlinePanelProps) {
  const [activeTab, setActiveTab] = useState<'notes' | 'outline'>('notes');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newSectionId, setNewSectionId] = useState<string>('');

  const isReadOnly = userRole === 'viewer';

  const handleCreateNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    onAddNote(
      newTitle.trim() || 'Nova Anotação',
      newContent.trim(),
      newSectionId || undefined
    );
    setNewTitle('');
    setNewContent('');
    setIsAddingNote(false);
  };

  const totalTokens = notebook.sources
    .filter((s) => s.enabled)
    .reduce((sum, s) => sum + s.estimatedTokens, 0);

  return (
    <div className="flex flex-col h-full bg-slate-50/70 dark:bg-slate-900/60 border-l border-slate-200 dark:border-slate-800 transition-colors">
      {/* Header Tabs */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1.5">
        <div className="flex-1 flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg min-w-0">
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 sm:px-3 text-xs font-medium rounded-md transition-all truncate ${
              activeTab === 'notes'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">Anotações</span>
            <span className="text-[10px] text-slate-400">({notebook.notes.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('outline')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 sm:px-3 text-xs font-medium rounded-md transition-all truncate ${
              activeTab === 'outline'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate">Sessões</span>
          </button>
        </div>

        {onCollapseEntirePanel && (
          <button
            type="button"
            onClick={onCollapseEntirePanel}
            title="Ocultar painel de anotações inteiro"
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <PanelRightClose className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
        )}
      </div>

      {/* Role Banner if viewer */}
      {isReadOnly && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/60 flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
          <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="leading-tight">
            Modo Leitor: visualização e perguntas liberadas. Edição requer aprovação.
          </span>
        </div>
      )}

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'notes' ? (
          /* Notes Tab */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Bloco de Rascunhos ({notebook.notes.length})
              </span>
              {!isReadOnly && (
                <button
                  onClick={() => setIsAddingNote(!isAddingNote)}
                  className="text-xs font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Nota</span>
                </button>
              )}
            </div>

            {isAddingNote && !isReadOnly && (
              <form
                onSubmit={handleCreateNoteSubmit}
                className="p-3.5 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2.5 shadow-2xs"
              >
                <input
                  type="text"
                  placeholder="Título da anotação..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs font-semibold px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-hidden"
                />

                {/* Section selection for note */}
                {notebook.sections.length > 0 && (
                  <select
                    value={newSectionId}
                    onChange={(e) => setNewSectionId(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 focus:outline-hidden"
                  >
                    <option value="">Sem Seção / Geral</option>
                    {notebook.sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.icon} {sec.name}
                      </option>
                    ))}
                  </select>
                )}

                <textarea
                  required
                  placeholder="Escreva sua reflexão, insight ou conclusão..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={4}
                  className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-hidden resize-none"
                />

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingNote(false)}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-3 py-1.5 rounded-md"
                  >
                    Salvar Nota
                  </button>
                </div>
              </form>
            )}

            {notebook.notes.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-900/40 space-y-2">
                <Bookmark className="w-5 h-5 text-slate-400 mx-auto" />
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Nenhuma anotação salva ainda
                </p>
                <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto">
                  Você pode criar notas manuais ou salvar qualquer resposta do chat com 1 clique.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notebook.notes.map((note) => {
                  const sec = notebook.sections.find((s) => s.id === note.sectionId);
                  return (
                    <div
                      key={note.id}
                      className="p-3.5 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {note.title}
                          </h4>
                          {sec && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border mt-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700"
                              style={{
                                borderColor: sec.color ? `${sec.color}40` : undefined,
                              }}
                            >
                              <span>{sec.icon}</span>
                              <span>{sec.name}</span>
                            </span>
                          )}
                        </div>

                        {!isReadOnly && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onConvertNoteToSource(note)}
                              title="Converter nota em nova fonte do caderno"
                              className="p-1 text-slate-400 hover:text-amber-700 rounded text-[10px] font-medium hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                              <span className="hidden sm:inline">Virar Fonte</span>
                            </button>
                            <button
                              onClick={() => onDeleteNote(note.id)}
                              title="Excluir nota"
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {note.content}
                      </p>

                      <span
                        className="text-[10px] text-slate-400 block pt-1 border-t border-slate-100 dark:border-slate-700/60"
                        suppressHydrationWarning
                      >
                        {formatDisplayDate(note.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Outline & Sessions Tab */
          <div className="space-y-4">
            <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 text-xs">
              <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                Métricas do Caderno
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <span className="block text-[10px] text-slate-400">Total de Fontes</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {notebook.sources.length}
                  </span>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <span className="block text-[10px] text-slate-400">Tokens Ativos</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    ~{totalTokens.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Seções Criadas ({notebook.sections.length})
                </span>
                {!isReadOnly && (
                  <button
                    onClick={onOpenSectionModal}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nova Seção</span>
                  </button>
                )}
              </div>

              {notebook.sections.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-900/40 space-y-2">
                  <FolderOpen className="w-5 h-5 text-slate-400 mx-auto" />
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Nenhuma seção criada
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Crie seções como &quot;Modalidade Recepção&quot; para organizar suas fontes em pastas.
                  </p>
                  {!isReadOnly && (
                    <button
                      onClick={onOpenSectionModal}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Criar primeira seção
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {/* All sources filter */}
                  <button
                    onClick={() => onSelectSectionFilter?.(null)}
                    className={`w-full p-2.5 rounded-lg border text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      activeSectionFilter === null
                        ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 font-semibold text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">📚</span>
                      <span>Todas as Seções</span>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {notebook.sources.length} fontes
                    </span>
                  </button>

                  {notebook.sections.map((sec) => {
                    const count = notebook.sources.filter((s) => s.sectionId === sec.id).length;
                    const isSelected = activeSectionFilter === sec.id;
                    return (
                      <div key={sec.id} className="flex items-center gap-1.5">
                        <button
                          onClick={() => onSelectSectionFilter?.(sec.id)}
                          className={`flex-1 p-2.5 rounded-lg border text-left text-xs flex items-center justify-between transition-colors cursor-pointer min-w-0 ${
                            isSelected
                              ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 font-semibold text-slate-900 dark:text-slate-100 shadow-2xs'
                              : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0 border border-slate-200/70 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800"
                              style={{
                                backgroundColor: sec.color ? `${sec.color}15` : undefined,
                                borderColor: sec.color ? `${sec.color}35` : undefined,
                              }}
                            >
                              <span>{sec.icon}</span>
                            </div>
                            <span className="truncate">{sec.name}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 ml-1">
                            {count} fonte{count !== 1 ? 's' : ''}
                          </span>
                        </button>
                        {onOpenAddSource && !isReadOnly && (
                          <button
                            type="button"
                            onClick={() => onOpenAddSource(sec.id)}
                            title={`Incluir fonte na seção "${sec.name}"`}
                            className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer shrink-0 shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
