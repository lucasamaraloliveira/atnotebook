'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, NotebookSource, CitationRef, NotebookSection, ChatSession, UserRole } from '@/lib/types';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  BookmarkPlus,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  BookOpen,
  ArrowRight,
  RotateCcw,
  Trash2,
  X,
  History,
  Clock,
  MessageSquare,
  ArrowUpRight,
} from 'lucide-react';

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  sources: NotebookSource[];
  sections?: NotebookSection[];
  notebookTitle: string;
  userRole?: UserRole;
  onSendMessage: (text: string) => Promise<void>;
  onSaveAsNote: (title: string, content: string) => void;
  onInspectCitation: (sourceTitle: string) => void;
  isGenerating: boolean;
  onClearChat?: () => void;
  isSourcesOpen?: boolean;
  onToggleSources?: () => void;
  isNotesOpen?: boolean;
  onToggleNotes?: () => void;
  chatSessions?: ChatSession[];
  onSelectChatSession?: (session: ChatSession) => void;
  onDeleteChatSession?: (sessionId: string) => void;
  onClearAllChatSessions?: () => void;
  onRestoreChatSessions?: (sessions: ChatSession[]) => void;
}

const SUGGESTED_PROMPTS = [
  'Quais são os principais pontos de convergência entre as fontes?',
  'Existe alguma divergência ou contradição entre os documentos?',
  'Resuma os procedimentos da sessão de recepção em tópicos.',
  'Qual o impacto prático das restrições de plataformas fechadas?',
];

