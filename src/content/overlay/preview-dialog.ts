import { detectSensitiveText } from '@/content/detector/sensitive-detector'
import { escapeHtml, renderMarkdownDocumentHtml, renderMarkdownLineHtml } from '@/content/overlay/markdown-render'
import type {
  ClarificationAnswer,
  ClarificationQuestion,
  EditableAdapter,
  EditorSnapshot,
  EnhancementWorkflow,
  EnhanceMode,
  IntentInsight,
} from '@/shared/types'

interface OpenPreviewOptions {
  sourceText: string
  mode?: EnhanceMode
  skillId?: string
  adapter: EditableAdapter | null
  snapshot?: EditorSnapshot
  hostname: string
  copyOnly?: boolean
  workflow?: EnhancementWorkflow
}

interface ClarifyResponse {
  summary: string
  questions: ClarificationQuestion[]
  readyToEnhance: boolean
  warnings: string[]
}

interface EnhanceResponseData extends IntentInsight {
  enhancedPrompt: string
  warnings: string[]
  historyId?: string
}

const tryExtractEnhancedPrompt = (raw: string) => {
  const match = raw.match(/"enhancedPrompt"\s*:\s*"([\s\S]*)/)
  if (!match?.[1]) return ''
  const value = match[1]
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
  return value.replace(/",?\s*$/, '').trim()
}

type LineDiffSegment =
  | { type: 'equal'; text: string }
  | { type: 'delete'; text: string }
  | { type: 'insert'; text: string }

const buildLineDiff = (source: string, target: string): LineDiffSegment[] => {
  const sourceLines = source.split('\n')
  const targetLines = target.split('\n')
  const dp = Array.from({ length: sourceLines.length + 1 }, () =>
    Array.from({ length: targetLines.length + 1 }, () => 0),
  )

  for (let i = sourceLines.length - 1; i >= 0; i -= 1) {
    for (let j = targetLines.length - 1; j >= 0; j -= 1) {
      dp[i][j] =
        sourceLines[i] === targetLines[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const segments: LineDiffSegment[] = []
  let i = 0
  let j = 0
  while (i < sourceLines.length && j < targetLines.length) {
    if (sourceLines[i] === targetLines[j]) {
      segments.push({ type: 'equal', text: sourceLines[i] })
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      segments.push({ type: 'delete', text: sourceLines[i] })
      i += 1
    } else {
      segments.push({ type: 'insert', text: targetLines[j] })
      j += 1
    }
  }
  while (i < sourceLines.length) segments.push({ type: 'delete', text: sourceLines[i++] })
  while (j < targetLines.length) segments.push({ type: 'insert', text: targetLines[j++] })
  return segments
}

const renderDiffHtml = (source: string, target: string, type: 'source' | 'target') =>
  buildLineDiff(source, target)
    .filter((segment) => (type === 'source' ? segment.type !== 'insert' : segment.type !== 'delete'))
    .map((segment) => {
      const className =
        segment.type === 'insert'
          ? 'ape-diff-line ape-diff-insert'
          : segment.type === 'delete'
            ? 'ape-diff-line ape-diff-delete'
            : 'ape-diff-line'
      return `<div class="${className}">${renderMarkdownLineHtml(segment.text)}</div>`
    })
    .join('')

const ensurePreviewStyles = () => {
  if (document.getElementById('ape-preview-dialog-style')) return
  const style = document.createElement('style')
  style.id = 'ape-preview-dialog-style'
  style.textContent = `
    @keyframes ape-dialog-in { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes ape-shimmer { 0% { background-position: 120% 0; } 100% { background-position: -120% 0; } }
    .ape-dialog-panel { animation: ape-dialog-in .24s cubic-bezier(.22,.9,.3,1); scrollbar-width: thin; scrollbar-color: #b7c7bf transparent; }
    .ape-dialog-panel * { box-sizing: border-box; }
    .ape-dialog-header { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; padding:22px 24px 16px; border-bottom:1px solid #dce7e1; }
    .ape-dialog-brand { display:flex; gap:13px; align-items:center; min-width:0; }
    .ape-dialog-mark { width:40px; height:40px; border-radius:13px; display:grid; place-items:center; flex:0 0 auto; color:#fff; font-size:19px; background:#123f35; box-shadow:0 10px 24px rgba(18,63,53,.2); }
    .ape-dialog-title { margin:0; color:#10231d; font-size:20px; line-height:1.2; font-weight:760; letter-spacing:-.02em; }
    .ape-dialog-subtitle { margin-top:5px; color:#64766e; font-size:12px; line-height:1.6; }
    .ape-dialog-close { width:34px; height:34px; border:1px solid #d6e1dc; border-radius:11px; background:#fff; color:#52645c; cursor:pointer; font-size:18px; display:grid; place-items:center; transition:.18s ease; }
    .ape-dialog-close:hover { background:#f2f7f4; color:#10231d; transform:translateY(-1px); }
    .ape-dialog-toolbar { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px 24px; background:#f6faf7; border-bottom:1px solid #dce7e1; }
    .ape-flow-switch { display:inline-grid; grid-template-columns:1fr 1fr; padding:4px; border:1px solid #d5e2dc; border-radius:13px; background:#fff; gap:4px; }
    .ape-flow-option { border:0; border-radius:9px; background:transparent; color:#5c6d65; font-size:12px; font-weight:700; padding:8px 12px; cursor:pointer; transition:.18s ease; white-space:nowrap; }
    .ape-flow-option[data-active="true"] { background:#123f35; color:#fff; box-shadow:0 6px 14px rgba(18,63,53,.18); }
    .ape-dialog-status { color:#5f7169; font-size:12px; text-align:right; line-height:1.5; }
    .ape-progress { display:none; margin:16px 24px 0; padding:12px 14px; border:1px solid #cfe1d8; border-radius:14px; background:#f1f8f4; }
    .ape-progress-track { height:7px; overflow:hidden; border-radius:999px; background:#dcece4; }
    .ape-progress-bar { height:100%; width:8%; border-radius:999px; background:linear-gradient(90deg,#1f9d68,#e6a93d,#1f9d68); background-size:220% 100%; transition:width .35s ease; animation:ape-shimmer 1.8s linear infinite; }
    .ape-progress-text { margin-top:8px; color:#315c4b; font-size:12px; }
    .ape-intent-insight { display:none; margin:14px 24px 0; padding:14px 16px; border:1px solid #cfe0d7; border-radius:16px; background:linear-gradient(135deg,#f5fbf8,#eef8f3); }
    .ape-intent-insight[data-needs-clarification="true"] { border-color:#e5c98e; background:linear-gradient(135deg,#fffaf0,#f8f7ee); }
    .ape-intent-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .ape-intent-title { color:#123f35; font-size:13px; font-weight:800; }
    .ape-intent-badge { color:#567067; font-size:11px; }
    .ape-intent-summary { margin-top:7px; color:#2c463a; font-size:12px; line-height:1.6; white-space:pre-wrap; }
    .ape-intent-missing { margin:10px 0 0; padding-left:19px; color:#765016; font-size:12px; line-height:1.6; }
    .ape-intent-actions { display:flex; align-items:center; gap:9px; flex-wrap:wrap; margin-top:11px; }
    .ape-intent-hint { color:#7b6c50; font-size:11px; }
    .ape-stage { padding:20px 24px 24px; }
    .ape-clarify-layout { display:grid; grid-template-columns:minmax(220px,.72fr) minmax(0,1.28fr); gap:18px; align-items:start; }
    .ape-conversation { border:1px solid #d8e4de; border-radius:18px; background:#f7faf8; padding:15px; max-height:470px; overflow:auto; }
    .ape-conversation-label { color:#799087; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; margin:3px 0 8px; }
    .ape-message { padding:11px 12px; border-radius:14px; color:#263b33; font-size:12px; line-height:1.65; margin-bottom:10px; word-break:break-word; }
    .ape-message-user { background:#fff; border:1px solid #d8e4de; border-bottom-right-radius:5px; }
    .ape-message-ai { background:#e7f3ed; border:1px solid #c9e0d4; border-bottom-left-radius:5px; }
    .ape-message-answer { margin-top:7px; padding-top:7px; border-top:1px solid rgba(18,63,53,.12); color:#123f35; }
    .ape-question-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px; }
    .ape-section-kicker { color:#17815a; font-size:10px; font-weight:850; letter-spacing:.13em; text-transform:uppercase; }
    .ape-section-title { margin:4px 0 0; color:#10231d; font-size:17px; font-weight:760; letter-spacing:-.01em; }
    .ape-question-count { color:#65786f; font-size:11px; padding:5px 8px; border:1px solid #d8e4de; border-radius:999px; background:#fff; }
    .ape-question-list { display:flex; flex-direction:column; gap:10px; }
    .ape-question-card { display:grid; grid-template-columns:28px minmax(0,1fr); gap:11px; padding:13px; border:1px solid #d7e4de; border-radius:16px; background:#fff; box-shadow:0 9px 24px rgba(25,55,44,.05); }
    .ape-question-index { width:28px; height:28px; border-radius:9px; display:grid; place-items:center; background:#eef6f2; color:#167352; font-size:12px; font-weight:800; }
    .ape-question-label { color:#1c3028; font-size:13px; line-height:1.55; font-weight:720; }
    .ape-required { color:#c95b3f; margin-left:4px; }
    .ape-question-why { margin-top:3px; color:#74867e; font-size:11px; line-height:1.5; }
    .ape-question-input, .ape-continue-input { width:100%; margin-top:9px; border:1px solid #ccdcd4; border-radius:11px; background:#fbfdfc; color:#10231d; padding:10px 11px; outline:none; font:inherit; font-size:12px; line-height:1.55; resize:vertical; transition:.18s ease; }
    .ape-question-input { min-height:66px; }
    .ape-question-input:focus, .ape-continue-input:focus { border-color:#3a9b73; box-shadow:0 0 0 3px rgba(58,155,115,.13); background:#fff; }
    .ape-clarify-actions, .ape-result-actions { display:flex; gap:9px; flex-wrap:wrap; justify-content:flex-end; margin-top:15px; }
    .ape-btn { border:1px solid #ccd9d3; background:#fff; color:#20362d; border-radius:11px; padding:9px 13px; font-size:12px; font-weight:720; cursor:pointer; transition:transform .16s ease, box-shadow .16s ease, background .16s ease; }
    .ape-btn:hover { transform:translateY(-1px); box-shadow:0 8px 18px rgba(25,55,44,.08); }
    .ape-btn-primary { border-color:#123f35; background:#123f35; color:#fff; box-shadow:0 8px 18px rgba(18,63,53,.16); }
    .ape-btn-accent { border-color:#e4b75f; background:#fff8e9; color:#765016; }
    .ape-compare-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .ape-compare-box { height:min(36vh,360px); min-height:220px; border-radius:17px; padding:15px; overflow:auto; color:#243a31; font-size:12px; line-height:1.65; scrollbar-width:thin; scrollbar-color:#b8ccc2 transparent; }
    .ape-compare-original { border:1px solid #ead6cc; background:#fffaf7; }
    .ape-compare-optimized { border:1px solid #cfe3d8; background:#f5fbf8; }
    .ape-box-label { display:flex; align-items:center; gap:7px; color:#20372e; font-size:12px; font-weight:800; margin-bottom:10px; }
    .ape-box-dot { width:7px; height:7px; border-radius:999px; background:#c87551; }
    .ape-box-dot-green { background:#24936a; }
    .ape-diff-line { padding:3px 7px; border-radius:8px; min-height:1.5em; }
    .ape-diff-insert { background:rgba(38,164,111,.13); color:#145e43; }
    .ape-diff-delete { background:rgba(204,101,71,.1); color:#8f3f2c; text-decoration:line-through; }
    .ape-partial-title { display:flex; align-items:center; justify-content:space-between; margin:17px 0 9px; color:#20362d; font-size:13px; font-weight:780; }
    .ape-partial-box { border:1px solid #d8e4de; border-radius:16px; padding:11px; background:#f8fbf9; display:flex; flex-direction:column; gap:8px; max-height:230px; overflow:auto; }
    .ape-partial-item { display:flex; gap:9px; align-items:flex-start; padding:9px; border:1px solid #dce6e1; border-radius:12px; background:#fff; }
    .ape-partial-item input { margin-top:3px; accent-color:#167653; }
    .ape-partial-body { color:#3e5149; line-height:1.6; font-size:12px; flex:1; }
    .ape-continue-row { display:flex; gap:9px; align-items:center; margin-top:13px; }
    .ape-continue-input { margin-top:0; min-height:39px; resize:none; }
    .ape-continue-row .ape-btn { white-space:nowrap; }
    .ape-empty-state { padding:20px; border:1px dashed #bfd4ca; border-radius:15px; background:#f7fbf8; text-align:center; color:#567067; font-size:12px; line-height:1.7; }
    @media (max-width: 780px) {
      .ape-dialog-header, .ape-dialog-toolbar, .ape-stage { padding-left:16px; padding-right:16px; }
      .ape-dialog-toolbar { align-items:flex-start; flex-direction:column; }
      .ape-dialog-status { text-align:left; }
      .ape-clarify-layout, .ape-compare-grid { grid-template-columns:1fr; }
      .ape-conversation { max-height:230px; }
      .ape-continue-row { align-items:stretch; flex-direction:column; }
    }
  `
  document.documentElement.appendChild(style)
}

export class PreviewDialog {
  private host: HTMLDivElement
  private panel: HTMLDivElement
  private status: HTMLDivElement
  private progressWrap: HTMLDivElement
  private progressBar: HTMLDivElement
  private progressText: HTMLDivElement
  private intentInsight: HTMLDivElement
  private directFlowButton: HTMLButtonElement
  private clarifyFlowButton: HTMLButtonElement
  private clarifyStage: HTMLDivElement
  private conversationBox: HTMLDivElement
  private questionList: HTMLDivElement
  private questionCount: HTMLDivElement
  private resultStage: HTMLDivElement
  private originalBox: HTMLDivElement
  private optimizedBox: HTMLDivElement
  private continueInput: HTMLTextAreaElement
  private partialBox: HTMLDivElement
  private undoSnapshot: EditorSnapshot | null = null
  private currentAdapter: EditableAdapter | null = null
  private currentSourceText = ''
  private currentOptimizedText = ''
  private currentMode?: EnhanceMode
  private currentSkillId?: string
  private currentHostname = ''
  private currentRequestId = ''
  private currentWorkflow: EnhancementWorkflow = 'direct'
  private historyId?: string
  private selectedParagraphs = new Set<number>()
  private clarificationAnswers: ClarificationAnswer[] = []
  private activeQuestions: ClarificationQuestion[] = []
  private answerInputs = new Map<string, HTMLTextAreaElement>()
  private clarificationSummary = ''
  private progressTimer: number | undefined
  private progressStartedAt = 0
  private isStreaming = false

  constructor() {
    ensurePreviewStyles()
    this.host = document.createElement('div')
    this.host.dataset.apeTestid = 'compare-dialog'
    this.host.dataset.apeRoot = 'compare-dialog'
    Object.assign(this.host.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(12, 27, 21, .56)',
      backdropFilter: 'blur(8px)',
      zIndex: '2147483647',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '18px',
    } satisfies Partial<CSSStyleDeclaration>)

    this.panel = document.createElement('div')
    this.panel.className = 'ape-dialog-panel'
    Object.assign(this.panel.style, {
      width: 'min(1080px, 96vw)',
      maxHeight: '92vh',
      overflow: 'auto',
      background: '#ffffff',
      borderRadius: '22px',
      border: '1px solid rgba(214, 229, 221, .95)',
      boxShadow: '0 34px 90px rgba(9, 31, 22, .28)',
      fontFamily: '"Segoe UI Variable", "PingFang SC", "Microsoft YaHei", sans-serif',
    } satisfies Partial<CSSStyleDeclaration>)

    const header = document.createElement('div')
    header.className = 'ape-dialog-header'
    const brand = document.createElement('div')
    brand.className = 'ape-dialog-brand'
    const mark = document.createElement('div')
    mark.className = 'ape-dialog-mark'
    mark.textContent = '✦'
    const heading = document.createElement('div')
    const title = document.createElement('h2')
    title.className = 'ape-dialog-title'
    title.textContent = '把模糊需求变成可执行指令'
    const subtitle = document.createElement('div')
    subtitle.className = 'ape-dialog-subtitle'
    subtitle.textContent = '可直接增强，也可先通过追问确认目标、约束和交付标准。原输入在你确认前不会被修改。'
    heading.append(title, subtitle)
    brand.append(mark, heading)
    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'ape-dialog-close'
    closeButton.setAttribute('aria-label', '关闭')
    closeButton.textContent = '×'
    closeButton.addEventListener('click', () => this.close())
    header.append(brand, closeButton)

    const toolbar = document.createElement('div')
    toolbar.className = 'ape-dialog-toolbar'
    const flowSwitch = document.createElement('div')
    flowSwitch.className = 'ape-flow-switch'
    this.directFlowButton = this.createFlowButton('⚡ 直接增强', 'direct')
    this.clarifyFlowButton = this.createFlowButton('◌ 先追问意图', 'clarify')
    flowSwitch.append(this.directFlowButton, this.clarifyFlowButton)
    this.status = document.createElement('div')
    this.status.dataset.apeTestid = 'compare-status'
    this.status.className = 'ape-dialog-status'
    toolbar.append(flowSwitch, this.status)

    this.progressWrap = document.createElement('div')
    this.progressWrap.dataset.apeTestid = 'enhance-progress'
    this.progressWrap.className = 'ape-progress'
    const progressTrack = document.createElement('div')
    progressTrack.className = 'ape-progress-track'
    this.progressBar = document.createElement('div')
    this.progressBar.dataset.apeTestid = 'enhance-progress-bar'
    this.progressBar.className = 'ape-progress-bar'
    this.progressText = document.createElement('div')
    this.progressText.dataset.apeTestid = 'enhance-progress-text'
    this.progressText.className = 'ape-progress-text'
    progressTrack.appendChild(this.progressBar)
    this.progressWrap.append(progressTrack, this.progressText)

    this.intentInsight = document.createElement('div')
    this.intentInsight.className = 'ape-intent-insight'
    this.intentInsight.dataset.apeTestid = 'intent-insight'

    this.clarifyStage = document.createElement('div')
    this.clarifyStage.className = 'ape-stage'
    this.clarifyStage.dataset.apeTestid = 'clarify-stage'
    const clarifyLayout = document.createElement('div')
    clarifyLayout.className = 'ape-clarify-layout'
    this.conversationBox = document.createElement('div')
    this.conversationBox.className = 'ape-conversation'
    this.conversationBox.dataset.apeTestid = 'clarify-conversation'
    const questionColumn = document.createElement('div')
    const questionHead = document.createElement('div')
    questionHead.className = 'ape-question-head'
    const questionHeading = document.createElement('div')
    questionHeading.innerHTML = '<div class="ape-section-kicker">Intent interview</div><h3 class="ape-section-title">补齐真正影响结果的信息</h3>'
    this.questionCount = document.createElement('div')
    this.questionCount.className = 'ape-question-count'
    questionHead.append(questionHeading, this.questionCount)
    this.questionList = document.createElement('div')
    this.questionList.className = 'ape-question-list'
    this.questionList.dataset.apeTestid = 'clarification-questions'
    const clarifyActions = document.createElement('div')
    clarifyActions.className = 'ape-clarify-actions'
    clarifyActions.append(
      this.createButton('跳过追问', () => void this.skipClarification(), false, 'skip-clarification'),
      this.createButton('再问一轮', () => void this.askAnotherRound(), false, 'clarify-next-round', 'accent'),
      this.createButton('生成增强提示词', () => void this.generateFromClarification(), true, 'clarify-generate'),
    )
    questionColumn.append(questionHead, this.questionList, clarifyActions)
    clarifyLayout.append(this.conversationBox, questionColumn)
    this.clarifyStage.appendChild(clarifyLayout)

    this.resultStage = document.createElement('div')
    this.resultStage.className = 'ape-stage'
    const compareGrid = document.createElement('div')
    compareGrid.className = 'ape-compare-grid'
    this.originalBox = document.createElement('div')
    this.originalBox.dataset.apeTestid = 'compare-original'
    this.originalBox.className = 'ape-compare-box ape-compare-original'
    this.optimizedBox = document.createElement('div')
    this.optimizedBox.dataset.apeTestid = 'compare-optimized'
    this.optimizedBox.className = 'ape-compare-box ape-compare-optimized'
    compareGrid.append(this.originalBox, this.optimizedBox)

    const partialTitle = document.createElement('div')
    partialTitle.className = 'ape-partial-title'
    partialTitle.innerHTML = '<span>部分接受</span><span style="font-size:11px;color:#73857d;font-weight:500">只勾选你满意的段落</span>'
    this.partialBox = document.createElement('div')
    this.partialBox.dataset.apeTestid = 'partial-box'
    this.partialBox.className = 'ape-partial-box'

    const continueRow = document.createElement('div')
    continueRow.className = 'ape-continue-row'
    this.continueInput = document.createElement('textarea')
    this.continueInput.dataset.apeTestid = 'continue-input'
    this.continueInput.className = 'ape-continue-input'
    this.continueInput.rows = 1
    this.continueInput.placeholder = '继续优化，例如：再简洁一些 / 增加错误处理示例'
    continueRow.append(
      this.continueInput,
      this.createButton('继续优化', () => void this.continueOptimize(), true, 'continue-optimize'),
    )

    const actions = document.createElement('div')
    actions.className = 'ape-result-actions'
    actions.append(
      this.createButton('复制结果', () => void this.copy(), false, 'copy-optimized'),
      this.createButton('部分接受', () => void this.acceptSelected(true), false, 'partial-accept'),
      this.createButton('拒绝', () => this.close(), false, 'reject-optimized'),
      this.createButton('撤销替换', () => void this.undo(), false, 'undo-replace'),
      this.createButton('接受优化', () => void this.acceptSelected(false), true, 'accept-optimized'),
    )
    this.resultStage.append(compareGrid, actions, continueRow, partialTitle, this.partialBox)

    this.panel.append(header, toolbar, this.progressWrap, this.intentInsight, this.clarifyStage, this.resultStage)
    this.host.appendChild(this.panel)
    this.host.addEventListener('click', (event) => {
      if (event.target === this.host) this.close()
    })
    document.documentElement.appendChild(this.host)
  }

  private createFlowButton(label: string, workflow: EnhancementWorkflow) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ape-flow-option'
    button.dataset.apeTestid = `workflow-${workflow}`
    button.textContent = label
    button.addEventListener('click', () => {
      if (this.currentWorkflow === workflow) return
      void this.activateWorkflow(workflow, true)
    })
    return button
  }

  private createButton(
    label: string,
    onClick: () => void,
    primary = false,
    testid?: string,
    tone?: 'accent',
  ) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.className = `ape-btn ${primary ? 'ape-btn-primary' : ''} ${tone === 'accent' ? 'ape-btn-accent' : ''}`.trim()
    if (testid) button.dataset.apeTestid = testid
    button.addEventListener('click', onClick)
    return button
  }

  private updateWorkflowUi() {
    this.directFlowButton.dataset.active = String(this.currentWorkflow === 'direct')
    this.clarifyFlowButton.dataset.active = String(this.currentWorkflow === 'clarify')
  }

  private async activateWorkflow(workflow: EnhancementWorkflow, request: boolean) {
    this.currentRequestId = ''
    this.stopProgress(false)
    this.currentWorkflow = workflow
    this.updateWorkflowUi()
    this.clearIntentInsight()
    this.selectedParagraphs.clear()
    this.currentOptimizedText = ''
    if (!request) return
    if (workflow === 'clarify') {
      this.clarificationAnswers = []
      this.activeQuestions = []
      this.clarificationSummary = ''
      await this.requestClarification()
    } else {
      await this.requestEnhancement()
    }
  }

  private startProgress(message: string): void {
    this.stopProgress(false)
    this.progressStartedAt = Date.now()
    this.progressWrap.style.display = 'block'
    this.progressBar.style.width = '8%'
    this.progressText.textContent = message
    this.progressTimer = window.setInterval(() => {
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - this.progressStartedAt) / 1000))
      const width = Math.min(this.isStreaming ? 96 : 88, 8 + elapsedSeconds * (this.isStreaming ? 5 : 3))
      this.progressBar.style.width = `${width}%`
      const phase = this.isStreaming ? '模型正在流式返回内容' : elapsedSeconds < 20 ? '正在理解上下文' : '仍在处理中'
      this.progressText.textContent = `已等待 ${elapsedSeconds} 秒 · ${phase}`
    }, 1000)
  }

  private stopProgress(complete = true, message = '处理完成'): void {
    if (this.progressTimer !== undefined) {
      window.clearInterval(this.progressTimer)
      this.progressTimer = undefined
    }
    if (complete) {
      this.progressBar.style.width = '100%'
      this.progressText.textContent = message
      window.setTimeout(() => {
        this.progressWrap.style.display = 'none'
      }, 500)
    } else {
      this.progressWrap.style.display = 'none'
    }
    this.isStreaming = false
  }

  private clearIntentInsight(): void {
    this.intentInsight.replaceChildren()
    this.intentInsight.style.display = 'none'
    delete this.intentInsight.dataset.needsClarification
  }

  private renderIntentInsight(insight: IntentInsight): void {
    this.clearIntentInsight()
    const summary = insight.intentSummary?.trim() ?? ''
    const missing = [...new Set(insight.missingInformation.map((item) => item.trim()).filter(Boolean))]
    if (!summary && missing.length === 0) return

    this.intentInsight.dataset.needsClarification = String(insight.needsClarification)
    const head = document.createElement('div')
    head.className = 'ape-intent-head'
    const title = document.createElement('div')
    title.className = 'ape-intent-title'
    title.textContent = 'AI 对当前需求的理解'
    const badge = document.createElement('div')
    badge.className = 'ape-intent-badge'
    badge.textContent = insight.needsClarification ? '发现可能影响结果的关键信息缺口' : '信息完整度良好'
    head.append(title, badge)
    this.intentInsight.appendChild(head)

    if (summary) {
      const summaryNode = document.createElement('div')
      summaryNode.className = 'ape-intent-summary'
      summaryNode.textContent = summary
      this.intentInsight.appendChild(summaryNode)
    }

    if (missing.length > 0) {
      const label = document.createElement('div')
      label.className = 'ape-intent-hint'
      label.style.marginTop = '9px'
      label.textContent = '建议补充：'
      const list = document.createElement('ul')
      list.className = 'ape-intent-missing'
      missing.forEach((item) => {
        const entry = document.createElement('li')
        entry.textContent = item
        list.appendChild(entry)
      })
      this.intentInsight.append(label, list)
    }

    if (insight.needsClarification) {
      const actions = document.createElement('div')
      actions.className = 'ape-intent-actions'
      const clarifyButton = document.createElement('button')
      clarifyButton.type = 'button'
      clarifyButton.className = 'ape-btn ape-btn-accent'
      clarifyButton.dataset.apeTestid = 'enter-clarification'
      clarifyButton.textContent = '进入追问模式'
      clarifyButton.addEventListener('click', () => void this.activateWorkflow('clarify', true))
      const hint = document.createElement('span')
      hint.className = 'ape-intent-hint'
      hint.textContent = '当前结果仍可直接接受，原始输入不会自动替换。'
      actions.append(clarifyButton, hint)
      this.intentInsight.appendChild(actions)
    }
    this.intentInsight.style.display = 'block'
  }

  private renderConversation() {
    const prior = this.clarificationAnswers
      .map(
        (item) =>
          `<div class="ape-message ape-message-ai"><strong>${escapeHtml(item.question)}</strong><div class="ape-message-answer">${renderMarkdownDocumentHtml(item.answer)}</div></div>`,
      )
      .join('')
    this.conversationBox.innerHTML = `
      <div class="ape-conversation-label">你的原始需求</div>
      <div class="ape-message ape-message-user">${renderMarkdownDocumentHtml(this.currentSourceText)}</div>
      ${prior ? `<div class="ape-conversation-label">已经确认</div>${prior}` : ''}
      <div class="ape-conversation-label">AI 当前理解</div>
      <div class="ape-message ape-message-ai">${renderMarkdownDocumentHtml(this.clarificationSummary || '正在分析你的目标与缺失信息…')}</div>
    `
  }

  private renderClarification() {
    this.renderConversation()
    this.questionList.innerHTML = ''
    this.answerInputs.clear()
    this.questionCount.textContent = this.activeQuestions.length ? `${this.activeQuestions.length} 个问题` : '信息已清楚'
    if (this.activeQuestions.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'ape-empty-state'
      empty.innerHTML = '<strong style="color:#123f35">当前信息已经足够</strong><br>可以直接生成结构化提示词；如果还有特殊要求，也可以切回追问继续补充。'
      this.questionList.appendChild(empty)
      return
    }

    this.activeQuestions.forEach((question, index) => {
      const card = document.createElement('label')
      card.className = 'ape-question-card'
      const number = document.createElement('div')
      number.className = 'ape-question-index'
      number.textContent = String(index + 1).padStart(2, '0')
      const body = document.createElement('div')
      const questionLabel = document.createElement('div')
      questionLabel.className = 'ape-question-label'
      questionLabel.innerHTML = `${escapeHtml(question.question)}${question.required ? '<span class="ape-required">*</span>' : ''}`
      body.appendChild(questionLabel)
      if (question.why) {
        const why = document.createElement('div')
        why.className = 'ape-question-why'
        why.textContent = question.why
        body.appendChild(why)
      }
      const input = document.createElement('textarea')
      input.className = 'ape-question-input'
      input.dataset.apeTestid = `clarification-answer-${index}`
      input.placeholder = question.placeholder || '输入你的回答；不确定时可填写“由 AI 建议”'
      this.answerInputs.set(question.id, input)
      body.appendChild(input)
      card.append(number, body)
      this.questionList.appendChild(card)
    })
  }

  private collectAnswers(requireRequired: boolean): ClarificationAnswer[] | null {
    const next: ClarificationAnswer[] = []
    for (const question of this.activeQuestions) {
      const answer = this.answerInputs.get(question.id)?.value.trim() ?? ''
      if (requireRequired && question.required && !answer) {
        this.status.textContent = `请先回答必答项：“${question.question}”`
        this.answerInputs.get(question.id)?.focus()
        return null
      }
      if (answer) {
        const sensitive = detectSensitiveText(answer)
        if (sensitive.blocked) {
          this.status.textContent = '回答中检测到 API Key、令牌等敏感信息，已阻止发送。'
          this.answerInputs.get(question.id)?.focus()
          return null
        }
        next.push({ questionId: question.id, question: question.question, answer })
      }
    }
    const merged = new Map(this.clarificationAnswers.map((item) => [item.questionId, item]))
    next.forEach((item) => merged.set(item.questionId, item))
    return [...merged.values()]
  }

  private async requestClarification(): Promise<void> {
    const requestId = crypto.randomUUID()
    this.currentRequestId = requestId
    this.clarifyStage.style.display = 'block'
    this.resultStage.style.display = 'none'
    this.status.textContent = '追问模式 · AI 只会询问真正影响结果的信息'
    this.clarificationSummary ||= '正在分析你的目标与缺失信息…'
    this.renderClarification()
    this.startProgress('正在理解原始需求，并筛选高价值追问…')
    let response:
      | { ok: true; data: ClarifyResponse }
      | { ok: false; error: { message: string } }
    try {
      response = (await chrome.runtime.sendMessage({
        type: 'APE_CLARIFY_INTENT',
        payload: {
          sourceText: this.currentSourceText,
          mode: this.currentMode,
          skillId: this.currentSkillId,
          previousAnswers: this.clarificationAnswers,
          requestId,
        },
      })) as typeof response
    } catch (error) {
      if (requestId !== this.currentRequestId) return
      this.stopProgress(false)
      this.status.textContent = error instanceof Error ? error.message : '追问分析失败，请稍后再试'
      return
    }
    if (requestId !== this.currentRequestId) return
    if (!response?.ok) {
      this.stopProgress(false)
      this.status.textContent = response?.error?.message ?? '追问分析失败，请检查 Provider 与 API Key'
      return
    }
    this.clarificationSummary = response.data.summary
    this.activeQuestions = response.data.questions
    this.renderClarification()
    this.stopProgress(true, '意图分析完成')
    this.status.textContent = response.data.readyToEnhance
      ? 'AI 判断信息已足够，可以生成增强提示词。'
      : `请回答 ${response.data.questions.length} 个关键问题，然后生成提示词或继续追问。`
  }

  handleClarifyStream(requestId: string, partial: string): void {
    if (!requestId || requestId !== this.currentRequestId) return
    this.isStreaming = true
    const previewLength = Math.max(1, partial.trim().length)
    this.progressWrap.style.display = 'block'
    this.progressBar.style.width = `${Math.min(94, 20 + Math.log2(previewLength + 1) * 9)}%`
    this.progressText.textContent = `正在分析意图 · 已接收 ${previewLength} 个字符`
  }

  private async askAnotherRound() {
    const answers = this.collectAnswers(true)
    if (!answers) return
    this.clarificationAnswers = answers
    await this.requestClarification()
  }

  private async generateFromClarification() {
    const answers = this.collectAnswers(true)
    if (!answers) return
    this.clarificationAnswers = answers
    await this.requestEnhancement(undefined, answers)
  }

  private async skipClarification() {
    const answers = this.collectAnswers(false)
    if (answers) this.clarificationAnswers = answers
    await this.requestEnhancement(undefined, this.clarificationAnswers)
  }

  private renderLoading(): void {
    this.clearIntentInsight()
    this.originalBox.innerHTML = `<div class="ape-box-label"><span class="ape-box-dot"></span>原始提示词</div><div>${renderDiffHtml(
      this.currentSourceText,
      this.currentSourceText,
      'source',
    )}</div>`
    this.optimizedBox.innerHTML = '<div class="ape-box-label"><span class="ape-box-dot ape-box-dot-green"></span>优化后提示词</div><div class="ape-empty-state">正在构建结构、约束与验收标准…</div>'
    this.partialBox.innerHTML = '<div style="color:#6d8077;font-size:12px;padding:4px">结果返回后，可按段选择要采纳的内容。</div>'
  }

  private renderError(message: string): void {
    this.clearIntentInsight()
    this.optimizedBox.innerHTML = `<div class="ape-box-label"><span class="ape-box-dot ape-box-dot-green"></span>优化后提示词</div><div class="ape-empty-state" style="border-color:#e7c8bd;background:#fff8f5;color:#8c442f">${escapeHtml(message)}</div>`
    this.partialBox.innerHTML = '<div style="color:#6d8077;font-size:12px;padding:4px">当前没有可接受的结果，请检查 Provider、模型和 API Key。</div>'
  }

  private renderStreamPreview(partial: string): void {
    this.clearIntentInsight()
    const previewText = tryExtractEnhancedPrompt(partial) || partial
    this.originalBox.innerHTML = `<div class="ape-box-label"><span class="ape-box-dot"></span>原始提示词</div><div>${renderDiffHtml(
      this.currentSourceText,
      previewText,
      'source',
    )}</div>`
    this.optimizedBox.innerHTML = `<div class="ape-box-label"><span class="ape-box-dot ape-box-dot-green"></span>优化后提示词 · 流式预览</div><div>${renderMarkdownDocumentHtml(previewText) || '正在接收内容…'}</div>`
    this.partialBox.innerHTML = '<div style="color:#6d8077;font-size:12px;padding:4px">正在流式接收；完整结果返回后可接受、继续优化或部分接受。</div>'
  }

  private renderFinal(): void {
    this.originalBox.innerHTML = `<div class="ape-box-label"><span class="ape-box-dot"></span>原始提示词</div><div>${renderDiffHtml(
      this.currentSourceText,
      this.currentOptimizedText,
      'source',
    )}</div>`
    this.optimizedBox.innerHTML = `<div class="ape-box-label"><span class="ape-box-dot ape-box-dot-green"></span>优化后提示词</div><div>${renderDiffHtml(
      this.currentSourceText,
      this.currentOptimizedText,
      'target',
    )}</div>`

    const paragraphs = this.currentOptimizedText.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean)
    if (this.selectedParagraphs.size === 0) paragraphs.forEach((_, index) => this.selectedParagraphs.add(index))
    this.partialBox.innerHTML = ''
    paragraphs.forEach((paragraph, index) => {
      const label = document.createElement('label')
      label.className = 'ape-partial-item'
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.dataset.apeTestid = `partial-checkbox-${index}`
      input.checked = this.selectedParagraphs.has(index)
      input.addEventListener('change', () => {
        if (input.checked) this.selectedParagraphs.add(index)
        else this.selectedParagraphs.delete(index)
      })
      const body = document.createElement('div')
      body.className = 'ape-partial-body'
      body.innerHTML = renderMarkdownDocumentHtml(paragraph)
      label.append(input, body)
      this.partialBox.appendChild(label)
    })
  }

  handleStream(requestId: string, partial: string): void {
    if (!requestId || requestId !== this.currentRequestId) return
    this.isStreaming = true
    this.currentOptimizedText = partial
    const previewLength = Math.max(1, partial.trim().length)
    this.progressWrap.style.display = 'block'
    this.progressBar.style.width = `${Math.min(94, 18 + Math.log2(previewLength + 1) * 10)}%`
    this.progressText.textContent = `正在流式生成 · 已接收 ${previewLength} 个字符`
    this.status.textContent = '模型已开始返回内容，正在实时预览'
    this.renderStreamPreview(partial)
  }

  handleStatus(requestId: string, message: string): void {
    if (!requestId || requestId !== this.currentRequestId) return
    this.status.textContent = message
    this.progressWrap.style.display = 'block'
    this.progressBar.style.width = '54%'
    this.progressText.textContent = message
  }

  private async requestEnhancement(
    followUpInstruction?: string,
    clarificationContext: ClarificationAnswer[] = this.clarificationAnswers,
  ): Promise<void> {
    const requestId = crypto.randomUUID()
    this.currentRequestId = requestId
    this.clarifyStage.style.display = 'none'
    this.resultStage.style.display = 'block'
    this.status.textContent = clarificationContext.length
      ? `已带入 ${clarificationContext.length} 条意图信息，正在生成最终提示词`
      : '正在调用选定 Skill 与模型'
    this.renderLoading()
    this.startProgress('正在组织目标、上下文、约束和输出结构…')
    let response:
      | { ok: true; data: EnhanceResponseData }
      | { ok: false; error: { message: string } }
    try {
      response = (await chrome.runtime.sendMessage({
        type: 'APE_ENHANCE_TEXT',
        payload: {
          sourceText: this.currentSourceText,
          mode: this.currentMode,
          skillId: this.currentSkillId,
          hostname: this.currentHostname,
          followUpInstruction,
          previousEnhancedText: followUpInstruction ? this.currentOptimizedText : undefined,
          clarificationContext,
          workflow: clarificationContext.length ? 'clarify' : this.currentWorkflow,
          requestId,
        },
      })) as typeof response
    } catch (error) {
      if (requestId !== this.currentRequestId) return
      this.stopProgress(false)
      const message = error instanceof Error ? error.message : '调用失败，请重新加载扩展后再试'
      this.status.textContent = message
      this.renderError(message)
      return
    }
    if (requestId !== this.currentRequestId) return
    if (!response?.ok) {
      this.stopProgress(false)
      const message = response?.error?.message ?? '优化失败，请检查 Provider / API Key 配置'
      this.status.textContent = message
      this.renderError(message)
      return
    }

    this.historyId = response.data.historyId
    this.currentOptimizedText = response.data.enhancedPrompt
    this.selectedParagraphs.clear()
    this.renderFinal()
    this.renderIntentInsight(response.data)
    this.stopProgress(true, '优化完成')
    this.status.textContent = response.data.warnings.length
      ? `优化完成 · ${response.data.warnings.join('；')}`
      : '优化完成 · 原输入仍保持不变，等待你的确认'
  }

  async open(options: OpenPreviewOptions): Promise<void> {
    this.currentAdapter = options.adapter
    this.undoSnapshot = options.snapshot ?? null
    this.currentSourceText = options.sourceText
    this.currentMode = options.mode
    this.currentSkillId = options.skillId
    this.currentHostname = options.hostname
    this.currentOptimizedText = ''
    this.currentWorkflow = options.workflow ?? 'direct'
    this.historyId = undefined
    this.selectedParagraphs.clear()
    this.clarificationAnswers = []
    this.activeQuestions = []
    this.clarificationSummary = ''
    this.continueInput.value = ''
    this.host.style.display = 'flex'
    this.updateWorkflowUi()
    if (this.currentWorkflow === 'clarify') await this.requestClarification()
    else await this.requestEnhancement()
    if (options.copyOnly && this.currentOptimizedText) await this.copy()
  }

  private getAcceptedText(partial: boolean) {
    if (!partial) return this.currentOptimizedText
    const originalParagraphs = this.currentSourceText.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean)
    const optimizedParagraphs = this.currentOptimizedText.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean)
    const maxLength = Math.max(originalParagraphs.length, optimizedParagraphs.length)
    const merged: string[] = []
    for (let index = 0; index < maxLength; index += 1) {
      const useOptimized = this.selectedParagraphs.has(index) && optimizedParagraphs[index]
      const nextParagraph = useOptimized ? optimizedParagraphs[index] : originalParagraphs[index]
      if (nextParagraph) merged.push(nextParagraph)
    }
    return merged.join('\n\n')
  }

  private async acceptSelected(partial: boolean): Promise<void> {
    const acceptedText = this.getAcceptedText(partial)
    if (!acceptedText) {
      this.status.textContent = '请至少选择一个片段后再接受。'
      return
    }
    if (this.currentAdapter) {
      this.undoSnapshot = this.currentAdapter.snapshot()
      const ok = await this.currentAdapter.replaceText(acceptedText)
      this.status.textContent = ok ? '已应用优化结果。' : '应用失败，请改用复制。'
      if (ok) window.setTimeout(() => this.close(), 350)
    } else {
      await navigator.clipboard.writeText(acceptedText)
      this.status.textContent = '已复制接受后的内容。'
      window.setTimeout(() => this.close(), 350)
    }
    if (this.historyId) await chrome.runtime.sendMessage({ type: 'APE_MARK_HISTORY_ADOPTED', historyId: this.historyId })
  }

  private async continueOptimize(): Promise<void> {
    const instruction = this.continueInput.value.trim()
    if (!instruction) {
      this.status.textContent = '请先填写继续优化要求。'
      return
    }
    if (detectSensitiveText(instruction).blocked) {
      this.status.textContent = '继续优化要求中检测到敏感信息，已阻止发送。'
      return
    }
    await this.requestEnhancement(instruction, this.clarificationAnswers)
  }

  private async copy(): Promise<void> {
    if (!this.currentOptimizedText) return
    await navigator.clipboard.writeText(this.currentOptimizedText)
    this.status.textContent = '已复制优化结果。'
  }

  private async undo(): Promise<void> {
    if (!this.currentAdapter || !this.undoSnapshot) return
    const ok = await this.currentAdapter.restore(this.undoSnapshot)
    this.status.textContent = ok ? '已撤销替换。' : '撤销失败。'
  }

  close(): void {
    this.currentRequestId = ''
    this.stopProgress(false)
    this.host.style.display = 'none'
  }
}
