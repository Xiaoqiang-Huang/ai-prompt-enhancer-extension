import { requestOpenAICompatibleChat, resolveOpenAICompatibleEndpointCandidates } from '@/core/providers/openai-compatible-transport'
import { toHostPermissionPattern } from '@/background/permissions'
import {
  buildAuthHeaders,
  isLikelyOutputTruncated,
  readOpenAICompatibleResponse,
  readOllamaResponse,
} from '@/core/providers/provider-adapter'
import type { ProviderServiceConfig } from '@/shared/types'

const config = (patch: Partial<ProviderServiceConfig> = {}): ProviderServiceConfig => ({
  provider: 'custom',
  label: 'Test Provider',
  baseUrl: 'https://example.test/v1',
  model: 'test-model',
  models: ['test-model'],
  authMode: 'bearer',
  temperature: 0.4,
  maxTokens: 4096,
  timeoutMs: 5_000,
  retryCount: 0,
  enabled: true,
  ...patch,
})

describe('provider compatibility layer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalizes root, versioned and full chat endpoints', () => {
    expect(resolveOpenAICompatibleEndpointCandidates('https://example.test')).toEqual([
      'https://example.test/v1/chat/completions',
      'https://example.test/chat/completions',
    ])
    expect(resolveOpenAICompatibleEndpointCandidates('https://example.test/v1')).toEqual([
      'https://example.test/v1/chat/completions',
    ])
    expect(resolveOpenAICompatibleEndpointCandidates('https://example.test/v1/chat/completions')).toEqual([
      'https://example.test/v1/chat/completions',
    ])
  })

  it('derives a least-scope optional host permission from a custom endpoint', () => {
    expect(toHostPermissionPattern('https://api.example.test:8443/v1/chat/completions')).toBe(
      'https://api.example.test:8443/*',
    )
    expect(toHostPermissionPattern('file:///tmp/model')).toBe('')
  })

  it('supports no-auth and custom API key header modes', () => {
    expect(buildAuthHeaders(config({ authMode: 'none' }), '')).toEqual({})
    expect(buildAuthHeaders(config({ authMode: 'api-key', apiKeyHeader: 'X-Custom-Key' }), 'abc123')).toEqual({
      'X-Custom-Key': 'abc123',
    })
  })

  it('parses non-stream JSON and reports token-limit truncation', async () => {
    const response = new Response(
      JSON.stringify({
        choices: [{ message: { content: '{"enhancedPrompt":"partial' }, finish_reason: 'length' }],
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
    const result = await readOpenAICompatibleResponse(response)
    expect(result.text).toContain('enhancedPrompt')
    expect(result.finishReason).toBe('length')
    expect(result.truncated).toBe(true)
    expect(result.responseMode).toBe('json')
  })

  it('detects likely truncation even when a third-party API omits finish_reason', () => {
    expect(isLikelyOutputTruncated('{"enhancedPrompt":"unfinished', 4096)).toBe(true)
    expect(isLikelyOutputTruncated('```ts\nconst value = 1', 4096)).toBe(true)
    expect(isLikelyOutputTruncated('这是一个完整且简短的结果。', 4096)).toBe(false)
  })

  it('falls back from max_tokens to max_completion_tokens automatically', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'max_tokens is unsupported' } }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await requestOpenAICompatibleChat({
      baseUrl: 'https://example.test/v1',
      headers: { Authorization: 'Bearer test' },
      model: 'reasoning-model',
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 0.4,
      maxTokens: 4096,
      timeoutMs: 5_000,
      retryCount: 0,
      providerLabel: 'Test Provider',
    })

    expect(result.text).toBe('OK')
    expect(result.requestVariant).toBe('stream:max_completion_tokens')
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
    expect(firstBody.max_tokens).toBe(4096)
    expect(secondBody.max_completion_tokens).toBe(4096)
  })

  it('renders Ollama NDJSON chunks as they arrive instead of buffering the full response', async () => {
    const chunks = [
      `${JSON.stringify({ message: { content: '{"enhancedPrompt":"第一段' } })}\n`,
      `${JSON.stringify({ message: { content: '第二段"}', }, done_reason: 'stop' })}\n`,
    ]
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)))
        controller.close()
      },
    })
    const partials: string[] = []
    const result = await readOllamaResponse(
      new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } }),
      (partial) => partials.push(partial),
    )

    expect(result.responseMode).toBe('stream')
    expect(result.text).toBe('{"enhancedPrompt":"第一段第二段"}')
    expect(partials).toEqual(['{"enhancedPrompt":"第一段', '{"enhancedPrompt":"第一段第二段"}'])
  })
})
