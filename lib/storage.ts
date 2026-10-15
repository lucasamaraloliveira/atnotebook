'use client';

import { Notebook, ATNotebookExportPackage } from './types';
import { DEFAULT_NOTEBOOKS } from './initialData';
import { saveAllNotebooksToDB } from './db';

const STORAGE_KEY = 'omninotebook_data_v2';
const ACTIVE_NOTEBOOK_KEY = 'omninotebook_active_id';
const THEME_KEY = 'omninotebook_theme';

export function encodeNotebookForShare(notebook: Notebook): string {
  try {
    const payload = {
      id: notebook.id,
      title: notebook.title,
      description: notebook.description,
      emoji: notebook.emoji,
      createdAt: notebook.createdAt,
      updatedAt: notebook.updatedAt,
      ownerEmail: notebook.ownerEmail,
      sections: notebook.sections || [],
      sources: (notebook.sources || []).map((s) => ({
        id: s.id,
        title: s.title,
        type: s.type,
        sectionId: s.sectionId,
        originalOrigin: s.originalOrigin,
        content: s.content,
        summary: s.summary,
        charCount: s.charCount,
        wordCount: s.wordCount,
        estimatedTokens: s.estimatedTokens,
        checksum: s.checksum,
        migratedAt: s.migratedAt,
        verified: s.verified,
        notes: s.notes,
        enabled: s.enabled !== false,
      })),
      notes: notebook.notes || [],
      shareSettings: notebook.shareSettings,
    };
    const jsonStr = JSON.stringify(payload);
    return btoa(encodeURIComponent(jsonStr));
  } catch (err) {
    console.error('Failed to encode notebook for share:', err);
    return '';
  }
}

export function decodeNotebookFromShare(encodedStr: string): Notebook | null {
  if (!encodedStr || typeof encodedStr !== 'string') return null;
  try {
    const cleanStr = encodedStr.trim().replace(/^#/, '').replace(/^data=/, '');
    if (!cleanStr) return null;

    let jsonStr: string;
    try {
      jsonStr = decodeURIComponent(atob(cleanStr));
    } catch {
      // In case of truncated or invalid base64 string
      return null;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // In case of truncated or incomplete JSON string from length-limited URLs
      return null;
    }

    if (parsed && typeof parsed === 'object' && parsed.id && parsed.title && Array.isArray(parsed.sources)) {
      return {
        id: parsed.id,
        title: parsed.title,
        description: parsed.description || '',
        emoji: parsed.emoji || '📓',
        createdAt: parsed.createdAt || new Date().toISOString(),
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        ownerEmail: parsed.ownerEmail || 'user@example.com',
        sections: Array.isArray(parsed.sections) ? parsed.sections : [],
        sources: parsed.sources.map((s: any) => ({
          ...s,
          enabled: s.enabled !== false,
        })),
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        chatHistory: [], // clean chat for reader/shared link
        chatSessions: [],
        shareSettings: parsed.shareSettings,
      };
    }
    return null;
  } catch {
    // Fail gracefully without logging console.error that triggers Next.js dev overlay
    return null;
  }
}

export function getStoredNotebooks(): Notebook[] {
  if (typeof window === 'undefined') return DEFAULT_NOTEBOOKS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveNotebooks(DEFAULT_NOTEBOOKS);
      return DEFAULT_NOTEBOOKS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_NOTEBOOKS;
    }
    // Ensure all notebooks have valid arrays and default enabled sources
    return parsed.map((nb) => ({
      ...nb,
      sections: Array.isArray(nb.sections) ? nb.sections : [],
      chatHistory: Array.isArray(nb.chatHistory) ? nb.chatHistory : [],
      notes: Array.isArray(nb.notes) ? nb.notes : [],
      sources: Array.isArray(nb.sources)
        ? nb.sources.map((s: any) => ({
            ...s,
            enabled: s.enabled !== false,
          }))
        : [],
    }));
  } catch (err) {
    console.error('Failed to parse stored notebooks:', err);
    return DEFAULT_NOTEBOOKS;
  }
}

let dbSaveQueue: Promise<void> = Promise.resolve();

export function saveNotebooks(notebooks: Notebook[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notebooks));
    // Chain saves to avoid overlapping transactions
    dbSaveQueue = dbSaveQueue
      .then(() => saveAllNotebooksToDB(notebooks))
      .catch((err) => {
        console.error('Failed to sync notebooks with IndexedDB:', err);
      });
  } catch (err) {
    console.error('Failed to save notebooks to localStorage:', err);
  }
}

/**
 * Reconciles notebooks between LocalStorage and IndexedDB,
 * ensuring no user-created sources, sections, or chat sessions are lost.
 */
