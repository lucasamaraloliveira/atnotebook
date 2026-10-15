'use client';

import React, { useState } from 'react';
import { NotebookSource, NotebookSection, UserRole } from '@/lib/types';
import { DeleteBatchSourcesModal } from './DeleteBatchSourcesModal';
import {
  FileText,
  Plus,
  ArrowRightLeft,
  Search,
  CheckCircle2,
  Layers,
  CheckSquare,
  Square,
  ExternalLink,
  Trash2,
  Edit3,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  PanelLeftClose,
  LayoutGrid,
  ListTree,
  FolderOpen,
  Globe,
  Table,
  BookOpen,
  MoveRight,
  Check,
} from 'lucide-react';

interface SourcesPanelProps {
  sources: NotebookSource[];
  sections: NotebookSection[];
  userRole?: UserRole;
  onOpenAddSource: (sectionId?: string) => void;
  onOpenSmartCrawl?: () => void;
  onOpenMigration: () => void;
  onOpenGoogleDrive?: () => void;
  onSelectSource: (source: NotebookSource) => void;
  onToggleSource: (id: string) => void;
  onToggleAllSources: (enable: boolean) => void;
  onDeleteSource: (id: string) => void;
  onBatchDeleteSources?: (sourceIds: string[]) => void;
  onOpenSectionModal: () => void;
  onEditSection: (section: NotebookSection) => void;
  onDeleteSection: (section: NotebookSection) => void;
  onMoveSourceToSection: (sourceId: string, sectionId?: string) => void;
  onBatchMoveSourcesToSection?: (sourceIds: string[], sectionId?: string) => void;
  onToggleSectionSources?: (sectionId: string, enable: boolean) => void;
  onOpenAuditDuplicates?: () => void;
  onCollapseEntirePanel?: () => void;
}

