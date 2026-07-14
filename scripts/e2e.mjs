import { spawn, spawnSync } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const root = process.cwd()
const sourceDistDir = path.join(root, 'dist')
const qaDir = path.join(root, 'qa-artifacts')
const downloadsDir = path.join(qaDir, 'downloads')
const fixtureHtml = await readFile(path.join(root, 'qa-fixture.html'), 'utf8')
const E2E_MOCK_RESPONSE_KEY = 'ape_e2e_mock_response'
const port = Number(process.env.APE_E2E_PORT ?? 9300 + Math.floor(Math.random() * 500))
const profileDir = path.join(os.tmpdir(), `ape-e2e-profile-${Date.now()}`)
const extensionDistDir = path.join(os.tmpdir(), `ape-e2e-dist-${Date.now()}`)
const structuredLoginPrompt = [
  '# 结构化登录接口实现 Prompt',
  '',
  '## 目标',
  '请实现一个安全、可维护的登录接口，覆盖认证、错误处理和测试验收。',
  '',
  '## 技术栈',
  '- Node.js / TypeScript',
  '- Express 或兼容 HTTP 框架',
  '- JWT 或安全 Session',
  '',
  '## 输入输出',
  '- 输入：用户名或邮箱、密码、可选验证码',
  '- 输出：登录成功状态、用户基础信息、访问令牌或会话标识',
  '',
  '## 错误处理',
  '- 参数缺失或格式错误返回 400',
  '- 账号不存在或密码错误返回统一 401',
  '- 频率限制、锁定、审计日志需要明确',
  '',
  '## 测试要求',
  '- 覆盖成功登录、密码错误、参数缺失、锁定账号、过期 Token',
].join('\n')

const partialMockPrompt = '第一段优化\n\n第二段优化'
const newPromptSource = 'NEW_PROMPT_SOURCE_E2E'
const newPromptResponse = 'NEW_PROMPT_RESPONSE_E2E optimized result'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const chromeCandidates = [
  process.env.CHROME_PATH,
  path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'),
  path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe'),
  path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe'),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  path.join(os.homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const chromePath = chromeCandidates.find((candidate) => existsSync(candidate))
if (!chromePath) throw new Error('未找到 Chrome/Edge 可执行文件')
if (!existsSync(path.join(sourceDistDir, 'manifest.json'))) throw new Error('dist/manifest.json 不存在，请先运行 npm run build')

await mkdir(qaDir, { recursive: true })
await rm(downloadsDir, { recursive: true, force: true })
await mkdir(downloadsDir, { recursive: true })
await rm(profileDir, { recursive: true, force: true })
await rm(extensionDistDir, { recursive: true, force: true })
await mkdir(profileDir, { recursive: true })
await cp(sourceDistDir, extensionDistDir, { recursive: true })

const chromeArgs = [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`,
  `--load-extension=${extensionDistDir}`,
  `--disable-extensions-except=${extensionDistDir}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-popup-blocking',
  '--kiosk-printing',
  '--window-size=1440,1000',
  'about:blank',
]

const chrome = spawn(chromePath, chromeArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
let stderr = ''
chrome.stderr.on('data', (chunk) => { stderr += String(chunk) })

const fetchJson = async (url, options) => {
  const response = await fetch(url, options)
  if (!response.ok) throw new Error(`${url} -> ${response.status}`)
  return await response.json()
}

class CdpSession {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.nextId = 1
    this.pending = new Map()
    this.handlers = new Map()
    this.opened = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true })
      this.ws.addEventListener('error', reject, { once: true })
    })
    this.ws.addEventListener('message', (event) => this.onMessage(event))
  }
  onMessage(event) {
    const message = JSON.parse(event.data)
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id)
      this.pending.delete(message.id)
      if (message.error) reject(new Error(`${message.error.message}: ${message.error.data ?? ''}`))
      else resolve(message.result)
      return
    }
    if (message.method) {
      const handlers = this.handlers.get(message.method) ?? []
      for (const handler of handlers) handler(message.params)
    }
  }
  async send(method, params = {}) {
    await this.opened
    const id = this.nextId++
    const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
    this.ws.send(JSON.stringify({ id, method, params }))
    return await promise
  }
  on(method, handler) {
    const handlers = this.handlers.get(method) ?? []
    handlers.push(handler)
    this.handlers.set(method, handlers)
  }
  once(method) {
    return new Promise((resolve) => {
      const handler = (params) => {
        const handlers = this.handlers.get(method) ?? []
        this.handlers.set(method, handlers.filter((item) => item !== handler))
        resolve(params)
      }
      this.on(method, handler)
    })
  }
  close() {
    this.ws.close()
  }
}

