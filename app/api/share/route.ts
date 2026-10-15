import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, getDocs, collection, setDoc, writeBatch } from 'firebase/firestore';
import firebaseConfig from '@/firebase-applet-config.json';
import fs from 'fs';
import path from 'path';

// Shared memory cache
const shareCache = new Map<string, any>();
const SHARES_DIR = path.join('/tmp', 'omninotebook_shares');

function getFirebaseDB() {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    return getFirestore(app);
  } catch (e) {
    console.error('Failed to init Firestore on server:', e);
    return null;
  }
}

function ensureSharesDir() {
  try {
    if (!fs.existsSync(SHARES_DIR)) {
      fs.mkdirSync(SHARES_DIR, { recursive: true });
    }
  } catch (e) {
    console.error('Failed to create shares directory:', e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { notebook } = body;
    if (!notebook || !notebook.id) {
      return NextResponse.json({ error: 'Notebook payload string or object is required' }, { status: 400 });
    }

    const shareId = `sh_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    shareCache.set(shareId, notebook);

    // Save to Firestore if available
    const db = getFirebaseDB();
    if (db) {
      try {
        const { sources = [], ...mainPayload } = notebook;
        await setDoc(doc(db, 'shared_notebooks', shareId), {
          ...mainPayload,
          sourcesCount: sources.length,
          shareId,
          sharedAt: new Date().toISOString(),
        });

        const CHUNK_SIZE = 400;
        for (let i = 0; i < sources.length; i += CHUNK_SIZE) {
          const chunk = sources.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          for (const src of chunk) {
            batch.set(doc(db, 'shared_notebooks', shareId, 'sources', src.id), {
              ...src,
              enabled: src.enabled !== false,
            });
          }
          await batch.commit();
        }
      } catch (dbErr) {
        console.warn('Failed to persist share in Firestore on server:', dbErr);
      }
    }

    // Local disk fallback
    ensureSharesDir();
    try {
      const filePath = path.join(SHARES_DIR, `${shareId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(notebook), 'utf-8');
    } catch (e) {
      console.error('Failed to write share file to disk:', e);
    }

    return NextResponse.json({ shareId, success: true });
  } catch (error: any) {
    console.error('Error in POST /api/share:', error);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shareId = searchParams.get('shareId');

    if (!shareId) {
      return NextResponse.json({ error: 'shareId param required' }, { status: 400 });
    }

    // 1. Check memory cache
    if (shareCache.has(shareId)) {
      return NextResponse.json({ notebook: shareCache.get(shareId), success: true });
    }

    // 2. Check disk cache
    ensureSharesDir();
    const filePath = path.join(SHARES_DIR, `${shareId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const notebook = JSON.parse(content);
        shareCache.set(shareId, notebook);
        return NextResponse.json({ notebook, success: true });
      } catch {}
    }

    // 3. Check Cloud Firestore (handles Vercel serverless persistence across devices)
    const db = getFirebaseDB();
    if (db) {
      try {
        const shareDocRef = doc(db, 'shared_notebooks', shareId);
        const shareSnap = await getDoc(shareDocRef);
        if (shareSnap.exists()) {
          const data = shareSnap.data() as any;
          const sourcesSnap = await getDocs(collection(db, 'shared_notebooks', shareId, 'sources'));
          const sources: any[] = [];
          sourcesSnap.forEach((s) => sources.push(s.data()));

          const notebook = {
            ...data,
            sources: sources.length > 0 ? sources : (data.sources || []),
          };
          shareCache.set(shareId, notebook);
          return NextResponse.json({ notebook, success: true });
        }
      } catch (dbErr) {
        console.warn('Failed to fetch share from Firestore on server:', dbErr);
      }
    }

    return NextResponse.json({ error: 'Share link not found or expired' }, { status: 404 });
  } catch (error: any) {
    console.error('Error in GET /api/share:', error);
    return NextResponse.json({ error: 'Failed to fetch shared notebook' }, { status: 500 });
  }
}
