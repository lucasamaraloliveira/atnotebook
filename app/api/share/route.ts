import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Shared memory cache
const shareCache = new Map<string, any>();
const SHARES_DIR = path.join('/tmp', 'omninotebook_shares');

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

    ensureSharesDir();
    const shareId = `sh_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    shareCache.set(shareId, notebook);

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

    // Check memory cache first
    if (shareCache.has(shareId)) {
      return NextResponse.json({ notebook: shareCache.get(shareId), success: true });
    }

    // Check disk
    ensureSharesDir();
    const filePath = path.join(SHARES_DIR, `${shareId}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const notebook = JSON.parse(content);
      shareCache.set(shareId, notebook);
      return NextResponse.json({ notebook, success: true });
    }

    return NextResponse.json({ error: 'Share link not found or expired' }, { status: 404 });
  } catch (error: any) {
    console.error('Error in GET /api/share:', error);
    return NextResponse.json({ error: 'Failed to fetch shared notebook' }, { status: 500 });
  }
}