async function waitForDebugger() {
  for (let index = 0; index < 80; index += 1) {
    try { return await fetchJson(`http://127.0.0.1:${port}/json/version`) } catch { await sleep(250) }
  }
  throw new Error(`Chrome CDP 未启动：${stderr}`)
}

async function listTargets() {
  return await fetchJson(`http://127.0.0.1:${port}/json/list`)
}

async function waitForTarget(predicate, label, timeoutMs = 12000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const targets = await listTargets()
    const found = targets.find(predicate)
    if (found) return found
    await sleep(250)
  }
  const targets = await listTargets().catch(() => [])
  throw new Error(`等待 target 超时：${label}; targets=${JSON.stringify(targets.map((target) => ({ type: target.type, title: target.title, url: target.url })))}; chromeStderr=${stderr}`)
}

async function openTarget(url) {
  const target = await fetchJson(`http://127.0.0.1:${port}/json/new?about%3Ablank`, { method: 'PUT' })
  const session = new CdpSession(target.webSocketDebuggerUrl)
  await session.send('Page.enable')
  await session.send('Runtime.enable')
  await session.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  if (url !== 'about:blank') {
    const loaded = session.once('Page.loadEventFired')
    await session.send('Page.navigate', { url })
    await loaded
  }
  await sleep(500)
  return { target, session }
}

