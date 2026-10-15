import { Notebook, DailyUsageMetric } from './types';

export interface DayActivityData {
  date: string; // 'YYYY-MM-DD'
  dayName: string; // 'Seg', 'Ter', 'Qua', etc.
  shortDate: string; // '14/10'
  queries: number;
  tokensEstimated: number;
  sourcesAdded: number;
  notesAdded: number;
  isToday: boolean;
  percentageOfMax: number;
}

export interface SectionEngagement {
  id: string;
  name: string;
  icon: string;
  color?: string;
  sourcesCount: number;
  notesCount: number;
  percentage: number;
}

export interface NotebookAnalyticsReport {
  notebookId: string;
  notebookTitle: string;
  notebookEmoji: string;
  totalQueries: number;
  todayQueries: number;
  weeklyQueries: number;
  weeklyAverage: number;
  peakDay: { dayName: string; date: string; queries: number };
  activeDaysInWeek: number;
  lastActiveFormatted: string;
  weeklyTimeline: DayActivityData[];
  monthlyTimeline: DayActivityData[];
  sourcesMetrics: {
    total: number;
    enabled: number;
    disabled: number;
    enabledPercentage: number;
    totalTokens: number;
    totalWords: number;
    totalCharacters: number;
    averageTokensPerSource: number;
    byType: Record<string, number>;
  };
  sectionsMetrics: SectionEngagement[];
  notesMetrics: {
    total: number;
    totalWords: number;
  };
  chatMetrics: {
    activeMessages: number;
    archivedSessions: number;
    totalExchanges: number;
  };
}

/**
 * Get date string in 'YYYY-MM-DD' format according to local timezone
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Computes deep analytics and usage statistics for a given notebook
 */
