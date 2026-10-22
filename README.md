# DSH Projects

安装到正常 DeepSeek Harness 的第三方本地优先插件，提供 Project Conversation、Coordinator、独立可进入/恢复的 Threads、Overview、Memory、Library，以及本地 Direct / Worktree。原生 Conversation、模型选择、审批与 Stop 复用 DSH。

当前是 **FINAL-01 候选**，版本 `0.0.0-final01.5`，package 名为 `dsh-project-threads-wave1-spike`。安装身份和数据命名空间沿用原值。尚未选定本项目许可证；仓库应保持 Private，Release 应保持 Draft + Prerelease，不能标记 Latest。

已验证环境：DSH `0.2.1-rc.2`，Host build `332895e0f7c9d4dbfb29729f5eb367fa263ff986`，macOS arm64。本次重验系统为 macOS 26.5.1 (25F80)。仅此固定构建有证据；没有承诺其他版本或系统兼容。

## 安装和使用

从候选资产取得 `.tgz` 并先核对 SHA-256，再到 DSH 插件页使用完整 `file:` 路径安装并启用，等待“运行中”。入口为 Projects。创建项目后选择你已授权的模型，在主对话派工或继续现有 Thread。目录必须经用户选择与确认；资料、模型输出与历史记录都不能授予目录权限。

详见 [安装](docs/INSTALL.md)、[使用](docs/USAGE.md)、[迁移与回退](docs/MIGRATION.md)。本仓库不会替你修改正式 Profile。

## 构建和离线测试

固定 Node `26.8.1` / npm `11.19.0`：

```sh
npm ci
npm run build
npm run test:portable
# macOS arm64 上验证实际 PDF/ImageIO reader
npm run test:mac
npm pack --ignore-scripts
```

`.npmrc` 固定 `legacy-peer-deps=true`。宿主 peer 包由 DSH 运行时提供，不应当从 npm 自动安装第二套宿主。lockfile 不升级；开发依赖仅用于构建。跨平台离线测试不证明非 Mac 安装兼容，也不覆盖 Desktop 或真实模型。

## 当前限制

最终包真实模型语义尚未正式验收，`realModelValidated=false`、`fullClaudeParity=false`、`userAccepted=false`。不宣称完整 Claude Projects parity。真实外部 MCP、自动创建 Thread 的 Routine、产品内 PR/CI 和多可写仓库高级流程未闭合。本地执行，不提供云 Worker。

项目删除清理插件拥有的数据，同时归档保留宿主 Session 历史；不删除用户原文件/仓库/Worktree。Library 支持有界 PDF、PNG/JPEG、DOCX/XLSX/PPTX；不支持 OCR、通用 Office 保真排版、宏执行、公式计算或任意格式。宿主 peer warning 和解析边界见 [兼容性](docs/COMPATIBILITY.md)。完整限制见 [KNOWN_LIMITATIONS](docs/KNOWN_LIMITATIONS.md)。

架构见 [ARCHITECTURE](docs/ARCHITECTURE.md)，来源和第三方许可见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)，许可证决策见 [LICENSE_DECISION](LICENSE_DECISION.md)。
