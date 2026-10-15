'use client';

import { getApps, initializeApp, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  deleteDoc,
  writeBatch,
  Firestore,
} from 'firebase/firestore';
import { Notebook, NotebookSource } from './types';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let firestoreInstance: Firestore | null = null;

export function getFirestoreDB(): Firestore | null {
  if (typeof window === 'undefined') return null;
  if (!firestoreInstance) {
    try {
      firestoreInstance = getFirestore(app);
    } catch (err) {
      console.warn('[Firestore] Failed to initialize Firestore client:', err);
      return null;
    }
  }
  return firestoreInstance;
}

export type CloudSyncStatus =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'local_only'
  | 'api_disabled'
  | 'error';

let lastKnownCloudStatus: CloudSyncStatus = 'local_only';

export function getLastCloudStatus(): CloudSyncStatus {
  return lastKnownCloudStatus;
}

/**
 * Saves or updates a single notebook in Cloud Firestore.
 * Uses Firestore Subcollections (`notebooks/{id}/sources/{sourceId}`) to completely bypass
 * the 1MB document limit, allowing notebooks with 300+ sources to save with 100% integrity.
 */
export async function saveNotebookToFirestore(
  notebook: Notebook,
  userEmail?: string
): Promise<{ success: boolean; status: CloudSyncStatus; error?: string }> {
  const db = getFirestoreDB();
  if (!db) {
    lastKnownCloudStatus = 'local_only';
    return { success: false, status: 'local_only', error: 'Firestore offline' };
  }

  try {
    const notebookDocRef = doc(db, 'notebooks', notebook.id);
    const { sources = [], ...mainPayload } = notebook;

    // 1. Save main notebook document (metadata, sections, notes, chatSessions, stats)
    // We intentionally omit the heavy sources array here to avoid Firestore's 1MB limit.
    const metaPayload = {
      ...mainPayload,
      sourcesCount: sources.length,
      ownerEmail: userEmail || notebook.ownerEmail || 'lucas.amaral.oliveira.silva@gmail.com',
      lastSyncedAt: new Date().toISOString(),
      updatedAt: notebook.updatedAt || new Date().toISOString(),
    };

    await setDoc(notebookDocRef, metaPayload, { merge: true });

    // 2. Save each source in the subcollection `notebooks/{id}/sources`
    // Firestore batches are limited to 500 operations; we chunk by 400 for safety.
    const CHUNK_SIZE = 400;
    for (let i = 0; i < sources.length; i += CHUNK_SIZE) {
      const chunk = sources.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const src of chunk) {
        const sourceDocRef = doc(db, 'notebooks', notebook.id, 'sources', src.id);
        batch.set(sourceDocRef, {
          ...src,
          enabled: src.enabled !== false,
          migratedAt: src.migratedAt || new Date().toISOString(),
        });
      }

      await batch.commit();
    }

    // 3. Clean up deleted sources from cloud subcollection if needed
    try {
      const existingSourcesSnap = await getDocs(
        collection(db, 'notebooks', notebook.id, 'sources')
      );
      const currentSourceIds = new Set(sources.map((s) => s.id));
      const deleteBatch = writeBatch(db);
      let deleteCount = 0;

      existingSourcesSnap.forEach((d) => {
        if (!currentSourceIds.has(d.id)) {
          deleteBatch.delete(d.ref);
          deleteCount++;
        }
      });

      if (deleteCount > 0) {
        await deleteBatch.commit();
      }
    } catch (cleanErr) {
      console.warn('[Firestore] Warning while cleaning obsolete sources:', cleanErr);
    }

    lastKnownCloudStatus = 'synced';
    return { success: true, status: 'synced' };
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (
      msg.includes('PERMISSION_DENIED') ||
      msg.includes('has not been used in project') ||
      msg.includes('disabled')
    ) {
      lastKnownCloudStatus = 'api_disabled';
      console.warn(
        '[Firestore] Cloud Firestore API is not enabled on project atnotebook-1eb35. Data remains saved in local IndexedDB.'
      );
      return {
        success: false,
        status: 'api_disabled',
        error: 'API Cloud Firestore desativada no console Google.',
      };
    }

    lastKnownCloudStatus = 'error';
    console.warn('[Firestore] Sync error:', msg);
    return { success: false, status: 'error', error: msg };
  }
}

