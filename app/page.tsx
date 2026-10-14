'use client';

import React, { useState, useEffect } from 'react';
import {
  Notebook,
  NotebookSource,
  NotebookSection,
  ChatMessage,
  ChatSession,
  NotebookNote,
  UserRole,
} from '@/lib/types';
import {
  getStoredNotebooks,
  saveNotebooks,
  getActiveNotebookId,
  setActiveNotebookId,
  getStoredTheme,
  setStoredTheme,
  decodeNotebookFromShare,
  reconcileNotebooks,
} from '@/lib/storage';
import {
  loadNotebooksFromDB,
  saveNotebookToDB,
  saveChatSessionToDB,
  deleteChatSessionFromDB,
  clearChatSessionsFromDB,
} from '@/lib/db';
import { Header } from '@/components/Header';
import { SourcesPanel } from '@/components/SourcesPanel';
import { ChatWorkspace } from '@/components/ChatWorkspace';
import { NotesOutlinePanel } from '@/components/NotesOutlinePanel';
import { MigrationModal } from '@/components/MigrationModal';
import { AddSourceModal } from '@/components/AddSourceModal';
import { SmartCrawlModal } from '@/components/SmartCrawlModal';
import { SourceInspectorModal } from '@/components/SourceInspectorModal';
import { ShareExportModal } from '@/components/ShareExportModal';
import { NewNotebookModal } from '@/components/NewNotebookModal';
import { SectionModal } from '@/components/SectionModal';
import { AuditDuplicatesModal } from '@/components/AuditDuplicatesModal';
import { DeleteSectionModal } from '@/components/DeleteSectionModal';
import { EditNotebookModal } from '@/components/EditNotebookModal';
import {
  Layers,
  MessageSquare,
  Bookmark,
  Lock,
  ShieldAlert,
  Undo2,
  Trash2,
  X,
  CheckCircle2,
  PanelLeftOpen,
  PanelRightOpen,
  RotateCcw,
} from 'lucide-react';

interface UndoDeleteSectionState {
  section: NotebookSection;
  deletedSources: NotebookSource[];
  notebookId: string;
  deletedAt: number;
}

const emptySubscribe = () => () => {};

