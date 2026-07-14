# Security Policy

## Reporting a vulnerability

请不要在公开 Issue 中发布 API Key、Cookie、可复现的敏感提示词或完整利用细节。请通过维护者邮箱私下报告，并提供：

- 受影响版本
- 复现步骤
- 影响范围
- 脱敏后的日志或截图

支持邮箱目前使用占位地址：`support@example.com`。在正式公开发布前请替换为维护者实际邮箱。

## 安全设计边界

- API Key 只保存在用户本地扩展存储中并加密保存。
- GitHub Skill 导入只解析配置文本，不执行远程代码。
- 默认不使用 `<all_urls>`，不请求 `tabs` 权限。
- 增强请求只有在用户显式触发后才发送到用户配置的 Provider。