export function ChatWorkspace({
  messages,
  sources,
  sections = [],
  notebookTitle,
  userRole = 'owner',
  onSendMessage,
  onSaveAsNote,
  onInspectCitation,
  isGenerating,
  onClearChat,
  isSourcesOpen = true,
  onToggleSources,
  isNotesOpen = true,
  onToggleNotes,
  chatSessions = [],
  onSelectChatSession,
  onDeleteChatSession,
  onClearAllChatSessions,
  onRestoreChatSessions,
}: ChatWorkspaceProps) {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  // Deletion modals & Undo states
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);
  const [isConfirmClearAllHistoryOpen, setIsConfirmClearAllHistoryOpen] = useState(false);
  const [undoState, setUndoState] = useState<{
    message: string;
    sessions: ChatSession[];
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeSources = userRole === 'viewer'
    ? sources.map((s) => ({ ...s, enabled: true }))
    : sources.filter((s) => s.enabled !== false);

  // Auto-dismiss undo banner after 10 seconds
  useEffect(() => {
    if (undoState) {
      const timer = setTimeout(() => {
        setUndoState(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [undoState]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    const text = input.trim();
    setInput('');
    await onSendMessage(text);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveNote = (msg: ChatMessage) => {
    const title = `Nota: ${msg.content.slice(0, 40).replace(/[*#]/g, '')}...`;
    onSaveAsNote(title, msg.content);
    setSavedId(msg.id);
    setTimeout(() => setSavedId(null), 2000);
  };

  const handleConfirmClear = () => {
    if (onClearChat) {
      onClearChat();
    }
    setIsConfirmClearOpen(false);
  };

  // Handlers for deleting single session with modal + undo
  const handleRequestDeleteSession = (session: ChatSession) => {
    setSessionToDelete(session);
  };

  const handleConfirmDeleteSingleSession = () => {
    if (!sessionToDelete) return;
    const deletedSession = sessionToDelete;
    if (onDeleteChatSession) {
      onDeleteChatSession(deletedSession.id);
    }
    setUndoState({
      message: `Conversa "${deletedSession.title.length > 32 ? deletedSession.title.slice(0, 30) + '...' : deletedSession.title}" excluída do histórico.`,
      sessions: [deletedSession],
    });
    setSessionToDelete(null);
  };

  // Handlers for clearing all history with modal + undo
  const handleRequestClearAllHistory = () => {
    setIsConfirmClearAllHistoryOpen(true);
  };

  const handleConfirmClearAllHistory = () => {
    const sessionsBackup = [...chatSessions];
    if (onClearAllChatSessions) {
      onClearAllChatSessions();
    }
    setUndoState({
      message: `Todo o histórico (${sessionsBackup.length} conversas) foi excluído.`,
      sessions: sessionsBackup,
    });
    setIsConfirmClearAllHistoryOpen(false);
  };

  // Undo deletion
  const handleUndoDelete = () => {
    if (!undoState || !onRestoreChatSessions) return;
    onRestoreChatSessions(undoState.sessions);
    setUndoState(null);
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-slate-900 relative transition-colors overflow-hidden">
      {/* Workspace Banner */}
      <div className="px-4 sm:px-8 py-2.5 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400 shrink-0 z-10 w-full">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
            {notebookTitle}
          </span>
          <span aria-hidden="true" className="hidden xs:inline">·</span>
          <span className="hidden sm:inline truncate">
            {activeSources.length === 0
              ? 'Nenhuma fonte ativa'
              : `${activeSources.length} fonte${activeSources.length > 1 ? 's' : ''} ancorada${
                  activeSources.length > 1 ? 's' : ''
                }`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Conversation History Button */}
          {chatSessions && chatSessions.length > 0 && (
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-1.5 text-[11px] font-semibold py-1 px-2.5 sm:px-3 rounded-lg border bg-slate-100 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-2xs"
              title="Ver histórico de conversas e ações salvas no banco de dados"
            >
              <History className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Histórico</span>
              <span className="ml-0.5 px-1.5 py-0.2 bg-amber-200/80 dark:bg-amber-950 text-amber-900 dark:text-amber-300 text-[10px] font-bold rounded-full">
                {chatSessions.length}
              </span>
            </button>
          )}

          {/* Clear Chat / Novo Chat button */}
          {onClearChat && (
            <button
              type="button"
              onClick={() => {
                if (messages.length === 0) return;
                setIsConfirmClearOpen(true);
              }}
              disabled={messages.length === 0}
              title={
                messages.length === 0
                  ? 'O chat já está limpo'
                  : 'Limpar sessão e iniciar um novo chat'
              }
              className={`flex items-center gap-1 text-[11px] font-medium py-1 px-2 sm:px-2.5 rounded-lg border transition-all ${
                messages.length > 0
                  ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-900 shadow-2xs cursor-pointer'
                  : 'opacity-40 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Novo Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 w-full min-h-0 flex flex-col justify-between">
        <div className="w-full max-w-5xl xl:max-w-6xl mx-auto space-y-6 flex-1 flex flex-col justify-start">
          {messages.length === 0 ? (
            <div className="max-w-xl sm:max-w-2xl lg:max-w-3xl mx-auto py-8 sm:py-12 text-center space-y-6 my-auto">
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800 flex items-center justify-center mx-auto text-amber-800 dark:text-amber-300">
                <Sparkles className="w-6 h-6" />
              </div>

              <div className="space-y-2">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Pergunte ao seu Caderno
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg mx-auto">
                  Envie dúvidas ou peça resumos sobre as fontes anexadas. As respostas trazem referências e citações diretas aos trechos originais.
                </p>
              </div>

              {/* NotebookLM Style Section Icons */}
              {sections && sections.length > 0 && (
                <div className="space-y-2 text-left pt-1">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">
                    Seções do Caderno
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {sections.map((sec) => (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => {
                          setInput(`Resuma as principais diretrizes da seção "${sec.name}"`);
                        }}
                        className="inline-flex items-center gap-2 py-1.5 px-3 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs hover:scale-102 transition-all cursor-pointer"
                        title={`Perguntar sobre ${sec.name}`}
                      >
                        <span
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-sm shrink-0 border border-slate-200/70 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800"
                          style={{
                            backgroundColor: sec.color ? `${sec.color}15` : undefined,
                            borderColor: sec.color ? `${sec.color}35` : undefined,
                          }}
                        >
                          {sec.icon}
                        </span>
                        <span>{sec.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Prompts */}
              <div className="space-y-2 text-left pt-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">
                  Perguntas Sugeridas
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SUGGESTED_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInput(prompt);
                      }}
                      className="p-3 sm:p-3.5 text-left text-xs sm:text-[13px] bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-between group shadow-2xs"
                    >
                      <span className="line-clamp-2 leading-relaxed">{prompt}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const isUser = message.role === 'user';
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 sm:gap-4 w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900 dark:bg-slate-800 text-amber-400 flex items-center justify-center shrink-0 mt-1 shadow-2xs">
                      <Bot className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </div>
                  )}

                  <div
                    className={`flex flex-col space-y-2 ${
                      isUser
                        ? 'items-end max-w-xl sm:max-w-2xl lg:max-w-3xl'
                        : 'items-start flex-1 max-w-full'
                    }`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-3 sm:px-6 sm:py-4.5 text-sm sm:text-[14.5px] leading-relaxed ${
                        isUser
                          ? 'bg-slate-900 dark:bg-blue-600 text-white rounded-tr-xs shadow-2xs'
                          : 'w-full bg-slate-50/95 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-tl-xs shadow-2xs'
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        (() => {
                          // Strip any inline citations [Fonte: ...] or (Fonte: ...) and any trailing "Fontes Citadas" block from main text
                          let cleanText = message.content
                            .replace(/\[\s*Fonte:\s*[^\]]+\]/gi, '')
                            .replace(/\(\s*Fonte:\s*[^\)]+\)/gi, '');

                          // If markdown text includes "### 📚 Fontes Citadas" or similar header at end, split it
                          const sourcesHeaderIdx = cleanText.search(/###?\s*📚?\s*Fontes\s*(Citadas|Consultadas)/i);
                          if (sourcesHeaderIdx !== -1) {
                            cleanText = cleanText.substring(0, sourcesHeaderIdx).trim();
                          }

                          return (
                            <div className="space-y-4">
                              {message.modelNotice && (
                                <div className="p-2.5 sm:p-3 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-300/80 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center justify-between gap-2 shadow-2xs animate-in fade-in duration-200">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <RefreshCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 animate-spin" />
                                    <span className="truncate">{message.modelNotice}</span>
                                  </div>
                                  {message.usedModel && (
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-200/90 dark:bg-amber-900/90 text-amber-950 dark:text-amber-100 shrink-0">
                                      Modelo: {message.usedModel}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="prose prose-slate dark:prose-invert prose-sm sm:prose-base max-w-none font-normal">
                                <ReactMarkdown
                                  components={{
                                    p: ({ children }) => (
                                      <p className="mb-5 text-slate-800 dark:text-slate-200 leading-relaxed font-normal text-sm sm:text-[15px] tracking-normal">
                                        {children}
                                      </p>
                                    ),
                                    h1: ({ children }) => (
                                      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-7 mb-4 border-b pb-2 border-slate-200/80 dark:border-slate-700/80">
                                        {children}
                                      </h1>
                                    ),
                                    h2: ({ children }) => (
                                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-3">
                                        {children}
                                      </h2>
                                    ),
                                    h3: ({ children }) => (
                                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-5 mb-2.5">
                                        {children}
                                      </h3>
                                    ),
                                    ul: ({ children }) => (
                                      <ul className="list-disc pl-6 my-4 space-y-2 text-slate-800 dark:text-slate-200">
                                        {children}
                                      </ul>
                                    ),
                                    ol: ({ children }) => (
                                      <ol className="list-decimal pl-6 my-4 space-y-2 text-slate-800 dark:text-slate-200">
                                        {children}
                                      </ol>
                                    ),
                                    li: ({ children }) => (
                                      <li className="my-1.5 leading-relaxed">{children}</li>
                                    ),
                                    strong: ({ children }) => (
                                      <strong className="font-semibold text-slate-900 dark:text-slate-100">
                                        {children}
                                      </strong>
                                    ),
                                    blockquote: ({ children }) => (
                                      <blockquote className="my-5 pl-4 pr-3 py-2.5 border-l-4 border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 text-slate-800 dark:text-slate-200 rounded-r-xl italic font-normal">
                                        {children}
                                      </blockquote>
                                    ),
                                    code: ({ children }) => (
                                      <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-amber-700 dark:text-amber-300 rounded font-mono text-xs">
                                        {children}
                                      </code>
                                    ),
                                  }}
                                >
                                  {cleanText}
                                </ReactMarkdown>
                              </div>

                              {/* Dedicated Citations Panel */}
                              {message.citations && message.citations.length > 0 && (
                                <div className="mt-4 pt-3.5 border-t border-slate-200/80 dark:border-slate-700/80 bg-slate-100/60 dark:bg-slate-900/50 p-3.5 rounded-xl space-y-2.5 shadow-2xs">
                                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                                    <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span>Fontes Citadas nesta Resposta ({message.citations.length}):</span>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {message.citations.map((c, i) => (
                                      <button
                                        key={i}
                                        type="button"
                                        onClick={() => onInspectCitation(c.sourceTitle)}
                                        className="inline-flex items-center gap-2 text-xs py-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-amber-50/80 dark:hover:bg-slate-700/80 border border-slate-200/90 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700 text-slate-800 dark:text-slate-200 rounded-lg transition-all shadow-2xs cursor-pointer font-medium group"
                                        title={`Ver trecho original e detalhes de "${c.sourceTitle}"`}
                                      >
                                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 group-hover:scale-125 transition-transform" />
                                        <span className="truncate max-w-[260px] font-semibold">{c.sourceTitle}</span>
                                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 shrink-0 ml-0.5" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </div>

                    {/* Actions for assistant messages */}
                    {!isUser && (
                      <div className="flex items-center gap-2 text-xs text-slate-400 px-1 pt-0.5">
                        <button
                          onClick={() => handleCopy(message.id, message.content)}
                          className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        >
                          {copiedId === message.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>

                        {userRole !== 'viewer' && (
                          <>
                            <span aria-hidden="true">·</span>

                            <button
                              onClick={() => handleSaveNote(message)}
                              className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            >
                              {savedId === message.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">Salvo</span>
                                </>
                              ) : (
                                <>
                                  <BookmarkPlus className="w-3.5 h-3.5" />
                                  <span>Salvar nota</span>
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 mt-1 shadow-2xs">
                      <User className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {isGenerating && (
            <div className="flex gap-3 sm:gap-4 w-full justify-start">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900 dark:bg-slate-800 text-amber-400 flex items-center justify-center shrink-0 mt-1 animate-pulse shadow-2xs">
                <Bot className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
              <div className="max-w-md bg-slate-50/95 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl rounded-tl-xs px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2.5 shadow-2xs">
                <RefreshCw className="w-4 h-4 animate-spin text-slate-500 shrink-0" />
                <span>Consultando fontes ativas das sessões e formulando resposta...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Form Footer (Pinned at Bottom) */}
      <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md w-full shrink-0 sticky bottom-0 z-20">
        <form onSubmit={handleSubmit} className="w-full max-w-5xl xl:max-w-6xl mx-auto space-y-2">
          {activeSources.length === 0 && (
            <div className="p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Nenhuma fonte está ativa nas sessões. Marque fontes no painel para que a IA possa
                responder.
              </span>
            </div>
          )}

          <div className="relative flex items-center">
            <input
              type="text"
              placeholder={
                activeSources.length === 0
                  ? 'Selecione fontes no painel esquerdo para perguntar...'
                  : `Pergunte à IA sobre as ${activeSources.length} fontes ativas...`
              }
              value={input}
              disabled={isGenerating || activeSources.length === 0}
              onChange={(e) => setInput(e.target.value)}
              className="w-full pl-4 pr-12 py-3 text-sm bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-800/90 focus:bg-white dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:text-slate-900 dark:focus:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600 transition-all disabled:opacity-50 shadow-2xs"
            />
            <button
              type="submit"
              disabled={!input.trim() || isGenerating || activeSources.length === 0}
              className="absolute right-2 p-2 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white rounded-lg transition-colors disabled:cursor-not-allowed shadow-2xs cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>Respostas ancoradas estritamente nas fontes com verificação de integridade.</span>
            <span>Enter para enviar</span>
          </div>
        </form>
      </div>

      {/* Clear Chat Confirmation Modal */}
      {isConfirmClearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Limpar Conversa e Iniciar Novo Chat?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Isso limpará as {messages.length} mensagens desta conversa para não sobrecarregar a tela. Suas fontes e anotações permanecerão salvas no caderno.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsConfirmClearOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="px-4 py-2 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Iniciar Novo Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conversation History Drawer Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full max-w-md sm:max-w-lg h-full shadow-2xl flex flex-col justify-between overflow-hidden">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/90">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                    Histórico de Conversas & Ações
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {chatSessions.length} conversa{chatSessions.length !== 1 ? 's' : ''} salva{chatSessions.length !== 1 ? 's' : ''} no banco de dados
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* History Items List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Highlight recent 3 items badge */}
              <div className="p-3 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 rounded-xl text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 min-w-0">
                  <span className="font-semibold block">Últimas 3 Ações mantidas em destaque:</span>
                  <span className="text-[11.5px] opacity-90 leading-relaxed block">
                    Alterne entre conversas salvas ou exclua itens específicos do histórico quando desejar.
                  </span>
                </div>
              </div>

              {chatSessions.length === 0 ? (
                <div className="py-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
                  <MessageSquare className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-medium">Nenhum histórico de conversa registrado.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Top 3 Actions Section */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <span>Últimas 3 Ações</span>
                      <span className="text-amber-700 dark:text-amber-400 font-bold bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-md text-[10px]">
                        Histórico Rápido
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {chatSessions.slice(0, 3).map((session, idx) => (
                        <div
                          key={session.id}
                          className="group p-3.5 bg-slate-50 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 rounded-xl transition-all shadow-2xs space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                                #{idx + 1}
                              </span>
                              <h4 className="text-xs sm:text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {session.title}
                              </h4>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRequestDeleteSession(session)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer shrink-0"
                              title="Excluir este item do histórico"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                            <div className="flex items-center gap-2">
                              <span>
                                {new Date(session.createdAt).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <span>·</span>
                              <span>
                                {session.messages?.length || 0} msg
                                {session.messages?.length !== 1 ? 's' : ''}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                onSelectChatSession?.(session);
                                setIsHistoryOpen(false);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                            >
                              <span>Restaurar</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Older Actions Section */}
                  {chatSessions.length > 3 && (
                    <div className="space-y-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Ações Anteriores ({chatSessions.length - 3})
                      </div>

                      <div className="space-y-2">
                        {chatSessions.slice(3).map((session) => (
                          <div
                            key={session.id}
                            className="p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-xl transition-all text-xs flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                {session.title}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                {new Date(session.createdAt).toLocaleDateString('pt-BR')}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectChatSession?.(session);
                                  setIsHistoryOpen(false);
                                }}
                                className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer"
                              >
                                Carregar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteSession(session)}
                                className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md cursor-pointer"
                                title="Excluir do histórico"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            {chatSessions.length > 0 && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleRequestClearAllHistory}
                  className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpar Todo o Histórico</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  className="px-4 py-2 text-xs font-medium bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-xl transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Single Session */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/50">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  Excluir esta conversa do histórico?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Você está prestes a remover <strong className="text-slate-700 dark:text-slate-300">&ldquo;{sessionToDelete.title}&rdquo;</strong> do histórico de conversas do caderno.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingleSession}
                className="px-4 py-2 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Clear All History */}
      {isConfirmClearAllHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/50">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  Limpar Todo o Histórico de Conversas?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Tem certeza de que deseja apagar todas as <strong>{chatSessions.length}</strong> conversas salvas no histórico deste caderno? Suas fontes e notas continuarão preservadas.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsConfirmClearAllHistoryOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAllHistory}
                className="px-4 py-2 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Limpar Todo o Histórico</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification with UNDO Option */}
      {undoState && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[calc(100%-2rem)] bg-slate-900 dark:bg-slate-800 text-slate-100 p-3.5 sm:px-4 sm:py-3.5 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <span className="text-xs sm:text-sm font-medium truncate text-slate-200">
              {undoState.message}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleUndoDelete}
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Desfazer</span>
            </button>
            <button
              type="button"
              onClick={() => setUndoState(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Fechar notificação"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