function useIsMounted() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export default function Home() {
  const isMounted = useIsMounted();

  const [notebooks, setNotebooks] = useState<Notebook[]>(() => {
    const stored = getStoredNotebooks();
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlData = urlParams.get('data') || (window.location.hash.startsWith('#data=') ? window.location.hash.slice(6) : '');
      if (urlData) {
        const decoded = decodeNotebookFromShare(urlData);
        if (decoded) {
          const existsIdx = stored.findIndex((n) => n.id === decoded.id);
          if (existsIdx >= 0) {
            stored[existsIdx] = decoded;
          } else {
            stored.unshift(decoded);
          }
          return stored;
        }
      }
      const urlNbId = urlParams.get('notebookId');
      const cleanChat = urlParams.get('cleanChat') === 'true';
      if (cleanChat && urlNbId) {
        return stored.map((nb) =>
          nb.id === urlNbId ? { ...nb, chatHistory: [] } : nb
        );
      }
    }
    return stored;
  });

  const [activeNotebookId, setActiveId] = useState<string>(() => {
    const loaded = getStoredNotebooks();
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlData = urlParams.get('data') || (window.location.hash.startsWith('#data=') ? window.location.hash.slice(6) : '');
      if (urlData) {
        const decoded = decodeNotebookFromShare(urlData);
        if (decoded) {
          return decoded.id;
        }
      }
      const urlNbId = urlParams.get('notebookId');
      if (urlNbId && loaded.some((n) => n.id === urlNbId)) {
        return urlNbId;
      }
    }
    const storedActive = getActiveNotebookId();
    if (loaded.some((n) => n.id === storedActive)) {
      return storedActive;
    }
    return loaded[0]?.id || '';
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return getStoredTheme();
  });
  const [userRole, setUserRole] = useState<UserRole>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlRole = urlParams.get('role');
      if (urlRole === 'viewer' || urlRole === 'reader' || urlRole === 'leitor') return 'viewer';
      if (urlRole === 'editor') return 'editor';
    }
    return 'owner';
  });

  // Modals state
  const [isMigrationOpen, setIsMigrationOpen] = useState(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [addSourceInitialSectionId, setAddSourceInitialSectionId] = useState<string | undefined>(undefined);
  const [isSmartCrawlOpen, setIsSmartCrawlOpen] = useState(false);
  const [isAuditDuplicatesOpen, setIsAuditDuplicatesOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isShareExportOpen, setIsShareExportOpen] = useState(false);
  const [isNewNotebookOpen, setIsNewNotebookOpen] = useState(false);
  const [isEditNotebookOpen, setIsEditNotebookOpen] = useState(false);
  const [notebookToEdit, setNotebookToEdit] = useState<Notebook | null>(null);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [sectionToEdit, setSectionToEdit] = useState<NotebookSection | null>(null);
  const [sectionToDelete, setSectionToDelete] = useState<NotebookSection | null>(null);
  const [undoDeleteSectionState, setUndoDeleteSectionState] = useState<UndoDeleteSectionState | null>(null);
  const [undoTimerSeconds, setUndoTimerSeconds] = useState<number>(10);
  const [undoRestoredSuccess, setUndoRestoredSuccess] = useState<string | null>(null);

  // Responsive sidebars toggle (desktop & tablet adaptive)
  const [isSourcesSidebarOpen, setIsSourcesSidebarOpen] = useState(true);
  const [isNotesSidebarOpen, setIsNotesSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1100;
    }
    return true;
  });

  const [activeSectionFilter, setActiveSectionFilter] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<NotebookSource | null>(null);

  // Mobile layout tab
  const [mobileTab, setMobileTab] = useState<'sources' | 'chat' | 'notes'>('chat');

  // Loading state
  const [isGeneratingChat, setIsGeneratingChat] = useState(false);

  // Hydrate state from IndexedDB on startup & resolve shared notebooks via shareId or hash
  useEffect(() => {
    async function hydrate() {
      let sharedNb: Notebook | null = null;
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('shareId');
        if (shareId) {
          try {
            const res = await fetch(`/api/share?shareId=${shareId}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.notebook) {
                sharedNb = data.notebook;
              }
            }
          } catch (e) {
            console.error('Failed to fetch shared notebook from /api/share:', e);
          }
        }

        if (!sharedNb) {
          const urlData =
            urlParams.get('data') ||
            (window.location.hash.startsWith('#data=') ? window.location.hash.slice(6) : '');
          if (urlData) {
            sharedNb = decodeNotebookFromShare(urlData);
          }
        }
      }

      const localNotebooks = getStoredNotebooks();
      const dbNotebooks = await loadNotebooksFromDB();
      let reconciled = reconcileNotebooks(localNotebooks, dbNotebooks);

      if (sharedNb) {
        const cleanChat = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cleanChat') === 'true';
        if (cleanChat) {
          sharedNb = { ...sharedNb, chatHistory: [] };
        }
        const existsIdx = reconciled.findIndex((n) => n.id === sharedNb!.id);
        if (existsIdx >= 0) {
          reconciled[existsIdx] = sharedNb;
        } else {
          reconciled = [sharedNb, ...reconciled];
        }
        setActiveId(sharedNb.id);
        setActiveNotebookId(sharedNb.id);
      }

      setNotebooks(reconciled);
      saveNotebooks(reconciled);
    }

    hydrate().catch((err) => {
      console.error('Error hydrating notebooks:', err);
    });
  }, []);

  // Undo countdown timer
  useEffect(() => {
    if (!undoDeleteSectionState) return;

    const interval = setInterval(() => {
      setUndoTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setUndoDeleteSectionState(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [undoDeleteSectionState]);

  // Sync theme class to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    setStoredTheme(nextTheme);
  };

  // Sync to storage
  const updateNotebooksAndSave = (updated: Notebook[]) => {
    setNotebooks(updated);
    saveNotebooks(updated);
  };

  const activeNotebook =
    notebooks.find((n) => n.id === activeNotebookId) || notebooks[0] || null;

  if (!isMounted || !activeNotebook) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-slate-400 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-sm font-medium">Carregando ambiente do ATNotebook...</span>
        </div>
      </div>
    );
  }

  // Handle notebook switch
  const handleSelectNotebook = (id: string) => {
    setActiveId(id);
    setActiveNotebookId(id);
    setActiveSectionFilter(null);
  };

  // Create new notebook
  const handleCreateNotebook = (title: string, description: string, emoji: string) => {
    const newNb: Notebook = {
      id: `nb-${Date.now()}`,
      title,
      description,
      emoji,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerEmail: 'lucas.amaral.oliveira.silva@gmail.com',
      sections: [],
      sources: [],
      chatHistory: [],
      notes: [],
    };
    const updated = [newNb, ...notebooks];
    updateNotebooksAndSave(updated);
    setActiveId(newNb.id);
    setActiveNotebookId(newNb.id);
    setActiveSectionFilter(null);
  };

  // Rename or update existing notebook
  const handleRenameNotebook = (notebookId: string, newTitle: string) => {
    const updated = notebooks.map((nb) =>
      nb.id === notebookId
        ? { ...nb, title: newTitle, updatedAt: new Date().toISOString() }
        : nb
    );
    updateNotebooksAndSave(updated);
  };

  const handleOpenEditNotebook = (notebook: Notebook) => {
    setNotebookToEdit(notebook);
    setIsEditNotebookOpen(true);
  };

  const handleSaveNotebookDetails = (
    notebookId: string,
    updates: { title: string; description: string; emoji: string }
  ) => {
    const updated = notebooks.map((nb) =>
      nb.id === notebookId
        ? { ...nb, ...updates, updatedAt: new Date().toISOString() }
        : nb
    );
    updateNotebooksAndSave(updated);
    setIsEditNotebookOpen(false);
    setNotebookToEdit(null);
  };

  // Section Management
  const handleSaveSection = (
    sectionData: Omit<NotebookSection, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    let updatedSections: NotebookSection[];

    if (existingId) {
      updatedSections = activeNotebook.sections.map((s) =>
        s.id === existingId
          ? { ...s, ...sectionData }
          : s
      );
    } else {
      const newSec: NotebookSection = {
        ...sectionData,
        id: `sec-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      updatedSections = [...activeNotebook.sections, newSec];
    }

    const updatedNb: Notebook = {
      ...activeNotebook,
      sections: updatedSections,
      updatedAt: new Date().toISOString(),
    };
    updateNotebooksAndSave(
      notebooks.map((nb) => (nb.id === activeNotebook.id ? updatedNb : nb))
    );
    setSectionToEdit(null);
  };

  const handleDeleteSection = (section: NotebookSection) => {
    setSectionToDelete(section);
  };

  const handleConfirmDeleteSection = (section: NotebookSection) => {
    // Record affected sources to allow full restore with undo
    const affectedSources = activeNotebook.sources.filter((s) => s.sectionId === section.id);

    setUndoTimerSeconds(10);
    setUndoDeleteSectionState({
      section,
      deletedSources: affectedSources,
      notebookId: activeNotebook.id,
      deletedAt: Date.now(),
    });

    const updatedSections = activeNotebook.sections.filter((s) => s.id !== section.id);
    // Cascade delete all sources linked to this section
    const updatedSources = activeNotebook.sources.filter((s) => s.sectionId !== section.id);

    const updatedNb: Notebook = {
      ...activeNotebook,
      sections: updatedSections,
      sources: updatedSources,
      updatedAt: new Date().toISOString(),
    };
    updateNotebooksAndSave(
      notebooks.map((nb) => (nb.id === activeNotebook.id ? updatedNb : nb))
    );
    if (activeSectionFilter === section.id) {
      setActiveSectionFilter(null);
    }
    setSectionToDelete(null);
  };

  const handleUndoDeleteSection = () => {
    if (!undoDeleteSectionState) return;
    const { section, deletedSources, notebookId } = undoDeleteSectionState;

    const targetNb = notebooks.find((nb) => nb.id === notebookId) || activeNotebook;
    const exists = targetNb.sections.some((s) => s.id === section.id);
    const updatedSections = exists ? targetNb.sections : [...targetNb.sections, section];

    // Restore deleted sources in cascade
    const existingSourceIds = new Set(targetNb.sources.map((s) => s.id));
    const sourcesToRestore = deletedSources.filter((s) => !existingSourceIds.has(s.id));
    const updatedSources = [...targetNb.sources, ...sourcesToRestore];

    const restoredNb: Notebook = {
      ...targetNb,
      sections: updatedSections,
      sources: updatedSources,
      updatedAt: new Date().toISOString(),
    };

    updateNotebooksAndSave(
      notebooks.map((nb) => (nb.id === targetNb.id ? restoredNb : nb))
    );

    setUndoDeleteSectionState(null);
    const restoredSourcesText =
      deletedSources.length > 0
        ? ` e ${deletedSources.length} ${deletedSources.length === 1 ? 'fonte vinculada' : 'fontes vinculadas'}`
        : '';
    setUndoRestoredSuccess(`Seção "${section.name}"${restoredSourcesText} restaurada com sucesso!`);
    setTimeout(() => {
      setUndoRestoredSuccess(null);
    }, 3500);
  };

  const handleMoveSourceToSection = (sourceId: string, targetSectionId?: string) => {
    const updatedSources = activeNotebook.sources.map((s) =>
      s.id === sourceId ? { ...s, sectionId: targetSectionId } : s
    );
    const updatedNb: Notebook = {
      ...activeNotebook,
      sources: updatedSources,
      updatedAt: new Date().toISOString(),
    };
    updateNotebooksAndSave(
      notebooks.map((nb) => (nb.id === activeNotebook.id ? updatedNb : nb))
    );
  };

  const handleBatchMoveSourcesToSection = (sourceIds: string[], targetSectionId?: string) => {
    const idSet = new Set(sourceIds);
    const updatedSources = activeNotebook.sources.map((s) =>
      idSet.has(s.id) ? { ...s, sectionId: targetSectionId } : s
    );
    const updatedNb: Notebook = {
      ...activeNotebook,
      sources: updatedSources,
      updatedAt: new Date().toISOString(),
    };
    updateNotebooksAndSave(
      notebooks.map((nb) => (nb.id === activeNotebook.id ? updatedNb : nb))
    );
  };

  const handleToggleSectionSources = (sectionId: string, enable: boolean) => {
    const updatedSources = activeNotebook.sources.map((s) =>
      s.sectionId === sectionId ? { ...s, enabled: enable } : s
    );
    const updatedNb: Notebook = {
      ...activeNotebook,
      sources: updatedSources,
      updatedAt: new Date().toISOString(),
    };
    updateNotebooksAndSave(
      notebooks.map((nb) => (nb.id === activeNotebook.id ? updatedNb : nb))
    );
  };

  // Source actions
  const handleToggleSource = (sourceId: string) => {
    const updatedSources = activeNotebook.sources.map((s) =>
      s.id === sourceId ? { ...s, enabled: !s.enabled } : s
    );
    const updatedNotebook: Notebook = {
      ...activeNotebook,
      sources: updatedSources,
      updatedAt: new Date().toISOString(),
    };
    const updatedAll = notebooks.map((nb) =>
      nb.id === activeNotebook.id ? updatedNotebook : nb
    );
    updateNotebooksAndSave(updatedAll);
  };

  const handleToggleAllSources = (enable: boolean) => {
    const updatedSources = activeNotebook.sources.map((s) => ({
      ...s,
      enabled: enable,
    }));
    const updatedNotebook: Notebook = {
      ...activeNotebook,
      sources: updatedSources,
      updatedAt: new Date().toISOString(),
    };
    const updatedAll = notebooks.map((nb) =>
      nb.id === activeNotebook.id ? updatedNotebook : nb
    );
    updateNotebooksAndSave(updatedAll);
  };

  const handleAddSource = (sourceData: Omit<NotebookSource, 'id'>) => {
    // Defensive check: ensure exact duplicate URLs are not re-inserted into the notebook
    if (sourceData.originalOrigin) {
      const cleanOrigin = sourceData.originalOrigin.replace(/^Mapeado via URL:\s*/i, '').trim();
      const alreadyExists = activeNotebook.sources.some((s) => {
        if (!s.originalOrigin) return false;
        const existingOrigin = s.originalOrigin.replace(/^Mapeado via URL:\s*/i, '').trim();
        return existingOrigin === cleanOrigin;
      });
      if (alreadyExists) {
        console.warn('Tentativa de adicionar link duplicado bloqueada:', cleanOrigin);
        return;
      }
    }

    const newSource: NotebookSource = {
      ...sourceData,
      id: `src-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    const updatedNotebook: Notebook = {
      ...activeNotebook,
      sources: [newSource, ...activeNotebook.sources],
      updatedAt: new Date().toISOString(),
    };
    const updatedAll = notebooks.map((nb) =>
      nb.id === activeNotebook.id ? updatedNotebook : nb
    );
    updateNotebooksAndSave(updatedAll);
  };

  const handleImportMultipleSources = (sourcesData: Array<Omit<NotebookSource, 'id'>>) => {
    // Filter out duplicates based on exact URL matching against current notebook sources
    const existingOrigins = new Set(
      activeNotebook.sources
        .map((s) => (s.originalOrigin ? s.originalOrigin.replace(/^Mapeado via URL:\s*/i, '').trim() : ''))
        .filter(Boolean)
    );

    const nonDuplicateSources = sourcesData.filter((s) => {
      if (!s.originalOrigin) return true;
      const clean = s.originalOrigin.replace(/^Mapeado via URL:\s*/i, '').trim();
      if (existingOrigins.has(clean)) {
        return false;
      }
      existingOrigins.add(clean);
      return true;
    });

    if (nonDuplicateSources.length === 0) return;

    const newSources: NotebookSource[] = nonDuplicateSources.map((s, idx) => ({
      ...s,
      id: `src-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
    }));
    const updatedNotebook: Notebook = {
      ...activeNotebook,
      sources: [...newSources, ...activeNotebook.sources],
      updatedAt: new Date().toISOString(),
    };
    const updatedAll = notebooks.map((nb) =>
      nb.id === activeNotebook.id ? updatedNotebook : nb
    );
    updateNotebooksAndSave(updatedAll);
  };

  const handleUpdateSource = (updatedSource: NotebookSource) => {
    const updatedSources = activeNotebook.sources.map((s) =>
      s.id === updatedSource.id ? updatedSource : s
    );
    const updatedNotebook: Notebook = {
      ...activeNotebook,
      sources: updatedSources,
      updatedAt: new Date().toISOString(),
    };
    const updatedAll = notebooks.map((nb) =>
      nb.id === activeNotebook.id ? updatedNotebook : nb
    );
    updateNotebooksAndSave(updatedAll);
  };

  const handleDeleteSource = (id: string) => {
    const updatedSources = activeNotebook.sources.filter((s) => s.id !== id);
    const updatedNotebook: Notebook = {
      ...activeNotebook,
      sources: updatedSources,
      updatedAt: new Date().toISOString(),
    };
    const updatedAll = notebooks.map((nb) =>
      nb.id === activeNotebook.id ? updatedNotebook : nb
    );
    updateNotebooksAndSave(updatedAll);
  };

  const handleBatchDeleteSources = (sourceIds: string[]) => {
    const idsSet = new Set(sourceIds);
    const updatedSources = activeNotebook.sources.filter((s) => !idsSet.has(s.id));
    const updatedNotebook: Notebook = {
      ...activeNotebook,
      sources: updatedSources,
      updatedAt: new Date().toISOString(),
    };
    const updatedAll = notebooks.map((nb) =>
      nb.id === activeNotebook.id ? updatedNotebook : nb
    );
    updateNotebooksAndSave(updatedAll);
  };

  // Inspect source
  const handleSelectSource = (src: NotebookSource) => {
    setSelectedSource(src);
    setIsInspectorOpen(true);
  };

  const handleInspectCitation = (sourceTitle: string) => {
    const found = activeNotebook.sources.find(
      (s) => s.title.toLowerCase().trim() === sourceTitle.toLowerCase().trim()
    );
    if (found) {
      setSelectedSource(found);
      setIsInspectorOpen(true);
    } else {
      const loose = activeNotebook.sources.find((s) =>
        s.title.toLowerCase().includes(sourceTitle.toLowerCase())
      );
      if (loose) {
        setSelectedSource(loose);
        setIsInspectorOpen(true);
      }
    }
  };

  // Send message in chat
  const handleSendMessage = async (text: string) => {
    const activeSources = userRole === 'viewer'
      ? activeNotebook.sources.map((s) => ({ ...s, enabled: true }))
      : activeNotebook.sources.filter((s) => s.enabled !== false);
    if (activeSources.length === 0) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const newChatHistory = [...activeNotebook.chatHistory, userMessage];

    const nbOptimistic: Notebook = {
      ...activeNotebook,
      chatHistory: newChatHistory,
      updatedAt: new Date().toISOString(),
    };
    updateNotebooksAndSave(
      notebooks.map((nb) => (nb.id === activeNotebook.id ? nbOptimistic : nb))
    );

    setIsGeneratingChat(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          history: newChatHistory.map((m) => ({ role: m.role, content: m.content })),
          sources: activeSources.map((s) => ({
            id: s.id,
            title: s.title,
            content: s.content,
            type: s.type,
            originalOrigin: s.originalOrigin,
          })),
          notebookTitle: activeNotebook.title,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro na resposta do modelo.');
      }

      const botMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: data.answer,
        timestamp: new Date().toISOString(),
        citations: data.citations || [],
        groundedSourcesCount: data.groundedSourcesCount || activeSources.length,
        modelNotice: data.modelNotice,
        usedModel: data.usedModel,
      };

      const finalChat = [...newChatHistory, botMessage];
      const newSession: ChatSession = {
        id: `session-${Date.now()}`,
        notebookId: activeNotebook.id,
        title: text.length > 55 ? text.slice(0, 52) + '...' : text,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        actionType: 'question',
        messages: finalChat,
      };
      saveChatSessionToDB(newSession).catch(() => {});
      const updatedSessions = [newSession, ...(activeNotebook.chatSessions || [])];
      const finalNb: Notebook = {
        ...activeNotebook,
        chatHistory: finalChat,
        chatSessions: updatedSessions,
        updatedAt: new Date().toISOString(),
      };
      updateNotebooksAndSave(
        notebooks.map((nb) => (nb.id === activeNotebook.id ? finalNb : nb))
      );
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `⚠️ Não foi possível obter resposta: ${err.message}`,
        timestamp: new Date().toISOString(),
      };
      const finalChat = [...newChatHistory, errorMessage];
      const finalNb: Notebook = {
        ...activeNotebook,
        chatHistory: finalChat,
        updatedAt: new Date().toISOString(),
      };
      updateNotebooksAndSave(
        notebooks.map((nb) => (nb.id === activeNotebook.id ? finalNb : nb))
      );
    } finally {
      setIsGeneratingChat(false);
    }
  };

  // Chat Session History Handlers
  const handleSelectChatSession = (session: ChatSession) => {
    const updatedNotebook: Notebook = {
      ...activeNotebook,
      chatHistory: session.messages || [],
      updatedAt: new Date().toISOString(),
    };
    updateNotebooksAndSave(
      notebooks.map((nb) => (nb.id === activeNotebook.id ? updatedNotebook : nb))
    );
  };

  const handleDeleteChatSession = (sessionId: string) => {
    deleteChatSessionFromDB(sessionId).catch(() => {});
    const updatedSessions = (activeNotebook.chatSessions || []).filter(
      (s) => s.id !== sessionId
    );
    const updatedNotebook: Notebook = {
      ...activeNotebook,
      chatSessions: updatedSessions,
      updatedAt: new Date().toISOString(),
    };
    updateNotebooksAndSave(
      notebooks.map((nb) => (nb.id === activeNotebook.id ? updatedNotebook : nb))
    );
  };

  const handleClearAllChatSessions = () => {
    clearChatSessionsFromDB(activeNotebook.id).catch(() => {});
    const updatedNotebook: Notebook = {
      ...activeNotebook,
      chatHistory: [],
      chatSessions: [],
      updatedAt: new Date().toISOString(),
    };
    updateNotebooksAndSave(
      notebooks.map((nb) => (nb.id === activeNotebook.id ? updatedNotebook : nb))
    );
  };

  const handleRestoreChatSessions = (sessionsToRestore: ChatSession[]) => {
    sessionsToRestore.forEach((s) => {
      saveChatSessionToDB(s).catch(() => {});
    });
    const currentSessions = activeNotebook.chatSessions || [];
    const existingIds = new Set(currentSessions.map((s) => s.id));
    const newSessions = sessionsToRestore.filter((s) => !existingIds.has(s.id));
    const mergedSessions = [...newSessions, ...currentSessions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const updatedNotebook: Notebook = {
      ...activeNotebook,
      chatSessions: mergedSessions,
      updatedAt: new Date().toISOString(),
    };
    updateNotebooksAndSave(
      notebooks.map((nb) => (nb.id === activeNotebook.id ? updatedNotebook : nb))
    );
  };

  // Clear chat conversation to start fresh
  const handleClearChat = () => {
    const updatedNotebook: Notebook = {
      ...activeNotebook,
      chatHistory: [],
      updatedAt: new Date().toISOString(),
    };
    const updated = notebooks.map((nb) =>
      nb.id === activeNotebook.id ? updatedNotebook : nb
    );
    updateNotebooksAndSave(updated);
  };

  // Notes actions
  const handleAddNote = (title: string, content: string, sectionId?: string) => {
    const newNote: NotebookNote = {
      id: `note-${Date.now()}`,
      title,
      content,
      sectionId,
      createdAt: new Date().toISOString(),
    };
    const updatedNotebook: Notebook = {
      ...activeNotebook,
      notes: [newNote, ...activeNotebook.notes],
      updatedAt: new Date().toISOString(),
    };
    updateNotebooksAndSave(
      notebooks.map((nb) => (nb.id === activeNotebook.id ? updatedNotebook : nb))
    );
  };

  const handleDeleteNote = (id: string) => {
    const updatedNotebook: Notebook = {
      ...activeNotebook,
      notes: activeNotebook.notes.filter((n) => n.id !== id),
      updatedAt: new Date().toISOString(),
    };
    updateNotebooksAndSave(
      notebooks.map((nb) => (nb.id === activeNotebook.id ? updatedNotebook : nb))
    );
  };

  const handleConvertNoteToSource = (note: NotebookNote) => {
    handleAddSource({
      title: note.title,
      type: 'text',
      sectionId: note.sectionId,
      originalOrigin: 'Nota interna convertida em fonte',
      content: note.content,
      charCount: note.content.length,
      wordCount: note.content.split(/\s+/).length,
      estimatedTokens: Math.ceil(note.content.length / 4),
      checksum: 'NOTE' + Date.now().toString().slice(-4),
      migratedAt: new Date().toISOString(),
      verified: true,
      enabled: true,
    });
  };

  const handleUpdateShareSettings = (updated: Notebook) => {
    const all = notebooks.map((n) => (n.id === updated.id ? updated : n));
    updateNotebooksAndSave(all);
  };

  const handleDeleteNotebook = (id: string) => {
    if (notebooks.length <= 1) return;
    const filtered = notebooks.filter((n) => n.id !== id);
    updateNotebooksAndSave(filtered);
    if (activeNotebookId === id) {
      setActiveId(filtered[0]?.id || '');
    }
  };

  // Filter sources if section filter is active in Outline panel
  const displayedSources = activeSectionFilter
    ? activeNotebook.sources.filter((s) => s.sectionId === activeSectionFilter)
    : activeNotebook.sources;

  return (
    <div className="h-screen h-dvh w-screen w-dvw overflow-hidden flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors selection:bg-blue-100 dark:selection:bg-blue-900">
      {/* Top Header */}
      <Header
        notebooks={notebooks}
        activeNotebook={activeNotebook}
        userRole={userRole}
        onSelectNotebook={handleSelectNotebook}
        onOpenNewNotebook={() => setIsNewNotebookOpen(true)}
        onOpenMigration={() => setIsMigrationOpen(true)}
        onOpenShareExport={() => setIsShareExportOpen(true)}
        onRenameNotebook={handleRenameNotebook}
        onOpenEditNotebook={handleOpenEditNotebook}
        onDeleteNotebook={handleDeleteNotebook}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isSourcesOpen={isSourcesSidebarOpen}
        onToggleSources={() => setIsSourcesSidebarOpen((prev) => !prev)}
        isNotesOpen={isNotesSidebarOpen}
        onToggleNotes={() => setIsNotesSidebarOpen((prev) => !prev)}
      />

      {/* Viewer Role Banner */}
      {userRole === 'viewer' && (
        <div className="shrink-0 z-20 bg-amber-100/90 dark:bg-amber-950/60 border-b border-amber-300 dark:border-amber-800/80 px-4 py-2 text-xs text-amber-950 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Modo Leitor Ativo:</strong> As barras laterais estão ocultas. Você pode consultar e fazer perguntas para a IA sobre este caderno com citações diretas das fontes.
            </span>
          </div>
          {activeNotebook.chatHistory.length > 0 && (
            <button
              type="button"
              onClick={handleClearChat}
              className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
              title="Limpar mensagens e reiniciar chat"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar Conversa</span>
            </button>
          )}
        </div>
      )}

      {/* Mobile Tab Selector (Hidden for reader role as only chat workspace is visible) */}
      {userRole !== 'viewer' && (
        <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 flex items-center justify-around gap-1 text-xs shrink-0 z-20">
          <button
            onClick={() => setMobileTab('sources')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg transition-colors text-xs ${
              mobileTab === 'sources'
                ? 'bg-slate-900 dark:bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Fontes ({activeNotebook.sources.length})</span>
          </button>

          <button
            onClick={() => setMobileTab('chat')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg transition-colors text-xs ${
              mobileTab === 'chat'
                ? 'bg-slate-900 dark:bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Chat IA</span>
          </button>

          <button
            onClick={() => setMobileTab('notes')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg transition-colors text-xs ${
              mobileTab === 'notes'
                ? 'bg-slate-900 dark:bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Seções & Notas</span>
          </button>
        </div>
      )}

      {/* Main Studio Workspace */}
      <main className="flex-1 min-h-0 flex overflow-hidden w-full relative">
        {/* Re-open Left Sidebar Button if Collapsed on Desktop/Tablet */}
        {userRole !== 'viewer' && !isSourcesSidebarOpen && (
          <aside
            aria-label="Expandir painel de fontes e seções"
            className="hidden md:flex fixed left-0 top-1/2 -translate-y-1/2 z-40 select-none"
          >
            <button
              type="button"
              onClick={() => setIsSourcesSidebarOpen(true)}
              title="Expandir painel de fontes e seções"
              className="flex flex-col items-center justify-center gap-2 py-3 px-1.5 bg-white/95 dark:bg-slate-900/95 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border-y border-r border-slate-200 dark:border-slate-700 rounded-r-xl shadow-lg hover:shadow-xl transition-all cursor-pointer backdrop-blur-md group"
            >
              <PanelLeftOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:scale-115 transition-transform" />
              <span
                className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 py-1"
                style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  letterSpacing: '0.06em',
                }}
              >
                Fontes ({activeNotebook.sources.length})
              </span>
            </button>
          </aside>
        )}

        {/* Re-open Right Sidebar Button if Collapsed on Desktop/Tablet */}
        {userRole !== 'viewer' && !isNotesSidebarOpen && (
          <aside
            aria-label="Expandir painel de anotações e seções"
            className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-40 select-none"
          >
            <button
              type="button"
              onClick={() => setIsNotesSidebarOpen(true)}
              title="Expandir painel de anotações e seções"
              className="flex flex-col items-center justify-center gap-2 py-3 px-1.5 bg-white/95 dark:bg-slate-900/95 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border-y border-l border-slate-200 dark:border-slate-700 rounded-l-xl shadow-lg hover:shadow-xl transition-all cursor-pointer backdrop-blur-md group"
            >
              <PanelRightOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:scale-115 transition-transform" />
              <span
                className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 py-1"
                style={{
                  writingMode: 'vertical-rl',
                  letterSpacing: '0.06em',
                }}
              >
                Anotações ({activeNotebook.notes.length})
              </span>
            </button>
          </aside>
        )}

        {/* Left Column: Sources Panel (Hidden for Reader Role) */}
        {userRole !== 'viewer' && (
          <div
            className={`h-full transition-all duration-200 shrink-0 ${
              mobileTab === 'sources'
                ? 'w-full block'
                : isSourcesSidebarOpen
                ? 'hidden md:block md:w-80 lg:w-80'
                : 'hidden'
            }`}
          >
            <SourcesPanel
              sources={displayedSources}
              sections={activeNotebook.sections}
              userRole={userRole}
              onToggleSource={handleToggleSource}
              onToggleAllSources={handleToggleAllSources}
              onToggleSectionSources={handleToggleSectionSources}
              onSelectSource={handleSelectSource}
              onOpenAddSource={(secId?: string) => {
                setAddSourceInitialSectionId(secId);
                setIsAddSourceOpen(true);
              }}
              onOpenSmartCrawl={() => setIsSmartCrawlOpen(true)}
              onOpenMigration={() => setIsMigrationOpen(true)}
              onOpenSectionModal={() => {
                setSectionToEdit(null);
                setIsSectionModalOpen(true);
              }}
              onEditSection={(sec) => {
                setSectionToEdit(sec);
                setIsSectionModalOpen(true);
              }}
              onDeleteSection={handleDeleteSection}
              onMoveSourceToSection={handleMoveSourceToSection}
              onBatchMoveSourcesToSection={handleBatchMoveSourcesToSection}
              onDeleteSource={handleDeleteSource}
              onBatchDeleteSources={handleBatchDeleteSources}
              onOpenAuditDuplicates={() => setIsAuditDuplicatesOpen(true)}
              onCollapseEntirePanel={() => setIsSourcesSidebarOpen(false)}
            />
          </div>
        )}

        {/* Center Column: Dedicated Chat Workspace */}
        <div
          className={`flex-1 h-full min-h-0 min-w-0 flex flex-col ${
            userRole === 'viewer' || mobileTab === 'chat' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <ChatWorkspace
            messages={activeNotebook.chatHistory}
            sources={activeNotebook.sources}
            sections={activeNotebook.sections}
            notebookTitle={activeNotebook.title}
            userRole={userRole}
            onSendMessage={handleSendMessage}
            onSaveAsNote={(title, content) => handleAddNote(title, content)}
            onInspectCitation={handleInspectCitation}
            isGenerating={isGeneratingChat}
            onClearChat={handleClearChat}
            isSourcesOpen={isSourcesSidebarOpen}
            onToggleSources={() => setIsSourcesSidebarOpen((prev) => !prev)}
            isNotesOpen={isNotesSidebarOpen}
            onToggleNotes={() => setIsNotesSidebarOpen((prev) => !prev)}
            chatSessions={activeNotebook.chatSessions || []}
            onSelectChatSession={handleSelectChatSession}
            onDeleteChatSession={handleDeleteChatSession}
            onClearAllChatSessions={handleClearAllChatSessions}
            onRestoreChatSessions={handleRestoreChatSessions}
          />
        </div>

        {/* Right Column: Sessions Outline & Notes (Hidden for Reader Role) */}
        {userRole !== 'viewer' && (
          <div
            className={`h-full transition-all duration-200 shrink-0 ${
              mobileTab === 'notes'
                ? 'w-full block'
                : isNotesSidebarOpen
                ? 'hidden md:block md:w-72 lg:w-80'
                : 'hidden'
            }`}
          >
            <NotesOutlinePanel
              notebook={activeNotebook}
              userRole={userRole}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
              onConvertNoteToSource={handleConvertNoteToSource}
              onSelectSectionFilter={setActiveSectionFilter}
              activeSectionFilter={activeSectionFilter}
              onOpenSectionModal={() => {
                setSectionToEdit(null);
                setIsSectionModalOpen(true);
              }}
              onOpenAddSource={(secId?: string) => {
                setAddSourceInitialSectionId(secId);
                setIsAddSourceOpen(true);
              }}
              onCollapseEntirePanel={() => setIsNotesSidebarOpen(false)}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <MigrationModal
        isOpen={isMigrationOpen}
        onClose={() => setIsMigrationOpen(false)}
        onImportSource={handleAddSource}
        sections={activeNotebook.sections}
        notebookTitle={activeNotebook.title}
      />

      <AddSourceModal
        isOpen={isAddSourceOpen}
        onClose={() => {
          setIsAddSourceOpen(false);
          setAddSourceInitialSectionId(undefined);
        }}
        onAddSource={handleAddSource}
        sections={activeNotebook.sections}
        initialSectionId={addSourceInitialSectionId}
        existingSources={activeNotebook.sources}
        onLocateExistingSource={(existingSrc) => {
          setIsSourcesSidebarOpen(true);
          handleSelectSource(existingSrc);
        }}
        onOpenSmartCrawl={() => setIsSmartCrawlOpen(true)}
      />

      <SmartCrawlModal
        isOpen={isSmartCrawlOpen}
        onClose={() => setIsSmartCrawlOpen(false)}
        onImportSources={handleImportMultipleSources}
        sections={activeNotebook.sections}
        userRole={userRole}
        existingSources={activeNotebook.sources}
      />

      <AuditDuplicatesModal
        isOpen={isAuditDuplicatesOpen}
        onClose={() => setIsAuditDuplicatesOpen(false)}
        sources={activeNotebook.sources}
        sections={activeNotebook.sections}
        onDeleteSource={handleDeleteSource}
        onBatchDeleteSources={handleBatchDeleteSources}
        onSelectSource={handleSelectSource}
      />

      <SectionModal
        isOpen={isSectionModalOpen}
        onClose={() => {
          setIsSectionModalOpen(false);
          setSectionToEdit(null);
        }}
        onSaveSection={handleSaveSection}
        sectionToEdit={sectionToEdit}
      />

      {/* Delete Section Confirmation Modal */}
      <DeleteSectionModal
        isOpen={!!sectionToDelete}
        section={sectionToDelete}
        sourcesCount={
          sectionToDelete
            ? activeNotebook.sources.filter((s) => s.sectionId === sectionToDelete.id).length
            : 0
        }
        onClose={() => setSectionToDelete(null)}
        onConfirmDelete={handleConfirmDeleteSection}
      />

      {/* Undo Section Deletion Floating Toast */}
      {undoDeleteSectionState && (
        <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 animate-in slide-in-from-bottom-5 duration-200 max-w-sm sm:max-w-md w-[calc(100%-2rem)] sm:w-auto">
          <div className="bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 border border-slate-700/80 rounded-2xl shadow-2xl p-3.5 flex items-center justify-between gap-3 backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">
                  Seção <strong>&quot;{undoDeleteSectionState.section.name}&quot;</strong>
                  {undoDeleteSectionState.deletedSources.length > 0 && (
                    <span> e {undoDeleteSectionState.deletedSources.length} {undoDeleteSectionState.deletedSources.length === 1 ? 'fonte' : 'fontes'}</span>
                  )}{' '}
                  excluída{undoDeleteSectionState.deletedSources.length > 0 ? 's' : ''}.
                </p>
                <p className="text-[10px] text-slate-400">
                  Opção para restaurar ({undoTimerSeconds}s)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleUndoDeleteSection}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Desfazer</span>
              </button>
              <button
                type="button"
                onClick={() => setUndoDeleteSectionState(null)}
                className="p-1 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                title="Fechar notificação"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notice After Restoring */}
      {undoRestoredSuccess && (
        <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 animate-in fade-in duration-150">
          <div className="bg-emerald-600 text-white rounded-xl shadow-xl px-4 py-2.5 flex items-center gap-2 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{undoRestoredSuccess}</span>
          </div>
        </div>
      )}

      <SourceInspectorModal
        source={selectedSource}
        sections={activeNotebook.sections}
        userRole={userRole}
        isOpen={isInspectorOpen}
        onClose={() => {
          setIsInspectorOpen(false);
          setSelectedSource(null);
        }}
        onUpdateSource={handleUpdateSource}
        onDeleteSource={handleDeleteSource}
      />

      <ShareExportModal
        notebook={activeNotebook}
        isOpen={isShareExportOpen}
        onClose={() => setIsShareExportOpen(false)}
        onUpdateNotebookShareSettings={handleUpdateShareSettings}
      />

      <NewNotebookModal
        isOpen={isNewNotebookOpen}
        onClose={() => setIsNewNotebookOpen(false)}
        onCreateNotebook={handleCreateNotebook}
      />

      <EditNotebookModal
        isOpen={isEditNotebookOpen}
        onClose={() => {
          setIsEditNotebookOpen(false);
          setNotebookToEdit(null);
        }}
        notebook={notebookToEdit}
        onSaveNotebook={handleSaveNotebookDetails}
      />
    </div>
  );
}
