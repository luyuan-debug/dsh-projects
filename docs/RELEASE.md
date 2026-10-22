# 发布维护

## 检查流程

1. 使用固定 Node / npm 执行 `npm ci`，检查锁文件无意外变化。
2. 运行 `npm run build`、`npm run test:portable`，在 macOS arm64 额外运行 `npm run test:mac`。
3. 保留项目及第三方许可，执行 `npm pack --ignore-scripts`，用 `tools/release/verify-package.py` 核对安装包成员。
4. 在独立 DSH_HOME / Profile 验证安装、冷启动、项目与 Thread、续聊、升级、停用及卸载。`tools/release/check-host.py` 提供脚本模型测试，不验证真实模型质量。
5. 用 `tools/release/scan-security.py --history --package <tgz>` 检查源码、历史和安装包。逐项审查匹配，不能直接忽略未分类结果。
6. 为安装包和发布附件生成 SHA-256 校验和，核对版本、标签、许可及发布说明后发布。

GitHub Actions 负责构建和可移植离线测试，不自动发布。安装、桌面操作、实际文档读取及真实模型行为需要分别验证。安装测试不得使用日常 Profile；真实模型调用需要明确的费用授权。

## 0.1.0-rc.1 的验证范围

| 检查 | 结果 |
| --- | --- |
| macOS 完整离线测试 | 196 通过 |
| macOS CI | 178 通过，无跳过 |
| Ubuntu CI | 165 通过，13 项仅适用于 macOS 的测试跳过 |
| 隔离 DSH 安装 | 全新安装、启停、冷恢复、项目与 Thread 操作、卸载通过 |
| 从 0.0.0-final01.5 升级 | 项目、Thread、Memory、Library 保留 |
| 安装包 | 全部成员与对应源码、依赖逐字节核对 |

上述安装测试使用脚本模型；不代表真实模型任务质量或图片理解已验证。Agent Team 共装、嵌套与预设冲突不在测试范围内。

## CI 临时目录

测试入口优先使用 `DSH_TEST_ROOT`，其次使用 GitHub runner 的 `RUNNER_TEMP`，否则使用系统临时目录。Linux 测试目录应位于 checkout 和 `/tmp` 之外。13 项依赖 macOS 租约机制的测试在 Linux 跳过，其他 Git 安全测试继续执行。

## 文档修订与已发布文件

在线文档和 Release 说明可以补充限制、修正措辞。已发布安装包、源码归档和标签保持对应；文档修订不自动重打安装包。核对旧安装包时以对应标签为准。

若更新单独下载的发布说明，也要更新包含其摘要的 `SHA256SUMS.txt`。产品变更应生成新版本并重新验证。保留旧标签和测试记录，不重写发布历史。
