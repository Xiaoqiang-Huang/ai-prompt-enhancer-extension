import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const dryRun = process.argv.includes('--dry-run')
const root = process.cwd()
const manifestPath = path.join(root, 'dist', 'manifest.json')

const readManifest = async () => JSON.parse(await readFile(manifestPath, 'utf8'))

const requireValue = (name) => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const readJsonResponse = async (response, operation) => {
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text.slice(0, 500) }
  }
  if (!response.ok) {
    throw new Error(`${operation} failed with HTTP ${response.status}: ${JSON.stringify(data)}`)
  }
  return data
}

const getAccessToken = async () => {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireValue('CWS_CLIENT_ID'),
      client_secret: requireValue('CWS_CLIENT_SECRET'),
      refresh_token: requireValue('CWS_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  })
  const data = await readJsonResponse(response, 'OAuth token refresh')
  if (!data.access_token) throw new Error('OAuth token response did not contain access_token')
  return data.access_token
}

const main = async () => {
  const manifest = await readManifest()
  const defaultZip = path.join(root, 'release', `ai-prompt-enhancer-extension-${manifest.version}-cws.zip`)
  const zipPath = path.resolve(root, process.env.CWS_ZIP_PATH?.trim() || defaultZip)
  const packageInfo = await stat(zipPath)
  if (!packageInfo.isFile() || packageInfo.size === 0) throw new Error(`Invalid extension package: ${zipPath}`)

  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      mode: 'dry-run',
      version: manifest.version,
      package: path.relative(root, zipPath),
      bytes: packageInfo.size,
      remoteRequestSent: false,
    }, null, 2))
    return
  }

  const publisherId = encodeURIComponent(requireValue('CWS_PUBLISHER_ID'))
  const extensionId = encodeURIComponent(requireValue('CWS_EXTENSION_ID'))
  const token = await getAccessToken()
  const itemName = `publishers/${publisherId}/items/${extensionId}`
  const packageBytes = await readFile(zipPath)

  const uploadResponse = await fetch(`https://chromewebstore.googleapis.com/upload/v2/${itemName}:upload`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/zip',
      'x-goog-upload-protocol': 'raw',
      'x-goog-upload-file-name': path.basename(zipPath),
    },
    body: packageBytes,
  })
  const upload = await readJsonResponse(uploadResponse, 'Chrome Web Store package upload')

  const publishResponse = await fetch(`https://chromewebstore.googleapis.com/v2/${itemName}:publish`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  const publish = await readJsonResponse(publishResponse, 'Chrome Web Store publish submission')

  const statusResponse = await fetch(`https://chromewebstore.googleapis.com/v2/${itemName}:fetchStatus`, {
    headers: { authorization: `Bearer ${token}` },
  })
  const status = await readJsonResponse(statusResponse, 'Chrome Web Store status check')

  console.log(JSON.stringify({
    ok: true,
    version: manifest.version,
    uploadState: upload.uploadState ?? 'submitted',
    publishState: publish.state ?? publish.status ?? 'submitted-for-review',
    storeStatus: status,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
