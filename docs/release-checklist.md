# 发布检查清单

最后更新：2026-07-14

## 自动化命令

在发布前必须全部通过：

```bash
npm run typecheck
npm run test:run
npm run lint
npm run build
npm run test:e2e
```

## dist 检查

- [ ] `dist/manifest.json` 存在且版本号正确。
- [ ] `dist` 中包含 popup、options、sidepanel、background service worker 与内容脚本产物。
- [ ] 不包含源码中的测试 fixture、真实 API Key、个人账号数据或调试缓存。
- [ ] 使用 `dist` 目录作为 unpacked extension 成功安装。

## Manifest 检查

- [ ] `permissions` 不包含不必要权限。
- [ ] 不包含 `tabs` 权限；如未来重新加入必须有明确必要性说明。
- [ ] 不包含 `<all_urls>`。
- [ ] 默认 `host_permissions` 仅覆盖明确支持站点。
- [ ] `optional_host_permissions` 用于用户主动启用其他网站。
- [ ] `content_scripts.matches` 与 `web_accessible_resources.matches` 不使用泛化全站匹配。

## E2E 检查

- [ ] 使用真实 `dist` 加载 unpacked extension。
- [ ] 使用本地 fixture，不调用真实 OpenAI/Claude/Gemini/Ollama 等 API。
- [ ] popup、options、sidepanel 均可打开。
- [ ] fixture 输入框旁出现绿色小球。
- [ ] 点击增强后出现“原始提示词 / 优化后提示词”对比视图。
- [ ] 接受前和拒绝后不替换输入框。
- [ ] 接受后替换为优化结果。
- [ ] 继续优化携带原始提示词和上一轮结果。
- [ ] 部分接受保留未选原始段落。
- [ ] 保存提示词写入独立个人提示词库，不写入模板库。
- [ ] Markdown / HTML / JSON / TXT 导出生成文件。
- [ ] PDF 路径打开可打印 HTML 页面并保留代码块样式。

## 隐私政策检查

- [ ] 说明只处理用户显式触发的文本。
- [ ] 说明不默认读取整个网页、不默认记录所有输入。
- [ ] 说明 Prompt 会发送给用户配置的 AI Provider。
- [ ] 说明 API Key 默认本地加密保存。
- [ ] 说明历史默认本地保存且可关闭、清空、导出。
- [ ] 说明 GitHub Skill 导入只读取用户指定仓库/文件。
- [ ] 说明对话导出只在用户点击后读取当前页面可见 DOM。
- [ ] 说明不出售用户数据、不用于广告画像。

## 截图检查

- [ ] 截图来自真实加载的 `dist` 扩展。
- [ ] 截图不包含真实 API Key、邮箱或个人隐私数据。
- [ ] `compare-dialog.png` 可见“原始提示词”和“优化后提示词”。
- [ ] `sidepanel-prompts.png` 可见独立个人提示词库。
- [ ] `export-print-page.png` 可见代码块样式。

## ZIP 打包检查

- [ ] 只打包 `dist` 内容，不把整个项目、`node_modules`、测试缓存或个人 profile 打进 ZIP。
- [ ] ZIP 根目录直接包含 `manifest.json`，而不是多嵌套一层目录。
- [ ] 在干净 Chromium/Chrome 中从 ZIP 解压后的目录可作为 unpacked extension 加载。

## 上架前人工确认项

- [ ] 替换 Chrome Web Store 支持邮箱占位。
- [ ] 准备正式图标、推广图、至少 5 张商店截图。
- [ ] 人工核对隐私政策 URL 与商店 Data Usage 表单一致。
- [ ] 人工确认默认支持站点列表和商店权限说明一致。
- [ ] 人工确认所有第三方 AI Provider 的品牌名称、描述和使用方式准确。
- [ ] 使用测试 API Key 在真实 Provider 上做一次人工冒烟，但不要把 Key 写入截图或提交包。

## Automatic update delivery

- [ ] The Chrome Web Store item has completed its initial manual publication.
- [ ] The `chrome-web-store` environment contains all five `CWS_*` encrypted secrets.
- [ ] The release tag exactly matches `v` plus the version in `dist/manifest.json`.
- [ ] The publish workflow uploads the ZIP and submits the item for review.
- [ ] The built extension does not contain the project repository address or a release download address.
