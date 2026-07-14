import { detectSensitiveText } from '@/content/detector/sensitive-detector'

describe('detectSensitiveText', () => {
  it('blocks api keys', () => {
    const result = detectSensitiveText('my key is sk-1234567890abcdefg')
    expect(result.blocked).toBe(true)
    expect(result.matches[0]?.type).toBe('api-key')
  })
})
