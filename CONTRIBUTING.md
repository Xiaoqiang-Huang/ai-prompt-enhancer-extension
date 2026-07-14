# Contributing

感谢参与 AI Prompt Enhancer。项目目前以 Chrome MV3、React、TypeScript、Vite 为主要技术栈。

## 开发流程

```bash
npm install
npm run dev
```

提交前请运行：

```bash
npm run typecheck
npm run test:run
npm run lint
npm run build
npm run test:e2e
```

## 提交内容建议

- 新增 Skill 时，说明用途、变量、触发条件和来源；不要提交远程可执行代码。
- 新增 Provider 兼容逻辑时，补充脱敏的请求/响应 fixture 和单元测试。
- 修改输入框定位或浮球布局时，同时检查 ChatGPT、Claude、Gemini、DeepSeek 和本地 fixture。
- 不要提交 API Key、Cookie、浏览器 profile、下载文件或本机路径。
- UI 变化请附上不含隐私数据的截图或录屏说明。

## Pull Request

请在 PR 中说明变更目的、影响范围、验证命令和仍未覆盖的风险。默认使用 draft PR，确认没有真实凭据和本机数据后再转为 ready for review。
