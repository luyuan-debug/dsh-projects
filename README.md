# DSH Projects

基于 **Claude Projects** 的项目组织方式，为 **DeepSeek Harness** 开发的第三方项目插件。

**适配 DSH 0.2.1-rc.2 · macOS arm64**

**当前版本：v0.3.0-rc.1 · MIT · 预发行版**

[下载安装包](https://github.com/luyuan-debug/dsh-projects/releases/tag/v0.3.0-rc.1) · [安装指南](docs/INSTALL.md) · [使用指南](docs/USAGE.md)

## 核心能力

**把一次对话，延续成一个可以持续推进的项目。**

在项目主对话里确定目标，通过独立 Thread 执行任务。Memory 保存项目约定，Library 管理参考资料，后续对话可以继续使用。

| 功能 | 内容 |
| --- | --- |
| 项目与任务 | 项目目标、项目指令、独立 Thread、续聊与状态概览 |
| 项目记忆 | 概要、需求、约束、决定、问题和经验；支持编辑、来源、版本和历史 |
| 资料检索 | 在授权范围内检索工程文本和 Library 资料 |
| 可选历史记忆 | 连接 `Hindsight`，召回历史经验；任务报告写回需单独开启 |
| 资料库 | 导入、预览和下载 PDF、图片及常见 Office 文档 |
| 本地执行 | Direct / Git Worktree，沿用 DSH 的模型、审批和停止操作 |
| 项目管理 | 暂停、归档、恢复和删除 |

## v0.3.0-rc.1 更新

- 完善项目记忆：区分当前内容、候选和历史，保留来源与修改记录。
- 增加记忆索引说明，并在使用记录中分别列出索引预览和全文。
- 加入可选的 `Hindsight` 连接，修复连接失败后仍显示旧成功状态的问题。
- 目录选择支持取消和超时，等待期间可以继续操作项目。

[完整更新说明](RELEASE_NOTES.md) · [版本记录](CHANGELOG.md)

## 安装与升级

从 Release 下载 `.tgz` 和同名 `.sha256` 文件，校验后在 DSH 的插件页面安装。建议先在独立 Profile 试用。

**从 v0.1.0-rc.1 升级前请备份数据。** 新版变更了存储格式，需要手动批准迁移；回退时须恢复旧包和配套备份。步骤见 [升级与回退](docs/MIGRATION.md)。

项目记忆默认在本地使用，不需要 `Hindsight`。需要外部历史时，按 [连接说明](docs/HINDSIGHT.md) 配置服务和项目记忆库。

## 当前限制

- **不支持在 Project 内使用 DSH 官方 Agent Team。** 同一 Profile 共装尚未测试；需要两者时，请使用独立 Profile。
- `Hindsight` 默认关闭。连接测试使用模拟服务，真实记忆库读写和真实模型效果尚未测试。
- 目录选择已测试取消和超时处理，完整的原生选择与授权流程尚未完成测试。
- 暂不提供真实外部 MCP 接入、自动派工、插件内 PR/CI 协作、多可写仓库管理或云端 Worker。
- 文档读取不支持 OCR、旧版 Office、宏执行、公式计算或完整排版还原。
- 仅验证了上述 DSH 版本和 macOS arm64；真实模型的任务质量和图片理解尚未测试。

[兼容性](docs/COMPATIBILITY.md) · [已知限制](docs/KNOWN_LIMITATIONS.md) · [构建与测试](docs/RELEASE.md)

本插件参考 Claude Projects，未实现其全部功能，与 Claude Projects 没有官方关联。

采用 [MIT 许可证](LICENSE)。第三方组件见 [许可声明](THIRD_PARTY_NOTICES.md)。
