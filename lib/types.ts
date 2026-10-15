export type SourceType =
  | 'text'
  | 'document'
  | 'web_article'
  | 'transcript'
  | 'table'
  | 'gemini_migrated';

export interface NotebookSection {
  id: string;
  name: string;
  icon: string;
  description?: string;
  color?: string;
  createdAt: string;
}

export interface NotebookSource {
  id: string;
  title: string;
  type: SourceType;
  sectionId?: string; // ID da pasta/sessão a que pertence (ex: "Modalidade Recepção")
  originalOrigin?: string;
  content: string;
  summary?: string;
  charCount: number;
  wordCount: number;
  estimatedTokens: number;
  checksum: string;
  migratedAt: string;
  verified: boolean;
  notes?: string;
  enabled: boolean;
}

export interface CitationRef {
  sourceId: string;
  sourceTitle: string;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: CitationRef[];
  groundedSourcesCount?: number;
  modelNotice?: string;
  usedModel?: string;
}

export interface ChatSession {
  id: string;
  notebookId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  actionType?: 'question' | 'summary' | 'analysis' | 'custom';
}

export interface NotebookNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  sourceId?: string;
  sectionId?: string;
}

export type UserRole = 'owner' | 'editor' | 'viewer';

export interface ShareSettings {
  isPubliclyShared: boolean;
  defaultRole: 'viewer' | 'editor';
  allowReaderChat: boolean;
  requiresOwnerApprovalForEdit: boolean;
  shareCode: string;
  ownerEmail?: string;
  accessRequests?: Array<{
    id: string;
    requesterEmail: string;
    requestedRole: 'editor';
    timestamp: string;
    status: 'pending' | 'approved' | 'rejected';
  }>;
}

export interface Notebook {
  id: string;
  title: string;
  description: string;
  emoji: string;
  createdAt: string;
  updatedAt: string;
  ownerEmail?: string;
  sections: NotebookSection[];
  sources: NotebookSource[];
  chatHistory: ChatMessage[];
  chatSessions?: ChatSession[];
  notes: NotebookNote[];
  shareSettings?: ShareSettings;
}

export interface ATNotebookExportPackage {
  format: 'ATNotebook';
  version: 1;
  exportedAt: string;
  notebook: {
    id: string;
    title: string;
    description: string;
    emoji: string;
    createdAt: string;
    updatedAt: string;
    ownerEmail?: string;
    shareSettings?: ShareSettings;
    sections: NotebookSection[];
    sources: NotebookSource[];
    notes: NotebookNote[];
    chatHistory: ChatMessage[];
    chatSessions?: ChatSession[];
  };
  metrics: {
    totalSources: number;
    totalSections: number;
    totalNotes: number;
    totalChatSessions: number;
    totalWords: number;
  };
}

export interface MigrationDraftItem {
  id: string;
  title: string;
  sectionId?: string;
  originalOrigin: string;
  content: string;
  notes: string;
  type: SourceType;
  status: 'pending' | 'verified' | 'imported';
}
