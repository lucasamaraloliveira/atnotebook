'use client';

import React, { useState, useRef, type DragEvent } from 'react';
import { Notebook } from '@/lib/types';
import {
  validateAndParseNotebookPackage,
  type ParseNotebookResult,
} from '@/lib/storage';
import {
  X,
  UploadCloud,
  FileCheck2,
  FileCode,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  Layers,
  FileText,
  MessageSquare,
  Sparkles,
  ClipboardPaste,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface ImportNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (importedNotebook: Notebook, customTitle?: string) => void;
}

export function ImportNotebookModal({
  isOpen,
  onClose,
  onConfirmImport,
}: ImportNotebookModalProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'raw_text'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);

  // Parse result state
  const [parseResult, setParseResult] = useState<ParseNotebookResult | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setParseResult(null);
    setFileName(null);
    setFileSize(null);
    setRawText('');
    setCustomTitle('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processContent = (text: string, name?: string, sizeInBytes?: number) => {
    setIsProcessing(true);
    const result = validateAndParseNotebookPackage(text);
    setParseResult(result);
    if (result.success && result.notebook) {
      setCustomTitle(result.notebook.title);
    }
    if (name) setFileName(name);
    if (sizeInBytes !== undefined) {
      const kb = (sizeInBytes / 1024).toFixed(1);
      setFileSize(`${kb} KB`);
    }
    setIsProcessing(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processContent(text, file.name, file.size);
    };
    reader.onerror = () => {
      setParseResult({
        success: false,
        error: 'Erro ao ler o arquivo selecionado no navegador.',
      });
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processContent(text, file.name, file.size);
    };
    reader.onerror = () => {
      setParseResult({
        success: false,
        error: 'Falha ao processar arquivo solto no navegador.',
      });
    };
    reader.readAsText(file);
  };

  const handleRawTextParse = () => {
    if (!rawText.trim()) return;
    processContent(rawText, 'clipboard_backup.json');
  };

  const handleConfirm = () => {
    if (!parseResult?.success || !parseResult.notebook) return;
    onConfirmImport(parseResult.notebook, customTitle.trim() || undefined);
    handleReset();
    onClose();
  };

  const metrics = parseResult?.metrics;
  const notebook = parseResult?.notebook;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden transition-colors flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <UploadCloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                Importar Caderno Completo
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  .atnb / .json
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Restaure um caderno com todas as fontes, seções, notas e histórico de conversas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Navigation Tabs (only shown before valid notebook identified or when resetting) */}
          {!parseResult?.success && (
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('file');
                  handleReset();
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'file'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Arquivo .atnb ou .json</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('raw_text');
                  handleReset();
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'raw_text'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Colar Código JSON</span>
              </button>
            </div>
          )}

          {/* TAB 1: File Upload & Drag and Drop */}
          {!parseResult?.success && activeTab === 'file' && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${
                isDragging
                  ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 ring-4 ring-blue-500/10'
                  : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".atnb,.json,application/json,application/octet-stream"
                onChange={handleFileChange}
                className="hidden"
                id="atnb-file-input"
              />

              <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 shadow-2xs">
                <UploadCloud className="w-6 h-6" />
              </div>

              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Arraste o arquivo .atnb ou .json aqui
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
                Suporta backups proprietários (.atnb) e exportações JSON completas do ATNotebook.
              </p>

              <label
                htmlFor="atnb-file-input"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Escolher Arquivo no Computador</span>
              </label>

              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Importação 100% segura: gera novos IDs únicos sem sobrescrever outros cadernos</span>
              </div>
            </div>
          )}

          {/* TAB 2: Direct Raw JSON Text */}
          {!parseResult?.success && activeTab === 'raw_text' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Cole o conteúdo estruturado do backup JSON:
                </label>
                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder='{"format":"ATNotebook","version":1,"notebook":{...}}'
                  className="w-full text-xs font-mono px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-hidden resize-none"
                />
              </div>

              <button
                type="button"
                onClick={handleRawTextParse}
                disabled={!rawText.trim() || isProcessing}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Verificar e Analisar Estrutura</span>
              </button>
            </div>
          )}

          {/* Error Message */}
          {parseResult && !parseResult.success && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <h5 className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                  Falha na validação do arquivo
                </h5>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed">
                  {parseResult.error}
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-300 underline hover:no-underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Tentar com outro arquivo</span>
                </button>
              </div>
            </div>
          )}

          {/* SUCCESS PREVIEW: Identified Notebook Info & Counters */}
          {parseResult?.success && notebook && metrics && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              {/* File details pill */}
              <div className="flex items-center justify-between text-xs px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-900 dark:text-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-semibold">
                    {parseResult.sourceFormat === 'atnb_package'
                      ? 'Pacote Oficial ATNotebook verificado com sucesso!'
                      : 'Backup JSON de Caderno verificado com sucesso!'}
                  </span>
                </div>
                {fileName && (
                  <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 truncate max-w-[140px] sm:max-w-[200px]">
                    {fileName} {fileSize ? `(${fileSize})` : ''}
                  </span>
                )}
              </div>

              {/* Notebook Card Preview */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-2xl shadow-2xs shrink-0 select-none">
                    {notebook.emoji || '📓'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                      Caderno Identificado
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {notebook.title}
                    </h4>
                    {notebook.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">
                        {notebook.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Metrics Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-0.5">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Fontes</span>
                    </div>
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {metrics.totalSources}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {metrics.totalWords.toLocaleString('pt-BR')} palavras
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-semibold mb-0.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Seções</span>
                    </div>
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {metrics.totalSections}
                    </span>
                    <span className="text-[10px] text-slate-400 block">pastas vinculadas</span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 text-xs font-semibold mb-0.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Notas</span>
                    </div>
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {metrics.totalNotes}
                    </span>
                    <span className="text-[10px] text-slate-400 block">anotações salvas</span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-0.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Conversas</span>
                    </div>
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {metrics.totalChatSessions}
                    </span>
                    <span className="text-[10px] text-slate-400 block">sessões de chat</span>
                  </div>
                </div>
              </div>

              {/* Title Customization Field */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Nome do novo caderno no ATNotebook:
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Nome do caderno..."
                  className="w-full text-xs px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden"
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1">
                  Um novo caderno independente será criado, preservando todas as relações de fontes e seções sem interferir no conteúdo original.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/70 flex items-center justify-between gap-2">
          {parseResult?.success ? (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Trocar Arquivo</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          )}

          {parseResult?.success && (
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Importar Caderno para o ATNotebook</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
