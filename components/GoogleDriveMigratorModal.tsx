'use client';

import React, { useState, useEffect } from 'react';
import {
  googleSignIn,
  getAccessToken,
  logoutGoogle,
  initAuth,
} from '@/lib/googleAuth';
import {
  listDriveFiles,
  importDriveFilesBatch,
  DriveItem,
} from '@/lib/driveApi';
import { NotebookSource } from '@/lib/types';
import {
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  FileText,
  FileCode,
  Table,
  ShieldCheck,
  CheckSquare,
  Square,
  Download,
  LogOut,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { NotebookSection } from '@/lib/types';

interface GoogleDriveMigratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchImport: (
    sources: Array<Omit<NotebookSource, 'id'>>,
    createNewNotebookName?: string
  ) => void;
  currentNotebookTitle: string;
  sections?: NotebookSection[];
}

export function GoogleDriveMigratorModal({
  isOpen,
  onClose,
  onBatchImport,
  currentNotebookTitle,
  sections = [],
}: GoogleDriveMigratorModalProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Files browsing state
  const [files, setFiles] = useState<DriveItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fileFilter, setFileFilter] = useState<'all' | 'docs' | 'text' | 'spreadsheets'>('all');

  // Selection state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    currentName: string;
  } | null>(null);
  const [importCompletedCount, setImportCompletedCount] = useState<number | null>(null);
  const [targetDestination, setTargetDestination] = useState<'current' | 'new'>('current');
  const [targetSectionId, setTargetSectionId] = useState<string>('');
  const [newNotebookTitle, setNewNotebookTitle] = useState('Caderno Google Drive');

  // Listen to Auth State
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  const handleFetchFiles = async (appendPage = false) => {
    if (!token) return;
    setIsLoadingFiles(true);
    try {
      const result = await listDriveFiles(token, {
        query: searchQuery,
        fileTypeFilter: fileFilter,
        pageToken: appendPage ? nextPageToken : undefined,
        pageSize: 100,
      });

      if (appendPage) {
        setFiles((prev) => [...prev, ...result.files]);
      } else {
        setFiles(result.files);
      }
      setNextPageToken(result.nextPageToken);
    } catch (err: any) {
      console.error('Erro ao listar arquivos:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Load files when token or filters change
  useEffect(() => {
    let ignore = false;
    if (token && isOpen) {
      listDriveFiles(token, {
        query: searchQuery,
        fileTypeFilter: fileFilter,
        pageSize: 100,
      })
        .then((result) => {
          if (!ignore) {
            setFiles(result.files);
            setNextPageToken(result.nextPageToken);
          }
        })
        .catch((err) => {
          console.error('Erro ao listar arquivos:', err);
        });
    }
    return () => {
      ignore = true;
    };
  }, [token, isOpen, fileFilter, searchQuery]);

  if (!isOpen) return null;

  const handleLogin = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao conectar à conta Google.');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    setUser(null);
    setToken(null);
    setFiles([]);
    setSelectedFileIds(new Set());
  };

  const handleToggleSelectAll = () => {
    if (selectedFileIds.size === files.length && files.length > 0) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(files.map((f) => f.id)));
    }
  };

  const handleToggleFile = (id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleStartBulkImport = async () => {
    if (!token || selectedFileIds.size === 0 || isImporting) return;

    const filesToImport = files.filter((f) => selectedFileIds.has(f.id));
    if (filesToImport.length === 0) return;

    setIsImporting(true);
    setImportCompletedCount(null);

    try {
      const imported = await importDriveFilesBatch(
        token,
        filesToImport,
        (current, total, currentName) => {
          setImportProgress({ current, total, currentName });
        }
      );

      const mappedImported = imported.map((s) => ({
        ...s,
        sectionId:
          targetDestination === 'current' && targetSectionId
            ? targetSectionId
            : undefined,
      }));

      setImportCompletedCount(mappedImported.length);
      onBatchImport(
        mappedImported,
        targetDestination === 'new' ? newNotebookTitle : undefined
      );
    } catch (err: any) {
      alert(`Erro na importação em massa: ${err.message}`);
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('document')) return <FileText className="w-4 h-4 text-blue-600" />;
    if (mimeType.includes('spreadsheet')) return <Table className="w-4 h-4 text-emerald-600" />;
    if (mimeType.includes('folder')) return <FolderOpen className="w-4 h-4 text-amber-500" />;
    return <FileCode className="w-4 h-4 text-slate-600" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <FolderOpen className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                Migrador Direto do Google Drive & Notebooks
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Importação em massa sem necessidade de copiar link a link
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

        {/* Informational strip */}
        <div className="px-5 sm:px-6 py-2.5 bg-blue-50/70 dark:bg-blue-950/40 border-b border-blue-200/60 dark:border-blue-900/50 flex items-center gap-2 text-xs text-blue-950 dark:text-blue-200">
          <Info className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
          <span>
            Ideal para migrar centenas de fontes de uma só vez. Acesso somente leitura com
            preservação integral de texto e cálculo automático de checksum.
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!token ? (
            /* Not logged in State */
            <div className="max-w-md mx-auto py-12 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-700 shadow-2xs">
                <FolderOpen className="w-8 h-8 text-blue-600" />
              </div>

              <div className="space-y-2">
                <h4 className="text-base font-semibold text-slate-900">
                  Conecte sua Conta Google
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Permite listar diretamente seus documentos, arquivos e pastas do Google Drive
                  para selecionar dezenas ou centenas de fontes com 1 clique.
                </p>
              </div>

              {/* Official Google Sign-In Button */}
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={isLoadingAuth}
                  className="inline-flex items-center gap-3 px-6 py-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-colors text-sm font-medium text-slate-700 disabled:opacity-60 cursor-pointer"
                >
                  <svg className="w-5 h-5" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>
                    {isLoadingAuth ? 'Conectando ao Google...' : 'Entrar com o Google'}
                  </span>
                </button>
              </div>

              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
                  {authError}
                </div>
              )}
            </div>
          ) : (
            /* Logged in & File Browser State */
            <div className="space-y-5">
              {/* Connected Account Bar */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                    {user?.displayName ? user.displayName.charAt(0) : 'G'}
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block leading-tight truncate">
                      {user?.displayName || 'Conta Google Conectada'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                      {user?.email}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 px-2 py-1 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Desconectar</span>
                </button>
              </div>

              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar arquivos por nome (ex: Caderno, Relatório)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFetchFiles(false)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-hidden"
                  />
                </div>

                {/* Filter buttons */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    onClick={() => setFileFilter('all')}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                      fileFilter === 'all'
                        ? 'bg-slate-900 dark:bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFileFilter('docs')}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                      fileFilter === 'docs'
                        ? 'bg-slate-900 dark:bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Docs
                  </button>
                  <button
                    onClick={() => setFileFilter('text')}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                      fileFilter === 'text'
                        ? 'bg-slate-900 dark:bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Texto/MD
                  </button>
                  <button
                    onClick={() => setFileFilter('spreadsheets')}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                      fileFilter === 'spreadsheets'
                        ? 'bg-slate-900 dark:bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Planilhas
                  </button>

                  <button
                    onClick={() => handleFetchFiles(false)}
                    disabled={isLoadingFiles}
                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                    title="Atualizar lista"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Selection Bar */}
              <div className="p-3 bg-slate-100/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between text-xs">
                <button
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white"
                >
                  {selectedFileIds.size === files.length && files.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>
                    {selectedFileIds.size === files.length && files.length > 0
                      ? 'Desmarcar todos'
                      : `Selecionar todos (${files.length} arquivos listados)`}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-blue-700 dark:text-blue-400">
                    {selectedFileIds.size} selecionado{selectedFileIds.size !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Files Table / List */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-64 sm:max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {isLoadingFiles && files.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                    <span>Buscando arquivos no seu Google Drive...</span>
                  </div>
                ) : files.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400">
                    Nenhum documento encontrado com os filtros atuais.
                  </div>
                ) : (
                  files.map((file) => {
                    const isSelected = selectedFileIds.has(file.id);
                    return (
                      <div
                        key={file.id}
                        onClick={() => handleToggleFile(file.id)}
                        className={`p-3 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-50 dark:hover:bg-blue-950/60'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded-sm border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-400 pointer-events-none"
                          />
                          <div className="shrink-0">{getFileIcon(file.mimeType)}</div>
                          <div className="min-w-0">
                            <span className="font-medium text-slate-900 dark:text-slate-100 block truncate">
                              {file.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {file.mimeType.replace('application/vnd.google-apps.', '')}
                            </span>
                          </div>
                        </div>

                        {file.modifiedTime && (
                          <span className="text-[11px] text-slate-400 shrink-0">
                            {new Date(file.modifiedTime).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination button if has more files */}
              {nextPageToken && (
                <div className="text-center pt-1">
                  <button
                    onClick={() => handleFetchFiles(true)}
                    disabled={isLoadingFiles}
                    className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    Carregar mais 100 arquivos...
                  </button>
                </div>
              )}

              {/* Destination selector */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Destino da Importação em Massa:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-start gap-2.5 p-3 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-pointer hover:border-slate-400 transition-colors">
                    <input
                      type="radio"
                      name="dest"
                      checked={targetDestination === 'current'}
                      onChange={() => setTargetDestination('current')}
                      className="mt-0.5 text-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                        Inserir no Caderno Atual
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1.5 truncate">
                        {currentNotebookTitle}
                      </span>
                      {targetDestination === 'current' && sections.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">
                            Atribuir à Sessão:
                          </span>
                          <select
                            value={targetSectionId}
                            onChange={(e) => setTargetSectionId(e.target.value)}
                            className="w-full text-xs p-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
                          >
                            <option value="">Sem Sessão (Geral)</option>
                            {sections.map((sec) => (
                              <option key={sec.id} value={sec.id}>
                                {sec.icon} {sec.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-pointer hover:border-slate-400 transition-colors">
                    <input
                      type="radio"
                      name="dest"
                      checked={targetDestination === 'new'}
                      onChange={() => setTargetDestination('new')}
                      className="mt-0.5 text-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                        Criar Novo Caderno Dedicado
                      </span>
                      {targetDestination === 'new' && (
                        <input
                          type="text"
                          value={newNotebookTitle}
                          onChange={(e) => setNewNotebookTitle(e.target.value)}
                          className="mt-1.5 w-full text-xs px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                          placeholder="Nome do novo caderno..."
                        />
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Progress Bar during Import */}
              {isImporting && importProgress && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-blue-950 dark:text-blue-200 font-semibold">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-700 dark:text-blue-400" />
                      <span>
                        Importando {importProgress.current} de {importProgress.total} fontes...
                      </span>
                    </div>
                    <span>
                      {Math.round((importProgress.current / importProgress.total) * 100)}%
                    </span>
                  </div>

                  <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-150"
                      style={{
                        width: `${(importProgress.current / importProgress.total) * 100}%`,
                      }}
                    />
                  </div>

                  <p className="text-[11px] text-blue-800 dark:text-blue-300 truncate">
                    Lendo e auditando integridade: {importProgress.currentName}
                  </p>
                </div>
              )}

              {/* Completed Success Alert */}
              {importCompletedCount !== null && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-950 dark:text-emerald-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <span className="font-semibold block">
                        {importCompletedCount} fontes importadas com sucesso!
                      </span>
                      <span className="text-[11px] text-emerald-800 dark:text-emerald-400">
                        Todos os conteúdos foram auditados, com hash e tokens calculados.
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md font-medium"
                  >
                    Ver no Caderno
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs">
            {token
              ? `${selectedFileIds.size} de ${files.length} selecionados`
              : 'Conexão segura com a API do Google Drive'}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isImporting}
              className="px-3 sm:px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              {importCompletedCount !== null ? 'Fechar' : 'Cancelar'}
            </button>

            {token && (
              <button
                onClick={handleStartBulkImport}
                disabled={selectedFileIds.size === 0 || isImporting}
                className="px-4 sm:px-5 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Importando...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Importar {selectedFileIds.size} Fontes</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
