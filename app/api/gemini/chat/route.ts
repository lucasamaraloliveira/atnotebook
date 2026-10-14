import { NextRequest, NextResponse } from 'next/server';
import { ThinkingLevel } from '@google/genai';
import { generateContentWithFallback } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { question, history, sources, mode, notebookTitle } = await req.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Pergunta obrigatória.' }, { status: 400 });
    }

    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        {
          error:
            'Nenhuma fonte ativa selecionada neste caderno. Ative ou migre pelo menos uma fonte para a IA analisar.',
        },
        { status: 400 }
      );
    }

    // Token optimization: aggressively cap sourcesContext to minimize input token consumption (~24,000 chars total)
    const MAX_TOTAL_CHARS = 24000;
    const perSourceMaxChars = Math.max(4000, Math.floor(MAX_TOTAL_CHARS / Math.max(1, sources.length)));

    const sourcesContext = sources
      .map((s: { id: string; title: string; content: string; type?: string; originalOrigin?: string }, index: number) => {
        const truncatedContent =
          s.content && s.content.length > perSourceMaxChars
            ? s.content.substring(0, perSourceMaxChars) + '\n... [Conteúdo sintetizado para economia de tokens]'
            : s.content || '';

        return `--- INÍCIO DA FONTE [${index + 1}]: "${s.title}" (${s.type || 'documento'}${
          s.originalOrigin ? ` - Origem: ${s.originalOrigin}` : ''
        }) ---\n${truncatedContent}\n--- FIM DA FONTE [${index + 1}] ---`;
      })
      .join('\n\n');

    const systemInstruction = `Você é o assistente de inteligência artificial factual do ATNotebook (caderno: "${
      notebookTitle || 'Meu Caderno'
    }").
A SUA ATRIBUIÇÃO É EXCLUSIVAMENTE CONSULTAR E RESPONDER COM BASE NAS FONTES ANEXADAS NESTE CADERNO.

REGRAS INEGOCIÁVEIS DE ESTRUTURAÇÃO E FIDELIDADE FACTUAL:
1. CONSULTA EXCLUSIVA ÀS FONTES: Você deve responder com base ÚNICA E EXCLUSIVAMENTE nos fatos, dados e informações contidos nas fontes anexadas fornecidas abaixo.
2. ZERO SUPOSIÇÕES: NÃO faça suposições, especulações, inferências infundadas ou interpolações com conhecimento externo geral. Se não está escrito nas fontes anexadas, não afirme.
3. AUSÊNCIA DE INFORMAÇÃO: Se a resposta para a dúvida do usuário não constar nas fontes anexadas, declare de maneira direta e inequívoca: "Esta informação não consta nas fontes anexadas ao caderno." Não tente complementar com dados de fora.
4. TEXTO LIMPO E SEM CITAÇÕES NO MEIO DO CORPO: NUNCA insira marcações, colchetes ou citações como [Fonte: ...] ou (Fonte: ...) no meio das frases ou dos parágrafos. O corpo da resposta deve ser 100% limpo, fluido, com parágrafos bem espaçados, tópicos claros e alta legibilidade.
5. OBJETIVIDADE E ECONOMIA DE TOKENS: Seja direto, claro e conciso, sem rodeios ou repetições.
6. SEÇÃO SEPARADA DE FONTES NO FINAL: Ao final da resposta, caso tenha utilizado dados das fontes, inclua apenas no final a seção:
### 📚 Fontes Citadas nesta Resposta
- Nome da Fonte 1
- Nome da Fonte 2`;

    // Construct prompt payload
    const userPrompt = `FONTES ANEXADAS AO CADERNO:\n\n${sourcesContext}\n\nPERGUNTA DO USUÁRIO:\n${question}`;

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Include recent history if provided (compacted to the last 3 turns to minimize token load)
    if (Array.isArray(history) && history.length > 0) {
      for (const msg of history.slice(-3)) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: userPrompt }],
    });

    const { response, usedModel, switchedModel, modelNotice, quotaExceeded } = await generateContentWithFallback(
      {
        contents: contents as any,
        config: {
          systemInstruction,
          temperature: 0.1,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
        },
      },
      'gemini-3.5-flash-lite'
    );

    let answerText = response.text || 'Não foi possível gerar uma resposta com as fontes atuais.';

    // Clean any accidental inline citations [Fonte: ...] or (Fonte: ...) from paragraphs to keep body clean
    answerText = answerText.replace(/\[\s*Fonte:\s*[^\]]+\]/gi, '');
    answerText = answerText.replace(/\(\s*Fonte:\s*[^\)]+\)/gi, '');

    // Extract citations based on sources
    const extractedCitations: Array<{ sourceId: string; sourceTitle: string; snippet: string }> = [];
    sources.forEach((s: { id: string; title: string; content: string }) => {
      if (
        answerText.toLowerCase().includes(s.title.toLowerCase()) ||
        response.text?.toLowerCase().includes(s.title.toLowerCase())
      ) {
        // Grab a preview snippet from source content
        const snippet = s.content.length > 180 ? s.content.substring(0, 180) + '...' : s.content;
        extractedCitations.push({
          sourceId: s.id,
          sourceTitle: s.title,
          snippet,
        });
      }
    });

    return NextResponse.json({
      answer: answerText,
      citations: extractedCitations,
      groundedSourcesCount: sources.length,
      usedModel,
      switchedModel,
      quotaExceeded,
      modelNotice: modelNotice || (switchedModel ? 'Cota excedida, estamos trocando o modelo de IA' : undefined),
    });
  } catch (error: any) {
    console.error('Gemini chat error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Erro ao processar a consulta nas fontes do caderno.',
      },
      { status: 500 }
    );
  }
}
