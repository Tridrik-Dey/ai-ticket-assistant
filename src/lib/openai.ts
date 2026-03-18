const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-1.5-flash-latest";
const DEFAULT_GEMINI_REQUEST_TIMEOUT_MS = 15000;

const FALLBACK_GEMINI_MODELS = [
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro-latest",
  "gemini-2.0-flash",
  "gemini-2.0-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

export type GeminiProviderErrorMeta = {
  status?: number;
  body?: string;
};

export class GeminiProviderError extends Error {
  status?: number;
  body?: string;

  constructor(message: string, meta: GeminiProviderErrorMeta = {}) {
    super(message);
    this.name = "GeminiProviderError";
    this.status = meta.status;
    this.body = meta.body;
  }
}

class GeminiTimeoutError extends GeminiProviderError {
  constructor(message: string) {
    super(message, { status: 408 });
    this.name = "GeminiTimeoutError";
  }
}

function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }

  return apiKey;
}

function buildCandidates(preferredModel: string): string[] {
  const candidates = [preferredModel, ...FALLBACK_GEMINI_MODELS, DEFAULT_GEMINI_MODEL];
  return [...new Set(candidates)];
}

function getRequestTimeoutMs(): number {
  const rawTimeout = Number(process.env.GEMINI_REQUEST_TIMEOUT_MS);

  if (!Number.isFinite(rawTimeout) || rawTimeout <= 0) {
    return DEFAULT_GEMINI_REQUEST_TIMEOUT_MS;
  }

  return Math.trunc(rawTimeout);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new GeminiTimeoutError(`Gemini API request timed out after ${ms}ms.`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

async function generateUsingModel(
  apiKey: string,
  prompt: string,
  model: string,
): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(`${endpoint}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0,
      },
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new GeminiProviderError(`Gemini API request failed (${response.status}) for model ${model}.`, {
      status: response.status,
      body: text,
    });
  }

  const payload = JSON.parse(text) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new GeminiProviderError(`Gemini model ${model} returned an empty response.`);
  }

  return content;
}

export async function generateStructuredJson(
  prompt: string,
  model = DEFAULT_GEMINI_MODEL,
  timeoutMs = getRequestTimeoutMs(),
): Promise<string> {
  const apiKey = getGeminiApiKey();
  const candidates = buildCandidates(model);
  const tried = new Set<string>();
  let lastError: GeminiProviderError | null = null;

  for (const currentModel of candidates) {
    if (tried.has(currentModel)) continue;
    tried.add(currentModel);

    try {
      return await withTimeout(generateUsingModel(apiKey, prompt, currentModel), timeoutMs);
    } catch (error: unknown) {
      if (error instanceof GeminiProviderError) {
        if (error.status === 404 || error.status === 408) {
          lastError = error;
          continue;
        }

        throw error;
      }

      throw error;
    }
  }

  throw (
    lastError ??
    new GeminiProviderError("Gemini API request failed for all configured models.")
  );
}

export async function translateToEnglish(
  text: string,
  sourceLanguage = "auto",
  model = DEFAULT_GEMINI_MODEL,
  timeoutMs = getRequestTimeoutMs(),
): Promise<string> {
  if (text.trim().length === 0) {
    return text;
  }

  const prompt = [
    "Translate the following customer support text to English.",
    `Source language: ${sourceLanguage}.`,
    "Rules:",
    "- Preserve original meaning and tone.",
    "- Keep product names, IDs, and email addresses unchanged.",
    "- If the text is already in English, return it unchanged.",
    "- Return only the translated text, no JSON, no markdown.",
    "Text:",
    text,
  ].join("\n");

  const apiKey = getGeminiApiKey();
  const candidates = buildCandidates(model);
  const tried = new Set<string>();
  let lastError: GeminiProviderError | null = null;

  for (const currentModel of candidates) {
    if (tried.has(currentModel)) continue;
    tried.add(currentModel);

    try {
      const translated = await withTimeout(
        generateUsingModel(apiKey, prompt, currentModel),
        timeoutMs,
      );
      const cleaned = translated.trim().replace(/^["'`]|["'`]$/g, "");
      return cleaned.length > 0 ? cleaned : text;
    } catch (error: unknown) {
      if (error instanceof GeminiProviderError) {
        if (error.status === 404 || error.status === 408) {
          lastError = error;
          continue;
        }

        throw error;
      }

      throw error;
    }
  }

  throw (
    lastError ??
    new GeminiProviderError("Gemini translation request failed for all configured models.")
  );
}

export const geminiDefaultModel = DEFAULT_GEMINI_MODEL;
