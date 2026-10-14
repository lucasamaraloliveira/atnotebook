'use client';

import React, { useState } from 'react';
import { NotebookSource, NotebookSection, UserRole } from '@/lib/types';
import { computeTextMetrics } from '@/lib/integrity';
import {
  Globe,
  X,
  Sparkles,
  RefreshCw,
  Check,
  CheckSquare,
  Square,
  ExternalLink,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Download,
  BookOpen,
  Folder,
  FolderTree,
  CornerDownRight,
  Layers,
} from 'lucide-react';

interface DiscoveredPage {
  id: string;
  url: string;
  title: string;
  summary: string;
  content: string;
  wordCount: number;
  charCount: number;
  selected: boolean;
  hasFullContent?: boolean;
  isDuplicate?: boolean;
  duplicateReason?: string;
  depth?: 1 | 2 | 3;
  parentId?: string;
  parentUrl?: string;
  childCount?: number;
}

interface LevelStats {
  level1Count: number;
  level2Count: number;
  level3Count: number;
}

interface DuplicateStats {
  totalDuplicatesDetected: number;
  alreadyExistingInNotebookCount: number;
  repeatedInSiteCount: number;
  duplicateUrlsList: Array<{ url: string; reason: 'already_exists_in_notebook' | 'duplicate_on_site' }>;
}

interface SmartCrawlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSources: (sources: Array<Omit<NotebookSource, 'id'>>) => void;
  sections?: NotebookSection[];
  userRole?: UserRole;
  existingSources?: NotebookSource[];
}

const ITEMS_PER_PAGE = 45;

