import type { ManifestV3Export } from '@crxjs/vite-plugin'

const supportedHosts = [
  'https://chatgpt.com/*',
  'https://chat.openai.com/*',
  'https://claude.ai/*',
  'https://gemini.google.com/*',
  'https://chat.deepseek.com/*',
  'https://copilot.microsoft.com/*',
  'https://github.com/*',
  'https://mail.google.com/*',
  'https://docs.google.com/*',
  'https://www.notion.so/*',
  'https://notion.so/*',
]

const providerApiHosts = [
  'https://api.openai.com/*',
  'https://api.anthropic.com/*',
  'https://generativelanguage.googleapis.com/*',
  'https://*.openai.azure.com/*',
  'https://api.deepseek.com/*',
  'https://api.moonshot.cn/*',
  'https://dashscope.aliyuncs.com/*',
  'https://open.bigmodel.cn/*',
  'https://api.siliconflow.cn/*',
  'https://ark.cn-beijing.volces.com/*',
  'http://127.0.0.1/*',
  'http://localhost/*',
]

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: '__MSG_appName__',
  description: '__MSG_appDescription__',
  version: '0.1.3',
  default_locale: 'zh_CN',
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  permissions: ['storage', 'contextMenus', 'activeTab', 'sidePanel', 'scripting'],
  host_permissions: [...supportedHosts, ...providerApiHosts],
  optional_host_permissions: ['https://*/*', 'http://*/*'],
  action: {
    default_popup: 'popup.html',
    default_title: '__MSG_appName__',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  options_page: 'options.html',
  side_panel: {
    default_path: 'sidepanel.html',
  },
  commands: {
    enhance_current_input: {
      suggested_key: {
        default: 'Ctrl+Shift+E',
        mac: 'Command+Shift+E',
      },
      description: '__MSG_commandEnhanceCurrentInput__',
    },
    open_prompt_library: {
      suggested_key: {
        default: 'Ctrl+Shift+L',
        mac: 'Command+Shift+L',
      },
      description: '__MSG_commandOpenPromptLibrary__',
    },
  },
  content_scripts: [
    {
      matches: supportedHosts,
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  web_accessible_resources: [
    {
      resources: ['icons/*'],
      matches: supportedHosts,
    },
  ],
}

export default manifest
