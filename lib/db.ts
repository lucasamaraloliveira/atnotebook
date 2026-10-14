'use client';

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Notebook, ChatSession } from './types';
import { DEFAULT_NOTEBOOKS } from './initialData';

const DB_NAME = 'OmniNotebookDB_v1';
const DB_VERSION = 1;

interface OmniDB extends DBSchema {
  notebooks: {
    key: string;
    value: Notebook;
  };
  chat_sessions: {
    key: string;
    value: ChatSession;
    indexes: { 'by-notebookId': string };
  };
}

let dbPromise: Promise<IDBPDatabase<OmniDB>> | null = null;

function getDB() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<OmniDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('notebooks')) {
          db.createObjectStore('notebooks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('chat_sessions')) {
          const chatStore = db.createObjectStore('chat_sessions', { keyPath: 'id' });
          chatStore.createIndex('by-notebookId', 'notebookId');
        }
      },
    });
  }
  return dbPromise;
}

export async function loadNotebooksFromDB(): Promise<Notebook[]> {
  try {
    const db = await getDB();
    if (!db) return [];

    const all = await db.getAll('notebooks');
    if (!all || all.length === 0) {
      return [];
    }

    // Ensure array structures exist
    return all.map((nb) => ({
      ...nb,
      sections: Array.isArray(nb.sections) ? nb.sections : [],
      sources: Array.isArray(nb.sources) ? nb.sources : [],
      chatHistory: Array.isArray(nb.chatHistory) ? nb.chatHistory : [],
      chatSessions: Array.isArray(nb.chatSessions) ? nb.chatSessions : [],
      notes: Array.isArray(nb.notes) ? nb.notes : [],
    }));
  } catch (err) {
    console.error('Error loading notebooks from IndexedDB:', err);
    return [];
  }
}

export async function saveNotebookToDB(notebook: Notebook): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    await db.put('notebooks', notebook);
  } catch (err) {
    console.error(`Error saving notebook ${notebook.id} to IndexedDB:`, err);
  }
}

export async function saveAllNotebooksToDB(notebooks: Notebook[]): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction('notebooks', 'readwrite');
    const store = tx.store;

    const existingKeys = await store.getAllKeys();
    const currentIds = new Set(notebooks.map((n) => n.id));

    // Remove deleted notebooks from IndexedDB
    for (const key of existingKeys) {
      if (!currentIds.has(String(key))) {
        await store.delete(key);
      }
    }

    // Put all active notebooks
    for (const nb of notebooks) {
      await store.put(nb);
    }
    await tx.done;
  } catch (err) {
    console.error('Error batch saving notebooks to IndexedDB:', err);
  }
}

export async function deleteNotebookFromDB(id: string): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    await db.delete('notebooks', id);
  } catch (err) {
    console.error(`Error deleting notebook ${id} from IndexedDB:`, err);
  }
}

// Chat Sessions Persistence
export async function getChatSessionsFromDB(notebookId: string): Promise<ChatSession[]> {
  try {
    const db = await getDB();
    if (!db) return [];
    const index = db.transaction('chat_sessions').store.index('by-notebookId');
    const sessions = await index.getAll(notebookId);
    return sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error(`Error fetching chat sessions for notebook ${notebookId}:`, err);
    return [];
  }
}

export async function saveChatSessionToDB(session: ChatSession): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    await db.put('chat_sessions', session);
  } catch (err) {
    console.error(`Error saving chat session ${session.id}:`, err);
  }
}

export async function deleteChatSessionFromDB(sessionId: string): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    await db.delete('chat_sessions', sessionId);
  } catch (err) {
    console.error(`Error deleting chat session ${sessionId}:`, err);
  }
}

export async function clearChatSessionsFromDB(notebookId: string): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    const index = db.transaction('chat_sessions', 'readwrite').store.index('by-notebookId');
    const keys = await index.getAllKeys(notebookId);
    const tx = db.transaction('chat_sessions', 'readwrite');
    for (const key of keys) {
      await tx.store.delete(key);
    }
    await tx.done;
  } catch (err) {
    console.error(`Error clearing chat sessions for notebook ${notebookId}:`, err);
  }
}
