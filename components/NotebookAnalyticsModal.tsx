'use client';

import React, { useState } from 'react';
import { Notebook, UserRole } from '@/lib/types';
import { calculateNotebookAnalytics, DayActivityData } from '@/lib/analytics';
import {
  X,
  BarChart3,
  Calendar,
  Activity,
  Sparkles,
  Layers,
  Bookmark,
  MessageSquare,
  TrendingUp,
  Download,
  ShieldCheck,
  CheckCircle2,
  Clock,
  FileText,
  Flame,
  ArrowUpRight,
  Info,
} from 'lucide-react';

interface NotebookAnalyticsModalProps {
  notebook: Notebook;
  userRole: UserRole;
  isOpen: boolean;
  onClose: () => void;
}

export function NotebookAnalyticsModal({
  notebook,
  userRole,
  isOpen,
  onClose,
}: NotebookAnalyticsModalProps) {
  const [selectedRange, setSelectedRange] = useState<'7d' | '30d'>('7d');
  const [selectedDayHover, setSelectedDayHover] = useState<DayActivityData | null>(null);
  const [copiedExport, setCopiedExport] = useState(false);

  if (!isOpen) return null;

  // Access control check: only admin ('owner') or 'editor'
  if (userRole === 'viewer') return null;

  const report = calculateNotebookAnalytics(notebook);
  const timeline = selectedRange === '7d' ? report.weeklyTimeline : report.monthlyTimeline;
  const activeHover = selectedDayHover || timeline[timeline.length - 1];

  const handleDownloadReportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `analytics_${notebook.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden transition-colors flex flex-col max-h-[92dvh] sm:max-h-[88vh]">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-800/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                  Estatísticas de Uso do Caderno
                </h3>
                <span className="hidden xs:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                  <ShieldCheck className="w-3 h-3" />
                  {userRole === 'owner' ? 'Administrador' : 'Editor'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {report.notebookEmoji} {report.notebookTitle} · Frequência e atividade
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Fechar estatísticas"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto flex-1">
          {/* Top Bar: Range Selector & Export Action */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
            <div className="flex items-center gap-1 p-0.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedRange('7d')}
                className={`py-1 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  selectedRange === '7d'
                    ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Últimos 7 dias (Semanal)
              </button>
              <button
                type="button"
                onClick={() => setSelectedRange('30d')}
                className={`py-1 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  selectedRange === '30d'
                    ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Últimos 30 dias
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadReportJson}
              className="inline-flex items-center gap-1.5 text-xs font-medium py-1 px-2.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer ml-auto"
              title="Baixar relatório completo em formato JSON"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Exportar Métricas</span>
            </button>
          </div>

          {/* KPI Summary Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Card 1: Total Queries */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50 space-y-1">
              <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Requisições IA</span>
                <MessageSquare className="w-4 h-4" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
                {selectedRange === '7d' ? report.weeklyQueries : report.totalQueries}
              </p>
              <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                {report.todayQueries} {report.todayQueries === 1 ? 'realizada hoje' : 'realizadas hoje'}
              </p>
            </div>

            {/* Card 2: Weekly Average */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 space-y-1">
              <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Média / Dia</span>
                <TrendingUp className="w-4 h-4" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
                {report.weeklyAverage}
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium truncate">
                Pico: {report.peakDay.queries} ({report.peakDay.dayName})
              </p>
            </div>

            {/* Card 3: Indexed Knowledge */}
            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 space-y-1">
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Tokens Estimados</span>
                <Sparkles className="w-4 h-4" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 truncate">
                {report.sourcesMetrics.totalTokens >= 1000
                  ? `~${(report.sourcesMetrics.totalTokens / 1000).toFixed(1)}k`
                  : report.sourcesMetrics.totalTokens}
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium truncate">
                {report.sourcesMetrics.totalWords.toLocaleString('pt-BR')} palavras
              </p>
            </div>

            {/* Card 4: Fontes Ativas */}
            <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/50 space-y-1">
              <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Fontes Ancoradas</span>
                <Layers className="w-4 h-4" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
                {report.sourcesMetrics.enabled}/{report.sourcesMetrics.total}
              </p>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                {report.sourcesMetrics.enabledPercentage}% ativas para consulta
              </p>
            </div>
          </div>

          {/* Interactive Activity Chart (Bar Chart) */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Frequência de Requisições por Dia ({selectedRange === '7d' ? 'Semana Atual' : '30 Dias'})
                </h4>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {report.activeDaysInWeek} de 7 dias com atividade
              </span>
            </div>

            {/* Visual Bars Container */}
            <div className="pt-4 pb-2">
              <div className="flex items-end justify-between gap-1.5 sm:gap-3 h-36 px-1">
                {timeline.map((day, idx) => {
                  const isHovered = activeHover?.date === day.date;
                  const barHeight = Math.max(day.percentageOfMax, day.queries > 0 ? 12 : 4);
                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center gap-2 h-full justify-end cursor-pointer group"
                      onMouseEnter={() => setSelectedDayHover(day)}
                      onClick={() => setSelectedDayHover(day)}
                    >
                      {/* Counter on top of bar */}
                      <span
                        className={`text-[10px] font-bold transition-opacity ${
                          day.queries > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600 opacity-60'
                        }`}
                      >
                        {day.queries}
                      </span>

                      {/* Animated Column Bar */}
                      <div className="w-full max-w-[38px] bg-slate-200/80 dark:bg-slate-700/80 rounded-t-lg overflow-hidden flex flex-col justify-end h-28 relative">
                        <div
                          style={{ height: `${barHeight}%` }}
                          className={`w-full rounded-t-lg transition-all duration-300 ${
                            day.isToday
                              ? 'bg-blue-600 dark:bg-blue-500 shadow-xs ring-1 ring-blue-400'
                              : isHovered
                              ? 'bg-amber-500 dark:bg-amber-400'
                              : day.queries > 0
                              ? 'bg-slate-800 dark:bg-slate-300 group-hover:bg-blue-500'
                              : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        />
                      </div>

                      {/* Day Label */}
                      <div className="text-center">
                        <span
                          className={`text-[10px] sm:text-xs block font-semibold ${
                            day.isToday
                              ? 'text-blue-600 dark:text-blue-400 font-bold'
                              : isHovered
                              ? 'text-slate-900 dark:text-white'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {day.dayName}
                        </span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 hidden sm:block">
                          {day.shortDate}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Day Detail Highlight Card */}
            {activeHover && (
              <div className="mt-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {activeHover.dayName}, {activeHover.shortDate}
                    {activeHover.isToday && (
                      <span className="ml-1.5 px-1.5 py-0.2 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded text-[10px] font-bold">
                        Hoje
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 font-medium">
                  <span>
                    <strong>{activeHover.queries}</strong> {activeHover.queries === 1 ? 'pergunta' : 'perguntas'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    <strong>~{activeHover.tokensEstimated}</strong> tokens
                  </span>
                  {activeHover.sourcesAdded > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        +{activeHover.sourcesAdded} fontes
                      </span>
                    </>
                  )}
                  {activeHover.notesAdded > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-600 dark:text-amber-400">
                        +{activeHover.notesAdded} notas
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section Distribution & Content Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Sections Engagement */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Distribuição por Seção</span>
                </h4>
                <span className="text-[11px] text-slate-400">
                  {report.sectionsMetrics.length} seções
                </span>
              </div>

              {report.sectionsMetrics.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  Nenhuma seção temática criada ainda.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {report.sectionsMetrics.map((sec) => (
                    <div key={sec.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 truncate max-w-[200px]">
                          <span>{sec.icon}</span>
                          <span className="truncate">{sec.name}</span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold shrink-0">
                          {sec.sourcesCount} fontes · {sec.notesCount} notas
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          style={{
                            width: `${Math.max(sec.percentage, 5)}%`,
                            backgroundColor: sec.color || '#3b82f6',
                          }}
                          className="h-full rounded-full transition-all"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Repository Overview & Details */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-3">
              <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Inventário de Conhecimento</span>
              </h4>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Total de Fontes Catalogadas</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {report.sourcesMetrics.total} ({report.sourcesMetrics.enabled} ativas)
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Total de Caracteres</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {report.sourcesMetrics.totalCharacters.toLocaleString('pt-BR')} chars
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Média de Tokens por Fonte</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    ~{report.sourcesMetrics.averageTokensPerSource.toLocaleString('pt-BR')} tokens
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Anotações e Sínteses</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {report.notesMetrics.total} notas (~{report.notesMetrics.totalWords} palavras)
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Última Atualização Registrada</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {report.lastActiveFormatted}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>Métricas geradas com base nas requisições factuais e fontes do caderno.</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold hover:bg-slate-800 dark:hover:bg-white transition-colors cursor-pointer shadow-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
