# 版本记录

## 0.3.0-rc.1

### 新增

- 以逻辑 Markdown 文件管理项目概要、需求、约束、决定、问题和经验；保留候选、来源、修订及历史。
- 每轮按预算组织项目记忆上下文，提供索引字面短说明及分页、截断和省略提示。
- Used This Turn 分开记录索引预览与已提供全文。
- 本地词法检索覆盖已授权工程与 Library，自动来源召回默认关闭。
- 可选 Hindsight `1.1.0`：项目独立绑定记忆库，默认关闭，已有库默认只读，任务报告写回单独开启。

### 改进与修复

- 历史记忆明确显示已替代或已归档，不再误标为当前要求。
- Hindsight 连接检查按本次请求、阶段和绑定更新，失败不沿用旧成功状态，迟到结果不覆盖新检查。
- 私有记忆的索引预览同样阻止相关任务报告外发；忘记后暂停增强的保护继续保留。
- 目录选择支持取消、120 秒服务超时和 125 秒客户端兜底；任务变化后忽略迟到结果，等待不再占住其他项目命令。
- 本地检索改进中文、代码符号及 Godot / .NET 等受支持文本的读取与定位。

### 升级与验证

- 项目 Store 使用 schema 5、记忆使用 schema 2。旧存储默认拒绝静默升级；停止并备份后，须明确批准迁移。回退需要旧安装包和配套旧快照。
- 本地离线测试、固定 DSH Host 与原生 Desktop 的相关流程已验证。真实 Hindsight Recall / Retain、真实模型效果尚未验证；原生指定目录完整成功流程仍未完成验证。
- 继续适配 macOS arm64 / DSH `0.2.1-rc.2`，保留 MIT、Prerelease 标记，不设为 Latest。

[完整发布说明](RELEASE_NOTES.md) · [升级与回退](docs/MIGRATION.md) · [验证范围](docs/RELEASE.md)

## 0.1.0-rc.1

首个 MIT 开源预发行版，适配 macOS arm64 上的 DSH `0.2.1-rc.2`。

- 项目目标、项目指令、主对话和独立 Thread。
- 项目 Memory 与 Library，支持常用文档内容读取。
- Direct / Git Worktree、目录授权及 DSH 原生会话操作。
- 项目暂停、归档、恢复与删除。

当前不支持 DSH 官方 Agent Team；同一 Profile 共装未验证。真实外部 MCP、自动派工、插件内 PR/CI 等功能尚未完成，详见 [已知限制](docs/KNOWN_LIMITATIONS.md)。

[0.1.0-rc.1 发布记录](https://github.com/luyuan-debug/dsh-projects/releases/tag/v0.1.0-rc.1)
