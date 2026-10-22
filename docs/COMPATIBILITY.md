# 兼容性

## 支持环境

| 项目 | 已验证版本 |
| --- | --- |
| DSH | `0.2.1-rc.2` |
| DSH 构建 | `332895e0f7c9d4dbfb29729f5eb367fa263ff986` |
| 系统 | macOS arm64 |
| 插件 | `0.1.0-rc.1` |

安装包内的原生文档读取程序仅适用于 macOS arm64。其他 DSH 构建、Windows、Linux 和 Intel Mac 尚未验证。Linux CI 运行的是离线测试，不代表支持 Linux 安装。

<a id="agent-team"></a>
## DSH 官方 Agent Team：当前版本不支持

**DSH Projects 当前不支持与官方 Agent Team 在 Project 内配合使用。**

| 使用方式 | 当前状态 |
| --- | --- |
| 在 Project 主对话或 Thread 中运行 Agent Team | 不支持 |
| 由 Coordinator 调度 Team 成员 | 不支持 |
| 同一 Profile 安装两个插件，分别使用 | 未经过兼容性测试，不承诺兼容 |
| 分别放在独立 Profile 使用 | 建议的隔离方式；不是共存测试通过的结论 |

Project Thread 是项目管理的独立 DSH 会话，不是 Agent Team 的成员，不使用 Team 的信箱、任务板或父子会话投递机制。项目工具策略不会开放 Agent Team 工具。

请勿为 Project Coordinator 或 Thread 选择 Agent Team 预设。当前版本没有专门拦截这类预设的错误提示；能选中预设不代表能够正常运行。两个插件的系统提示、全局控件、停止操作和数据清理是否相互影响，也尚未测试。

如果需要使用官方 Agent Team，请在另一个 Profile 的普通 DSH 会话中使用。不要让两个插件共同管理同一个项目任务。

早期设计中提到的“在 Thread 内使用 Agent Team”属于未来设想，不是当前版本的能力。

### English

DSH Projects does not currently support the official DSH Agent Team inside a Project Coordinator or Project Thread. Coordinators cannot control Team members. Do not select an Agent Team preset for a Project Session; this release does not provide a dedicated preset rejection message.

Project Threads are independent DSH Sessions, not Team teammates. Project tool policies do not expose Agent Team tools. Installing both plugins in the same Profile has not been tested for compatibility. Use separate Profiles if you need both plugins; this recommendation does not imply that co-installation or nested execution has been validated.

## 安装依赖

DSH 提供插件所需的宿主依赖。安装时可能出现 `unmet peer` 警告：当前固定构建的实际安装和运行测试已通过，但 peer 检查仍未通过，不能据此推断其他版本也兼容。

开发环境固定为 Node `26.8.1` / npm `11.19.0`，`.npmrc` 的 `legacy-peer-deps=true` 用于避免 npm 额外安装宿主依赖。DSH 隔离安装测试使用其自带的 Node `24.21.0`。

React、react-dom 和 `@deepseek-ai/*` 由 DSH 提供；部分客户端依赖随构建产物分发，Zod 随安装包分发。许可见 [第三方声明](../THIRD_PARTY_NOTICES.md)。
