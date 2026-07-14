import { decryptSecret, encryptSecret } from '@/core/security/crypto'

describe('crypto', () => {
  it('encrypts and decrypts api key', async () => {
    const encrypted = await encryptSecret('sk-test-1234567890', 'passphrase')
    const decrypted = await decryptSecret(encrypted, 'passphrase')
    expect(decrypted).toBe('sk-test-1234567890')
  })
})
