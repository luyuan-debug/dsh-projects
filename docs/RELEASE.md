# 构建与测试

适配环境：macOS arm64、DSH `0.2.1-rc.2`，构建 `332895e0f7c9d4dbfb29729f5eb367fa263ff986`。

## v0.3.0-rc.1 测试结果

| 检查 | 结果 |
| --- | --- |
| macOS 本地离线测试 | 196 项通过 |
| 项目记忆测试 | 152 项通过 |
| 记忆界面测试 | 14 项通过 |
| 目录选择界面测试 | 15 项通过 |
| DSH 安装测试 | 安装、重启、停用、重新启用和卸载通过 |
| 原生桌面测试 | 记忆索引、使用记录、连接状态和错误恢复通过 |

[版本标签 CI](https://github.com/luyuan-debug/dsh-projects/actions/runs/39991900177) 中，macOS 的可移植测试 178 项、记忆测试 152 项、界面测试 14 项通过；Ubuntu 分别为 165、151、14 项通过，另有 14 项仅适用于 macOS 的测试跳过。各套件有重叠，不相加。

对话测试使用脚本模型，外部连接测试使用模拟 HTTP 服务。真实 `Hindsight` 读写、真实模型效果，以及原生目录选择与授权的完整成功流程尚未完成测试。Agent Team 在 Project 内不支持，同一 Profile 共装未测试。

安装包与源码归档对应 `v0.3.0-rc.1` 标签。文档修订不改变已发布程序。

## 本地构建

使用 Node `26.8.1` / npm `11.19.0`：

```sh
npm ci
npm run build
npm run test:portable
npm run test:memory
npm run test:mac
```

最后一项需要 macOS。测试数据使用临时目录，不连接日常 Profile；真实模型调用需另行配置和授权。

## 发布检查

1. 检查构建产物、锁文件、许可和版本号。
2. 运行回归测试，并在独立 Profile 测试安装、启停、恢复和卸载。
3. 生成安装包，用 `tools/release/verify-package.py` 检查内容，用 `tools/release/scan-security.py` 检查源码和附件。
4. 为附件生成 SHA-256 校验和，等待对应提交的 GitHub CI 通过后发布。
5. 保留旧版本、标签和安装包。文档附件发生变化时，同步更新校验和。

GitHub Actions 负责构建、可移植测试、项目记忆和记忆界面测试，不自动发布。Linux CI 通过不表示支持 Linux 安装。

## 测试目录

测试优先使用 `DSH_TEST_ROOT`，其次使用 GitHub runner 的 `RUNNER_TEMP`，否则使用系统临时目录。Linux 测试目录须位于 checkout 和 `/tmp` 之外。
