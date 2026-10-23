# 兼容性

## 适配环境

| 项目 | 版本 |
| --- | --- |
| DSH Projects | v0.3.0-rc.1 |
| DSH | 0.2.1-rc.2 |
| DSH 构建 | `332895e0f7c9d4dbfb29729f5eb367fa263ff986` |
| 系统 | macOS arm64 |
| 可选外部服务 | `Hindsight 1.1.0` 接口 |

其他 DSH 构建、Intel Mac、Windows 和 Linux 尚未验证。Linux CI 仅用于离线测试，不表示支持 Linux 安装。

安装包内的原生文档读取程序用于 macOS arm64。真实模型的任务质量和图片理解尚未测试。

## 目录选择

目录选择使用 DSH 提供的系统选择器。取消和超时处理已测试，完整的原生选择与后续授权流程尚未完成测试。

取消后系统窗口可能仍在关闭，结束前不能重复打开选择器。选择目录不会自动批准任务执行。[操作说明](DIRECTORY_SELECTION.md)

## 外部历史记忆

本地 Standard 记忆不需要 `Hindsight`。可选连接目前只完成模拟服务测试，真实库的写入、召回和模型效果尚未测试。

插件只负责连接已有服务，不安装后台服务，不管理服务端模型或数据库。本机 API 也可能使用云端模型，请先确认数据出口和费用。[连接说明](HINDSIGHT.md)

<a id="agent-team"></a>
## DSH 官方 Agent Team

**当前不支持在 Project 内使用 Agent Team。** 不要在项目主对话或 Thread 中选择 Team 预设，也不要让 Coordinator 调度 Team 成员。当前没有专门拦截 Team 预设的提示。

| 使用方式 | 状态 |
| --- | --- |
| Project 主对话或 Thread 内运行 Team | 不支持 |
| Coordinator 调度 Team 成员 | 不支持 |
| 同一 Profile 共装、分开使用 | 尚未测试 |
| 分别使用独立 Profile | 建议的使用方式 |

Project Thread 是独立 DSH 会话，不是 Team 成员，不使用 Team 的任务板和信箱。

DSH Projects does not support Agent Team inside a Project Coordinator or Thread. Co-installation in one Profile has not been tested. Use separate Profiles if you need both.

## 升级

从 v0.1.0-rc.1 升级需要将 Store schema 4 迁移至 5，记忆格式为 schema 2。请先停止任务并备份，再批准迁移；回退需要旧包和配套旧快照。[升级与回退](MIGRATION.md)

## 构建依赖

开发使用 Node `26.8.1` / npm `11.19.0`；DSH 隔离安装使用宿主自带的 Node `24.21.0`。

React、react-dom 和 DSH 宿主模块由 DSH 提供。Zod 随安装包分发，部分客户端依赖已编入构建产物。固定宿主仍可能出现 peer 依赖警告，其他版本不能直接沿用兼容结论。

[第三方许可](../THIRD_PARTY_NOTICES.md) · [构建与测试](RELEASE.md)
