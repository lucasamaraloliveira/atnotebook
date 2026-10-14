import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from '@google/genai';

export const GEMINI_MODEL_PRIORITY = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
] as const;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function isQuotaOrRateLimitError(error: any): boolean {
  if (!error) return false;
  const errMsg = String(error?.message || error || '').toLowerCase();
  const status = error?.status || error?.statusCode || error?.code;

  return (
    status === 429 ||
    status === 503 ||
    errMsg.includes('429') ||
    errMsg.includes('quota') ||
    errMsg.includes('resource_exhausted') ||
    errMsg.includes('rate limit') ||
    errMsg.includes('too many requests') ||
    errMsg.includes('exceeded your current quota') ||
    errMsg.includes('overloaded') ||
    errMsg.includes('capacity')
  );
}

export async function generateContentWithFallback(
  params: Omit<GenerateContentParameters, 'model'> & { model?: string },
  preferredModel?: string
): Promise<{
  response: GenerateContentResponse;
  usedModel: string;
  switchedModel: boolean;
  modelNotice?: string;
  quotaExceeded: boolean;
}> {
  const ai = getGeminiClient();

  const startModel = preferredModel || params.model || GEMINI_MODEL_PRIORITY[0];

  const startIdx = GEMINI_MODEL_PRIORITY.indexOf(startModel as any);
  let candidateModels: string[];

  if (startIdx !== -1) {
    candidateModels = [
      ...GEMINI_MODEL_PRIORITY.slice(startIdx),
      ...GEMINI_MODEL_PRIORITY.slice(0, startIdx),
    ];
  } else {
    candidateModels = [startModel, ...GEMINI_MODEL_PRIORITY];
  }

  let lastError: any = null;
  let switchedModel = false;
  let quotaExceeded = false;

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    let attempts = 0;
    const maxAttempts = 2; // Try up to 2 attempts per model with a small delay for transient 429s

    while (attempts < maxAttempts) {
      attempts++;
      try {
        console.log(`[Gemini Engine] Attempting model: ${model} (attempt ${attempts}/${maxAttempts})`);
        const response = await ai.models.generateContent({
          ...params,
          model,
        });

        console.log(`[Gemini Engine] Successfully generated content using model: ${model}`);
        const modelNotice =
          switchedModel || quotaExceeded || i > 0
            ? 'Cota excedida, alternamos para um modelo de IA auxiliar.'
            : undefined;

        return {
          response,
          usedModel: model,
          switchedModel: switchedModel || i > 0,
          modelNotice,
          quotaExceeded,
        };
      } catch (err: any) {
        lastError = err;
        switchedModel = true;
        if (isQuotaOrRateLimitError(err)) {
          quotaExceeded = true;
          // If rate limited, wait 1.2s before retrying or switching to next model
          await new Promise((r) => setTimeout(r, 1200));
        }
        console.warn(
          `[Gemini Fallback Rule] Model "${model}" (attempt ${attempts}) failed (Error: ${
            err?.message || err
          }). Checking fallback priority...`
        );
      }
    }
  }

  if (isQuotaOrRateLimitError(lastError)) {
    throw new Error(
      'Cota temporariamente excedida devido ao limite de requisições por minuto do provedor de IA. Por favor, aguarde cerca de 15 a 20 segundos e tente novamente.'
    );
  }

  throw lastError || new Error('Todas as tentativas com os modelos de IA da cadeia de prioridade falharam.');
}

