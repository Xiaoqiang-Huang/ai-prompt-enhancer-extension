export const RESPONSE_SCHEMA_HINT = `Please return JSON with the following structure:
{
  "enhancedPrompt": "string, AI-ready final prompt text",
  "intentSummary": "string, concise summary of what the user is trying to accomplish",
  "missingInformation": ["string, only critical information whose absence can materially change the result"],
  "needsClarification": false,
  "clarificationQuestions": [],
  "title": "string, optional short title",
  "summary": "string, optional enhancement summary",
  "warnings": ["string"],
  "placeholders": ["string", "..."]
}
For direct enhancement, set needsClarification=true only when a critical field is missing. Do not list optional nice-to-have details in missingInformation. If the request is sufficiently clear, use an empty missingInformation array, needsClarification=false, and an empty clarificationQuestions array.`

export const CLARIFICATION_SCHEMA_HINT = `Please return JSON with the following structure:
{
  "enhancedPrompt": "string, a concise summary of the user's currently understood intent; do not produce the final prompt yet",
  "clarificationQuestions": [
    {
      "id": "short-stable-id",
      "question": "one focused question",
      "why": "short reason this answer changes the result",
      "placeholder": "a short example answer",
      "required": true
    }
  ],
  "readyToEnhance": false,
  "warnings": [],
  "placeholders": []
}
If the intent is already sufficiently clear, return an empty clarificationQuestions array and readyToEnhance=true.`

const parseJsonCandidate = (candidate: string) => {
  const parsed = JSON.parse(candidate) as {
    enhancedPrompt?: unknown
    title?: unknown
    summary?: unknown
    warnings?: unknown
    placeholders?: unknown
    clarificationQuestions?: unknown
    readyToEnhance?: unknown
    intentSummary?: unknown
    missingInformation?: unknown
    needsClarification?: unknown
  }

  if (!parsed || typeof parsed !== 'object' || typeof parsed.enhancedPrompt !== 'string') {
    throw new Error('invalid schema: missing enhancedPrompt')
  }

  const clarificationQuestions = Array.isArray(parsed.clarificationQuestions)
    ? parsed.clarificationQuestions
        .map((item, index) => {
          if (!item || typeof item !== 'object') return null
          const question = item as Record<string, unknown>
          if (typeof question.question !== 'string' || !question.question.trim()) return null
          return {
            id:
              typeof question.id === 'string' && question.id.trim()
                ? question.id.trim()
                : `question-${index + 1}`,
            question: question.question.trim(),
            why: typeof question.why === 'string' ? question.why.trim() : undefined,
            placeholder: typeof question.placeholder === 'string' ? question.placeholder.trim() : undefined,
            required: question.required !== false,
          }
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .slice(0, 6)
    : undefined

  return {
    enhancedPrompt: parsed.enhancedPrompt,
    title: typeof parsed.title === 'string' ? parsed.title : undefined,
    summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((item): item is string => typeof item === 'string') : [],
    placeholders: Array.isArray(parsed.placeholders)
      ? parsed.placeholders.filter((item): item is string => typeof item === 'string')
      : [],
    clarificationQuestions,
    readyToEnhance: typeof parsed.readyToEnhance === 'boolean' ? parsed.readyToEnhance : undefined,
    intentSummary: typeof parsed.intentSummary === 'string' ? parsed.intentSummary.trim() : undefined,
    missingInformation: Array.isArray(parsed.missingInformation)
      ? parsed.missingInformation
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => item.trim())
          .slice(0, 6)
      : [],
    needsClarification: parsed.needsClarification === true,
  }
}

const toJsonCandidates = (raw: string): string[] => {
  const cleaned = raw.trim()
  const fenced = cleaned.match(/```json\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) {
    return [fenced[1].trim(), cleaned]
  }

  const jsonStart = cleaned.indexOf('{')
  const jsonEnd = cleaned.lastIndexOf('}')
  if (jsonStart !== -1 && jsonEnd > jsonStart + 1) {
    return [cleaned.slice(jsonStart, jsonEnd + 1), cleaned]
  }

  return [cleaned]
}

export const parseEnhanceOutput = (raw: string) => {
  const candidates = toJsonCandidates(raw)
  for (const candidate of candidates) {
    try {
      return parseJsonCandidate(candidate)
    } catch {
      // continue
    }
  }
  throw new Error('No valid JSON object in model output')
}