export function calculateNotebookAnalytics(notebook: Notebook): NotebookAnalyticsReport {
  const todayStr = getLocalDateString();
  const dailyMap = new Map<string, { queries: number; tokens: number; sources: number; notes: number }>();

  // 1. Gather all activity from stored usageStats.dailyActivity if available
  if (notebook.usageStats?.dailyActivity) {
    Object.entries(notebook.usageStats.dailyActivity).forEach(([date, act]) => {
      dailyMap.set(date, {
        queries: act.queries || 0,
        tokens: act.tokens || 0,
        sources: act.sourcesAdded || 0,
        notes: act.notesAdded || 0,
      });
    });
  }

  // Helper to increment dailyMap
  const incrementActivity = (dateStr: string, field: 'queries' | 'tokens' | 'sources' | 'notes', amount: number = 1) => {
    if (!dateStr || dateStr.length < 10) return;
    const cleanDate = dateStr.slice(0, 10);
    const existing = dailyMap.get(cleanDate) || { queries: 0, tokens: 0, sources: 0, notes: 0 };
    existing[field] += amount;
    dailyMap.set(cleanDate, existing);
  };

  // 2. Aggregate queries from active chat history (retroactive safety)
  if (Array.isArray(notebook.chatHistory)) {
    notebook.chatHistory.forEach((msg) => {
      if (msg.role === 'user' && msg.timestamp) {
        // If not already explicitly counted or to ensure accuracy
        incrementActivity(msg.timestamp, 'queries', 1);
        incrementActivity(msg.timestamp, 'tokens', Math.round((msg.content?.length || 0) / 4) + 120);
      }
    });
  }

  // 3. Aggregate queries from archived chat sessions
  if (Array.isArray(notebook.chatSessions)) {
    notebook.chatSessions.forEach((sess) => {
      if (Array.isArray(sess.messages)) {
        sess.messages.forEach((msg) => {
          if (msg.role === 'user' && msg.timestamp) {
            incrementActivity(msg.timestamp, 'queries', 1);
            incrementActivity(msg.timestamp, 'tokens', Math.round((msg.content?.length || 0) / 4) + 120);
          }
        });
      }
    });
  }

  // 4. Aggregate sources migration dates
  if (Array.isArray(notebook.sources)) {
    notebook.sources.forEach((src) => {
      if (src.migratedAt) {
        incrementActivity(src.migratedAt, 'sources', 1);
      }
    });
  }

  // 5. Aggregate notes creation dates
  if (Array.isArray(notebook.notes)) {
    notebook.notes.forEach((note) => {
      if (note.createdAt) {
        incrementActivity(note.createdAt, 'notes', 1);
      }
    });
  }

  // 6. Build the 7-day Weekly Timeline (from 6 days ago up to today)
  const weeklyTimeline: DayActivityData[] = [];
  let weeklyQueries = 0;
  let maxQueriesInWeek = 1;
  let peakDay = { dayName: 'Hoje', date: todayStr, queries: 0 };
  let activeDaysInWeek = 0;

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = getLocalDateString(d);
    const dayOfWeek = d.getDay();
    const dayName = DAY_NAMES[dayOfWeek];
    const shortDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const activity = dailyMap.get(dateStr) || { queries: 0, tokens: 0, sources: 0, notes: 0 };

    weeklyQueries += activity.queries;
    if (activity.queries > maxQueriesInWeek) {
      maxQueriesInWeek = activity.queries;
    }
    if (activity.queries > peakDay.queries) {
      peakDay = { dayName, date: dateStr, queries: activity.queries };
    }
    if (activity.queries > 0 || activity.sources > 0 || activity.notes > 0) {
      activeDaysInWeek++;
    }

    weeklyTimeline.push({
      date: dateStr,
      dayName,
      shortDate,
      queries: activity.queries,
      tokensEstimated: activity.tokens,
      sourcesAdded: activity.sources,
      notesAdded: activity.notes,
      isToday: dateStr === todayStr,
      percentageOfMax: 0, // calculated below
    });
  }

  // Calculate percentage of max for weekly bars
  weeklyTimeline.forEach((day) => {
    day.percentageOfMax = maxQueriesInWeek > 0 ? Math.round((day.queries / maxQueriesInWeek) * 100) : 0;
  });

  // 7. Build 30-day timeline for extended view
  const monthlyTimeline: DayActivityData[] = [];
  let maxQueriesInMonth = 1;
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = getLocalDateString(d);
    const dayOfWeek = d.getDay();
    const dayName = DAY_NAMES[dayOfWeek];
    const shortDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const activity = dailyMap.get(dateStr) || { queries: 0, tokens: 0, sources: 0, notes: 0 };

    if (activity.queries > maxQueriesInMonth) {
      maxQueriesInMonth = activity.queries;
    }

    monthlyTimeline.push({
      date: dateStr,
      dayName,
      shortDate,
      queries: activity.queries,
      tokensEstimated: activity.tokens,
      sourcesAdded: activity.sources,
      notesAdded: activity.notes,
      isToday: dateStr === todayStr,
      percentageOfMax: 0,
    });
  }
  monthlyTimeline.forEach((day) => {
    day.percentageOfMax = maxQueriesInMonth > 0 ? Math.round((day.queries / maxQueriesInMonth) * 100) : 0;
  });

  // 8. Sources Metrics
  const sources = notebook.sources || [];
  const totalSources = sources.length;
  const enabledSources = sources.filter((s) => s.enabled).length;
  const disabledSources = totalSources - enabledSources;
  const enabledPercentage = totalSources > 0 ? Math.round((enabledSources / totalSources) * 100) : 0;

  let totalTokens = 0;
  let totalWords = 0;
  let totalCharacters = 0;
  const byType: Record<string, number> = {};

  sources.forEach((s) => {
    totalTokens += s.estimatedTokens || Math.round((s.content?.length || 0) / 4);
    totalWords += s.wordCount || (s.content ? s.content.trim().split(/\s+/).length : 0);
    totalCharacters += s.charCount || s.content?.length || 0;
    const typeKey = s.type || 'text';
    byType[typeKey] = (byType[typeKey] || 0) + 1;
  });

  const averageTokensPerSource = totalSources > 0 ? Math.round(totalTokens / totalSources) : 0;

  // 9. Sections Engagement
  const sections = notebook.sections || [];
  const notes = notebook.notes || [];
  const sectionsMetrics: SectionEngagement[] = sections.map((sec) => {
    const secSources = sources.filter((s) => s.sectionId === sec.id).length;
    const secNotes = notes.filter((n) => n.sectionId === sec.id).length;
    const percentage = totalSources > 0 ? Math.round((secSources / totalSources) * 100) : 0;
    return {
      id: sec.id,
      name: sec.name,
      icon: sec.icon || '📁',
      color: sec.color,
      sourcesCount: secSources,
      notesCount: secNotes,
      percentage,
    };
  });

  // Sort sections by engagement
  sectionsMetrics.sort((a, b) => b.sourcesCount + b.notesCount - (a.sourcesCount + a.notesCount));

  // 10. Notes & Chat Stats
  let totalNotesWords = 0;
  notes.forEach((n) => {
    totalNotesWords += n.content ? n.content.trim().split(/\s+/).length : 0;
  });

  // Today queries count
  const todayQueries = dailyMap.get(todayStr)?.queries || 0;

  // Total all-time queries
  let totalQueries = 0;
  dailyMap.forEach((act) => {
    totalQueries += act.queries;
  });
  if (notebook.usageStats?.totalQueries && notebook.usageStats.totalQueries > totalQueries) {
    totalQueries = notebook.usageStats.totalQueries;
  }

  const weeklyAverage = Math.round((weeklyQueries / 7) * 10) / 10;

  // Last active date
  let lastActiveFormatted = 'Hoje';
  if (notebook.updatedAt) {
    try {
      const dt = new Date(notebook.updatedAt);
      lastActiveFormatted = dt.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      lastActiveFormatted = notebook.updatedAt;
    }
  }

  return {
    notebookId: notebook.id,
    notebookTitle: notebook.title,
    notebookEmoji: notebook.emoji || '📓',
    totalQueries,
    todayQueries,
    weeklyQueries,
    weeklyAverage,
    peakDay,
    activeDaysInWeek,
    lastActiveFormatted,
    weeklyTimeline,
    monthlyTimeline,
    sourcesMetrics: {
      total: totalSources,
      enabled: enabledSources,
      disabled: disabledSources,
      enabledPercentage,
      totalTokens,
      totalWords,
      totalCharacters,
      averageTokensPerSource,
      byType,
    },
    sectionsMetrics,
    notesMetrics: {
      total: notes.length,
      totalWords: totalNotesWords,
    },
    chatMetrics: {
      activeMessages: notebook.chatHistory?.length || 0,
      archivedSessions: notebook.chatSessions?.length || 0,
      totalExchanges: totalQueries,
    },
  };
}

