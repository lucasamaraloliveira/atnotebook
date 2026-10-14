'use client';

import { Notebook } from './types';
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
  if (!encodedStr) return null;
  try {
    const cleanStr = encodedStr.trim().replace(/^#/, '');
    const jsonStr = decodeURIComponent(atob(cleanStr));
    const parsed = JSON.parse(jsonStr);
    if (parsed && parsed.id && parsed.title && Array.isArray(parsed.sources)) {
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
  } catch (err) {
    console.error('Failed to decode notebook from share string:', err);
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