export function reconcileNotebooks(localList: Notebook[], dbList: Notebook[]): Notebook[] {
  if (!dbList || dbList.length === 0) return localList;
  if (!localList || localList.length === 0) return dbList;

  const dbMap = new Map(dbList.map((n) => [n.id, n]));
  const localMap = new Map(localList.map((n) => [n.id, n]));
  const allIds = Array.from(new Set([...localList.map((n) => n.id), ...dbList.map((n) => n.id)]));

  const reconciled: Notebook[] = [];

  for (const id of allIds) {
    const localNb = localMap.get(id);
    const dbNb = dbMap.get(id);

    if (localNb && !dbNb) {
      reconciled.push(localNb);
    } else if (!localNb && dbNb) {
      reconciled.push(dbNb);
    } else if (localNb && dbNb) {
      const localTime = new Date(localNb.updatedAt || 0).getTime();
      const dbTime = new Date(dbNb.updatedAt || 0).getTime();

      // Base candidate is the more recently updated one
      const baseNb = localTime >= dbTime ? localNb : dbNb;
      const otherNb = localTime >= dbTime ? dbNb : localNb;

      // Merge sources by ID: if the other version has a source not in baseNb, include it
      const baseSourceIds = new Set((baseNb.sources || []).map((s) => s.id));
      const extraSources = (otherNb.sources || []).filter((s) => !baseSourceIds.has(s.id));
      const mergedSources = [...(baseNb.sources || []), ...extraSources];

      // Merge sections by ID
      const baseSectionIds = new Set((baseNb.sections || []).map((sec) => sec.id));
      const extraSections = (otherNb.sections || []).filter((sec) => !baseSectionIds.has(sec.id));
      const mergedSections = [...(baseNb.sections || []), ...extraSections];

      // Merge chat sessions by ID
      const baseSessionIds = new Set((baseNb.chatSessions || []).map((cs) => cs.id));
      const extraSessions = (otherNb.chatSessions || []).filter((cs) => !baseSessionIds.has(cs.id));
      const mergedChatSessions = [...(baseNb.chatSessions || []), ...extraSessions];

      // Merge notes by ID
      const baseNoteIds = new Set((baseNb.notes || []).map((nt) => nt.id));
      const extraNotes = (otherNb.notes || []).filter((nt) => !baseNoteIds.has(nt.id));
      const mergedNotes = [...(baseNb.notes || []), ...extraNotes];

      reconciled.push({
        ...baseNb,
        sources: mergedSources,
        sections: mergedSections,
        chatSessions: mergedChatSessions,
        notes: mergedNotes,
        updatedAt: new Date(Math.max(localTime, dbTime)).toISOString(),
      });
    }
  }

  return reconciled;
}

export function getActiveNotebookId(): string {
  if (typeof window === 'undefined') return DEFAULT_NOTEBOOKS[0].id;
  try {
    return localStorage.getItem(ACTIVE_NOTEBOOK_KEY) || DEFAULT_NOTEBOOKS[0].id;
  } catch {
    return DEFAULT_NOTEBOOKS[0].id;
  }
}

export function setActiveNotebookId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_NOTEBOOK_KEY, id);
  } catch (err) {
    console.error('Failed to set active notebook id:', err);
  }
}

export function getStoredTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function setStoredTheme(theme: 'light' | 'dark'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THEME_KEY, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (err) {
    console.error('Failed to set theme:', err);
  }
}