/**
 * Record a user interaction into notebook.usageStats
 */
export function recordNotebookInteraction(
  notebook: Notebook,
  type: 'query' | 'source_added' | 'note_added',
  tokensCount: number = 0
): Notebook {
  const todayStr = getLocalDateString();
  const currentStats = notebook.usageStats || {
    totalQueries: 0,
    totalTokensProcessed: 0,
    dailyActivity: {},
  };

  const dailyActivity = { ...(currentStats.dailyActivity || {}) };
  const todayActivity = { ...(dailyActivity[todayStr] || { queries: 0, tokens: 0, sourcesAdded: 0, notesAdded: 0 }) };

  let totalQueries = currentStats.totalQueries || 0;
  let totalTokens = currentStats.totalTokensProcessed || 0;

  if (type === 'query') {
    todayActivity.queries = (todayActivity.queries || 0) + 1;
    todayActivity.tokens = (todayActivity.tokens || 0) + tokensCount;
    totalQueries += 1;
    totalTokens += tokensCount;
  } else if (type === 'source_added') {
    todayActivity.sourcesAdded = (todayActivity.sourcesAdded || 0) + 1;
  } else if (type === 'note_added') {
    todayActivity.notesAdded = (todayActivity.notesAdded || 0) + 1;
  }

  dailyActivity[todayStr] = todayActivity;

  return {
    ...notebook,
    updatedAt: new Date().toISOString(),
    usageStats: {
      totalQueries,
      totalTokensProcessed: totalTokens,
      lastActiveAt: new Date().toISOString(),
      dailyActivity,
    },
  };
}
