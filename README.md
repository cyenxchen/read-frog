# Read Frog（自用版）

这是开源浏览器扩展 [Read Frog（陪读蛙）](https://github.com/mengxi-ream/read-frog) 的**个人自用版本**，不是官方版本，与官方没有关联。

它基于官方的发版代码，每 12 小时自动同步一次官方的新版本。在此基础上，去掉了依赖官方账号和官方服务的功能，以及推广内容，并加了几项自己用的改动。官方功能的说明请看[官方仓库](https://github.com/mengxi-ream/read-frog)和[官方文档](https://www.readfrog.app/zh/docs)。

## 去掉的官方功能

- **官方账号**：登录 readfrog.app、头像菜单、会话，都不再出现。扩展不会向 `api.readfrog.app` 发出任何请求。
- **内置 AI**：不再提供「内置 AI」和「高级内置 AI」这两个官方托管的 AI 提供商，以及它们的用量和额度面板。
- **云笔记 Notebase 和复习**：去掉了「保存到 Notebase」、间隔复习（SRS），以及自定义 AI 指令里的 Notebase 设置。
- **服务端 AI 字幕**：视频没有字幕时，不再提供「请求 AI 字幕」，也不再显示 AI 字幕额度。
- **套餐、升级和付费提示**：去掉了套餐徽章、「升级」按钮，以及报错里「去登录」「去升级」的跳转。
- **猜你想保存**：这个功能会在每次划词翻译时额外调用一次 AI，结果只能存进云笔记，所以一并去掉。
- **预置的 AI 提供商和合作商推广**：
  - 新装时不再预置 OpenAI、Jalapeno Cloud、IF API、DeepSeek，API 提供商列表默认是空的。
  - 合作商不再显示「$1 Free」「90% Off」这类推广徽章，也不再占推荐位，但仍可以手动添加。
- **网站入口**：
  - 设置页侧栏不再有「产品」分组（路线图、帮助与社区）和「PDF 翻译」外链。
  - 不再弹出 What's New 里的促销文章。
- **自动打开的网页**：安装后不再打开官网引导页，卸载后也不再打开问卷页。
- **闪卡字样**：扩展名称和描述里去掉了 Flashcards（闪卡）相关说法。

## 修改和新增的功能

- **按语言选择视频字幕**（新增，默认关闭，在「设置 → 视频字幕」里打开）：
  - 视频本身有你的目标语言字幕时，直接显示它，不再翻译。
  - 没有目标语言字幕、但有原语言字幕时，用原语言字幕来翻译。
  - 支持 YouTube、Netflix、X 和 B 站（B 站只认 UP 主上传的字幕）。
- **旧配置自动改接**：如果导入的配置里有功能在用内置 AI，读取时会自动改用你自己配置的 AI 提供商。没有可用的 AI 提供商时，翻译类功能改用谷歌或微软翻译，AI 指令则显示「选择提供商」，等你配好后自动接上。
- **新装默认值**：只带谷歌翻译和微软翻译，网页翻译、视频字幕、划词翻译、输入翻译开箱即用。AI 功能需要你自己添加 AI 提供商并填写 API key。
- **自动同步与发版**（GitHub Actions）：
  - `fork-sync-upstream.yml`：每 12 小时检查官方发版。发现新版本就合并进来，跑完检查、测试和构建，然后打标签发版。
  - `fork-release.yml`：推送 `v<版本>-fork.<n>` 标签时，构建 Chrome、Edge、Firefox 安装包，发布到 [Releases](../../releases)。

## 已知限制

- 设置里的 Google Drive 配置同步不能用，因为没有配置自己的 Google OAuth 客户端。在不同机器之间搬配置，请用「设置 → 偏好设置 → 手动配置同步」里的导出和导入。
- 安装包没有上架应用商店，Chrome 同步不会把它同步到你的其他电脑，也不会自动更新。

## 安装

1. 从 [Releases](../../releases) 下载最新版里对应浏览器的 zip，例如 `read-frogextension-<版本>-chrome.zip`，然后解压。
2. 打开扩展管理页（Chrome：`chrome://extensions`，Edge：`edge://extensions`），打开「开发者模式」。
3. 点「加载已解压的扩展程序」，选择解压出来的文件夹。

更新时，下载新版本解压到同一个文件夹，覆盖旧文件，再在扩展管理页点刷新。路径不变，扩展里的设置就会保留。

## 自己构建

```bash
pnpm install
WXT_SKIP_ENV_VALIDATION=true pnpm build      # 输出到 .output/chrome-mv3
WXT_SKIP_ENV_VALIDATION=true pnpm zip:all    # 打包 Chrome、Edge、Firefox
```

## 开源协议

ReadFrog is dual-licensed under GPLv3 and a commercial license.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contributor licensing terms.

### 📜 Commercial License Grant

<img src="assets/tabbit.avif" alt="Tabbit" height="20" /> **Meituan Tabbit Browser Team**: Free license (at no cost) for closed-source commercial use, limited to v1.21.3 and earlier versions (commit [`724863f`](https://github.com/mengxi-ream/read-frog/commit/724863fdbc2d777766cada6c111235534ee03ca0)). Granted on March 3, 2026, 9:00 AM (Vancouver Time, UTC-8).
