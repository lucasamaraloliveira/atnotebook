import { NextRequest, NextResponse } from 'next/server';
import { generateContentWithFallback } from '@/lib/gemini';

function cleanHtmlToText(html: string): string {
  if (!html) return '';

  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
    .replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, '\n\n#### $1\n\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n\n```\n$1\n```\n\n')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n\n> $1\n\n')
    .replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, '\n$1')
    .replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, ' | $1')
    .replace(/<th[^>]*>([\s\S]*?)<\/th>/gi, ' | $1')
    .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');

  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
    .join('\n')
    .trim();
}

async function fetchPageFullContent(urlStr: string): Promise<{ url: string; title: string; fullContent: string }> {
  try {
    const res = await fetch(urlStr, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml,text/plain,application/pdf;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';
    let title = '';
    let fullContent = '';

    if (contentType.includes('application/pdf') || urlStr.toLowerCase().endsWith('.pdf')) {
      title = formatTitleFromUrl(urlStr) || 'Documento PDF';
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const textMatches = buffer.toString('utf-8').match(/[\x20-\x7E\n\r\t\xA0-\xFF]{4,}/g) || [];
      const pdfText = textMatches
        .filter((str) => !str.includes('obj') && !str.includes('endobj') && !str.includes('stream') && !str.includes('xref'))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      fullContent = pdfText.length > 50
        ? `# DOCUMENTO PDF: ${title}\nURL: ${urlStr}\n\n${pdfText}`
        : `# DOCUMENTO PDF: ${title}\nURL: ${urlStr}\n\nConteúdo integral do documento PDF importado da URL ${urlStr}.`;
    } else if (
      contentType.includes('text/plain') ||
      contentType.includes('text/markdown') ||
      contentType.includes('application/json')
    ) {
      const rawText = await res.text();
      title = formatTitleFromUrl(urlStr);
      fullContent = `# CONTEÚDO INTEGRAL: ${title.toUpperCase()}\nURL: ${urlStr}\n\n${rawText}`;
    } else {
      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      title = titleMatch ? cleanHtmlToText(titleMatch[1]) : formatTitleFromUrl(urlStr);
      fullContent = cleanHtmlToText(html);
    }

    return {
      url: urlStr,
      title: title || urlStr,
      fullContent: fullContent || `Conteúdo capturado da URL: ${urlStr}`,
    };
  } catch (err: any) {
    return {
      url: urlStr,
      title: formatTitleFromUrl(urlStr),
      fullContent: `Conteúdo de referência da página ${urlStr}.\nNota: Não foi possível realizar o download do HTML bruto (${err.message}).`,
    };
  }
}

function normalizeUrl(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    u.hash = '';
    // Strip tracking and session query parameters
    const paramsToDelete = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ref',
      'fbclid',
      'gclid',
      'session',
      'sid',
      'locale',
    ];
    paramsToDelete.forEach((p) => u.searchParams.delete(p));
    let pathname = u.pathname.replace(/\/+$/, '');
    if (!pathname) pathname = '/';
    u.pathname = pathname;
    return u.href.toLowerCase();
  } catch {
    return urlStr.trim().toLowerCase().replace(/\/+$/, '');
  }
}

function extractLinksFromHtml(
  html: string,
  baseUrl: string
): {
  links: Array<{ url: string; anchorText: string }>;
  repeatedUrlsCount: number;
  repeatedUrls: string[];
} {
  const links: Array<{ url: string; anchorText: string }> = [];
  const seenNormalized = new Set<string>();
  const repeatedUrls: string[] = [];
  let repeatedUrlsCount = 0;

  try {
    const baseObj = new URL(baseUrl);
    const baseNorm = normalizeUrl(baseUrl);
    seenNormalized.add(baseNorm);

    const regex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const rawHref = match[1]?.trim();
      const rawAnchor = cleanHtmlToText(match[2] || '');

      if (!rawHref) continue;
      if (
        rawHref.startsWith('#') ||
        rawHref.startsWith('javascript:') ||
        rawHref.startsWith('mailto:') ||
        rawHref.startsWith('tel:')
      ) {
        continue;
      }

      // Do NOT exclude PDF, TXT, MD, CSV, DOCX
      if (/\.(png|jpg|jpeg|gif|svg|css|js|zip|mp4|webp|ico|woff|woff2|ttf|eot)$/i.test(rawHref)) {
        continue;
      }

      try {
        const absoluteUrl = new URL(rawHref, baseObj.href).href;
        const targetObj = new URL(absoluteUrl);

        if (targetObj.hostname === baseObj.hostname) {
          targetObj.hash = '';
          const finalUrl = targetObj.href;
          const norm = normalizeUrl(finalUrl);

          if (seenNormalized.has(norm)) {
            repeatedUrlsCount++;
            if (!repeatedUrls.includes(finalUrl) && repeatedUrls.length < 50) {
              repeatedUrls.push(finalUrl);
            }
          } else {
            seenNormalized.add(norm);
            links.push({
              url: finalUrl,
              anchorText: rawAnchor.slice(0, 100) || targetObj.pathname,
            });
          }
        }
      } catch {
        // Ignore invalid URL
      }
    }
  } catch (err) {
    console.error('Error extracting links from HTML:', err);
  }

  return { links, repeatedUrlsCount, repeatedUrls };
}

