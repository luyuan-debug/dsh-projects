# DSH Projects v0.3.0-rc.1

基于 **Claude Projects** 的项目组织方式，为 **DeepSeek Harness** 开发的第三方项目插件。

**适配 DSH 0.2.1-rc.2 · macOS arm64 · MIT · 预发行版**

这次更新主要完善项目记忆，加入可选的 `Hindsight` 连接，并改进目录选择和连接状态提示。

## 更新内容

### 项目记忆

- 以逻辑 Markdown 文件管理项目概要、需求、约束、决定、问题和经验。
- 区分当前内容、候选和历史，保留来源与修改记录。
- 记忆索引增加短说明；每轮按预算选取概要、索引和相关正文。
- 使用记录分别列出索引预览与全文，方便查看当轮组装了哪些内容。
- 支持在授权范围内检索工程文本和 Library 资料。

### 可选的历史记忆

- 适配 `Hindsight 1.1.0`，每个项目绑定自己的记忆库。
- 默认关闭，已有库默认只读；任务报告写回需要单独开启。
- 修复检查失败后保留旧成功状态，以及旧请求覆盖新结果的问题。
- 服务不可用时继续使用本地记忆。

### 目录选择

- 等待期间可以取消，其他项目操作不再被阻塞。
- 增加超时处理，任务变化后忽略迟到的选择结果。
- 选择目录后仍需单独批准任务执行。

## 核心能力

**把一次对话，延续成一个可以持续推进的项目。**

通过项目主对话安排工作，用独立 Thread 执行和续聊；Memory 保存约定，Library 管理资料。本地执行支持 Direct / Git Worktree，沿用 DSH 的模型选择、审批和停止操作。

## 当前限制

- **不支持在 Project 内使用 DSH 官方 Agent Team。** 同一 Profile 共装尚未测试，建议分别使用独立 Profile。
- `Hindsight` 目前只完成模拟服务测试，真实记忆库的写入、召回和模型效果尚未测试。
- 原生目录选择与后续授权的完整成功流程尚未完成测试。
- 真实外部 MCP、自动派工、插件内 PR/CI、多可写仓库管理和云端 Worker 尚未提供。
- 真实模型的任务质量和图片理解尚未测试；其他 DSH 构建和操作系统尚未验证。

[兼容性与限制](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/KNOWN_LIMITATIONS.md) · [测试记录](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/RELEASE.md)

## 安装与升级

1. 下载 `.tgz` 安装包和同名 `.sha256` 文件，放在同一目录。
2. 运行校验：

   ```sh
   shasum -a 256 -c dsh-project-threads-wave1-spike-0.3.0-rc.1.tgz.sha256
   ```

3. 确认输出 `OK` 后，在 DSH 的插件页面输入安装包的完整 `file:` 路径，安装并启用。

**从 v0.1.0-rc.1 升级前请先停止任务并备份。** 新版变更了存储格式，需要手动批准迁移。旧程序不能读取新版存储，回退须恢复旧包和配套备份。[升级步骤](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/MIGRATION.md)

[安装指南](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/INSTALL.md) · [使用指南](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/USAGE.md) · [`Hindsight` 连接说明](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/HINDSIGHT.md)

本插件与 Claude Projects 没有官方关联。采用 [MIT 许可证](https://github.com/luyuan-debug/dsh-projects/blob/main/LICENSE)，第三方组件见 [许可声明](https://github.com/luyuan-debug/dsh-projects/blob/main/THIRD_PARTY_NOTICES.md)。
