'use client';

import React, { useState } from 'react';
import { NotebookSource, NotebookSection, UserRole } from '@/lib/types';
import { computeTextMetrics } from '@/lib/integrity';
import {
  X,
  ShieldCheck,
  Edit3,
  Copy,
  Check,
  Trash2,
  Save,
  BookOpen,
} from 'lucide-react';

interface SourceInspectorModalProps {
  source: NotebookSource | null;
  sections?: NotebookSection[];
  userRole?: UserRole;
  isOpen: boolean;
  onClose: () => void;
  onUpdateSource: (updated: NotebookSource) => void;
  onDeleteSource: (id: string) => void;
}

export function SourceInspectorModal({
  source,
  sections = [],
  userRole = 'owner',
  isOpen,
  onClose,
  onUpdateSource,
  onDeleteSource,
}: SourceInspectorModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedSectionId, setEditedSectionId] = useState('');
  const [editedOrigin, setEditedOrigin] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [editedNotes, setEditedNotes] = useState('');
  const [copied, setCopied] = useState(false);

  const isReadOnly = userRole === 'viewer';

  if (!isOpen || !source) return null;

  const handleStartEdit = () => {
    if (isReadOnly) return;
    setEditedTitle(source.title);
    setEditedSectionId(source.sectionId || '');
    setEditedOrigin(source.originalOrigin || '');
    setEditedContent(source.content);
    setEditedNotes(source.notes || '');
    setIsEditing(true);
  };

  const currentMetrics = isEditing ? computeTextMetrics(editedContent) : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(source.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (!editedTitle.trim() || !editedContent.trim()) return;
    const metrics = computeTextMetrics(editedContent);
    onUpdateSource({
      ...source,
      title: editedTitle.trim(),
      sectionId: editedSectionId || undefined,
      originalOrigin: editedOrigin.trim() || undefined,
      content: editedContent.trim(),
      notes: editedNotes.trim() || undefined,
      charCount: metrics.charCount,
      wordCount: metrics.wordCount,
      estimatedTokens: metrics.estimatedTokens,
      checksum: metrics.checksum,
      verified: true,
    });
    setIsEditing(false);
  };

  const handleToggleVerified = () => {
    if (isReadOnly) return;
    onUpdateSource({
      ...source,
      verified: !source.verified,
    });
  };

  const currentSection = sections.find((s) => s.id === source.sectionId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {isEditing ? 'Editando Fonte' : source.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                {currentSection && (
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    {currentSection.icon} {currentSection.name} ·
                  </span>
                )}
                <span>{source.originalOrigin || 'Fonte direta'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                {!isReadOnly && (
                  <button
                    onClick={handleStartEdit}
                    className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700"
                    title="Editar fonte"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700"
                  title="Copiar texto integral"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={handleSave}
                className="flex items-center gap-1 text-xs font-semibold py-1 px-3 bg-slate-900 dark:bg-blue-600 text-white rounded-md hover:bg-slate-800"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Integrity Strip */}
        <div className="px-6 py-3 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200">
              Hash: #{isEditing ? currentMetrics?.checksum : source.checksum}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {(isEditing ? currentMetrics?.wordCount : source.wordCount)?.toLocaleString('pt-BR')}{' '}
              palavras
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {(isEditing ? currentMetrics?.charCount : source.charCount)?.toLocaleString('pt-BR')}{' '}
              caracteres
            </span>
          </div>

          <button
            onClick={handleToggleVerified}
            disabled={isReadOnly}
            className={`flex items-center gap-1.5 text-xs font-medium py-1 px-2.5 rounded-md transition-colors ${
              source.verified
                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300'
                : 'bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{source.verified ? 'Integridade Auditada' : 'Marcar como Auditada'}</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {isEditing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Título
                  </label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Seção
                  </label>
                  <select
                    value={editedSectionId}
                    onChange={(e) => setEditedSectionId(e.target.value)}
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

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Origem / Documento
                </label>
                <input
                  type="text"
                  value={editedOrigin}
                  onChange={(e) => setEditedOrigin(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Texto Integral
                </label>
                <textarea
                  rows={12}
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full text-xs p-3 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {source.summary && (
                <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60 rounded-xl text-xs text-amber-950 dark:text-amber-200">
                  <span className="font-semibold block mb-0.5">Resumo Executivo da Fonte:</span>
                  <p>{source.summary}</p>
                </div>
              )}

              <div className="p-4 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap select-text">
                {source.content}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/70 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            Migrado em:{' '}
            {new Date(source.migratedAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>

          {!isReadOnly && (
            <button
              onClick={() => {
                onDeleteSource(source.id);
                onClose();
              }}
              className="text-red-600 dark:text-red-400 hover:underline font-medium flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir Fonte</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