export function SmartCrawlModal({
  isOpen,
  onClose,
  onImportSources,
  sections = [],
  userRole = 'owner',
  existingSources = [],
}: SmartCrawlModalProps) {
  const [urlInput, setUrlInput] = useState('');
  const [targetSectionId, setTargetSectionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(false);
  const [levelStats, setLevelStats] = useState<LevelStats | null>(null);
  const [levelFilter, setLevelFilter] = useState<'all' | 'level1' | 'level2' | 'level3'>('all');
  const [isFetchingFullContent, setIsFetchingFullContent] = useState(false);
  const [fetchProgress, setFetchProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [discoveredPages, setDiscoveredPages] = useState<DiscoveredPage[]>([]);
  const [duplicateStats, setDuplicateStats] = useState<DuplicateStats | null>(null);
  const [showDuplicateDetails, setShowDuplicateDetails] = useState(false);
  const [domainName, setDomainName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  if (!isOpen || userRole === 'viewer') return null;

  const handleCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setDiscoveredPages([]);
    setDuplicateStats(null);
    setLevelStats(null);
    setHasMorePages(false);
    setShowDuplicateDetails(false);
    setCurrentPage(1);

    // Extract list of existing URLs in the notebook
    const existingUrls = (existingSources || [])
      .map((s) => s.originalOrigin || '')
      .map((origin) => origin.replace(/^Mapeado via URL:\s*/i, '').trim())
      .filter((u) => u.startsWith('http://') || u.startsWith('https://'));

    try {
      const response = await fetch('/api/crawl-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput.trim(),
          existingUrls,
          limit: 150,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível mapear a URL fornecida.');
      }

      setDomainName(data.domain || '');
      setDiscoveredPages(data.pages || []);
      setLevelStats(data.levelStats || null);
      setHasMorePages(Boolean(data.hasMore));
      setDuplicateStats(data.duplicateStats || null);
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar ao serviço de mapeamento de URLs.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMorePages = async () => {
    if (isLoadingMore || !urlInput.trim()) return;
    setIsLoadingMore(true);
    setError(null);

    const existingUrls = (existingSources || [])
      .map((s) => s.originalOrigin || '')
      .map((origin) => origin.replace(/^Mapeado via URL:\s*/i, '').trim())
      .filter((u) => u.startsWith('http://') || u.startsWith('https://'));

    try {
      const response = await fetch('/api/crawl-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput.trim(),
          existingUrls,
          limit: Math.min(discoveredPages.length + 100, 300),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar mais páginas encadeadas.');
      }

      setDiscoveredPages(data.pages || []);
      setLevelStats(data.levelStats || null);
      setHasMorePages(Boolean(data.hasMore));
      setDuplicateStats(data.duplicateStats || null);
    } catch (err: any) {
      setError(err.message || 'Erro ao expandir subpáginas.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleTogglePage = (id: string) => {
    setDiscoveredPages((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (p.isDuplicate) return p; // Cannot select duplicates
        return { ...p, selected: !p.selected };
      })
    );
  };

  // Cascading Selection: toggle a parent subfolder and all its nested sub-subpages
  const handleToggleCascade = (parentId: string) => {
    setDiscoveredPages((prev) => {
      const parent = prev.find((p) => p.id === parentId);
      if (!parent) return prev;
      const targetState = !parent.selected;

      return prev.map((p) => {
        if (p.id === parentId && !p.isDuplicate) {
          return { ...p, selected: targetState };
        }
        if (p.parentId === parentId && !p.isDuplicate) {
          return { ...p, selected: targetState };
        }
        return p;
      });
    });
  };

  const handleToggleSelectAll = () => {
    const selectable = discoveredPages.filter((p) => !p.isDuplicate);
    const allSelected = selectable.length > 0 && selectable.every((p) => p.selected);
    setDiscoveredPages((prev) =>
      prev.map((p) => (p.isDuplicate ? { ...p, selected: false } : { ...p, selected: !allSelected }))
    );
  };

  const handleSelectFilteredOnly = () => {
    const filteredIds = new Set(
      filteredPages.filter((p) => !p.isDuplicate).map((p) => p.id)
    );
    setDiscoveredPages((prev) =>
      prev.map((p) => (filteredIds.has(p.id) && !p.isDuplicate ? { ...p, selected: true } : p))
    );
  };

  const handleConfirmImport = async () => {
    // Strictly exclude any duplicate pages from being inserted as sources
    const selected = discoveredPages.filter((p) => p.selected && !p.isDuplicate);
    if (selected.length === 0 || isFetchingFullContent) return;

    setIsFetchingFullContent(true);
    setError(null);
    setFetchProgress(`Obtendo conteúdo integral de ${selected.length} páginas...`);

    try {
      // Find URLs that need full content download
      const urlsToFetch = selected
        .filter((p) => !p.hasFullContent || !p.content || p.content.startsWith('URL:'))
        .map((p) => p.url);

      let fetchedResultsMap = new Map<string, { title: string; fullContent: string }>();

      if (urlsToFetch.length > 0) {
        const response = await fetch('/api/crawl-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'fetch-contents',
            urls: urlsToFetch,
          }),
        });

        const data = await response.json();
        if (response.ok && Array.isArray(data.results)) {
          data.results.forEach((item: any) => {
            if (item.url && item.fullContent) {
              fetchedResultsMap.set(item.url, {
                title: item.title,
                fullContent: item.fullContent,
              });
            }
          });
        }
      }

      // Construct final sources with FULL UNTRUNCATED TEXT
      const sourcesToAdd: Array<Omit<NotebookSource, 'id'>> = selected.map((p) => {
        const fetched = fetchedResultsMap.get(p.url);
        const finalTitle = fetched?.title || p.title;
        const finalContent = fetched?.fullContent || p.content || `Conteúdo integral da página ${p.url}`;
        const metrics = computeTextMetrics(finalContent);

        return {
          title: finalTitle,
          type: 'web_article',
          sectionId: targetSectionId || undefined,
          originalOrigin: `Mapeado via URL: ${p.url}`,
          content: finalContent, // 100% COMPLETE VERBATIM CONTENT
          summary: p.summary || `Conteúdo integral importado de ${p.url}`,
          charCount: metrics.charCount,
          wordCount: metrics.wordCount,
          estimatedTokens: metrics.estimatedTokens,
          checksum: metrics.checksum,
          migratedAt: new Date().toISOString(),
          verified: true,
          enabled: true,
        };
      });

      onImportSources(sourcesToAdd);
      handleResetAndClose();
    } catch (err: any) {
      console.error('Error fetching full page contents:', err);
      setError('Ocorreu um erro ao baixar o conteúdo integral das páginas. Tente novamente.');
    } finally {
      setIsFetchingFullContent(false);
      setFetchProgress('');
    }
  };

  const handleResetAndClose = () => {
    setUrlInput('');
    setTargetSectionId('');
    setSearchQuery('');
    setError(null);
    setDiscoveredPages([]);
    setLevelStats(null);
    setHasMorePages(false);
    setIsLoadingMore(false);
    setLevelFilter('all');
    setIsLoading(false);
    setIsFetchingFullContent(false);
    setFetchProgress('');
    setCurrentPage(1);
    onClose();
  };

  // Filter & Pagination logic with multi-level depth support
  const filteredPages = discoveredPages.filter((p) => {
    if (levelFilter === 'level1' && p.depth !== 1) return false;
    if (levelFilter === 'level2' && p.depth !== 2) return false;
    if (levelFilter === 'level3' && p.depth !== 3) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.url.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q)
    );
  });

  const totalPagesCount = Math.ceil(filteredPages.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedPages = filteredPages.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const selectedCount = discoveredPages.filter((p) => p.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8.5 h-8.5 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Mapeamento & Ingestão de Conteúdo Integral de Pasta/URL</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800">
                  Conteúdo Integral sem Resumos
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                O sistema entra no link da URL informada e navega por todos os arquivos e subpáginas contidos naquela pasta para baixar 100% do conteúdo.
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            disabled={isFetchingFullContent}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Step 1: URL Form */}
          <form onSubmit={handleCrawl} className="space-y-3 bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  URL Principal do Site ou Portal *
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="url"
                    required
                    placeholder="https://exemplo.com/docs"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    disabled={isLoading || isFetchingFullContent}
                    className="w-full text-xs pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Seção de Destino
                </label>
                <select
                  value={targetSectionId}
                  onChange={(e) => setTargetSectionId(e.target.value)}
                  disabled={isLoading || isFetchingFullContent}
                  className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden"
                >
                  <option value="">Sem Seção (Geral)</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.icon} {sec.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                A IA analisa todos os links do HTML e do sitemap, identificando dezenas de páginas para ingestão de conteúdo integral.
              </span>
              <button
                type="submit"
                disabled={isLoading || isFetchingFullContent || !urlInput.trim()}
                className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-2xs transition-all flex items-center gap-2 cursor-pointer ${
                  isLoading || isFetchingFullContent || !urlInput.trim()
                    ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                }`}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mapeando Estrutura do Site...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Mapear Páginas Vinculadas</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div>
                <p className="font-semibold">Aviso:</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Full content fetching indicator */}
          {isFetchingFullContent && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-900 dark:text-blue-200 flex items-center gap-3 animate-pulse">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <p className="font-bold text-xs">Baixando Texto Bruto na Íntegra...</p>
                <p className="text-[11px] text-blue-700 dark:text-blue-300">{fetchProgress}</p>
              </div>
            </div>
          )}

          {/* Step 2: Discovered Pages Results */}
          {discoveredPages.length > 0 && !isFetchingFullContent && (
            <div className="space-y-3">
              {/* Duplicate Links Notice Banner */}
              {duplicateStats && duplicateStats.totalDuplicatesDetected > 0 && (
                <div className="p-4 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl space-y-2 text-xs text-amber-900 dark:text-amber-200 shadow-2xs animate-in fade-in duration-200">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="font-bold text-xs sm:text-sm">
                        Links Repetidos Identificados ({duplicateStats.totalDuplicatesDetected})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDuplicateDetails((prev) => !prev)}
                      className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      {showDuplicateDetails ? 'Ocultar lista de repetidos' : 'Ver links repetidos'}
                    </button>
                  </div>

                  <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                    A IA analisou toda a estrutura de links do portal e identificou links repetidos com base na URL:{' '}
                    {duplicateStats.alreadyExistingInNotebookCount > 0 && (
                      <span>
                        <strong>
                          {duplicateStats.alreadyExistingInNotebookCount}{' '}
                          {duplicateStats.alreadyExistingInNotebookCount === 1 ? 'link já existe' : 'links já existem'}
                        </strong>{' '}
                        previamente como fontes no seu caderno.{' '}
                      </span>
                    )}
                    {duplicateStats.repeatedInSiteCount > 0 && (
                      <span>
                        <strong>
                          {duplicateStats.repeatedInSiteCount}{' '}
                          {duplicateStats.repeatedInSiteCount === 1 ? 'link repetido foi encontrado' : 'links repetidos foram encontrados'}
                        </strong>{' '}
                        na navegação e menus do portal.{' '}
                      </span>
                    )}
                    Para evitar redundância na sua base de conhecimento,{' '}
                    <strong>estes links repetidos não serão inseridos como fonte</strong>.
                  </p>

                  {/* Expandable list of duplicate links */}
                  {showDuplicateDetails && duplicateStats.duplicateUrlsList.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-amber-200/80 dark:border-amber-800/80 max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {duplicateStats.duplicateUrlsList.map((dup, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 text-[10px] bg-white/80 dark:bg-slate-900/70 p-2 rounded-lg border border-amber-100 dark:border-amber-900/50"
                        >
                          <span className="truncate font-mono text-slate-700 dark:text-slate-300 flex-1">
                            {dup.url}
                          </span>
                          <span className="shrink-0 font-medium px-2 py-0.5 rounded text-[9px] bg-amber-100 dark:bg-amber-950 text-amber-850 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800">
                            {dup.reason === 'already_exists_in_notebook'
                              ? 'Já existe no caderno'
                              : 'Repetido no portal'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Multi-Level Chained Stats Header */}
              <div className="bg-slate-100 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {discoveredPages.length} {discoveredPages.length === 1 ? 'página identificada' : 'páginas encadeadas'}
                    </span>
                    {domainName && (
                      <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                        {domainName}
                      </span>
                    )}
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                      {selectedCount} selecionadas para ingestão
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={handleSelectFilteredOnly}
                        className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                        title="Selecionar todas as páginas não duplicadas que correspondem ao filtro de busca"
                      >
                        Marcar Filtradas ({filteredPages.filter((p) => !p.isDuplicate).length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {discoveredPages.filter((p) => !p.isDuplicate).every((p) => p.selected) ? (
                        <>
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>Desmarcar Todas</span>
                        </>
                      ) : (
                        <>
                          <Square className="w-3.5 h-3.5" />
                          <span>Marcar Todas Válidas</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Level breakdown pills */}
                {levelStats && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Estrutura Encadeada:</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      <Folder className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      1 Pasta Raiz (L1)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      <FolderTree className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      {levelStats.level2Count} {levelStats.level2Count === 1 ? 'Subpasta' : 'Subpastas'} (L2)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CornerDownRight className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      {levelStats.level3Count} Sub-subpastas Encadeadas (L3)
                    </span>
                  </div>
                )}
              </div>

              {/* Level Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setLevelFilter('all');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    levelFilter === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Todas ({discoveredPages.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLevelFilter('level1');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    levelFilter === 'level1'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                  }`}
                >
                  <Folder className="w-3 h-3" />
                  Pasta Raiz (1)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLevelFilter('level2');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    levelFilter === 'level2'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                  }`}
                >
                  <FolderTree className="w-3 h-3" />
                  Subpastas ({levelStats ? levelStats.level2Count : discoveredPages.filter(p => p.depth === 2).length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLevelFilter('level3');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    levelFilter === 'level3'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                  }`}
                >
                  <CornerDownRight className="w-3 h-3" />
                  Sub-subpastas Encadeadas ({levelStats ? levelStats.level3Count : discoveredPages.filter(p => p.depth === 3).length})
                </button>
              </div>

              {/* Load More Pages Notification Banner */}
              {hasMorePages && (
                <div className="p-3 bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/70 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                  <div>
                    <span className="font-bold text-indigo-900 dark:text-indigo-200">
                      Limite de segurança atingido ({discoveredPages.length} páginas mapeadas)
                    </span>
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                      Existem mais subpastas e sub-subpáginas no portal. Deseja expandir a busca para mais itens encadeados?
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadMorePages}
                    disabled={isLoadingMore}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isLoadingMore ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Carregando subpáginas...</span>
                      </>
                    ) : (
                      <>
                        <Layers className="w-3.5 h-3.5" />
                        <span>Carregar Mais (+100)</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Search Filter Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={`Buscar entre as ${discoveredPages.length} páginas por título ou URL...`}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden"
                />
              </div>

              {/* List of Discovered Pages with Hierarchical Tree Indentation */}
              <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                {paginatedPages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    Nenhuma página encontrada para o filtro selecionado.
                  </div>
                ) : (
                  paginatedPages.map((page) => {
                    const depth = page.depth || 1;
                    const isL1 = depth === 1;
                    const isL2 = depth === 2;
                    const isL3 = depth === 3;

                    return (
                      <div
                        key={page.id}
                        onClick={() => !page.isDuplicate && handleTogglePage(page.id)}
                        className={`p-3 rounded-xl border transition-all ${
                          isL1
                            ? 'ml-0 border-blue-200 dark:border-blue-900/60'
                            : isL2
                            ? 'ml-2.5 sm:ml-5 pl-3 border-l-3 border-l-indigo-500 border-t-slate-200 border-r-slate-200 border-b-slate-200 dark:border-slate-700/70'
                            : 'ml-6 sm:ml-10 pl-3 border-l-3 border-l-emerald-500 border-t-slate-200 border-r-slate-200 border-b-slate-200 dark:border-slate-700/70'
                        } ${
                          page.isDuplicate
                            ? 'bg-amber-50/40 dark:bg-amber-950/20 opacity-80 cursor-not-allowed'
                            : page.selected
                            ? isL1
                              ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 dark:border-blue-700 cursor-pointer'
                              : isL2
                              ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-400 dark:border-indigo-700 cursor-pointer'
                              : 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700 cursor-pointer'
                            : 'bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={page.isDuplicate ? false : page.selected}
                            disabled={page.isDuplicate}
                            onChange={() => !page.isDuplicate && handleTogglePage(page.id)}
                            onClick={(e) => e.stopPropagation()}
                            className={`mt-0.5 rounded text-blue-600 focus:ring-blue-500 ${
                              page.isDuplicate ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                {/* Hierarchy Level Badge */}
                                {isL1 && (
                                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/90 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 flex items-center gap-1 shrink-0">
                                    <Folder className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                    Pasta Raiz (L1)
                                  </span>
                                )}
                                {isL2 && (
                                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/90 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 shrink-0">
                                    <FolderTree className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                    Subpasta (L2)
                                  </span>
                                )}
                                {isL3 && (
                                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/90 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 shrink-0">
                                    <CornerDownRight className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                    Sub-subpasta Encadeada (L3)
                                  </span>
                                )}

                                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                  {page.title}
                                </h4>

                                {page.isDuplicate && (
                                  <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-950/90 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 shrink-0">
                                    Link Repetido
                                  </span>
                                )}

                                {/* Cascading select button for Level 2 folders */}
                                {isL2 && page.childCount !== undefined && page.childCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleCascade(page.id);
                                    }}
                                    className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 cursor-pointer"
                                    title="Marcar ou desmarcar esta pasta e todas as suas sub-subpáginas"
                                  >
                                    Marcar pasta + {page.childCount} sub-subpáginas
                                  </button>
                                )}
                              </div>

                              <a
                                href={page.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] text-slate-400 hover:text-blue-600 flex items-center gap-0.5 shrink-0"
                                title="Abrir URL em nova aba"
                              >
                                <span className="truncate max-w-[130px] sm:max-w-[200px]">{page.url}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            </div>

                            {page.isDuplicate ? (
                              <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1 font-medium">
                                ⚠️ {page.duplicateReason || 'Este link já existe previamente ou está repetido na estrutura.'}
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                                {page.summary}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                              <span className={page.isDuplicate ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-emerald-700 dark:text-emerald-400 font-medium'}>
                                {page.isDuplicate
                                  ? 'Desconsiderado da ingestão'
                                  : page.hasFullContent
                                  ? `${page.wordCount} palavras (Texto na íntegra)`
                                  : 'Download na íntegra ao confirmar'}
                              </span>
                              {page.parentUrl && (
                                <>
                                  <span>·</span>
                                  <span className="text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                                    Pai: {page.parentUrl}
                                  </span>
                                </>
                              )}
                              <span>·</span>
                              <span className="truncate">{page.url}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination controls for large page lists */}
              {totalPagesCount > 1 && (
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Mostrando {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredPages.length)} de {filteredPages.length} páginas
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      className="p-1 rounded text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-semibold text-[11px] px-1">
                      Página {currentPage} de {totalPagesCount}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPagesCount}
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPagesCount))}
                      className="p-1 rounded text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleResetAndClose}
            disabled={isFetchingFullContent}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {discoveredPages.length > 0 && (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={selectedCount === 0 || isFetchingFullContent}
              className={`px-4.5 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
                selectedCount === 0 || isFetchingFullContent
                  ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isFetchingFullContent ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Baixando Conteúdo Integral...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Ancorar Texto na Íntegra de {selectedCount} {selectedCount === 1 ? 'Fonte' : 'Fontes'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
