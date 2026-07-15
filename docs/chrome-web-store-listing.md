# Chrome Web Store 上架文案

## 中文短描述

在主流 AI 网页中安全增强提示词，支持 Skill、意图识别、对比确认、个人提示词库与对话导出。

## 中文详细描述

AI Prompt Enhancer 面向豆包、Kimi、通义千问、腾讯元宝、ChatGPT、Claude、Gemini、DeepSeek、Grok、Perplexity 等主流 AI 网页版，在用户明确触发后优化当前对话输入框中的提示词。

核心能力：

- 在受支持 AI 对话输入框上方显示可配置的轻量入口，不遮挡原站输入控件。
- 一次请求返回意图摘要、缺失信息与优化结果；只有关键字段缺失时才建议进入追问模式。
- 原始提示词与优化后提示词并列展示，支持接受、拒绝、继续优化和部分接受；确认前绝不替换输入框。
- 内置 Prompt Engineering Skill 库，并支持导入、编辑、启停和版本回滚。
- 支持 OpenAI、Anthropic、Gemini、Azure OpenAI、Ollama、DeepSeek、Kimi、通义千问、智谱、火山方舟及自定义兼容端点。
- 提供个人提示词库、本地优化历史和 Markdown / HTML / JSON / TXT / 可打印 PDF 对话导出。
- 可选的本地敏感信息检测会阻止疑似密钥、令牌或密码被发送。

隐私与控制：扩展不会默认读取整个网页，也不会自动上传用户的所有输入。只有用户点击增强时，当前提示词才会发送给用户自行配置的 AI Provider。API Key 默认在浏览器本地加密保存；历史记录可以关闭、清空或导出。扩展不运营开发者后端，不出售用户数据，也不用于广告画像。

## English short description

Safely enhance prompts on mainstream AI chat sites with Skills, intent analysis, side-by-side review, a prompt library, and exports.

## English detailed description

AI Prompt Enhancer improves prompts directly inside mainstream AI web apps including Doubao, Kimi, Qwen, Tencent Yuanbao, ChatGPT, Claude, Gemini, DeepSeek, Grok, Perplexity, Poe, and Mistral Le Chat.

Key features:

- A lightweight configurable launcher positioned above supported AI chat composers.
- One-request intent summary, missing-information analysis, and enhanced prompt output, with follow-up mode suggested only when critical context is missing.
- Before/after comparison with accept, reject, continue, and partial-accept controls. The original input is never replaced without confirmation.
- Built-in and user-imported Prompt Engineering Skills.
- Multiple AI providers and custom OpenAI-compatible endpoints.
- A personal prompt library, optional local history, and conversation export to Markdown, HTML, JSON, text, or printable PDF HTML.
- Optional local sensitive-text detection.

The extension does not read whole pages by default or upload every input automatically. Prompts are sent only after explicit user action and only to the provider configured by the user. API keys are encrypted locally by default.

## 单一用途说明

在用户明确触发时，帮助用户理解意图、优化和管理网页 AI 对话输入框中的提示词，并导出用户主动选择的当前可见对话内容。

## 权限说明

- `storage`：本地保存设置、加密 API Key、Skill、个人提示词库和可选历史。
- `activeTab` / `scripting`：在用户主动触发时访问或注入当前页面。
- `contextMenus`：提供右键增强入口。
- `sidePanel`：管理 Skill、Provider、历史和提示词库。
- 默认站点权限：仅覆盖 `docs/supported-sites.md` 中逐项列出的 AI 对话站点与少量工具站点，不使用 `<all_urls>`。
- 可选站点权限：仅在用户主动授权其他站点时使用。

## 截图清单

1. `qa-artifacts/popup.png`：Popup 配置入口。
2. `qa-artifacts/options.png`：设置与 Provider 配置。
3. `qa-artifacts/sidepanel-skills.png`：Skill 库。
4. `qa-artifacts/sidepanel-prompts.png`：个人提示词库。
5. `qa-artifacts/launcher-clip.png`：AI 输入框上方入口。
6. `qa-artifacts/compare-dialog.png`：原始/优化提示词对比确认。
7. `qa-artifacts/export-print-page.png`：可打印 PDF HTML。

## 支持邮箱占位

support@example.com（公开发布前必须替换为维护者真实支持邮箱）

## 版本说明

### 0.1.6

- 新增豆包、Kimi、通义千问、腾讯元宝、智谱清言、文心一言、讯飞星火、Grok、Perplexity、Poe、Mistral Le Chat 等主流 AI 网页版白名单。
- 统一 Manifest、后台页面校验和内容脚本的站点配置，避免支持范围不一致。
- 新增通用 Composer/ARIA/中英文 placeholder 输入框识别，并过滤会话搜索等非聊天输入框。
- 保持逐域名授权，不引入 `<all_urls>`。

### 0.1.5

- 增加从 GitHub Release 到 Chrome Web Store 的自动构建、验证、上传与提交流程。
- 用户端不展示源码托管或更新下载地址，商店版本由 Chrome 自动分发更新。

### 0.1.4

- 将输入框入口默认放在输入框上方，降低对文字、附件和发送按钮的遮挡。

### 0.1.3

- 非 AI 网站不再显示增强小球。

### 0.1.2

- 修复长输入和内部滚动时的入口位置漂移。

### 0.1.1

- 直接增强同时返回意图摘要、关键缺失信息和优化结果。

### 0.1.0

- 初版提示词增强、Skill、多 Provider、对比确认、提示词库、历史和对话导出。