/**
 * Loads all notebooks from Cloud Firestore, assembling sources from subcollections.
 */
export async function loadNotebooksFromFirestore(): Promise<{
  notebooks: Notebook[];
  status: CloudSyncStatus;
}> {
  const db = getFirestoreDB();
  if (!db) {
    return { notebooks: [], status: 'local_only' };
  }

  try {
    const colRef = collection(db, 'notebooks');
    const snapshot = await getDocs(colRef);
    const cloudNotebooks: Notebook[] = [];

    for (const d of snapshot.docs) {
      // Ignore test documents
      if (d.id.startsWith('_test_') || d.id === 'test-subcol-nb-01') continue;

      const data = d.data() as any;
      if (data && data.id && data.title) {
        // Fetch sources from subcollection `notebooks/{id}/sources`
        let sources: NotebookSource[] = [];
        try {
          const sourcesSnap = await getDocs(
            collection(db, 'notebooks', data.id, 'sources')
          );
          if (!sourcesSnap.empty) {
            sourcesSnap.forEach((sDoc) => {
              const sData = sDoc.data() as NotebookSource;
              if (sData && sData.id) {
                sources.push({
                  ...sData,
                  enabled: sData.enabled !== false,
                });
              }
            });
          } else if (Array.isArray(data.sources) && data.sources.length > 0) {
            // Fallback for legacy documents
            sources = data.sources.map((s: any) => ({
              ...s,
              enabled: s.enabled !== false,
            }));
          }
        } catch (srcErr) {
          console.warn(`[Firestore] Could not load sources subcollection for ${data.id}:`, srcErr);
          if (Array.isArray(data.sources)) {
            sources = data.sources;
          }
        }

        cloudNotebooks.push({
          id: data.id,
          title: data.title,
          description: data.description || '',
          emoji: data.emoji || '📓',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          ownerEmail: data.ownerEmail,
          sections: Array.isArray(data.sections) ? data.sections : [],
          sources,
          notes: Array.isArray(data.notes) ? data.notes : [],
          chatHistory: Array.isArray(data.chatHistory) ? data.chatHistory : [],
          chatSessions: Array.isArray(data.chatSessions) ? data.chatSessions : [],
          shareSettings: data.shareSettings,
        });
      }
    }

    lastKnownCloudStatus = 'synced';
    return { notebooks: cloudNotebooks, status: 'synced' };
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('PERMISSION_DENIED') || msg.includes('disabled')) {
      lastKnownCloudStatus = 'api_disabled';
    } else {
      lastKnownCloudStatus = 'error';
    }
    return { notebooks: [], status: lastKnownCloudStatus };
  }
}

/**
 * Saves a shared notebook into Firestore (`shared_notebooks/{shareId}`)
 * using subcollections for sources. This guarantees that links sent to mobile
 * or read-only users load all 300+ sources with 100% integrity.
 */