function extractSitemapUrls(xmlText: string, targetHost: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const locRegex = /<loc>(https?:\/\/[^<]+)<\/loc>/gi;
  let match;

  while ((match = locRegex.exec(xmlText)) !== null) {
    const loc = match[1].trim();
    try {
      const u = new URL(loc);
      if (
        u.hostname === targetHost &&
        !/\.(png|jpg|jpeg|gif|svg|css|js|pdf|zip|webp)$/i.test(u.pathname)
      ) {
        u.hash = '';
        if (!seen.has(u.href)) {
          seen.add(u.href);
          urls.push(u.href);
        }
      }
    } catch {}
  }
  return urls;
}

async function fetchPageLinks(
  urlStr: string,
  timeoutMs: number = 5000
): Promise<{ links: Array<{ url: string; anchorText: string }>; title?: string }> {
  try {
    const res = await fetch(urlStr, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { links: [] };
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? cleanHtmlToText(titleMatch[1]) : undefined;
    const { links } = extractLinksFromHtml(html, urlStr);
    return { links, title };
  } catch {
    return { links: [] };
  }
}

function formatTitleFromUrl(urlStr: string, anchorText?: string): string {
  const cleanAnchor = anchorText?.trim();
  if (
    cleanAnchor &&
    cleanAnchor.length >= 3 &&
    !/^(clique|link|veja|saiba|read|more|here|aqui|acesse|detalhes)$/i.test(cleanAnchor)
  ) {
    return cleanAnchor;
  }

  try {
    const u = new URL(urlStr);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return u.hostname;

    const lastPart = parts[parts.length - 1]
      .replace(/[-_]/g, ' ')
      .replace(/\.(html|php|asp|jsp|htm)$/i, '');

    const capitalized = lastPart.charAt(0).toUpperCase() + lastPart.slice(1);

    if (parts.length > 1) {
      const category = parts[parts.length - 2].replace(/[-_]/g, ' ');
      const capCategory = category.charAt(0).toUpperCase() + category.slice(1);
      return `${capCategory} › ${capitalized}`;
    }
    return capitalized;
  } catch {
    return urlStr;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Mode 3: Fetch single URL content & discover if it contains sub-folder links
    if (body.action === 'fetch-single' && body.url) {
      const urlStr = body.url.trim();
      let targetUrl = urlStr.startsWith('http://') || urlStr.startsWith('https://') ? urlStr : `https://${urlStr}`;
      
      const pageData = await fetchPageFullContent(targetUrl);

      let subLinks: Array<{ url: string; anchorText: string }> = [];
      try {
        const fetchRes = await fetch(targetUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          const extracted = extractLinksFromHtml(html, targetUrl);
          subLinks = extracted.links;
        }
      } catch {}

      return NextResponse.json({
        success: true,
        url: pageData.url,
        title: pageData.title,
        fullContent: pageData.fullContent,
        wordCount: pageData.fullContent.split(/\s+/).length,
        charCount: pageData.fullContent.length,
        subLinksCount: subLinks.length,
        subLinks: subLinks.slice(0, 100),
      });
    }

    // Mode 2: Fetch full verbatim contents for a list of URLs
    if (body.action === 'fetch-contents' && Array.isArray(body.urls)) {
      const targetUrls: string[] = body.urls;
      
      // Batch fetch up to 25 URLs concurrently
      const BATCH_SIZE = 12;
      const results: Array<{ url: string; title: string; fullContent: string; wordCount: number; charCount: number }> = [];

      for (let i = 0; i < targetUrls.length; i += BATCH_SIZE) {
        const chunk = targetUrls.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          chunk.map((u) => fetchPageFullContent(u))
        );

        batchResults.forEach((res, idx) => {
          if (res.status === 'fulfilled') {
            const data = res.value;
            results.push({
              url: data.url,
              title: data.title,
              fullContent: data.fullContent,
              wordCount: data.fullContent.split(/\s+/).length,
              charCount: data.fullContent.length,
            });
          } else {
            const fallbackUrl = chunk[idx];
            results.push({
              url: fallbackUrl,
              title: fallbackUrl,
              fullContent: `Conteúdo da página ${fallbackUrl}`,
              wordCount: 5,
              charCount: 30,
            });
          }
        });
      }

      return NextResponse.json({
        success: true,
        count: results.length,
        results,
      });
    }

    // Mode 1: Initial Crawl & Discover
    const url = body.url;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Por favor, informe uma URL válida para mapear.' },
        { status: 400 }
      );
    }

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json(
        { error: 'URL malformada ou inválida.' },
        { status: 400 }
      );
    }

    // Fetch main page HTML
    let mainPageHtml = '';
    try {
      const fetchRes = await fetch(parsedUrl.href, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!fetchRes.ok) {
        throw new Error(`Servidor retornou status HTTP ${fetchRes.status}`);
      }

      mainPageHtml = await fetchRes.text();
    } catch (fetchErr: any) {
      return NextResponse.json(
        {
          error: `Não foi possível acessar a URL "${targetUrl}": ${fetchErr.message || 'Falha de conexão'}.`,
        },
        { status: 502 }
      );
    }

    // Extract title and FULL UNTRUNCATED TEXT of main page
    const titleMatch = mainPageHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const mainTitle = titleMatch ? cleanHtmlToText(titleMatch[1]) : parsedUrl.hostname;
    const mainTextContent = cleanHtmlToText(mainPageHtml); // FULL TEXT CONTENT

    // Normalize and prepare existing notebook URLs
    const existingUrlsInput: string[] = Array.isArray(body.existingUrls) ? body.existingUrls : [];
    const existingNormalizedSet = new Set<string>();
    existingUrlsInput.forEach((u) => {
      if (typeof u === 'string' && u.trim()) {
        existingNormalizedSet.add(normalizeUrl(u));
      }
    });

    const duplicateUrlsList: Array<{ url: string; reason: 'already_exists_in_notebook' | 'duplicate_on_site' }> = [];
    let alreadyExistingInNotebookCount = 0;
    let duplicateInSiteStructureCount = 0;

    // Maximum pages limit requested by client (default 150, safe max 300)
    const maxLimit =
      typeof body.limit === 'number' && body.limit > 0 ? Math.min(body.limit, 300) : 150;

    // Track all seen URLs (normalized) within this site crawl
    const seenSiteUrls = new Set<string>();
    const l1Norm = normalizeUrl(parsedUrl.href);
    seenSiteUrls.add(l1Norm);

    // Level 1: Root Page
    const l1Id = `crawl-l1-${Date.now()}`;
    const isMainInNotebook = existingNormalizedSet.has(l1Norm);
    if (isMainInNotebook) {
      alreadyExistingInNotebookCount++;
      duplicateUrlsList.push({ url: parsedUrl.href, reason: 'already_exists_in_notebook' });
    }

    // Extract links from Level 1 HTML
    const { links: l1ExtractedLinks, repeatedUrlsCount: l1DuplicatesCount, repeatedUrls: l1DuplicateUrls } =
      extractLinksFromHtml(mainPageHtml, parsedUrl.href);

    duplicateInSiteStructureCount += l1DuplicatesCount;
    l1DuplicateUrls.forEach((dupUrl) => {
      if (!duplicateUrlsList.some((d) => d.url === dupUrl)) {
        duplicateUrlsList.push({ url: dupUrl, reason: 'duplicate_on_site' });
      }
    });

    // Level 2 Candidate Map (URL -> anchorText)
    const l2CandidatesMap = new Map<string, string>();
    l1ExtractedLinks.forEach((item) => {
      const norm = normalizeUrl(item.url);
      if (norm !== l1Norm && !seenSiteUrls.has(norm)) {
        seenSiteUrls.add(norm);
        l2CandidatesMap.set(item.url, item.anchorText);
      } else if (norm !== l1Norm && seenSiteUrls.has(norm)) {
        duplicateInSiteStructureCount++;
      }
    });

    // Also attempt XML sitemap to supplement Level 2 discovery
    try {
      const sitemapUrl = `${parsedUrl.origin}/sitemap.xml`;
      const sitemapRes = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(3000),
      });

      if (sitemapRes.ok) {
        const sitemapXml = await sitemapRes.text();
        const sitemapUrls = extractSitemapUrls(sitemapXml, parsedUrl.hostname);
        sitemapUrls.forEach((u) => {
          const norm = normalizeUrl(u);
          if (norm !== l1Norm && !seenSiteUrls.has(norm)) {
            seenSiteUrls.add(norm);
            l2CandidatesMap.set(u, '');
          } else if (norm !== l1Norm && seenSiteUrls.has(norm)) {
            duplicateInSiteStructureCount++;
          }
        });
      }
    } catch {
      // Sitemap is optional
    }

    // Build Level 2 items list
    const l2Items: Array<{
      id: string;
      url: string;
      title: string;
      anchorText: string;
      depth: 2;
      parentId: string;
      parentUrl: string;
    }> = [];

    let l2Counter = 0;
    l2CandidatesMap.forEach((anchorText, u) => {
      l2Counter++;
      l2Items.push({
        id: `crawl-l2-${l2Counter}`,
        url: u,
        title: formatTitleFromUrl(u, anchorText),
        anchorText,
        depth: 2,
        parentId: l1Id,
        parentUrl: parsedUrl.href,
      });
    });

    // Level 3 (Sub-subpastas encadeadas):
    // For each Level 2 subfolder, crawl its HTML concurrently to discover nested sub-subpages
    const l3ChildrenMap = new Map<
      string,
      Array<{
        id: string;
        url: string;
        title: string;
        depth: 3;
        parentId: string;
        parentUrl: string;
      }>
    >();

    let totalDiscoveredCount = 1 + l2Items.length;
    let hasMorePages = false;

    // Explore Level 2 pages in concurrent batches of 6 with short timeout
    const L2_BATCH_SIZE = 6;
    const l2ToExplore = l2Items.slice(0, 45); // Inspect top Level 2 subfolders for nested links

    for (let i = 0; i < l2ToExplore.length; i += L2_BATCH_SIZE) {
      if (totalDiscoveredCount >= maxLimit) {
        hasMorePages = true;
        break;
      }

      const chunk = l2ToExplore.slice(i, i + L2_BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        chunk.map((l2) => fetchPageLinks(l2.url, 4500))
      );

      for (let b = 0; b < chunk.length; b++) {
        const currentL2 = chunk[b];
        const res = batchResults[b];

        if (res.status === 'fulfilled' && res.value.links.length > 0) {
          if (res.value.title && res.value.title.length > 2) {
            currentL2.title = res.value.title;
          }

          const nestedL3List: Array<{
            id: string;
            url: string;
            title: string;
            depth: 3;
            parentId: string;
            parentUrl: string;
          }> = [];

          for (const subLink of res.value.links) {
            if (totalDiscoveredCount >= maxLimit) {
              hasMorePages = true;
              break;
            }

            const norm = normalizeUrl(subLink.url);
            if (norm === l1Norm) continue;

            if (seenSiteUrls.has(norm)) {
              duplicateInSiteStructureCount++;
              if (!duplicateUrlsList.some((d) => d.url === subLink.url) && duplicateUrlsList.length < 50) {
                duplicateUrlsList.push({ url: subLink.url, reason: 'duplicate_on_site' });
              }
            } else {
              seenSiteUrls.add(norm);
              totalDiscoveredCount++;
              nestedL3List.push({
                id: `crawl-l3-${currentL2.id}-${nestedL3List.length + 1}`,
                url: subLink.url,
                title: formatTitleFromUrl(subLink.url, subLink.anchorText),
                depth: 3,
                parentId: currentL2.id,
                parentUrl: currentL2.url,
              });
            }
          }

          if (nestedL3List.length > 0) {
            l3ChildrenMap.set(currentL2.id, nestedL3List);
          }
        }
      }
    }

    // Assemble hierarchical ordered list of pages:
    // Root (Level 1) -> Subpasta (Level 2) -> Sub-subpastas (Level 3) -> next Subpasta...
    const discoveredPages: Array<{
      id: string;
      url: string;
      title: string;
      summary: string;
      content: string;
      wordCount: number;
      charCount: number;
      selected: boolean;
      hasFullContent?: boolean;
      isDuplicate?: boolean;
      duplicateReason?: string;
      depth: 1 | 2 | 3;
      parentId?: string;
      parentUrl?: string;
      childCount?: number;
    }> = [];

    // 1. Add Level 1 (Pasta Raiz)
    discoveredPages.push({
      id: l1Id,
      url: parsedUrl.href,
      title: mainTitle || `Página Principal (${parsedUrl.hostname})`,
      summary: `Página principal e pasta raiz de ${parsedUrl.hostname}`,
      content: mainTextContent || `Conteúdo obtido a partir de ${parsedUrl.href}`,
      wordCount: mainTextContent.split(/\s+/).length,
      charCount: mainTextContent.length,
      selected: !isMainInNotebook,
      hasFullContent: true,
      isDuplicate: isMainInNotebook,
      duplicateReason: isMainInNotebook ? 'Esta URL principal já existe como fonte no caderno.' : undefined,
      depth: 1,
      childCount: l2Items.length,
    });

    let level2Count = 0;
    let level3Count = 0;

    // 2. Add Level 2 (Subpastas) and their chained Level 3 children (Sub-subpastas)
    for (const l2 of l2Items) {
      if (discoveredPages.length >= maxLimit) {
        hasMorePages = true;
        break;
      }

      const l2Norm = normalizeUrl(l2.url);
      const isL2InNotebook = existingNormalizedSet.has(l2Norm);
      if (isL2InNotebook) {
        alreadyExistingInNotebookCount++;
        if (!duplicateUrlsList.some((d) => d.url === l2.url)) {
          duplicateUrlsList.push({ url: l2.url, reason: 'already_exists_in_notebook' });
        }
      }

      const l3Children = l3ChildrenMap.get(l2.id) || [];
      level2Count++;

      discoveredPages.push({
        id: l2.id,
        url: l2.url,
        title: l2.title,
        summary: `Subpasta direta identificada no portal ${parsedUrl.hostname}`,
        content: `URL: ${l2.url}`,
        wordCount: 0,
        charCount: 0,
        selected: !isL2InNotebook,
        hasFullContent: false,
        isDuplicate: isL2InNotebook,
        duplicateReason: isL2InNotebook ? 'Este link já existe previamente como fonte no caderno.' : undefined,
        depth: 2,
        parentId: l1Id,
        parentUrl: parsedUrl.href,
        childCount: l3Children.length,
      });

      // Insert all Level 3 sub-subpages immediately beneath this Level 2 parent
      for (const l3 of l3Children) {
        if (discoveredPages.length >= maxLimit) {
          hasMorePages = true;
          break;
        }

        const l3Norm = normalizeUrl(l3.url);
        const isL3InNotebook = existingNormalizedSet.has(l3Norm);
        if (isL3InNotebook) {
          alreadyExistingInNotebookCount++;
          if (!duplicateUrlsList.some((d) => d.url === l3.url)) {
            duplicateUrlsList.push({ url: l3.url, reason: 'already_exists_in_notebook' });
          }
        }

        level3Count++;

        discoveredPages.push({
          id: l3.id,
          url: l3.url,
          title: l3.title,
          summary: `Sub-subpasta encadeada vinculada a ${l2.title}`,
          content: `URL: ${l3.url}`,
          wordCount: 0,
          charCount: 0,
          selected: !isL3InNotebook,
          hasFullContent: false,
          isDuplicate: isL3InNotebook,
          duplicateReason: isL3InNotebook ? 'Este link já existe previamente como fonte no caderno.' : undefined,
          depth: 3,
          parentId: l2.id,
          parentUrl: l2.url,
          childCount: 0,
        });
      }
    }

    return NextResponse.json({
      success: true,
      domain: parsedUrl.hostname,
      mainUrl: parsedUrl.href,
      mainTitle,
      totalDiscovered: discoveredPages.length,
      hasMore: hasMorePages,
      levelStats: {
        level1Count: 1,
        level2Count,
        level3Count,
      },
      pages: discoveredPages,
      duplicateStats: {
        totalDuplicatesDetected: alreadyExistingInNotebookCount + duplicateInSiteStructureCount,
        alreadyExistingInNotebookCount,
        repeatedInSiteCount: duplicateInSiteStructureCount,
        duplicateUrlsList: duplicateUrlsList.slice(0, 100),
      },
    });
  } catch (err: any) {
    console.error('Crawl API route error:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao processar mapeamento da URL.' },
      { status: 500 }
    );
  }
}
