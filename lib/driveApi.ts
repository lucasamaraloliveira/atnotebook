import { computeTextMetrics } from './integrity';
import { NotebookSource } from './types';

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface ListFilesOptions {
  query?: string;
  folderId?: string;
  pageSize?: number;
  pageToken?: string;
  fileTypeFilter?: 'all' | 'docs' | 'text' | 'spreadsheets';
}

export async function listDriveFiles(
  accessToken: string,
  options: ListFilesOptions = {}
): Promise<{ files: DriveItem[]; nextPageToken?: string }> {
  const { query = '', folderId, pageSize = 100, pageToken, fileTypeFilter = 'all' } = options;

  const queryParts: string[] = ['trashed = false'];

  if (folderId) {
    queryParts.push(`'${folderId}' in parents`);
  }

  if (query.trim()) {
    queryParts.push(`name contains '${query.replace(/'/g, "\\'")}'`);
  }

  if (fileTypeFilter === 'docs') {
    queryParts.push(`mimeType = 'application/vnd.google-apps.document'`);
  } else if (fileTypeFilter === 'text') {
    queryParts.push(
      `(mimeType = 'text/plain' or mimeType = 'text/markdown' or mimeType = 'application/json' or mimeType = 'text/csv')`
    );
  } else if (fileTypeFilter === 'spreadsheets') {
    queryParts.push(`mimeType = 'application/vnd.google-apps.spreadsheet'`);
  } else {
    // Exclude system media like mp3/mp4/raw zip unless text
    queryParts.push(
      `(mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.google-apps.folder' or mimeType = 'text/plain' or mimeType = 'text/markdown' or mimeType = 'application/pdf' or mimeType = 'application/json' or mimeType = 'text/csv')`
    );
  }

  const q = queryParts.join(' and ');
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set(
    'fields',
    'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)'
  );
  url.searchParams.set('q', q);
  url.searchParams.set('orderBy', 'modifiedTime desc');
  if (pageToken) {
    url.searchParams.set('pageToken', pageToken);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Erro ao listar arquivos do Google Drive (${response.status})`
    );
  }

  const data = await response.json();
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken,
  };
}

export async function fetchFileContent(
  accessToken: string,
  file: DriveItem
): Promise<string> {
  let content = '';

  if (file.mimeType === 'application/vnd.google-apps.document') {
    // Export Google Doc as plain text
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`;
    const res = await fetch(exportUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Falha ao exportar Google Doc: ${file.name}`);
    content = await res.text();
  } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
    // Export Sheet as CSV
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/csv`;
    const res = await fetch(exportUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Falha ao exportar Planilha: ${file.name}`);
    content = await res.text();
  } else {
    // Fetch raw content
    const mediaUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
    const res = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Falha ao baixar arquivo: ${file.name}`);
    content = await res.text();
  }

  return content;
}

export async function importDriveFilesBatch(
  accessToken: string,
  filesToImport: DriveItem[],
  onProgress: (current: number, total: number, fileName: string) => void
): Promise<Array<Omit<NotebookSource, 'id'>>> {
  const importedSources: Array<Omit<NotebookSource, 'id'>> = [];
  const total = filesToImport.length;

  for (let i = 0; i < total; i++) {
    const file = filesToImport[i];
    onProgress(i + 1, total, file.name);

    try {
      const rawText = await fetchFileContent(accessToken, file);
      const text = rawText.trim();
      const metrics = computeTextMetrics(text);

      importedSources.push({
        title: file.name.replace(/\.[^/.]+$/, ''), // Clean extension
        type:
          file.mimeType === 'application/vnd.google-apps.document'
            ? 'document'
            : file.mimeType === 'application/vnd.google-apps.spreadsheet'
            ? 'table'
            : 'text',
        originalOrigin: `Google Drive: ${file.name}${file.webViewLink ? ` (${file.webViewLink})` : ''}`,
        content: text || `[Documento vazio ou sem texto extraível: ${file.name}]`,
        summary: `Importado diretamente do Google Drive em lote (${metrics.wordCount} palavras).`,
        charCount: metrics.charCount,
        wordCount: metrics.wordCount,
        estimatedTokens: metrics.estimatedTokens,
        checksum: metrics.checksum,
        migratedAt: new Date().toISOString(),
        verified: true,
        notes: `ID do Google Drive: ${file.id}`,
        enabled: true,
      });
    } catch (err: any) {
      console.warn(`Erro ao importar ${file.name}:`, err);
      // Still record with note
      const fallbackText = `[Erro na leitura automática de ${file.name}: ${err.message}]`;
      const fallbackMetrics = computeTextMetrics(fallbackText);
      importedSources.push({
        title: file.name,
        type: 'document',
        originalOrigin: `Google Drive: ${file.name}`,
        content: fallbackText,
        charCount: fallbackMetrics.charCount,
        wordCount: fallbackMetrics.wordCount,
        estimatedTokens: fallbackMetrics.estimatedTokens,
        checksum: fallbackMetrics.checksum,
        migratedAt: new Date().toISOString(),
        verified: false,
        notes: `Erro no download: ${err.message}`,
        enabled: false,
      });
    }
  }

  return importedSources;
}
