'use client';

import React, { useState } from 'react';
import { Notebook } from '@/lib/types';
import {
  exportNotebookAsJson,
  exportNotebookAsMarkdown,
  encodeNotebookForShare,
  exportFullNotebookFile,
} from '@/lib/storage';
import { saveSharedNotebookToFirestore } from '@/lib/firestore';
import {
  X,
  Share2,
  Download,
  Copy,
  Check,
  FileCode,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Info,
  Lock,
  UserCheck,
  Link,
  ShieldAlert,
  Sparkles,
  Layers,
} from 'lucide-react';

interface ShareExportModalProps {
  notebook: Notebook;
  isOpen: boolean;
  onClose: () => void;
  onUpdateNotebookShareSettings?: (updatedNotebook: Notebook) => void;
}

export function ShareExportModal({
  notebook,
  isOpen,
  onClose,
  onUpdateNotebookShareSettings,
}: ShareExportModalProps) {
  const [selectedRole, setSelectedRole] = useState<'viewer' | 'editor'>('viewer');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(
    notebook.shareSettings?.requiresOwnerApprovalForEdit ?? true
  );
  const [cleanChatWhenSharing, setCleanChatWhenSharing] = useState(true);
  const [shareId, setShareId] = useState<string>('');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  React.useEffect(() => {
    if (!isOpen || !notebook) return;
    let isCancelled = false;

    // Use queueMicrotask or async start to avoid synchronous setState inside effect body
    queueMicrotask(() => {
      if (!isCancelled) setIsGeneratingLink(true);
    });

    async function generateLink() {
      // 1. Try saving to Cloud Firestore with subcollections (handles 300+ sources without size limits)
      try {
        const cloudRes = await saveSharedNotebookToFirestore(notebook);
        if (!isCancelled && cloudRes.success && cloudRes.shareId) {
          setShareId(cloudRes.shareId);
          setIsGeneratingLink(false);
          return;
        }
      } catch (cloudErr) {
        console.warn('Direct Firestore share fallback:', cloudErr);
      }

      // 2. Fallback to /api/share
      fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebook }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (!isCancelled && data && data.shareId) {
            setShareId(data.shareId);
          }
        })
        .catch((err) => {
          console.error('Failed to create server share link:', err);
        })
        .finally(() => {
          if (!isCancelled) setIsGeneratingLink(false);
        });
    }

    generateLink();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, notebook]);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const encodedPayload = encodeNotebookForShare(notebook);

  const shareUrl = shareId
    ? `${currentOrigin}/?notebookId=${notebook.id}&role=${selectedRole}${
        cleanChatWhenSharing ? '&cleanChat=true' : ''
      }&shareId=${shareId}`
    : `${currentOrigin}/?notebookId=${notebook.id}&role=${selectedRole}${
        cleanChatWhenSharing ? '&cleanChat=true' : ''
      }#data=${encodedPayload}`;

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyJson = () => {
    const payload = selectedRole === 'viewer'
      ? { ...notebook, shareSettings: { ...notebook.shareSettings, defaultRole: 'viewer' } }
      : notebook;
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleToggleApproval = (checked: boolean) => {
    setRequiresApproval(checked);
    if (onUpdateNotebookShareSettings) {
      onUpdateNotebookShareSettings({
        ...notebook,
        shareSettings: {
          isPubliclyShared: true,
          defaultRole: selectedRole,
          allowReaderChat: true,
          requiresOwnerApprovalForEdit: checked,
          shareCode: notebook.shareSettings?.shareCode || `omni-${notebook.id.slice(0, 6)}`,
          ownerEmail: notebook.ownerEmail,
        },
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Share2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Compartilhar este Caderno: {notebook.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Compartilhamento isolado com permissão de leitor ou editor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Permission Level Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
              1. Nível de Permissão para este Caderno:
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedRole('viewer')}
                className={`p-3 text-left rounded-xl border transition-all ${
                  selectedRole === 'viewer'
                    ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 shadow-2xs font-medium'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Permissão de Leitor</span>
                  </span>
                  {selectedRole === 'viewer' && <Check className="w-4 h-4 text-blue-600" />}
                </div>
                <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                  O usuário pode fazer perguntas ao chatbot e consultar as fontes, mas não pode
                  adicionar, editar ou excluir nada.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('editor')}
                className={`p-3 text-left rounded-xl border transition-all ${
                  selectedRole === 'editor'
                    ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 shadow-2xs font-medium'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-purple-600" />
                    <span>Permissão de Editor</span>
                  </span>
                  {selectedRole === 'editor' && <Check className="w-4 h-4 text-blue-600" />}
                </div>
                <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                  Acesso total de gestão de fontes e sessões. Requer autorização prévia sua.
                </p>
              </button>
            </div>
          </div>

          {/* Owner Approval Enforcement Notice */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Controle de Autorização do Proprietário</span>
              </div>
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => handleToggleApproval(e.target.checked)}
                className="rounded-sm border-amber-300 text-amber-600 cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              Quando ativado, qualquer usuário com permissão de leitor que tentar editar ou
              adicionar novas fontes precisa que você conceda autorização formalmente.
            </p>
          </div>

          {/* Share Link Generation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                2. Link Compartilhável deste Caderno ({selectedRole === 'viewer' ? 'Leitor' : 'Editor'}):
              </label>

              {/* Clean chat option */}
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleanChatWhenSharing}
                  onChange={(e) => setCleanChatWhenSharing(e.target.checked)}
                  className="rounded-sm border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-400"
                />
                <span>Compartilhar com chat limpo (novo chat)</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-mono select-all focus:outline-hidden"
              />
              <button
                onClick={handleCopyShareLink}
                className="px-3.5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Export Options */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                3. Exportar Arquivo & Backup do Caderno:
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {notebook.sources.length} fontes · {notebook.sections.length} seções
              </span>
            </div>

            {/* Featured Export: Complete .atnb package */}
            <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5 sm:mt-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Caderno Completo (.atnb)
                    </h4>
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-600 text-white shadow-2xs">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">
                    Pacote nativo com metadados, todas as seções, fontes integradas, notas e histórico de conversas do chat.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => exportFullNotebookFile(notebook, 'atnb')}
                className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar .atnb</span>
              </button>
            </div>

            {/* Secondary Formats: Full JSON, Copy JSON, and Markdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => exportFullNotebookFile(notebook, 'json')}
                className="p-3 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-left transition-colors flex items-center gap-2.5 cursor-pointer"
              >
                <FileCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    Exportar JSON
                  </h4>
                  <p className="text-[10px] text-slate-500 truncate">Backup completo (.json)</p>
                </div>
              </button>

              <button
                type="button"
                onClick={handleCopyJson}
                className="p-3 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-left transition-colors flex items-center gap-2.5 cursor-pointer"
              >
                {copiedPayload ? (
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
                )}
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {copiedPayload ? 'JSON Copiado!' : 'Copiar JSON'}
                  </h4>
                  <p className="text-[10px] text-slate-500 truncate">1 clique para clipboard</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => exportNotebookAsMarkdown(notebook)}
                className="p-3 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-left transition-colors flex items-center gap-2.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    Markdown (.md)
                  </h4>
                  <p className="text-[10px] text-slate-500 truncate">Relatório legível</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