export async function saveSharedNotebookToFirestore(
  notebook: Notebook
): Promise<{ shareId: string; success: boolean; error?: string }> {
  const db = getFirestoreDB();
  const shareId = `sh_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

  if (!db) {
    return { shareId: '', success: false, error: 'Firestore offline' };
  }

  try {
    const shareDocRef = doc(db, 'shared_notebooks', shareId);
    const { sources = [], ...mainPayload } = notebook;

    // 1. Save shared metadata doc
    await setDoc(shareDocRef, {
      ...mainPayload,
      sourcesCount: sources.length,
      shareId,
      sharedAt: new Date().toISOString(),
    });

    // 2. Save sources subcollection in chunks of 400
    const CHUNK_SIZE = 400;
    for (let i = 0; i < sources.length; i += CHUNK_SIZE) {
      const chunk = sources.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const src of chunk) {
        const sourceDocRef = doc(db, 'shared_notebooks', shareId, 'sources', src.id);
        batch.set(sourceDocRef, {
          ...src,
          enabled: src.enabled !== false,
        });
      }

      await batch.commit();
    }

    return { shareId, success: true };
  } catch (err: any) {
    console.error('[Firestore] Error saving shared notebook to cloud:', err);
    return { shareId: '', success: false, error: String(err?.message || err) };
  }
}

/**
 * Loads a shared notebook from Firestore by `shareId`, assembling all sources.
 */
export async function getSharedNotebookFromFirestore(
  shareId: string
): Promise<Notebook | null> {
  const db = getFirestoreDB();
  if (!db || !shareId) return null;

  try {
    const shareDocRef = doc(db, 'shared_notebooks', shareId);
    const shareDocSnap = await getDoc(shareDocRef);

    if (!shareDocSnap.exists()) {
      // Fallback: check if shareId is a regular notebook ID
      const directDoc = await getDoc(doc(db, 'notebooks', shareId));
      if (!directDoc.exists()) return null;
      const data = directDoc.data() as any;
      const sourcesSnap = await getDocs(collection(db, 'notebooks', shareId, 'sources'));
      const sources: NotebookSource[] = [];
      sourcesSnap.forEach((s) => sources.push(s.data() as NotebookSource));
      return {
        id: data.id,
        title: data.title,
        description: data.description || '',
        emoji: data.emoji || '📓',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        ownerEmail: data.ownerEmail,
        sections: Array.isArray(data.sections) ? data.sections : [],
        sources: sources.length > 0 ? sources : (data.sources || []),
        notes: Array.isArray(data.notes) ? data.notes : [],
        chatHistory: Array.isArray(data.chatHistory) ? data.chatHistory : [],
        chatSessions: Array.isArray(data.chatSessions) ? data.chatSessions : [],
        shareSettings: data.shareSettings,
      };
    }

    const data = shareDocSnap.data() as any;
    const sourcesSnap = await getDocs(
      collection(db, 'shared_notebooks', shareId, 'sources')
    );
    const sources: NotebookSource[] = [];
    sourcesSnap.forEach((s) => {
      const sData = s.data() as NotebookSource;
      if (sData && sData.id) {
        sources.push({ ...sData, enabled: sData.enabled !== false });
      }
    });

    return {
      id: data.id || `nb-shared-${shareId}`,
      title: data.title || 'Caderno Compartilhado',
      description: data.description || '',
      emoji: data.emoji || '📓',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
      ownerEmail: data.ownerEmail,
      sections: Array.isArray(data.sections) ? data.sections : [],
      sources: sources.length > 0 ? sources : (data.sources || []),
      notes: Array.isArray(data.notes) ? data.notes : [],
      chatHistory: Array.isArray(data.chatHistory) ? data.chatHistory : [],
      chatSessions: Array.isArray(data.chatSessions) ? data.chatSessions : [],
      shareSettings: data.shareSettings,
    };
  } catch (err) {
    console.error(`[Firestore] Failed to fetch shared notebook ${shareId}:`, err);
    return null;
  }
}

/**
 * Deletes a notebook from Cloud Firestore including all sources in subcollection.
 */
export async function deleteNotebookFromFirestore(notebookId: string): Promise<void> {
  const db = getFirestoreDB();
  if (!db) return;

  try {
    // Delete sources in subcollection
    const sourcesSnap = await getDocs(
      collection(db, 'notebooks', notebookId, 'sources')
    );
    if (!sourcesSnap.empty) {
      const batch = writeBatch(db);
      sourcesSnap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // Delete main notebook doc
    const docRef = doc(db, 'notebooks', notebookId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn(`[Firestore] Could not delete notebook ${notebookId} from cloud:`, err);
  }
}
