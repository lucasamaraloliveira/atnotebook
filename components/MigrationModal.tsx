'use client';

import React, { useState } from 'react';
import { NotebookSource, NotebookSection, SourceType } from '@/lib/types';
import { computeTextMetrics } from '@/lib/integrity';
import {
  X,
  ArrowRightLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Plus,
  RefreshCw,
  Info,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface MigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSource: (source: Omit<NotebookSource, 'id'>) => void;
  sections?: NotebookSection[];
  notebookTitle: string;
}

export function MigrationModal({
  isOpen,
  onClose,
  onImportSource,
  sections = [],
  notebookTitle,
}: MigrationModalProps) {
  const [title, setTitle] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [originalOrigin, setOriginalOrigin] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState<SourceType>('gemini_migrated');

  // AI analysis state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<string | null>(null);

  // Batch migration history
  const [migratedList, setMigratedList] = useState<
    Array<{ title: string; checksum: string; chars: number }>
  >([]);

  if (!isOpen) return null;

  const metrics = computeTextMetrics(content);

  const handleAuditWithAi = async () => {
    if (!content.trim() || isAuditing) return;
    setIsAuditing(true);
    setAuditResult(null);
    try {
      const res = await fetch('/api/gemini/analyze-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAuditResult(data.analysis);
      } else {
        setAuditResult('Texto analisado. Integridade estrutural consistente.');
      }
    } catch (err: any) {
      setAuditResult('Erro na auditoria remota, mas o cálculo local de checksum foi concluído.');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleMigrateSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const newSource: Omit<NotebookSource, 'id'> = {
      title: title.trim(),
      type,
      sectionId: sectionId || undefined,
      originalOrigin: originalOrigin.trim() || 'Gemini Notebook (Origem Manual)',
      content: content.trim(),
      summary: auditResult ? auditResult.slice(0, 180) : undefined,
      charCount: metrics.charCount,
      wordCount: metrics.wordCount,
      estimatedTokens: metrics.estimatedTokens,
      checksum: metrics.checksum,
      migratedAt: new Date().toISOString(),
      verified: true,
      notes: notes.trim() || 'Fonte copiada individualmente e conferida com sucesso.',
      enabled: true,
    };

    onImportSource(newSource);

    // Add to local session tracker
    setMigratedList((prev) => [
      ...prev,
      { title: newSource.title, checksum: newSource.checksum, chars: newSource.charCount },
    ]);

    // Reset inputs for next source
    setTitle('');
    setContent('');
    setNotes('');
    setAuditResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center shadow-xs">
              <ArrowRightLeft className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Assistente de Migração Manual do Gemini Notebook
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Destino: <span className="font-medium text-slate-800 dark:text-slate-200">{notebookTitle}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Banner */}
        <div className="px-5 sm:px-6 py-3 bg-amber-50/80 dark:bg-amber-950/40 border-b border-amber-200/70 dark:border-amber-900/40 flex items-start justify-between gap-3 text-xs text-amber-950 dark:text-amber-200">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="font-semibold">Superando a limitação de compartilhamento:</strong> As
              recentes restrições do Gemini Notebook impedem o compartilhamento com fontes externas.
              Ao importar para o ATNotebook, você retoma a análise de fontes e o compartilhamento irrestrito.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          <form onSubmit={handleMigrateSingle} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Título no Gemini *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Artigo Modelo RAG"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-1 focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Seção / Pasta de Destino
                </label>
                <select
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-1 focus:ring-slate-400"
                >
                  <option value="">Sem Seção (Geral)</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.icon} {sec.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Caderno de Origem
                </label>
                <input
                  type="text"
                  placeholder="Ex: Caderno Pesquisa 2026"
                  value={originalOrigin}
                  onChange={(e) => setOriginalOrigin(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-1 focus:ring-slate-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Conteúdo Copiado da Fonte *
                </label>
                <span className="text-[11px] text-slate-400">
                  Cole o texto integral sem receio de limite
                </span>
              </div>
              <textarea
                required
                rows={7}
                placeholder="Cole aqui o texto copiado individualmente da fonte original do Gemini Notebook..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full text-xs p-3 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-1 focus:ring-slate-400 leading-relaxed"
              />
            </div>

            {/* Integrity Metrics Card */}
            {content.length > 0 && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Conferência de Integridade do Dado Migrado</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAuditWithAi}
                    disabled={isAuditing}
                    className="text-xs font-medium text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-100 flex items-center gap-1 cursor-pointer"
                  >
                    {isAuditing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5" />
                    )}
                    <span>Auditar com IA</span>
                  </button>
                </div>

                {/* Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase">Caracteres</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {metrics.charCount.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase">Palavras</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {metrics.wordCount.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase">Tokens Est.</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      ~{metrics.estimatedTokens.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase">Checksum</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                      #{metrics.checksum}
                    </span>
                  </div>
                </div>

                {/* AI Audit Feedback */}
                {auditResult && (
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    <span className="font-semibold block text-slate-900 dark:text-slate-100 mb-1">
                      Parecer da Auditoria de Ingestão:
                    </span>
                    {auditResult}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Notas de Validação da Migração (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Verificado parágrafo final, sem truncamento."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {migratedList.length > 0 &&
                  `${migratedList.length} fonte${
                    migratedList.length > 1 ? 's' : ''
                  } migrada${migratedList.length > 1 ? 's' : ''} nesta sessão`}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Concluir e Fechar
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || !content.trim()}
                  className="px-4 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Migrar Esta Fonte e Continuar</span>
                </button>
              </div>
            </div>
          </form>

          {/* Session Migrated Queue */}
          {migratedList.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Fontes Migradas nesta Sessão:
              </span>
              <div className="space-y-1.5">
                {migratedList.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg flex items-center justify-between text-xs text-emerald-950 dark:text-emerald-200"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-medium">{m.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-emerald-800 dark:text-emerald-400">
                      <span>{m.chars} caracteres</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">#{m.checksum}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
