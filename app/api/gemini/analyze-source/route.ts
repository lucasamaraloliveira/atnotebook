import { NextRequest, NextResponse } from 'next/server';
import { generateContentWithFallback } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { title, content } = await req.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Conteúdo da fonte é obrigatório.' }, { status: 400 });
    }

    const { response } = await generateContentWithFallback(
      {
        contents: `Analise brevemente o texto abaixo, que está sendo migrado para o ATNotebook:
Título: "${title || 'Sem título'}"
Conteúdo:
${content.substring(0, 4000)}

Responda em formato estritamente estruturado em português:
1. Resumo em 2 frases objetivas.
2. 3 a 5 palavras-chave ou entidades centrais.
3. Avaliação de integridade: indique se o texto parece íntegro, cortado ou truncado.`,
      },
      'gemini-3.5-flash-lite'
    );

    return NextResponse.json({
      analysis: response.text || 'Análise concluída.',
    });
  } catch (error: any) {
    console.error('Source analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao analisar fonte.' },
      { status: 500 }
    );
  }
}
