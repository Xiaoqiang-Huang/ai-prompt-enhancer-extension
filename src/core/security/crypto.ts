const encoder = new TextEncoder()
const decoder = new TextDecoder()

const toBase64 = (input: Uint8Array): string => {
  let binary = ''
  input.forEach((item) => {
    binary += String.fromCharCode(item)
  })
  return btoa(binary)
}

const fromBase64 = (input: string): Uint8Array => {
  const binary = atob(input)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

const deriveAesKey = async (passphrase: string, salt: Uint8Array): Promise<CryptoKey> => {
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, [
    'deriveBits',
    'deriveKey',
  ])
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt as BufferSource,
      iterations: 120_000,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export const encryptSecret = async (value: string, passphrase: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveAesKey(passphrase, salt)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value))

  return {
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    iv: toBase64(iv),
    salt: toBase64(salt),
    kdf: 'PBKDF2-SHA-256' as const,
    iterations: 120_000,
  }
}

export const decryptSecret = async (
  input: { ciphertext: string; iv: string; salt: string },
  passphrase: string,
): Promise<string> => {
  const key = await deriveAesKey(passphrase, fromBase64(input.salt))
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(input.iv) as BufferSource },
    key,
    fromBase64(input.ciphertext) as BufferSource,
  )
  return decoder.decode(plaintext)
}
