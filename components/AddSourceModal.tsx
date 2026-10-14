'use client';

import React, { useState } from 'react';
import { NotebookSource, NotebookSection, SourceType } from '@/lib/types';
import { computeTextMetrics } from '@/lib/integrity';
import {
  X,
  Plus,
  FileText,
  Globe,
  FileCode,
  Check,
  Sparkles,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSource: (source: Omit<NotebookSource, 'id'>) => void;
  sections?: NotebookSection[];
  initialSectionId?: string;
  existingSources?: NotebookSource[];
  onLocateExistingSource?: (source: NotebookSource) => void;
  onOpenSmartCrawl?: () => void;
}

export function AddSourceModal({
  isOpen,
  onClose,
  onAddSource,
  sections = [],
  initialSectionId,
  existingSources = [],
  onLocateExistingSource,
  onOpenSmartCrawl,
}: AddSourceModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<SourceType>('web_article');
  const [sectionId, setSectionId] = useState<string>(initialSectionId || '');
  const [originalOrigin, setOriginalOrigin] = useState('');
  const [content, setContent] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isExtractingUrl, setIsExtractingUrl] = useState(false);
  const [extractedFolderLinks, setExtractedFolderLinks] = useState<number>(0);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Sync initialSectionId when prop changes without cascading effect
  const [prevInitialSectionId, setPrevInitialSectionId] = useState(initialSectionId);
  if (initialSectionId !== prevInitialSectionId) {
    setPrevInitialSectionId(initialSectionId);
    setSectionId(initialSectionId || '');
  }

  // Exact character-by-character comparison with trim across the whole notebook
  const duplicateSourceMatch = React.useMemo(() => {
    const rawTarget = urlInput.trim() || originalOrigin.trim();
    if (!rawTarget) return null;
    const cleanTarget = rawTarget.trim();

    return (existingSources || []).find((s) => {
      if (!s.originalOrigin) return false;
      const cleanOrigin = s.originalOrigin
        .replace(/^Mapeado via URL:\s*/i, '')
        .trim();
      return cleanOrigin === cleanTarget;
    });
  }, [urlInput, originalOrigin, existingSources]);

  if (!isOpen) return null;

  const handleExtractUrlContent = async () => {
    if (!urlInput.trim() || isExtractingUrl) return;
    setIsExtractingUrl(true);
    setUrlError(null);
    setExtractedFolderLinks(0);

    try {
      const res = await fetch('/api/crawl-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fetch-single',
          url: urlInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível extrair o conteúdo da URL.');
      }

      if (data.title && (!title || title === '')) {
        setTitle(data.title);
      }
      if (data.fullContent) {
        setContent(data.fullContent);
      }
      if (data.url) {
        setOriginalOrigin(data.url);
      }
      if (data.subLinksCount && data.subLinksCount > 0) {
        setExtractedFolderLinks(data.subLinksCount);
      }
    } catch (err: any) {
      setUrlError(err.message || 'Erro ao conectar à URL.');
    } finally {
      setIsExtractingUrl(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || duplicateSourceMatch) return;

    const metrics = computeTextMetrics(content);

    onAddSource({
      title: title.trim(),
      type,
      sectionId: sectionId || undefined,
      originalOrigin: originalOrigin.trim() || urlInput.trim() || undefined,
      content: content.trim(),
      charCount: metrics.charCount,
      wordCount: metrics.wordCount,
      estimatedTokens: metrics.estimatedTokens,
      checksum: metrics.checksum,
      migratedAt: new Date().toISOString(),
      verified: true,
      enabled: true,
    });

    setTitle('');
    setSectionId('');
    setOriginalOrigin('');
    setContent('');
    setUrlInput('');
    setExtractedFolderLinks(0);
    setUrlError(null);
    onClose();
  };

  const currentSection = sections.find((s) => s.id === sectionId);
  const duplicateSection = duplicateSourceMatch
    ? sections.find((s) => s.id === duplicateSourceMatch.sectionId)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Adicionar Fonte / Nota ao Caderno
              </h3>
              {currentSection && (
                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                  Seção de destino: {currentSection.icon} {currentSection.name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Quick URL / Folder Extractor Tool */}
          <div className="p-3.5 bg-blue-50/90 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/80 rounded-xl space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-xs font-bold text-blue-950 dark:text-blue-100">
                  Importar via URL / Pasta da Web (Extração Automática)
                </span>
              </div>
              {onOpenSmartCrawl && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSmartCrawl();
                  }}
                  className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Mapear Várias Subpáginas</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="url"
                placeholder="Cole a URL do documento, artigo ou pasta da web (https://...)"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleExtractUrlContent();
                  }
                }}
                className="flex-1 text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleExtractUrlContent}
                disabled={!urlInput.trim() || isExtractingUrl}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs ${
                  !urlInput.trim() || isExtractingUrl
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
                }`}
              >
                {isExtractingUrl ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Baixando Conteúdo...</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5" />
                    <span>Extrair Conteúdo</span>
                  </>
                )}
              </button>
            </div>

            {duplicateSourceMatch && (
              <div className="p-3 bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/25 dark:border-amber-400/20 rounded-xl space-y-2 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in duration-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-xs text-amber-950 dark:text-amber-100">
                        Link Repetido Identificado no Caderno
                      </p>
                      <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                        Esta URL já existe como fonte neste caderno: <strong className="text-amber-950 dark:text-amber-100">&quot;{duplicateSourceMatch.title}&quot;</strong>
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                        <span>Localização:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {duplicateSection ? `${duplicateSection.icon} ${duplicateSection.name}` : 'Geral (Sem Seção)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {onLocateExistingSource && (
                    <button
                      type="button"
                      onClick={() => {
                        onLocateExistingSource(duplicateSourceMatch);
                        onClose();
                      }}
                      className="px-2.5 py-1.5 text-[11px] font-semibold bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs whitespace-nowrap"
                      title="Localizar e abrir fonte existente no caderno"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Ver Fonte Existente</span>
                    </button>
                  )}
                </div>

                <div className="text-[10px] text-amber-700/90 dark:text-amber-400/90 pt-1.5 border-t border-amber-500/20">
                  A inserção como nova fonte está bloqueada para preservar o contexto e evitar duplicidades de conteúdo no caderno.
                </div>
              </div>
            )}

            {urlError && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                {urlError}
              </p>
            )}

            {/* If folder links detected inside URL */}
            {extractedFolderLinks > 0 && onOpenSmartCrawl && (
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between gap-2 text-xs text-amber-950 dark:text-amber-200 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    A URL contém uma pasta/diretório com <strong>{extractedFolderLinks} arquivos e subpáginas</strong> vinculadas!
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSmartCrawl();
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-md transition-colors flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                >
                  <span>Mapear Pasta Completa</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Título do Documento *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Documentação / Artigo Técnico"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Seção / Pasta de Destino
              </label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Tipo de Fonte
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as SourceType)}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden"
              >
                <option value="web_article">Artigo Web / URL</option>
                <option value="text">Texto Puro / Anotação</option>
                <option value="document">Documento / PDF</option>
                <option value="transcript">Transcrição de Áudio / Reunião</option>
                <option value="table">Tabela / Dados Estruturados</option>
                <option value="gemini_migrated">Migrado do Gemini Notebook</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Origem / URL de Referência
              </label>
              <input
                type="text"
                placeholder="Ex: https://site.com/artigo"
                value={originalOrigin}
                onChange={(e) => setOriginalOrigin(e.target.value)}
                className={`w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden ${
                  duplicateSourceMatch && originalOrigin.trim()
                    ? 'border-amber-400 dark:border-amber-500'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              />
              {duplicateSourceMatch && originalOrigin.trim() && !urlInput.trim() && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                  URL repetida neste caderno (existente em: {duplicateSourceMatch.title})
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Conteúdo Integral da Fonte *
              </label>
              <span className="text-[11px] text-slate-400">Texto bruto e estruturado lido pela IA</span>
            </div>
            <textarea
              required
              rows={8}
              placeholder="Conteúdo integral extraído da URL ou cole o texto..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full text-xs p-3 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !content.trim() || Boolean(duplicateSourceMatch)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors shadow-2xs ${
                !title.trim() || !content.trim() || Boolean(duplicateSourceMatch)
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white cursor-pointer'
              }`}
            >
              {duplicateSourceMatch ? 'Inserção Bloqueada (Link Repetido)' : 'Adicionar ao Caderno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
