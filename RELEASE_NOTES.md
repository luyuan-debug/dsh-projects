# DSH Projects v0.3.0-rc.1

基于 **Claude Projects** 的项目组织方式，为 **DeepSeek Harness** 实现的第三方本地项目插件。

**适配版本：DSH 0.2.1-rc.2 · macOS arm64**

**MIT 开源 · 预发行版**

本次更新主要完善项目记忆：把项目概要、决定、来源和历史放到同一套管理流程中，让后续对话可以按需继续使用；同时加入可选 Hindsight 连接，并修复目录选择等待和连接状态显示问题。

## 更新内容

### 更完整的项目记忆

- 以逻辑 Markdown 文件管理概要、需求、约束、决定、问题和经验。当前内容、候选、已替代及归档分开，编辑保留来源与修订记录。
- 每个业务回合按预算组织一份上下文，优先保留概要与相关正文，再提供记忆索引；不会每轮注入全部记忆。
- 索引包含名称、主题、类型、状态、修订和短说明。短说明取首个非空字面行的前 100 个 Unicode 字符，保留符号，并标明截断、分页或预算省略；它不是自动总结。
- **Used This Turn** 分开显示“索引预览（非全文）”与“已提供全文”，用于核对已组装到本轮上下文的内容；不代表请求发送成功或模型理解。
- 本地词法检索可以查找已授权工程和 Library 文本。索引范围需要确认，自动来源召回默认关闭。

### 可选 Hindsight 历史补充

- 适配 Hindsight `1.1.0`，一个项目绑定一个明确的记忆库。默认关闭，已有库默认只读，不改变原库配置。
- 任务报告写回单独开启，并受共享范围、数据出口和费用确认限制；私有记忆即使只出现在索引预览中，也会阻止相关报告外发。
- 连接检查按本次请求显示服务与记忆库结果。检查期间清除旧成功结论，健康异常、网络失败和记忆库访问失败分别处理；旧请求、旧绑定不能覆盖新结果。
- 服务失败时继续使用本地记忆。忘记操作会抑制对应内容并暂停增强，避免远端派生历史再次注入；它不会清除已有聊天或原文件。

### 目录选择与等待恢复

- 等待目录时可以取消，其他项目操作不再随之阻塞。
- 服务端等待上限 120 秒，客户端另有 125 秒兜底。
- 关闭、修改或拒绝任务，以及切换项目后，迟到的选择结果不会应用到旧任务。
- 选择目录与授予任务执行权限仍为两个步骤。取消或超时不保证物理系统窗口立即消失。

## 核心能力

**把一次对话，延续成一个可以持续推进的项目。**

项目主对话保存目标和指令，通过独立 Thread 安排和继续工作；Memory 保存约定，Library 管理参考资料。本地执行支持 Direct / Git Worktree，并沿用 DSH 的模型选择、审批和停止操作。项目可以暂停、归档、恢复或删除。

本插件参考 Claude Projects，尚未实现其全部功能，与 Claude Projects 没有官方关联。

## 使用前请确认

> **当前版本不支持 DSH 官方 Agent Team。** 请勿在 Project 主对话或 Thread 中运行 Team、选择 Team 预设，或让 Coordinator 调度 Team 成员。同一 Profile 共装未经过兼容性测试；需要分别使用时，请使用独立 Profile。当前没有针对 Team 预设的专用拦截提示。[兼容性说明](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/COMPATIBILITY.md#agent-team)

本地离线测试、固定 DSH Host 和原生 Desktop 的相关操作已验证；Hindsight 连接及上下文测试使用可控 HTTP 服务和脚本模型。**真实 Hindsight Recall / Retain、真实模型任务质量与图片理解尚未验证。原生“选择指定目录并完成后续授权”的完整成功流程仍未完成验证。** 不将这些结果合并为全部功能已验证。

真实外部 MCP、自动创建 Thread 的 Routine、插件内 PR/CI 协作、多可写仓库流程和云端 Worker 尚未提供。文档读取不支持 OCR、旧版 Office、宏执行、公式计算或完整排版还原。[已知限制](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/KNOWN_LIMITATIONS.md) · [构建与测试记录](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/RELEASE.md)

## 安装与升级

建议先在独立 Profile 试用。从 `v0.1.0-rc.1` 升级涉及存储格式变化：**先停止任务、备份旧数据，再在明确选择的 Profile 中批准迁移。旧安装包不能直接读取新版存储，回退必须恢复配套旧快照。** 具体步骤见 [升级与回退](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/MIGRATION.md)。

1. 从下方 **Assets** 下载 `.tgz` 安装包和同名 `.sha256` 文件，放入同一目录。
2. 在该目录运行校验命令，确认输出 `OK`：

   ```sh
   shasum -a 256 -c dsh-project-threads-wave1-spike-0.3.0-rc.1.tgz.sha256
   ```

3. 在 DSH 的 **插件 → 安装第三方插件** 中输入安装包的完整 `file:` 路径，安装并启用。
4. 默认使用 Standard 本地记忆。需要 Hindsight 时，再核对服务与授权，显式配置连接。

[安装指南](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/INSTALL.md) · [使用指南](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/USAGE.md) · [Hindsight 设置](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/HINDSIGHT.md)

## 版本信息

已验证 DSH 构建为 `332895e0f7c9d4dbfb29729f5eb367fa263ff986`。其他 DSH 构建和操作系统尚未验证；安装时可能出现 peer 依赖警告，请先阅读兼容性说明。

安装包名保留为 `dsh-project-threads-wave1-spike`，界面名称为 **Projects**。本版本保留 Prerelease 标记，不设为 Latest；旧版 Release 与安装包继续保留。

[MIT 许可证](https://github.com/luyuan-debug/dsh-projects/blob/main/LICENSE) · [第三方声明](https://github.com/luyuan-debug/dsh-projects/blob/main/THIRD_PARTY_NOTICES.md)
