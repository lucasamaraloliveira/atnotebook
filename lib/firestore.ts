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
  Firestore,
} from 'firebase/firestore';
import { Notebook } from './types';
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
 * Fallbacks gracefully to local storage if Firestore API is not enabled in the project.
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
    const payload = {
      ...notebook,
      ownerEmail: userEmail || notebook.ownerEmail || 'lucas.amaral.oliveira.silva@gmail.com',
      lastSyncedAt: new Date().toISOString(),
    };

    await setDoc(notebookDocRef, payload, { merge: true });
    lastKnownCloudStatus = 'synced';
    return { success: true, status: 'synced' };
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('PERMISSION_DENIED') || msg.includes('has not been used in project') || msg.includes('disabled')) {
      lastKnownCloudStatus = 'api_disabled';
      console.warn(
        '[Firestore] Cloud Firestore API is not enabled on project atnotebook-1eb35. Data remains 100% saved in local IndexedDB.'
      );
      return {
        success: false,
        status: 'api_disabled',
        error: 'API Cloud Firestore desativada no console Google.',
      };
    }

    lastKnownCloudStatus = 'error';
    console.warn('[Firestore] Sync warning:', msg);
    return { success: false, status: 'error', error: msg };
  }
}

/**
 * Loads all notebooks from Cloud Firestore.
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

    snapshot.forEach((d) => {
      const data = d.data() as any;
      if (data && data.id && data.title) {
        cloudNotebooks.push({
          id: data.id,
          title: data.title,
          description: data.description || '',
          emoji: data.emoji || '📓',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          ownerEmail: data.ownerEmail,
          sections: Array.isArray(data.sections) ? data.sections : [],
          sources: Array.isArray(data.sources)
            ? data.sources.map((s: any) => ({ ...s, enabled: s.enabled !== false }))
            : [],
          notes: Array.isArray(data.notes) ? data.notes : [],
          chatHistory: Array.isArray(data.chatHistory) ? data.chatHistory : [],
          chatSessions: Array.isArray(data.chatSessions) ? data.chatSessions : [],
          shareSettings: data.shareSettings,
        });
      }
    });

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
 * Deletes a notebook from Cloud Firestore.
 */
export async function deleteNotebookFromFirestore(notebookId: string): Promise<void> {
  const db = getFirestoreDB();
  if (!db) return;

  try {
    const docRef = doc(db, 'notebooks', notebookId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn(`[Firestore] Could not delete notebook ${notebookId} from cloud:`, err);
  }
}