export function SourcesPanel({
  sources,
  sections,
  userRole = 'owner',
  onOpenAddSource,
  onOpenSmartCrawl,
  onOpenMigration,
  onSelectSource,
  onToggleSource,
  onToggleAllSources,
  onDeleteSource,
  onBatchDeleteSources,
  onOpenSectionModal,
  onEditSection,
  onDeleteSection,
  onMoveSourceToSection,
  onBatchMoveSourcesToSection,
  onToggleSectionSources,
  onOpenAuditDuplicates,
  onCollapseEntirePanel,
}: SourcesPanelProps) {
  const [search, setSearch] = useState('');
  // View mode switcher: 'iconsOnly' (Disposição 1: NotebookLM) vs 'linked' (Disposição 2: com fontes vinculadas)
  const [viewMode, setViewMode] = useState<'iconsOnly' | 'linked'>('iconsOnly');
  // In 'iconsOnly' mode, which section is currently expanded/selected
  const [selectedSectionInIconMode, setSelectedSectionInIconMode] = useState<string | null>(null);
  // In 'linked' mode, collapsed sections set
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  // Drag and drop state
  const [draggedSourceId, setDraggedSourceId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  // Source move dropdown active ID
  const [activeMoveSourceId, setActiveMoveSourceId] = useState<string | null>(null);

  // Multi-Selection & Batch Operations State
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [isBatchModeActive, setIsBatchModeActive] = useState<boolean>(false);
  const [batchTargetSectionId, setBatchTargetSectionId] = useState<string>('');
  const [batchSuccessNotice, setBatchSuccessNotice] = useState<string | null>(null);
  const [isDeleteBatchModalOpen, setIsDeleteBatchModalOpen] = useState<boolean>(false);

  const isReadOnly = userRole === 'viewer';
  const activeCount = sources.filter((s) => s.enabled).length;
  const verifiedCount = sources.filter((s) => s.verified).length;

  // Real-time calculation of duplicate link occurrences in current notebook
  const existingDuplicatesCount = React.useMemo(() => {
    const urlMap = new Map<string, number>();
    sources.forEach((s) => {
      if (!s.originalOrigin) return;
      const clean = s.originalOrigin.replace(/^Mapeado via URL:\s*/i, '').trim();
      if (clean.startsWith('http://') || clean.startsWith('https://')) {
        urlMap.set(clean, (urlMap.get(clean) || 0) + 1);
      }
    });
    let duplicates = 0;
    urlMap.forEach((count) => {
      if (count > 1) {
        duplicates += count - 1;
      }
    });
    return duplicates;
  }, [sources]);

  // Selected sources for preview in modal
  const selectedSourcesList = sources.filter((s) => selectedSourceIds.has(s.id));

  // Filter sources by search text
  const filteredSources = sources.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      s.title.toLowerCase().includes(q) ||
      s.content.toLowerCase().includes(q) ||
      (s.originalOrigin && s.originalOrigin.toLowerCase().includes(q));
    return matchesSearch;
  });

  // Batch Selection Handlers
  const handleToggleBatchSelect = (sourceId: string) => {
    if (isReadOnly) return;
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const handleToggleSelectAllForBatch = () => {
    if (isReadOnly) return;
    if (selectedSourceIds.size === filteredSources.length) {
      setSelectedSourceIds(new Set());
    } else {
      setSelectedSourceIds(new Set(filteredSources.map((s) => s.id)));
    }
  };

  const handleApplyBatchMove = () => {
    if (selectedSourceIds.size === 0 || !batchTargetSectionId || isReadOnly) return;
    const idsArray = Array.from(selectedSourceIds);
    const targetSecId = batchTargetSectionId === 'none' ? undefined : batchTargetSectionId;

    if (onBatchMoveSourcesToSection) {
      onBatchMoveSourcesToSection(idsArray, targetSecId);
    } else {
      idsArray.forEach((id) => onMoveSourceToSection(id, targetSecId));
    }

    const targetSec = sections.find((s) => s.id === targetSecId);
    const targetName = targetSec ? `"${targetSec.name}"` : '"Geral / Sem Seção"';
    setBatchSuccessNotice(
      `${idsArray.length} ${idsArray.length === 1 ? 'fonte vinculada' : 'fontes vinculadas'} com sucesso à seção ${targetName}!`
    );

    setSelectedSourceIds(new Set());
    setBatchTargetSectionId('');
    setIsBatchModeActive(false);
    setTimeout(() => setBatchSuccessNotice(null), 3500);
  };

  const handleApplyBatchDelete = () => {
    if (selectedSourceIds.size === 0 || isReadOnly) return;
    const idsArray = Array.from(selectedSourceIds);
    const count = idsArray.length;

    if (onBatchDeleteSources) {
      onBatchDeleteSources(idsArray);
    } else {
      idsArray.forEach((id) => onDeleteSource(id));
    }

    setBatchSuccessNotice(
      `${count} ${count === 1 ? 'fonte excluída' : 'fontes excluídas'} com sucesso!`
    );

    setSelectedSourceIds(new Set());
    setIsBatchModeActive(false);
    setIsDeleteBatchModalOpen(false);
    setTimeout(() => setBatchSuccessNotice(null), 3500);
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, sourceId: string) => {
    if (isReadOnly) return;
    setDraggedSourceId(sourceId);
    e.dataTransfer.setData('text/plain', sourceId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedSourceId(null);
    setDragOverTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, sectionId: string) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTarget !== sectionId) {
      setDragOverTarget(sectionId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, sectionId: string) => {
    if (dragOverTarget === sectionId) {
      setDragOverTarget(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetSectionId?: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedSourceId;
    if (sourceId && !isReadOnly) {
      onMoveSourceToSection(sourceId, targetSectionId);
    }
    setDraggedSourceId(null);
    setDragOverTarget(null);
  };

  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Group sources by section
  const sourcesBySection: { [sectionId: string]: NotebookSource[] } = {};
  sections.forEach((sec) => {
    sourcesBySection[sec.id] = filteredSources.filter((s) => s.sectionId === sec.id);
  });
  const unsectionedSources = filteredSources.filter(
    (s) => !s.sectionId || !sections.some((sec) => sec.id === s.sectionId)
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/60 dark:bg-slate-950/60 border-r border-slate-200 dark:border-slate-800 transition-colors">
      {/* Panel Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-white/70 dark:bg-slate-900/80 backdrop-blur-xs">
        {/* Top Row: Title in a single line, elevated, clean and uncluttered */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight whitespace-nowrap">
              Fontes & Seções
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
              ({sources.length})
            </span>
          </div>

          {onCollapseEntirePanel && (
            <button
              type="button"
              onClick={onCollapseEntirePanel}
              className="hidden md:inline-flex p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer shrink-0"
              title="Ocultar painel de fontes"
              aria-label="Ocultar painel de fontes"
            >
              <PanelLeftClose className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </button>
          )}
        </div>

        {/* Action Toolbar (Below title, balanced and clean without mismatched proportions) */}
        {!isReadOnly && (
          <div className="flex items-center justify-between gap-1 p-1 bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-lg overflow-x-auto no-scrollbar">

            <button
              type="button"
              onClick={() => onOpenAddSource()}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-2xs transition-all cursor-pointer whitespace-nowrap"
              title="Adicionar nova fonte manual (arquivo, texto ou link)"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Fonte</span>
            </button>

            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-0.5" />

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onOpenSectionModal}
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                title="Criar nova seção temática"
                aria-label="Criar nova seção temática"
              >
                <FolderPlus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </button>

              {onOpenSmartCrawl && (
                <button
                  type="button"
                  onClick={onOpenSmartCrawl}
                  className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                  title="Mapeamento Inteligente de URL com IA"
                  aria-label="Mapeamento Inteligente de URL"
                >
                  <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </button>
              )}

              {onOpenMigration && (
                <button
                  type="button"
                  onClick={onOpenMigration}
                  className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                  title="Importar cadernos e fontes"
                  aria-label="Importar cadernos e fontes"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                </button>
              )}

              {onOpenAuditDuplicates && (
                <button
                  type="button"
                  onClick={onOpenAuditDuplicates}
                  className={`relative p-1.5 rounded-md transition-colors cursor-pointer ${
                    existingDuplicatesCount > 0
                      ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-100/70 dark:hover:bg-amber-950/70'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-700'
                  }`}
                  title={
                    existingDuplicatesCount > 0
                      ? `Auditar links: ${existingDuplicatesCount} duplicata(s) detectada(s)`
                      : 'Auditar e validar links duplicados no caderno'
                  }
                  aria-label="Auditar e validar links duplicados"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {existingDuplicatesCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsBatchModeActive((prev) => !prev);
                  if (isBatchModeActive) {
                    setSelectedSourceIds(new Set());
                  }
                }}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  isBatchModeActive || selectedSourceIds.size > 0
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-700'
                }`}
                title="Seleção em Massa (vincular ou excluir várias fontes)"
                aria-label="Seleção em Massa"
              >
                <CheckSquare className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* View Mode Switcher: NotebookLM Style */}
        <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800/90 rounded-lg text-xs border border-slate-200/60 dark:border-slate-700/60 w-full min-w-0">
          <button
            type="button"
            onClick={() => setViewMode('iconsOnly')}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-1.5 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap ${
              viewMode === 'iconsOnly'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Disposição apenas de ícones com o nome da seção (estilo NotebookLM)"
          >
            <LayoutGrid className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="text-[11px] sm:text-xs">Apenas Ícones</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('linked')}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-1.5 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap ${
              viewMode === 'linked'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Disposição expandida das seções com as fontes vinculadas visíveis"
          >
            <ListTree className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="text-[11px] sm:text-xs">Fontes Vinculadas</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Filtrar fontes e seções..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 sm:py-1.5 text-base sm:text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500"
          />

        </div>

        {/* Toggle all */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-0.5 gap-2 min-w-0">
          <button
            onClick={() => onToggleAllSources(activeCount !== sources.length)}
            className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer min-w-0"
          >
            {activeCount === sources.length && sources.length > 0 ? (
              <CheckSquare className="w-3.5 h-3.5 text-slate-900 dark:text-slate-100 shrink-0" />
            ) : (
              <Square className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
            )}
            <span className="text-[11px] font-medium whitespace-nowrap">
              {activeCount === sources.length ? 'Desmarcar todas' : 'Selecionar todas'}
            </span>
          </button>
          <span className="text-[11px] whitespace-nowrap shrink-0">
            {activeCount}/{sources.length} ativas na IA
          </span>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Batch Success Notice Banner */}
        {batchSuccessNotice && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-2 animate-in fade-in duration-200 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{batchSuccessNotice}</span>
          </div>
        )}

        {/* BATCH LINKING & DELETION ACTION BAR (When Sources are Selected) */}
        {selectedSourceIds.size > 0 && !isReadOnly && (
          <div className="p-3 bg-blue-50/90 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 rounded-xl space-y-2.5 shadow-md animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-950 dark:text-blue-100 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>
                  {selectedSourceIds.size} {selectedSourceIds.size === 1 ? 'fonte selecionada' : 'fontes selecionadas'}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleSelectAllForBatch}
                  className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 hover:underline cursor-pointer"
                >
                  {selectedSourceIds.size === filteredSources.length ? 'Desmarcar Todas' : 'Marcar Todas'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSourceIds(new Set())}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer ml-1"
                >
                  Cancelar
                </button>
              </div>
            </div>

            {/* Actions Row 1: Section Binding */}
            <div className="flex items-center gap-2">
              <select
                value={batchTargetSectionId}
                onChange={(e) => setBatchTargetSectionId(e.target.value)}
                className="flex-1 text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden font-medium"
              >
                <option value="">Vincular a outra seção...</option>
                <option value="none">Geral (Sem Seção)</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.icon} {sec.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleApplyBatchMove}
                disabled={!batchTargetSectionId}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs ${
                  !batchTargetSectionId
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
                }`}
              >
                <MoveRight className="w-3.5 h-3.5" />
                <span>Vincular</span>
              </button>
            </div>

            {/* Actions Row 2: Bulk Delete Action */}
            <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/60">
              <button
                type="button"
                onClick={() => setIsDeleteBatchModalOpen(true)}
                className="w-full py-1.5 px-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                title="Excluir todas as fontes selecionadas após confirmação"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir {selectedSourceIds.size} {selectedSourceIds.size === 1 ? 'fonte selecionada' : 'fontes selecionadas'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DISPOSIÇÃO 1: APENAS ÍCONES COM O NOME DA SEÇÃO (ESTILO NOTEBOOKLM)     */}
        {/* ========================================================================= */}
        {viewMode === 'iconsOnly' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Seções Criadas
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {sections.length} {sections.length === 1 ? 'seção' : 'seções'}
              </span>
            </div>

            {sections.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-900/50 space-y-2">
                <FolderOpen className="w-6 h-6 text-slate-400 dark:text-slate-500 mx-auto" />
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Nenhuma seção criada
                </p>
                {!isReadOnly && (
                  <button
                    onClick={onOpenSectionModal}
                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                  >
                    + Criar primeira seção
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {sections.map((section) => {
                  const sectionSources = sourcesBySection[section.id] || [];
                  const isSelected = selectedSectionInIconMode === section.id;

                  return (
                    <div
                      key={section.id}
                      className={`group rounded-xl border transition-all overflow-hidden ${
                        isSelected
                          ? 'bg-slate-100/90 dark:bg-slate-900 border-slate-300 dark:border-slate-700 shadow-xs ring-1 ring-slate-300/60 dark:ring-slate-700/60'
                          : 'bg-white dark:bg-slate-900/90 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 shadow-2xs'
                      }`}
                    >
                      {/* NotebookLM Clean Section Item */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          setSelectedSectionInIconMode((prev) =>
                            prev === section.id ? null : section.id
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedSectionInIconMode((prev) =>
                              prev === section.id ? null : section.id
                            );
                          }
                        }}
                        className="p-3 flex items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 shadow-2xs group-hover:scale-105 transition-transform border border-slate-200/70 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800"
                            style={{
                              backgroundColor: section.color ? `${section.color}15` : undefined,
                              borderColor: section.color ? `${section.color}35` : undefined,
                            }}
                          >
                            <span>{section.icon}</span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs sm:text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {section.name}
                            </h3>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 truncate">
                              {sectionSources.length} {sectionSources.length === 1 ? 'fonte vinculada' : 'fontes vinculadas'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {!isReadOnly && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenAddSource(section.id);
                                }}
                                title={`Incluir fonte na seção "${section.name}"`}
                                className="px-2 py-1 flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 rounded-md transition-colors cursor-pointer shrink-0"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Fonte</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditSection(section);
                                }}
                                title="Editar seção"
                                className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity rounded cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteSection(section);
                                }}
                                title="Excluir seção"
                                className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-opacity rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <div className="text-slate-400 dark:text-slate-500 ml-1">
                            {isSelected ? (
                              <ChevronDown className="w-4 h-4 text-slate-800 dark:text-slate-200" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expandable linked sources preview when clicked in Icon Mode */}
                      {isSelected && (
                        <div className="p-2.5 pt-1.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-1.5">
                          <div className="py-1">
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate block">
                              Fontes em &quot;{section.name}&quot; ({sectionSources.length}):
                            </span>
                          </div>

                          {sectionSources.length === 0 ? (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-2 text-center">
                              Nenhuma fonte vinculada a esta seção.
                            </p>
                          ) : (
                            sectionSources.map((source) => (
                              <NotebookLMSourceLink
                                key={source.id}
                                source={source}
                                isReadOnly={isReadOnly}
                                sections={sections}
                                isBatchModeActive={isBatchModeActive || selectedSourceIds.size > 0}
                                isBatchSelected={selectedSourceIds.has(source.id)}
                                onToggleBatchSelect={handleToggleBatchSelect}
                                onToggleSource={onToggleSource}
                                onSelectSource={onSelectSource}
                                onMoveSourceToSection={onMoveSourceToSection}
                                onDeleteSource={onDeleteSource}
                                activeMoveSourceId={activeMoveSourceId}
                                setActiveMoveSourceId={setActiveMoveSourceId}
                              />
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Unsectioned sources section in icon mode */}
            {unsectionedSources.length > 0 && (
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1 block mb-2">
                  Fontes Gerais ({unsectionedSources.length})
                </span>
                <div className="space-y-1.5">
                  {unsectionedSources.map((source) => (
                    <NotebookLMSourceLink
                      key={source.id}
                      source={source}
                      isReadOnly={isReadOnly}
                      sections={sections}
                      isBatchModeActive={isBatchModeActive || selectedSourceIds.size > 0}
                      isBatchSelected={selectedSourceIds.has(source.id)}
                      onToggleBatchSelect={handleToggleBatchSelect}
                      onToggleSource={onToggleSource}
                      onSelectSource={onSelectSource}
                      onMoveSourceToSection={onMoveSourceToSection}
                      onDeleteSource={onDeleteSource}
                      activeMoveSourceId={activeMoveSourceId}
                      setActiveMoveSourceId={setActiveMoveSourceId}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* DISPOSIÇÃO 2: ÍCONES COM OS LINKS DAS FONTES VINCULADOS (NOTEBOOKLM)    */}
        {/* ========================================================================= */}
        {viewMode === 'linked' && (
          <div className="space-y-4">
            {sections.map((section) => {
              const sectionSources = sourcesBySection[section.id] || [];
              const isCollapsed = collapsedSections.has(section.id);
              const isTargeted = dragOverTarget === section.id;

              return (
                <div
                  key={section.id}
                  onDragOver={(e) => handleDragOver(e, section.id)}
                  onDragLeave={(e) => handleDragLeave(e, section.id)}
                  onDrop={(e) => handleDrop(e, section.id)}
                  className={`rounded-xl border transition-all overflow-hidden ${
                    isTargeted
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 dark:border-blue-400 ring-2 ring-blue-400/50'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs'
                  }`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSectionCollapse(section.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSectionCollapse(section.id);
                      }
                    }}
                    className="p-3 bg-slate-50/80 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm shrink-0">
                        <span>{section.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate block">
                          {section.name}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {sectionSources.length} fontes
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenAddSource(section.id);
                          }}
                          title={`Incluir fonte na seção "${section.name}"`}
                          className="px-2 py-1 flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 rounded-md transition-colors cursor-pointer shrink-0"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Fonte</span>
                        </button>
                      )}
                      <div className="text-slate-400 ml-0.5">
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="p-2 space-y-1.5 bg-slate-50/30 dark:bg-slate-950/30">
                      {sectionSources.length === 0 ? (
                        <div className="py-2.5 px-3 text-center border border-dashed border-slate-200/80 dark:border-slate-800 rounded-lg bg-white/40 dark:bg-slate-900/40">
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                            Nenhuma fonte vinculada a esta seção.
                          </p>
                        </div>
                      ) : (
                        sectionSources.map((source) => (
                          <NotebookLMSourceLink
                            key={source.id}
                            source={source}
                            sections={sections}
                            isReadOnly={isReadOnly}
                            isBatchModeActive={isBatchModeActive || selectedSourceIds.size > 0}
                            isBatchSelected={selectedSourceIds.has(source.id)}
                            onToggleBatchSelect={handleToggleBatchSelect}
                            activeMoveSourceId={activeMoveSourceId}
                            setActiveMoveSourceId={setActiveMoveSourceId}
                            isDragging={draggedSourceId === source.id}
                            onDragStart={(e) => handleDragStart(e, source.id)}
                            onDragEnd={handleDragEnd}
                            onToggleSource={onToggleSource}
                            onSelectSource={onSelectSource}
                            onMoveSourceToSection={onMoveSourceToSection}
                            onDeleteSource={onDeleteSource}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unsectioned Accordion */}
            <div
              onDragOver={(e) => handleDragOver(e, 'unsectioned')}
              onDragLeave={(e) => handleDragLeave(e, 'unsectioned')}
              onDrop={(e) => handleDrop(e, undefined)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs"
            >
              <div className="p-3 bg-slate-50/80 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Geral / Sem Seção ({unsectionedSources.length})
                </span>
              </div>

              <div className="p-2 space-y-1.5 bg-slate-50/40 dark:bg-slate-950/40">
                {unsectionedSources.length === 0 ? (
                  <div className="py-2.5 text-center text-[11px] text-slate-400 dark:text-slate-500 italic">
                    Todas as fontes estão organizadas em seções.
                  </div>
                ) : (
                  unsectionedSources.map((source) => (
                    <NotebookLMSourceLink
                      key={source.id}
                      source={source}
                      sections={sections}
                      isReadOnly={isReadOnly}
                      isBatchModeActive={isBatchModeActive || selectedSourceIds.size > 0}
                      isBatchSelected={selectedSourceIds.has(source.id)}
                      onToggleBatchSelect={handleToggleBatchSelect}
                      activeMoveSourceId={activeMoveSourceId}
                      setActiveMoveSourceId={setActiveMoveSourceId}
                      isDragging={draggedSourceId === source.id}
                      onDragStart={(e) => handleDragStart(e, source.id)}
                      onDragEnd={handleDragEnd}
                      onToggleSource={onToggleSource}
                      onSelectSource={onSelectSource}
                      onMoveSourceToSection={onMoveSourceToSection}
                      onDeleteSource={onDeleteSource}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/80 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[11px] font-medium">
            {verifiedCount}/{sources.length} fontes auditadas
          </span>
        </div>
      </div>

      {/* Delete Batch Confirmation Modal */}
      <DeleteBatchSourcesModal
        isOpen={isDeleteBatchModalOpen}
        selectedSources={selectedSourcesList}
        onClose={() => setIsDeleteBatchModalOpen(false)}
        onConfirmDelete={handleApplyBatchDelete}
      />
    </div>
  );
}

// =============================================================================
// NotebookLM Style Source Link Item: Clean, Clickable Document Link with Checkbox
// =============================================================================
function NotebookLMSourceLink({
  source,
  sections,
  isReadOnly,
  isBatchModeActive,
  isBatchSelected,
  onToggleBatchSelect,
  activeMoveSourceId,
  setActiveMoveSourceId,
  isDragging,
  onDragStart,
  onDragEnd,
  onToggleSource,
  onSelectSource,
  onMoveSourceToSection,
  onDeleteSource,
}: {
  source: NotebookSource;
  sections: NotebookSection[];
  isReadOnly: boolean;
  isBatchModeActive?: boolean;
  isBatchSelected?: boolean;
  onToggleBatchSelect?: (id: string) => void;
  activeMoveSourceId: string | null;
  setActiveMoveSourceId: (id: string | null) => void;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onToggleSource: (id: string) => void;
  onSelectSource: (source: NotebookSource) => void;
  onMoveSourceToSection: (sourceId: string, sectionId?: string) => void;
  onDeleteSource: (id: string) => void;
}) {
  const isMoving = activeMoveSourceId === source.id;

  // Find section name badge
  const currentSec = sections.find((s) => s.id === source.sectionId);

  // Choose appropriate clean icon based on source type
  const getSourceIcon = () => {
    switch (source.type) {
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
      draggable={!isReadOnly}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative rounded-lg border transition-all select-none ${
        isBatchSelected
          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 ring-1 ring-blue-400/40'
          : isDragging
          ? 'opacity-40 border-blue-400 dark:border-blue-500 scale-[0.98]'
          : source.enabled
          ? 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 shadow-2xs'
          : 'bg-slate-100/50 dark:bg-slate-950/50 border-slate-200/40 dark:border-slate-800/60 opacity-60'
      } ${!isReadOnly ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="p-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Multi-Selection Checkbox for Batch Linking */}
          {isBatchModeActive && !isReadOnly && (
            <input
              type="checkbox"
              checked={!!isBatchSelected}
              onChange={() => onToggleBatchSelect?.(source.id)}
              title="Selecionar esta fonte para vincular em massa a outra seção"
              className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
            />
          )}

          {/* Checkbox for AI consultation (NotebookLM) */}
          <input
            type="checkbox"
            checked={source.enabled}
            onChange={() => onToggleSource(source.id)}
            title={source.enabled ? 'Desmarcar da IA' : 'Marcar para consultar na IA'}
            className="rounded-sm border-slate-300 dark:border-slate-600 text-blue-600 dark:text-blue-500 accent-blue-600 dark:accent-blue-500 focus:ring-blue-500 cursor-pointer shrink-0"
          />

          {/* Source Document Type Icon */}
          {getSourceIcon()}

          {/* Source Title as Clickable Link */}
          <button
            type="button"
            onClick={() => {
              if (isBatchModeActive && !isReadOnly) {
                onToggleBatchSelect?.(source.id);
              } else {
                onSelectSource(source);
              }
            }}
            title={`Abrir e ler fonte: "${source.title}"`}
            className="text-left text-xs font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:underline truncate flex-1 cursor-pointer transition-colors"
          >
            {source.title}
          </button>

          {/* Section badge indicator */}
          {currentSec && (
            <span className="hidden sm:inline-flex text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200/60 dark:border-slate-700/60 shrink-0">
              {currentSec.icon} {currentSec.name}
            </span>
          )}
        </div>

        {/* Hover Action Buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setActiveMoveSourceId(isMoving ? null : source.id)}
              title="Vincular a outra seção"
              className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <MoveRight className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onSelectSource(source)}
            title="Inspecionar conteúdo completo"
            className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" />
          </button>

          {!isReadOnly && (
            <button
              type="button"
              onClick={() => onDeleteSource(source.id)}
              title="Remover fonte"
              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Inline Section Move Selector */}
      {isMoving && !isReadOnly && (
        <div className="p-2 mx-1 mb-1 bg-slate-100/90 dark:bg-slate-800/95 border border-slate-300 dark:border-slate-700 rounded-md text-xs space-y-1">
          <span className="font-semibold text-slate-800 dark:text-slate-200 block text-[10px]">
            Vincular à Seção:
          </span>
          <select
            value={source.sectionId || ''}
            onChange={(e) => {
              onMoveSourceToSection(source.id, e.target.value || undefined);
              setActiveMoveSourceId(null);
            }}
            className="w-full text-xs p-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-hidden"
          >
            <option value="">Sem Seção (Geral)</option>
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.icon} {sec.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