async function evalIn(session, expression, awaitPromise = true) {
  const result = await Promise.race([
    session.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Runtime.evaluate timeout: ${expression.slice(0, 160)}`)), 10000)),
  ])
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result?.value
}

async function waitEval(session, expression, label, timeoutMs = 12000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await evalIn(session, expression)
      if (value) return value
    } catch {}
    await sleep(250)
  }
  let diagnostic = ''
  try {
    diagnostic = JSON.stringify(await evalIn(session, `({ href: location.href, title: document.title, text: document.body?.innerText?.slice(0, 500), html: document.documentElement?.outerHTML?.slice(0, 500) })`))
  } catch (error) {
    diagnostic = String(error)
  }
  throw new Error(`等待条件超时：${label}; diagnostic=${diagnostic}`)
}

async function screenshot(session, filename) {
  await sleep(250)
  const result = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await writeFile(path.join(qaDir, filename), Buffer.from(result.data, 'base64'))
}

async function setMock(serviceWorkerSession, response, delayMs = 0) {
  await evalIn(serviceWorkerSession, `chrome.storage.local.set(${JSON.stringify({
    ape_e2e_mock_response: response,
    ape_e2e_enhance_requests: [],
    ape_e2e_mock_delay_ms: delayMs,
  })})`)
}

async function getStorage(serviceWorkerSession, keys) {
  return await evalIn(serviceWorkerSession, `chrome.storage.local.get(${JSON.stringify(keys)})`)
}

async function setEnhancementWorkflow(serviceWorkerSession, enhancementWorkflow) {
  return await evalIn(serviceWorkerSession, `chrome.storage.local.get('ape_settings').then((state) => chrome.storage.local.set({
    ape_settings: { ...(state.ape_settings ?? {}), enhancementWorkflow: ${JSON.stringify(enhancementWorkflow)} }
  }))`)
}

async function click(session, selector) {
  await evalIn(
    session,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el) throw new Error('selector not found: ${selector}')
      const pointerInit = { bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse', isPrimary: true }
      el.dispatchEvent(new PointerEvent('pointerdown', pointerInit))
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true, buttons: 1 }))
      el.dispatchEvent(new PointerEvent('pointerup', pointerInit))
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, composed: true }))
      el.click()
      return true
    })()`,
  )
}

async function fill(session, selector, value) {
  await evalIn(
    session,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el) throw new Error('selector not found: ${selector}')
      el.focus()
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set
        setter ? setter.call(el, ${JSON.stringify(value)}) : (el.value = ${JSON.stringify(value)})
      } else if (el instanceof HTMLElement && el.isContentEditable) {
        el.textContent = ${JSON.stringify(value)}
      } else {
        throw new Error('selector is not fillable: ${selector}')
      }
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }))
      el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }))
      return 'value' in el ? el.value : el.textContent
    })()`,
  )
}

const checks = []
const check = (name, condition, details = '') => {
  if (!condition) throw new Error(`E2E 失败：${name}${details ? ` (${details})` : ''}`)
  checks.push({ name, status: 'PASS', details })
}

try {
  const version = await waitForDebugger()
  const browserSession = new CdpSession(version.webSocketDebuggerUrl)
  await browserSession.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadsDir, eventsEnabled: true })

  const serviceWorkerTarget = await waitForTarget((target) => target.type === 'service_worker' && target.url.includes('/service-worker-loader.js'), 'AI Prompt Enhancer service worker')
  const extensionId = new URL(serviceWorkerTarget.url).hostname
  check('扩展能成功加载', Boolean(extensionId), extensionId)

  const popup = await openTarget(`chrome-extension://${extensionId}/popup.html`)
  await waitEval(popup.session, 'document.body.innerText.includes("AI Prompt Enhancer")', 'popup rendered')
  await screenshot(popup.session, 'popup.png')
  check('popup 能打开', true)
  const storageSession = popup.session

  const options = await openTarget(`chrome-extension://${extensionId}/options.html`)
  await waitEval(options.session, 'document.body.innerText.length > 20', 'options rendered')
  await screenshot(options.session, 'options.png')
  check('options 能打开', true)

  const sidepanel = await openTarget(`chrome-extension://${extensionId}/sidepanel.html`)
  await waitEval(sidepanel.session, 'document.body.innerText.length > 20', 'sidepanel rendered')
  await evalIn(sidepanel.session, `(() => { const b=[...document.querySelectorAll('button')].find((item)=>item.textContent.includes('Skills')); b?.click(); return !!b })()`)
  await sleep(600)
  await screenshot(sidepanel.session, 'sidepanel-skills.png')
  check('sidepanel 能打开', true)

  const fixture = await openTarget('about:blank')
  await fixture.session.send('Log.enable')
  fixture.session.on('Fetch.requestPaused', async (params) => {
    try {
      await fixture.session.send('Fetch.fulfillRequest', {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }],
        body: Buffer.from(fixtureHtml, 'utf8').toString('base64'),
      })
    } catch {}
  })
  fixture.session.on('Page.javascriptDialogOpening', async () => {
    await fixture.session.send('Page.handleJavaScriptDialog', { accept: true })
  })
  await fixture.session.send('Fetch.enable', { patterns: [{ urlPattern: 'https://chatgpt.com/ape-e2e-fixture*', requestStage: 'Request' }] })
  const loaded = fixture.session.once('Page.loadEventFired')
  await fixture.session.send('Page.navigate', { url: 'https://chatgpt.com/ape-e2e-fixture' })
  await loaded
  await waitEval(fixture.session, 'document.querySelector("textarea")?.value.includes("登录接口")', 'fixture textarea')

  await setMock(storageSession, structuredLoginPrompt, 1500)
  await evalIn(fixture.session, `document.querySelector('textarea').focus()`)
  const autoInjected = await evalIn(fixture.session, 'Boolean(document.querySelector("[data-ape-testid=launcher]"))')
  if (!autoInjected) {
    await evalIn(storageSession, `new Promise((resolve, reject) => {
      chrome.tabs.query({ url: 'https://chatgpt.com/*' }, async (tabs) => {
        try {
          const tab = tabs[0]
          if (!tab?.id) throw new Error('fixture tab not found')
          const manifest = chrome.runtime.getManifest()
          const contentBundle = manifest.web_accessible_resources?.flatMap((item) => item.resources ?? []).find((item) => item.startsWith('assets/index.ts-') && !item.includes('loader'))
          const [entry] = contentBundle ? [contentBundle] : (manifest.content_scripts?.[0]?.js ?? [])
          const url = chrome.runtime.getURL(entry)
          const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async (moduleUrl) => {
              try {
                await import(moduleUrl)
                return { ok: true }
              } catch (error) {
                return { ok: false, message: error instanceof Error ? error.message : String(error) }
              }
            },
            args: [url],
          })
          resolve({ tab: { id: tab.id, url: tab.url, title: tab.title }, entry, url, result })
        } catch (error) {
          reject(error)
        }
      })
    })`)
    await evalIn(fixture.session, `(() => { const el = document.querySelector('textarea'); el.blur(); document.body.focus(); el.focus(); el.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); return true })()`)
  }
  await waitEval(fixture.session, 'getComputedStyle(document.querySelector("[data-ape-testid=launcher]")).display !== "none"', 'launcher visible')
  await waitEval(fixture.session, 'getComputedStyle(document.querySelector("[data-ape-testid=quick-action-panel]")).display !== "none"', 'secondary bubbles visible')
  await screenshot(fixture.session, 'launcher-clip.png')
  check('fixture 杈撳叆妗嗘梺鍑虹幇缁胯壊灏忕悆', true)
  check('Secondary action bubbles are visible beside the launcher', true)

  const normalGeometry = await evalIn(fixture.session, `(() => {
    const input = document.querySelector('textarea').getBoundingClientRect()
    const launcher = document.querySelector('[data-ape-testid=launcher]').getBoundingClientRect()
    const dock = document.querySelector('[data-ape-testid=quick-action-panel]').getBoundingClientRect()
    const intersects = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)
    return {
      launcherOverlap: intersects(input, launcher),
      dockOverlap: intersects(input, dock),
      placement: document.querySelector('[data-ape-testid=launcher]').dataset.apePlacement,
    }
  })()`)
  check('Launcher cluster stays outside the active input', !normalGeometry.launcherOverlap && !normalGeometry.dockOverlap, JSON.stringify(normalGeometry))

  await evalIn(fixture.session, `(() => {
    const input = document.querySelector('textarea')
    const card = input.closest('.card')
    card.dataset.apeE2ePreviousStyle = card.getAttribute('style') ?? ''
    input.dataset.apeE2ePreviousStyle = input.getAttribute('style') ?? ''
    Object.assign(card.style, { position: 'fixed', left: '8px', right: '8px', bottom: '20px', width: 'auto', zIndex: '1' })
    Object.assign(input.style, { width: '100%', minHeight: '120px', boxSizing: 'border-box' })
    window.dispatchEvent(new Event('resize'))
    input.focus()
    return true
  })()`)
  await sleep(180)
  const edgeGeometry = await evalIn(fixture.session, `(() => {
    const input = document.querySelector('textarea').getBoundingClientRect()
    const launcherElement = document.querySelector('[data-ape-testid=launcher]')
    const launcher = launcherElement.getBoundingClientRect()
    const dock = document.querySelector('[data-ape-testid=quick-action-panel]').getBoundingClientRect()
    const intersects = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)
    return {
      launcherOverlap: intersects(input, launcher),
      dockOverlap: intersects(input, dock),
      placement: launcherElement.dataset.apePlacement,
    }
  })()`)
  check(
    'Viewport-wide inputs use a non-overlapping vertical fallback',
    !edgeGeometry.launcherOverlap && !edgeGeometry.dockOverlap && ['above', 'below'].includes(edgeGeometry.placement),
    JSON.stringify(edgeGeometry),
  )
  await evalIn(fixture.session, `(() => {
    const input = document.querySelector('textarea')
    const card = input.closest('.card')
    const restore = (element, value) => value ? element.setAttribute('style', value) : element.removeAttribute('style')
    restore(card, card.dataset.apeE2ePreviousStyle)
    restore(input, input.dataset.apeE2ePreviousStyle)
    delete card.dataset.apeE2ePreviousStyle
    delete input.dataset.apeE2ePreviousStyle
    window.dispatchEvent(new Event('resize'))
    input.focus()
    return true
  })()`)
  await sleep(120)

  await click(fixture.session, '[data-ape-testid=launcher]')
  await waitEval(fixture.session, 'getComputedStyle(document.querySelector("[data-ape-testid=enhance-progress]")).display !== "none"', 'progress visible')
  await screenshot(fixture.session, 'enhance-progress.png')
  check('Enhance progress indicator is visible while waiting', true)
  await waitEval(fixture.session, 'document.querySelector("[data-ape-testid=compare-original]")?.innerText.length > 10 && document.querySelector("[data-ape-testid=compare-optimized]")?.innerText.includes("结构化登录接口实现 Prompt")', 'compare view')
  await screenshot(fixture.session, 'compare-dialog.png')
  check('点击增强提示词后出现对比视图', true)
  check('未接受前原输入框内容不变', await evalIn(fixture.session, 'document.querySelector("textarea").value') === '帮我写一个登录接口')
  await click(fixture.session, '[data-ape-testid=reject-optimized]')
  await sleep(300)
  check('点击拒绝后原输入框内容不变', await evalIn(fixture.session, 'document.querySelector("textarea").value') === '帮我写一个登录接口')

  await fill(fixture.session, 'textarea', '帮我规划一个产品发布')
  await setMock(storageSession, structuredLoginPrompt)
  await evalIn(storageSession, `chrome.storage.local.set({
    ape_e2e_mock_clarification: {
      summary: '用户希望规划一次产品发布，但目标受众和交付节奏还需要确认。',
      readyToEnhance: false,
      warnings: [],
      questions: [
        { id: 'audience', question: '这次发布主要面向谁？', why: '受众决定渠道和信息层级。', placeholder: '例如：现有企业客户', required: true },
        { id: 'deadline', question: '期望何时完成发布？', why: '时间决定计划粒度。', placeholder: '例如：两周内', required: true }
      ]
    },
    ape_e2e_clarification_requests: []
  })`)
  await setEnhancementWorkflow(storageSession, 'clarify')
  await sleep(350)
  await click(fixture.session, '[data-ape-testid=launcher]')
  await waitEval(fixture.session, 'document.querySelector("[data-ape-testid=clarification-answer-1]")', 'clarification questions')
  await screenshot(fixture.session, 'clarify-dialog.png')
  check('追问模式展示针对性的意图问题', await evalIn(fixture.session, 'document.querySelector("[data-ape-testid=clarification-questions]")?.innerText.includes("这次发布主要面向谁")'))
  await fill(fixture.session, '[data-ape-testid=clarification-answer-0]', '现有企业客户和实施团队')
  await fill(fixture.session, '[data-ape-testid=clarification-answer-1]', '两周内完成')
  await click(fixture.session, '[data-ape-testid=clarify-generate]')
  await waitEval(fixture.session, 'document.querySelector("[data-ape-testid=compare-optimized]")?.innerText.includes("结构化登录接口实现 Prompt")', 'clarified enhancement result')
  const clarifiedRequests = (await getStorage(storageSession, ['ape_e2e_enhance_requests'])).ape_e2e_enhance_requests
  const clarifiedRequest = clarifiedRequests.at(-1)
  check(
    '追问回答随最终增强请求发送',
    clarifiedRequest?.workflow === 'clarify' &&
      clarifiedRequest?.clarificationContext?.some((item) => item.answer === '现有企业客户和实施团队') &&
      clarifiedRequest?.clarificationContext?.some((item) => item.answer === '两周内完成'),
  )
  check('追问完成后仍进入显式确认视图', await evalIn(fixture.session, 'document.querySelector("textarea").value') === '帮我规划一个产品发布')
  await click(fixture.session, '[data-ape-testid=reject-optimized]')
  await setEnhancementWorkflow(storageSession, 'direct')
  await evalIn(storageSession, `chrome.storage.local.remove(['ape_e2e_mock_clarification'])`)
  await sleep(300)

  await click(fixture.session, '[data-ape-testid=launcher]')
  await waitEval(fixture.session, 'document.querySelector("[data-ape-testid=compare-optimized]")?.innerText.includes("\\u7ed3\\u6784\\u5316\\u767b\\u5f55\\u63a5\\u53e3\\u5b9e\\u73b0 Prompt")', 'optimized result before accept')
  await click(fixture.session, '[data-ape-testid=accept-optimized]')
  await waitEval(fixture.session, 'document.querySelector("textarea").value.includes("\\u7ed3\\u6784\\u5316\\u767b\\u5f55\\u63a5\\u53e3\\u5b9e\\u73b0 Prompt")', 'textarea replaced after accept')
  const acceptedValue = await evalIn(fixture.session, 'document.querySelector("textarea").value')
  check('点击接受优化后输入框被替换为优化结果', acceptedValue === structuredLoginPrompt, `actual length=${acceptedValue.length}`)
  await waitEval(fixture.session, 'getComputedStyle(document.querySelector("[data-ape-testid=compare-dialog]")).display === "none"', 'compare dialog closed after accept')
  check('Accepting optimization auto closes the comparison dialog', true)

  await fill(fixture.session, 'textarea', newPromptSource)
  await setMock(storageSession, newPromptResponse)
  await waitEval(fixture.session, 'getComputedStyle(document.querySelector("[data-ape-testid=launcher]")).display !== "none"', 'launcher visible for new prompt')
  await click(fixture.session, '[data-ape-testid=launcher]')
  await waitEval(fixture.session, 'getComputedStyle(document.querySelector("[data-ape-testid=quick-action-panel]")).display !== "none"', 'panel visible for new prompt')
  await waitEval(fixture.session, 'getComputedStyle(document.querySelector("[data-ape-testid=compare-dialog]")).display !== "none"', 'dialog visible for new prompt')
  await waitEval(fixture.session, 'document.querySelector("[data-ape-testid=compare-optimized]")?.innerText.includes("NEWPROMPTRESPONSE_E2E")', 'new prompt optimized')
  const newPromptRequests = (await getStorage(storageSession, ['ape_e2e_enhance_requests'])).ape_e2e_enhance_requests
  check('Enhance uses latest edited input text instead of stale prompt', newPromptRequests.at(-1)?.sourceText === newPromptSource)
  await click(fixture.session, '[data-ape-testid=reject-optimized]')

  await fill(fixture.session, 'textarea', '?????????')
  await setMock(storageSession, structuredLoginPrompt)
  await click(fixture.session, '[data-ape-testid=launcher]')
  await waitEval(fixture.session, 'document.querySelector("[data-ape-testid=continue-input]")', 'continue input')
  await setMock(storageSession, `${structuredLoginPrompt}\n\n## ??????\n- ?????????????`)
  await fill(fixture.session, '[data-ape-testid=continue-input]', 'MAKE_IT_SHORTER_E2E')
  await waitEval(
    fixture.session,
    'document.querySelector("[data-ape-testid=continue-input]")?.value === "MAKE_IT_SHORTER_E2E"',
    'continue input filled',
  )
  await click(fixture.session, '[data-ape-testid=continue-optimize]')
  await waitEval(fixture.session, 'document.querySelector("[data-ape-testid=compare-optimized]")?.innerText.includes("??????")', 'continue optimized')
  const requests = (await getStorage(storageSession, ['ape_e2e_enhance_requests'])).ape_e2e_enhance_requests
  const lastRequest = requests.at(-1)
  check(
    '?????????????????',
    lastRequest.sourceText === '?????????' &&
      lastRequest.previousEnhancedText === structuredLoginPrompt &&
      lastRequest.followUpInstruction === 'MAKE_IT_SHORTER_E2E',
  )
  await click(fixture.session, '[data-ape-testid=reject-optimized]')

  await fill(fixture.session, 'textarea', '第一段原始\n\n第二段原始')
  await setMock(storageSession, partialMockPrompt)
  await click(fixture.session, '[data-ape-testid=launcher]')
  await waitEval(fixture.session, 'document.querySelector("[data-ape-testid=compare-optimized]")?.innerText.includes("\\u7b2c\\u4e00\\u6bb5\\u4f18\\u5316") && document.querySelector("[data-ape-testid=partial-checkbox-1]")', 'partial optimized result')
  await click(fixture.session, '[data-ape-testid=partial-checkbox-1]')
  await click(fixture.session, '[data-ape-testid=partial-accept]')
  await sleep(300)
  const partialValue = await evalIn(fixture.session, 'document.querySelector("textarea").value')
  check('部分接受保留未选原始段落', partialValue === '第一段优化\n\n第二段原始', JSON.stringify(partialValue))
  await waitEval(fixture.session, 'getComputedStyle(document.querySelector("[data-ape-testid=compare-dialog]")).display === "none"', 'compare dialog closed after partial accept')
  check('Partial accept auto closes the comparison dialog', true)

  await fill(fixture.session, 'textarea', '保存用提示词')
  await click(fixture.session, '[data-ape-testid=launcher]')
  await click(fixture.session, '[data-ape-testid=panel-save-toggle]')
  await waitEval(fixture.session, 'document.querySelector("[data-ape-testid=save-submit]")', 'save submit')
  await fill(fixture.session, '[data-ape-testid=save-title]', 'E2E 保存提示词')
  await fill(fixture.session, '[data-ape-testid=save-tags]', 'e2e,qa')
  await fill(fixture.session, '[data-ape-testid=save-category]', 'QA')
  await click(fixture.session, '[data-ape-testid=save-submit]')
  await sleep(500)
  const savedState = await getStorage(storageSession, ['ape_saved_prompts', 'ape_templates'])
  check('保存提示词写入独立个人提示词库', Array.isArray(savedState.ape_saved_prompts) && savedState.ape_saved_prompts.some((item) => item.title === 'E2E 保存提示词'))
  check('保存提示词未写入模板库', !Array.isArray(savedState.ape_templates) || !savedState.ape_templates.some((item) => item.title === 'E2E 保存提示词'))

  const sidepanelPrompts = await openTarget(`chrome-extension://${extensionId}/sidepanel.html`)
  await waitEval(sidepanelPrompts.session, 'document.body.innerText.length > 20', 'sidepanel prompts rendered')
  await evalIn(sidepanelPrompts.session, `(() => { const b=[...document.querySelectorAll('button')].find((item)=>item.textContent.includes('提示词库')); b?.click(); return !!b })()`)
  await waitEval(sidepanelPrompts.session, 'document.body.innerText.includes("E2E 保存提示词")', 'saved prompt visible')
  await screenshot(sidepanelPrompts.session, 'sidepanel-prompts.png')

  await click(fixture.session, '[data-ape-testid=panel-export-toggle]')
  for (const format of ['markdown', 'html', 'json', 'txt']) {
    await click(fixture.session, `[data-ape-testid=export-${format}]`)
    await sleep(500)
  }
  const downloaded = await readdir(downloadsDir)
  check('导出 Markdown / HTML / JSON / TXT 生成下载文件', ['md', 'html', 'json', 'txt'].every((ext) => downloaded.some((file) => file.endsWith(`.${ext}`))), downloaded.join(', '))

  const beforeTargets = new Set((await listTargets()).map((target) => target.id))
  await evalIn(fixture.session, `localStorage.setItem('ape_e2e_disable_print', '1')`)
  await click(fixture.session, '[data-ape-testid=export-pdf]')
  await sleep(1200)
  const pdfTarget = (await listTargets()).find((target) => !beforeTargets.has(target.id) && target.type === 'page')
  if (!pdfTarget?.webSocketDebuggerUrl) throw new Error('PDF 可打印 HTML 页面未打开')
  const pdfSession = new CdpSession(pdfTarget.webSocketDebuggerUrl)
  await pdfSession.send('Page.enable')
  await pdfSession.send('Runtime.enable')
  await waitEval(pdfSession, 'document.body.innerText.includes("Conversation Export")', 'pdf export page')
  await waitEval(pdfSession, 'Boolean(document.querySelector(".code-block"))', 'pdf code block')
  await screenshot(pdfSession, 'export-print-page.png')
  const codeStyle = await evalIn(pdfSession, `(() => { const el = document.querySelector('.code-block'); const s = getComputedStyle(el); return { background: s.backgroundColor, color: s.color, whiteSpace: s.whiteSpace }; })()`)
  check('PDF 路径打开可打印 HTML 并保留代码块样式', Boolean(codeStyle?.background && codeStyle.background !== 'rgba(0, 0, 0, 0)'))

  const privacyState = await getStorage(storageSession, ['ape_history'])
  check('优化历史记录在 mock E2E 中本地写入', Array.isArray(privacyState.ape_history) && privacyState.ape_history.length > 0)

  const readableCheckNames = [
    'Extension loaded from dist',
    'Popup opens',
    'Options page opens',
    'Side panel opens',
    'Green launcher appears beside the fixture input',
    'Secondary action bubbles are visible beside the launcher',
    'Launcher and secondary actions do not overlap the active input',
    'Viewport-wide inputs use an above/below fallback instead of overlap',
    'Enhance progress indicator is visible while waiting',
    'Enhance prompt opens the before/after comparison view',
    'Original input is unchanged before accepting',
    'Reject keeps the original input unchanged',
    'Clarify-first mode displays targeted intent questions',
    'Clarification answers are sent with the final enhancement request',
    'Clarify-first mode still opens the explicit confirmation view',
    'Accept replaces the input with the optimized result',
    'Accepting optimization auto closes the comparison dialog',
    'Enhance uses latest edited input text instead of stale prompt',
    'Continue optimize sends the original prompt and previous optimized result',
    'Partial accept preserves unselected original paragraphs',
    'Partial accept auto closes the comparison dialog',
    'Save prompt writes to the independent personal prompt library',
    'Save prompt does not write to the template library',
    'Markdown / HTML / JSON / TXT exports create files',
    'PDF export opens printable HTML and keeps code block styling',
    'Mock E2E writes local optimization history',
  ]
  const readableDetail = (index, details) => {
    if (!details) return ''
    if (index === 19) return 'first paragraph optimized, second original paragraph preserved'
    return [...details].every((char) => char.charCodeAt(0) <= 0x7f) ? details : ''
  }
  const report = [
    '# E2E Report',
    '',
    `- Time: ${new Date().toISOString()}`,
    `- Browser: ${chromePath}`,
    `- Extension ID: ${extensionId}`,
    '- Source dist: dist',
    `- Loaded dist copy: ${extensionDistDir}`,
    '- Fixture URL: https://chatgpt.com/ape-e2e-fixture (CDP fulfilled from local qa-fixture.html)',
    `- Third-party AI API calls: none; used chrome.storage.local key ${E2E_MOCK_RESPONSE_KEY}.`,
    '',
    '## Checks',
    ...checks.map((item, index) => {
      const detail = readableDetail(index, item.details)
      return `- [x] ${readableCheckNames[index] ?? item.name}${detail ? `: ${detail}` : ''}`
    }),
    '',
    '## Downloads',
    ...downloaded.map((file) => `- ${file}`),
  ].join('\n')
  await writeFile(path.join(qaDir, 'e2e-report.md'), report, 'utf8')
  console.log(report)

  await Promise.all([popup.session, options.session, sidepanel.session, sidepanelPrompts.session, fixture.session, browserSession].map(async (session) => session.close()))
} finally {
  if (process.platform === 'win32' && chrome.pid) {
    spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    chrome.kill()
  }
  await sleep(500)
  try { await rm(profileDir, { recursive: true, force: true }) } catch {}
  try { await rm(extensionDistDir, { recursive: true, force: true }) } catch {}
}
