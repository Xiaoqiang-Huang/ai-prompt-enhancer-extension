# Chrome Web Store 上架文案

## 中文短描述

在常用 AI 与写作网页中安全增强提示词，支持 Skill、对比确认、历史、个人提示词库与对话导出。

## 中文详细描述

AI Prompt Enhancer 是一款面向 ChatGPT、Claude、Gemini、DeepSeek、Copilot、GitHub、Gmail、Google Docs、Notion 等常用网页的提示词优化扩展。

核心能力：

- 在输入框旁显示可配置的绿色加速小球，一键打开增强面板。
- 对当前提示词进行结构化增强，支持优化前后对比、差异高亮、接受、拒绝、继续优化与部分接受。
- 内置 Prompt Engineering Skill 库，并支持从 GitHub、JSON/YAML 文件或粘贴文本导入自定义 Skill。
- 支持 OpenAI、Anthropic、Google Gemini、Azure OpenAI、Ollama 与自定义兼容 API Provider。
- 保存个人提示词库，支持标签、分类、备注、复制和使用次数统计。
- 保存可关闭的本地优化历史，支持关闭原始文本保存。
- 导出当前可见对话为 Markdown、HTML、JSON、TXT 或可打印 PDF 页面。
- 本地敏感信息检测开启时，会阻止疑似密钥、令牌、密码等内容被增强发送。

隐私与控制：插件不会默认读取整个网页，不会自动上传所有输入，不运营自己的后端服务。只有当用户显式点击增强时，当前提示词才会发送给用户自己配置的 AI Provider。API Key 默认本地加密保存，历史记录可关闭、清空或导出。

## English short description

Safely enhance prompts on popular AI and writing sites with Skills, side-by-side review, history, prompt library, and exports.

## English detailed description

AI Prompt Enhancer helps you improve prompts directly on popular AI and writing websites such as ChatGPT, Claude, Gemini, DeepSeek, Copilot, GitHub, Gmail, Google Docs, and Notion.

Key features:

- A configurable green launcher next to supported text inputs.
- AI-powered prompt enhancement with before/after comparison, diff highlighting, accept, reject, continue enhancing, and partial accept.
- Built-in Prompt Engineering Skills plus custom Skill import from GitHub, JSON/YAML files, or pasted configuration text.
- Multiple AI providers including OpenAI, Anthropic, Google Gemini, Azure OpenAI, Ollama, and custom compatible endpoints.
- Personal prompt library with tags, categories, notes, copy action, and usage counts.
- Local optimization history that can be disabled; saving original text can also be disabled.
- Conversation export to Markdown, HTML, JSON, plain text, or printable PDF HTML.
- Local sensitive-text detection to block accidental enhancement of keys, tokens, or passwords when enabled.

Privacy and control: the extension does not read whole pages by default, does not upload every input automatically, and does not run a developer backend. Your prompt is sent only when you explicitly trigger enhancement, and only to the AI Provider you configure. API keys are stored locally with encryption by default.

## 单一用途说明

本扩展的单一用途是：在用户明确触发时，帮助用户优化、管理和导出网页中的提示词与当前可见对话内容。

## 权限说明摘要

- `storage`：本地保存设置、加密 API Key、Skill、个人提示词库和历史。
- `activeTab` / `scripting`：用户触发时在当前页面注入或调用提示词增强交互。
- `contextMenus`：提供右键菜单增强选中文本。
- `sidePanel`：提供 Skill、Provider、历史和提示词库管理界面。
- 默认站点权限：仅覆盖明确支持的 AI/写作站点。
- 可选站点权限：用户可为其他站点主动授权；默认不使用 `<all_urls>`。

## 截图清单

1. `qa-artifacts/popup.png`：扩展 popup。
2. `qa-artifacts/options.png`：设置页 Provider/隐私配置。
3. `qa-artifacts/sidepanel-skills.png`：侧边栏 Skill 库。
4. `qa-artifacts/sidepanel-prompts.png`：独立个人提示词库。
5. `qa-artifacts/launcher-clip.png`：网页输入框旁绿色小球。
6. `qa-artifacts/compare-dialog.png`：原始提示词/优化后提示词对比确认。
7. `qa-artifacts/export-print-page.png`：可打印 PDF HTML 页面。

## 支持邮箱占位

support@example.com（公开发布前必须替换为维护者实际邮箱）

## 版本说明

### 0.1.0

- 初版提示词增强工作流。
- 支持绿色小球、Skill 管理、多 Provider、对比确认、部分接受、个人提示词库、历史记录和对话导出。
- 完成权限最小化、隐私文档、E2E 验收与发布打包准备。
