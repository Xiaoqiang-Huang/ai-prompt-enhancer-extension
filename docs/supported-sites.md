# 支持的 AI 网页版

扩展只在明确列入白名单的 AI 对话网站加载输入框增强入口，不使用 `<all_urls>`。站点清单由 `src/shared/supported-sites.ts` 统一维护，Manifest、后台页面校验和输入框检测共用同一份配置，避免权限与运行逻辑不一致。

## 中国大陆常用产品

- 豆包、Dola
- Kimi
- 通义千问
- 腾讯元宝
- 智谱清言
- 文心一言 / ERNIE
- 海螺 AI、MiniMax
- 讯飞星火
- 天工 AI
- 秘塔 AI 搜索
- 360 AI / 纳米 AI
- ima、Coze

## 国际常用产品

- ChatGPT、Claude、Google Gemini、Google AI Studio
- DeepSeek、Microsoft Copilot
- Grok、Perplexity、Poe
- Mistral Le Chat、Meta AI、You.com
- HuggingChat、Genspark、Manus

## 输入框识别策略

1. ChatGPT、Claude、Gemini、DeepSeek、Copilot 使用站点专用选择器。
2. 其他白名单站点使用统一的 Composer、`textarea`、`contenteditable`、ARIA 和中英文 placeholder 规则。
3. 普通搜索框、邮箱、网址输入框不会被当作对话输入框。
4. 白名单之外的网站不会显示小球；如未来需要支持新站点，应新增明确域名并完成 fixture 回归，而不是扩大为 `<all_urls>`。

网页结构可能随产品升级而变化。如果入口未出现，可先刷新网页和重新加载扩展，再在项目 Issue 中提供站点名称、页面地址和脱敏截图。