export function exportNotebookAsJson(notebook: Notebook, asReaderOnly = false): void {
  const exportPayload = asReaderOnly
    ? {
        ...notebook,
        shareSettings: {
          ...notebook.shareSettings,
          defaultRole: 'viewer',
        },
      }
    : notebook;

  const dataStr =
    'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  const safeTitle = notebook.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = asReaderOnly
    ? `notebook_${safeTitle}_leitor.json`
    : `notebook_${safeTitle}_completo.json`;
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function exportNotebookAsMarkdown(notebook: Notebook): void {
  let md = `# ${notebook.emoji} ${notebook.title}\n\n`;
  md += `> ${notebook.description}\n\n`;
  md += `_Criado em: ${new Date(notebook.createdAt).toLocaleDateString('pt-BR')} | Total de Fontes: ${notebook.sources.length}_\n\n`;

  if (notebook.sections && notebook.sections.length > 0) {
    md += `## 🗂️ Sessões do Caderno\n\n`;
    notebook.sections.forEach((sec, idx) => {
      const secSources = notebook.sources.filter((s) => s.sectionId === sec.id);
      md += `### ${sec.icon} ${sec.name} (${secSources.length} fontes)\n`;
      if (sec.description) md += `_${sec.description}_\n\n`;
      secSources.forEach((s) => {
        md += `- **${s.title}** (${s.wordCount} palavras, hash: \`${s.checksum}\`)\n`;
      });
      md += `\n`;
    });
  }

  md += `---\n\n## 📚 Fontes Detalhadas\n\n`;
  notebook.sources.forEach((s, idx) => {
    const sec = notebook.sections?.find((sec) => sec.id === s.sectionId);
    md += `### ${idx + 1}. ${s.title}\n`;
    if (sec) md += `- **Sessão**: ${sec.icon} ${sec.name}\n`;
    md += `- **Tipo**: ${s.type}\n`;
    if (s.originalOrigin) md += `- **Origem**: ${s.originalOrigin}\n`;
    md += `- **Checksum**: \`${s.checksum}\` (${s.wordCount} palavras)\n\n`;
    md += `\`\`\`text\n${s.content}\n\`\`\`\n\n`;
  });

  if (notebook.notes && notebook.notes.length > 0) {
    md += `---\n\n## 📝 Notas & Rascunhos\n\n`;
    notebook.notes.forEach((note) => {
      md += `### ${note.title}\n${note.content}\n\n`;
    });
  }

  const dataStr = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(md);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  const safeTitle = notebook.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
  downloadAnchor.setAttribute('download', `notebook_${safeTitle}_relatorio.md`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export interface ParseNotebookResult {
  success: boolean;
  package?: ATNotebookExportPackage;
  notebook?: Notebook;
  metrics?: ATNotebookExportPackage['metrics'];
  error?: string;
  sourceFormat?: 'atnb_package' | 'raw_notebook';
}

/**
 * Exports a notebook as a complete ATNotebook backup file (.atnb or .json)
 * containing all sections, sources with full content, notes, and chat sessions.
 */
export function exportFullNotebookFile(
  notebook: Notebook,
  extension: 'atnb' | 'json' = 'atnb'
): void {
  const sources = notebook.sources || [];
  const sections = notebook.sections || [];
  const notes = notebook.notes || [];
  const chatSessions = notebook.chatSessions || [];
  const chatHistory = notebook.chatHistory || [];

  const totalWords = sources.reduce(
    (acc, s) =>
      acc +
      (typeof s.wordCount === 'number'
        ? s.wordCount
        : s.content
        ? s.content.trim().split(/\s+/).filter(Boolean).length
        : 0),
    0
  );

  const exportPayload: ATNotebookExportPackage = {
    format: 'ATNotebook',
    version: 1,
    exportedAt: new Date().toISOString(),
    notebook: {
      id: notebook.id,
      title: notebook.title,
      description: notebook.description || '',
      emoji: notebook.emoji || '📓',
      createdAt: notebook.createdAt || new Date().toISOString(),
      updatedAt: notebook.updatedAt || new Date().toISOString(),
      ownerEmail: notebook.ownerEmail,
      shareSettings: notebook.shareSettings,
      sections: sections,
      sources: sources.map((s) => ({
        ...s,
        enabled: s.enabled !== false,
      })),
      notes: notes,
      chatHistory: chatHistory,
      chatSessions: chatSessions,
    },
    metrics: {
      totalSources: sources.length,
      totalSections: sections.length,
      totalNotes: notes.length,
      totalChatSessions: chatSessions.length,
      totalWords,
    },
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const mimeType = extension === 'atnb' ? 'application/octet-stream' : 'application/json';
  const blob = new Blob([jsonStr], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const safeTitle = (notebook.title || 'caderno')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const filename = `caderno_${safeTitle || 'sem_titulo'}_completo.${extension}`;

  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = url;
  downloadAnchor.download = filename;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Validates, checks integrity, and parses a raw text representation of an ATNotebook package (.atnb / .json).
 * Supports both standard ATNotebookExportPackage envelopes and raw Notebook structures.
 */
export function validateAndParseNotebookPackage(rawText: string): ParseNotebookResult {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return {
      success: false,
      error: 'O arquivo ou texto fornecido está vazio.',
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText.trim());
  } catch {
    return {
      success: false,
      error: 'Formato inválido: O arquivo não contém uma estrutura JSON legível.',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      success: false,
      error: 'Formato inválido: Estrutura de dados não reconhecida.',
    };
  }

  let rawNb: any = null;
  let sourceFormat: 'atnb_package' | 'raw_notebook' = 'atnb_package';
  let declaredMetrics: ATNotebookExportPackage['metrics'] | undefined = undefined;

  // Case 1: Official ATNotebook package
  if (parsed.format === 'ATNotebook' && parsed.notebook) {
    rawNb = parsed.notebook;
    sourceFormat = 'atnb_package';
    if (parsed.metrics) {
      declaredMetrics = parsed.metrics;
    }
  } else if (parsed.notebook && Array.isArray(parsed.notebook.sources)) {
    rawNb = parsed.notebook;
    sourceFormat = 'atnb_package';
  } else if (Array.isArray(parsed.sources) || (parsed.id && (parsed.title || parsed.sections))) {
    // Case 2: Raw Notebook object (e.g. standard JSON export)
    rawNb = parsed;
    sourceFormat = 'raw_notebook';
  } else {
    return {
      success: false,
      error:
        'Arquivo incompatível: Não foi encontrada a estrutura de caderno ou fontes do ATNotebook.',
    };
  }

  // Sanitize and validate fields
  const title =
    typeof rawNb.title === 'string' && rawNb.title.trim()
      ? rawNb.title.trim()
      : 'Caderno Sem Título';
  const description = typeof rawNb.description === 'string' ? rawNb.description : '';
  const emoji = typeof rawNb.emoji === 'string' && rawNb.emoji ? rawNb.emoji : '📓';

  const sections = Array.isArray(rawNb.sections)
    ? rawNb.sections.map((sec: any, idx: number) => ({
        id: sec.id || `sec-${idx}`,
        name: sec.name || `Seção ${idx + 1}`,
        icon: sec.icon || '📁',
        description: sec.description || '',
        color: sec.color || '',
        createdAt: sec.createdAt || new Date().toISOString(),
      }))
    : [];

  const sources = Array.isArray(rawNb.sources)
    ? rawNb.sources.map((s: any, idx: number) => {
        const content = typeof s.content === 'string' ? s.content : '';
        const wordCount =
          typeof s.wordCount === 'number'
            ? s.wordCount
            : content.trim()
            ? content.trim().split(/\s+/).filter(Boolean).length
            : 0;
        const charCount = typeof s.charCount === 'number' ? s.charCount : content.length;
        return {
          id: s.id || `src-${idx}`,
          title: s.title || `Fonte ${idx + 1}`,
          type: s.type || 'text',
          sectionId: s.sectionId || undefined,
          originalOrigin: s.originalOrigin || '',
          content,
          summary: s.summary || '',
          charCount,
          wordCount,
          estimatedTokens:
            typeof s.estimatedTokens === 'number' ? s.estimatedTokens : Math.ceil(wordCount * 1.3),
          checksum: s.checksum || `chk_${idx}_${Date.now()}`,
          migratedAt: s.migratedAt || new Date().toISOString(),
          verified: s.verified !== false,
          notes: s.notes || '',
          enabled: s.enabled !== false,
        };
      })
    : [];

  const notes = Array.isArray(rawNb.notes)
    ? rawNb.notes.map((n: any, idx: number) => ({
        id: n.id || `note-${idx}`,
        title: n.title || `Nota ${idx + 1}`,
        content: n.content || '',
        createdAt: n.createdAt || new Date().toISOString(),
        sourceId: n.sourceId || undefined,
        sectionId: n.sectionId || undefined,
      }))
    : [];

  const chatHistory = Array.isArray(rawNb.chatHistory)
    ? rawNb.chatHistory.map((m: any, idx: number) => ({
        id: m.id || `msg-${idx}`,
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
        timestamp: m.timestamp || new Date().toISOString(),
        citations: Array.isArray(m.citations) ? m.citations : undefined,
        groundedSourcesCount: m.groundedSourcesCount,
        modelNotice: m.modelNotice,
        usedModel: m.usedModel,
      }))
    : [];

  const chatSessions = Array.isArray(rawNb.chatSessions)
    ? rawNb.chatSessions.map((cs: any, idx: number) => ({
        id: cs.id || `session-${idx}`,
        notebookId: cs.notebookId || rawNb.id || 'nb-unknown',
        title: cs.title || `Sessão ${idx + 1}`,
        createdAt: cs.createdAt || new Date().toISOString(),
        updatedAt: cs.updatedAt || new Date().toISOString(),
        actionType: cs.actionType || 'question',
        messages: Array.isArray(cs.messages)
          ? cs.messages.map((m: any, mIdx: number) => ({
              id: m.id || `msg-${idx}-${mIdx}`,
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content || '',
              timestamp: m.timestamp || new Date().toISOString(),
              citations: Array.isArray(m.citations) ? m.citations : undefined,
              groundedSourcesCount: m.groundedSourcesCount,
              modelNotice: m.modelNotice,
              usedModel: m.usedModel,
            }))
          : [],
      }))
    : [];

  const totalWords = sources.reduce(
    (acc: number, s: any) => acc + (s.wordCount || 0),
    0
  );

  const metrics = declaredMetrics || {
    totalSources: sources.length,
    totalSections: sections.length,
    totalNotes: notes.length,
    totalChatSessions: chatSessions.length,
    totalWords,
  };

  const validatedNotebook: Notebook = {
    id: rawNb.id || `nb-imported-${Date.now()}`,
    title,
    description,
    emoji,
    createdAt: rawNb.createdAt || new Date().toISOString(),
    updatedAt: rawNb.updatedAt || new Date().toISOString(),
    ownerEmail: rawNb.ownerEmail,
    shareSettings: rawNb.shareSettings,
    sections,
    sources,
    notes,
    chatHistory,
    chatSessions,
  };

  return {
    success: true,
    notebook: validatedNotebook,
    metrics,
    sourceFormat,
  };
}

/**
 * Creates an entirely cloned, independent Notebook from an imported template,
 * generating fresh unique IDs for the notebook, all sections, sources, notes, and chat sessions,
 * while accurately preserving relational bindings between them.
 */
export function createClonedNotebookFromImport(
  importedNb: Notebook,
  customTitle?: string
): Notebook {
  const genHash = () => Math.random().toString(36).substring(2, 8);
  const now = Date.now();
  const newNotebookId = `nb-${now}-${genHash()}`;

  // 1. Remap sections
  const sectionMap = new Map<string, string>();
  const clonedSections = (importedNb.sections || []).map((sec, idx) => {
    const newSecId = `sec-${now}-${idx}-${genHash()}`;
    if (sec.id) sectionMap.set(sec.id, newSecId);
    return {
      ...sec,
      id: newSecId,
      createdAt: sec.createdAt || new Date().toISOString(),
    };
  });

  // 2. Remap sources with mapped sectionId
  const sourceMap = new Map<string, string>();
  const clonedSources = (importedNb.sources || []).map((src, idx) => {
    const newSrcId = `src-${now}-${idx}-${genHash()}`;
    if (src.id) sourceMap.set(src.id, newSrcId);
    return {
      ...src,
      id: newSrcId,
      sectionId: src.sectionId ? sectionMap.get(src.sectionId) || undefined : undefined,
      enabled: src.enabled !== false,
      migratedAt: src.migratedAt || new Date().toISOString(),
    };
  });

  // 3. Remap notes with mapped sectionId and sourceId
  const clonedNotes = (importedNb.notes || []).map((note, idx) => {
    const newNoteId = `note-${now}-${idx}-${genHash()}`;
    return {
      ...note,
      id: newNoteId,
      sectionId: note.sectionId ? sectionMap.get(note.sectionId) || undefined : undefined,
      sourceId: note.sourceId ? sourceMap.get(note.sourceId) || undefined : undefined,
      createdAt: note.createdAt || new Date().toISOString(),
    };
  });

  // 4. Remap chat sessions with mapped notebookId and message citations
  const clonedChatSessions = (importedNb.chatSessions || []).map((cs, idx) => {
    const newSessionId = `session-${now}-${idx}-${genHash()}`;
    return {
      ...cs,
      id: newSessionId,
      notebookId: newNotebookId,
      createdAt: cs.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: (cs.messages || []).map((m, mIdx) => ({
        ...m,
        id: `msg-${now}-${idx}-${mIdx}-${genHash()}`,
        citations: (m.citations || []).map((c) => ({
          ...c,
          sourceId: sourceMap.get(c.sourceId) || c.sourceId,
        })),
      })),
    };
  });

  // 5. Remap main chat history messages
  const clonedChatHistory = (importedNb.chatHistory || []).map((m, idx) => ({
    ...m,
    id: `msg-${now}-${idx}-${genHash()}`,
    citations: (m.citations || []).map((c) => ({
      ...c,
      sourceId: sourceMap.get(c.sourceId) || c.sourceId,
    })),
  }));

  const finalTitle = customTitle?.trim() || importedNb.title || 'Caderno Importado';

  return {
    id: newNotebookId,
    title: finalTitle,
    description: importedNb.description || '',
    emoji: importedNb.emoji || '📓',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ownerEmail: importedNb.ownerEmail || 'user@example.com',
    sections: clonedSections,
    sources: clonedSources,
    notes: clonedNotes,
    chatHistory: clonedChatHistory,
    chatSessions: clonedChatSessions,
    shareSettings: importedNb.shareSettings
      ? {
          ...importedNb.shareSettings,
          shareCode: `omni-${newNotebookId.slice(0, 6)}`,
        }
      : undefined,
  };
}
