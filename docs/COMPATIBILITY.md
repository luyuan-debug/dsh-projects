# 兼容性

## 支持环境

| 项目 | 已验证环境或接口适配版本 |
| --- | --- |
| DSH Projects | `0.3.0-rc.1` |
| DSH | `0.2.1-rc.2` |
| DSH 构建 | `332895e0f7c9d4dbfb29729f5eb367fa263ff986` |
| 系统 | macOS arm64 |
| 可选 Hindsight 接口 | `1.1.0`，真实 Recall / Retain 尚未验证 |

安装包内的原生文档读取程序仅适用于 macOS arm64。其他 DSH 构建、Windows、Linux 和 Intel Mac 尚未验证。Linux CI 运行的是离线测试，不代表支持 Linux 安装。

从 `v0.1.0-rc.1` 升级涉及 Store schema 4 到 5 的迁移，需要停止、备份并显式批准；旧包不能直接读取新版存储，详见 [升级与回退](MIGRATION.md)。

## 原生目录选择

目录选择使用固定 DSH 构建提供的原生能力，不修改 DSH 核心。等待支持用户取消、关闭时取消与 120 秒服务超时，客户端另有 125 秒兜底；目录选择不再占住其他 Project 命令，迟到返回不会自动应用到已变化的任务。

同一执行端最多保留一个尚未结束的物理选择器。若后端忽略取消，旧系统窗口可能仍在关闭，新选择会立即提示已有选择器。取消或超时不能证明物理窗口已经消失，也不授予文件夹权限。

原生等待、取消及恢复行为已进行相关验证，**选择指定目录并完成后续任务授权的完整成功流程仍未完成验证**。不要将前者视为整个目录流程已通过。操作与恢复方法见 [目录选择](DIRECTORY_SELECTION.md)。

## Hindsight（可选）

插件适配 Hindsight 官方 `1.1.0` 的受限 REST 接口，使用已有服务，不安装完整 daemon、SDK 管理器或自动注入插件，不管理服务端模型。接口适配不代表任意部署或真实模型效果已验证。

| 验证层级 | 范围 |
| --- | --- |
| 离线可控 HTTP 服务 | 请求范围、返回处理、错误、取消、绑定变更和连接状态 |
| DSH Host / 原生 Desktop | 固定宿主构建中的接入、上下文组装与界面操作，使用脚本模型和合成服务 |
| 真实 Hindsight 服务 | 目标部署与专用 bank 的实际 Recall / Retain 尚未验证 |
| 真实模型 | Agent 是否正确使用历史、完成任务和理解图片尚未验证 |

健康响应只说明相应健康或元数据请求的结果，不能替代 Recall、Retain 或数据出口验证。每次连接检查显示本次阶段及结果；历史成功时间不会代替当前状态。

Standard 默认关闭此连接，不为本地记忆操作发 Hindsight HTTP 请求。开启增强需显式选择服务和项目 bank；已有库默认只读，写回终态任务报告另行启用。

API 在本机不代表模型在本机。云端 embedding、重排、LLM、后台归并及新库模板都可能外发或计费，须核对路线与授权。设置方式及数据边界见 [Hindsight 设置](HINDSIGHT.md)。

<a id="agent-team"></a>
## DSH 官方 Agent Team：当前版本不支持

**DSH Projects 当前不支持与官方 Agent Team 在 Project 内配合使用。**

| 使用方式 | 当前状态 |
| --- | --- |
| 在 Project 主对话或 Thread 中运行 Agent Team | 不支持 |
| 由 Coordinator 调度 Team 成员 | 不支持 |
| 同一 Profile 安装两个插件，分别使用 | 未经过兼容性测试，不承诺兼容 |
| 分别放在独立 Profile 使用 | 建议的隔离方式；不是共存测试通过的结论 |

Project Thread 是项目管理的独立 DSH 会话，不是 Agent Team 成员，不使用 Team 的信箱、任务板或父子会话投递机制。项目工具策略不会开放 Agent Team 工具。

请勿为 Project Coordinator 或 Thread 选择 Agent Team 预设。当前版本没有专门拦截这类预设的错误提示；能选中预设不代表能够正常运行。两个插件的系统提示、全局控件、停止操作和数据清理是否相互影响，也尚未测试。

如果需要使用官方 Agent Team，请在另一个 Profile 的普通 DSH 会话中使用。不要让两个插件共同管理同一个项目任务。

### English

DSH Projects does not currently support the official DSH Agent Team inside a Project Coordinator or Project Thread. Coordinators cannot control Team members. Do not select an Agent Team preset for a Project Session; this release does not provide a dedicated preset rejection message.

Project Threads are independent DSH Sessions, not Team teammates. Project tool policies do not expose Agent Team tools. Installing both plugins in the same Profile has not been tested for compatibility. Use separate Profiles if you need both plugins; this recommendation does not imply that co-installation or nested execution has been validated.

## 安装依赖

DSH 提供插件所需的宿主依赖。安装时可能出现 `unmet peer` 警告；请以固定宿主构建和当前版本的 [验证范围](RELEASE.md) 为准。安装成功或旧版记录不能证明其他版本兼容。

开发环境固定为 Node `26.8.1` / npm `11.19.0`，`.npmrc` 的 `legacy-peer-deps=true` 用于避免 npm 额外安装宿主依赖。DSH 隔离安装测试使用其自带的 Node `24.21.0`。

React、react-dom 和 `@deepseek-ai/*` 由 DSH 提供；部分客户端依赖随构建产物分发，Zod 随安装包分发。许可见 [第三方声明](../THIRD_PARTY_NOTICES.md)。
