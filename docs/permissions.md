# 权限说明

最后更新：2026-07-14

本扩展遵循权限最小化原则：默认只在明确支持的 AI/写作站点注入内容脚本；其他站点需要用户主动触发或授权。`dist/manifest.json` 中不包含 `<all_urls>`，也不请求 `tabs` 权限。

| 权限名 | 用途 | 为什么必要 | 是否可选 | 触发时机 |
| --- | --- | --- | --- | --- |
| `storage` | 保存设置、Provider 配置、加密后的 API Key、Skill、个人提示词库、优化历史 | 扩展需要在本地持久化用户配置和用户主动保存的内容 | 必需 | 安装后配置、保存提示词、保存历史、导入 Skill 时 |
| `activeTab` | 对用户当前激活页面执行一次性操作 | 用户在非默认站点主动点击扩展或菜单时，需要临时访问当前页面输入框 | 必需 | 用户点击扩展按钮、右键菜单或快捷入口时 |
| `scripting` | 动态注入内容脚本到当前标签页 | 默认未覆盖或尚未加载内容脚本的页面，需要在用户触发后注入交互层 | 必需 | 用户从 popup、右键菜单或快捷键触发增强时 |
| `contextMenus` | 提供右键菜单增强选中文本/当前输入 | 让用户在网页选中文本后直接触发增强或复制模式 | 必需 | 扩展安装后注册菜单，用户右键点击时使用 |
| `sidePanel` | 打开侧边栏管理 Skill、Provider、提示词库和历史 | Chrome 侧边栏是扩展主要管理界面之一 | 必需 | 用户点击扩展入口或浏览器侧边栏时 |
| `downloads` | 当前版本未请求该权限；导出通过浏览器 Blob/锚点下载实现 | 当前导出不需要 Chrome Downloads API | 不请求 | 不适用 |
| 默认 `host_permissions` | `chatgpt.com`、`chat.openai.com`、`claude.ai`、`gemini.google.com`、`chat.deepseek.com`、`copilot.microsoft.com`、`github.com`、`mail.google.com`、`docs.google.com`、`notion.so`、`www.notion.so` | 这些是默认支持的 AI、写作和协作站点，需在输入框旁显示绿色小球和导出当前可见对话 | 必需但范围收窄 | 用户访问这些明确支持站点时 |
| Provider API `host_permissions` | OpenAI、Anthropic、Gemini、Azure OpenAI、DeepSeek、Moonshot、通义千问、智谱、SiliconFlow、火山方舟官方 API 域名，以及 `localhost` / `127.0.0.1` | 后台 Service Worker 必须拥有对应源权限才能向用户主动配置的 Provider 发出增强请求；这些权限不会注入网页内容脚本 | 核心 Provider 必需 | 用户点击增强或测试连接时 |
| `optional_host_permissions`：`https://*/*`、`http://*/*` | 用户选择在其他网站启用扩展功能 | 避免默认请求所有网站权限，同时允许用户按需扩展适用范围 | 可选 | 用户在其他网站主动授权或触发动态访问时 |
| `content_scripts.matches` | 与默认 `host_permissions` 相同 | 只在默认支持站点自动加载输入框检测和绿色小球 | 必需但范围收窄 | 页面加载时 |
| `web_accessible_resources.matches` | 与默认 `host_permissions` 相同 | 内容脚本需要加载扩展内部资源 | 必需但范围收窄 | 默认支持站点加载内容脚本时 |
