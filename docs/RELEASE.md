# 发布维护

当前版本 0.1.0-rc.1，标签 v0.1.0-rc.1，采用 MIT。用户已授权本轮验证通过后公开仓库和发布 Prerelease，明确不设 Latest。未来每次对外发布仍应具有相应任务授权。

1. 固定 Node/npm，执行 npm ci，确认 lockfile 无变化。
2. npm run build；核对 Client 与 FINAL-01 基线哈希。
3. npm run test:portable；Mac arm64 另运行 npm run test:mac。
4. 保留第三方许可，npm pack --ignore-scripts；逐成员核对源码和 tgz。
5. 用新的 DSH_HOME/Profile 安装、启用、冷启动、项目/Thread 创建与继续、停用、卸载；只允许脚本 fixture，禁止收费模型。
6. 对提交树、拟推送全部历史、发布包扫描秘密/隐私/运行环境；任何未分类匹配阻止 push。
7. 生成资产和 SHA256SUMS，确认本次授权、许可文本和资产身份后再公开/发布。

GitHub 工作流仅 build + portable offline tests，不使用 secrets、不自动发布。真实 Host/Desktop/Mac reader/模型不由该 CI 覆盖。工作流在托管端运行前只能称已配置，不能称 GitHub CI 已通过。

本地完整原历史和原包存于发布仓库之外，不得推送这些备份。发布命令与状态见 MANUAL_PUBLISH_STEPS.md。

## CI 平台边界修复

Hosted runner 的测试入口读取预置的 `RUNNER_TEMP`，避免产品拒绝的 `/tmp`；本地可用 `DSH_TEST_ROOT` 显式覆盖。不在 job 级 env 中引用 `runner` 上下文。本地 Linux 可使用 `DSH_TEST_ROOT=../dsh-projects-test-data npm run test:portable`，目录必须由本次测试拥有，且在 checkout 和 `/tmp` 之外。

11 项依赖已验证 macOS OS lease 的 Git 测试在非 Mac 显式跳过；4 项不依赖该锁的 Git 安全测试继续运行。另有原先已标记的 2 项 Profile lease 测试仅在 Mac 运行。因此 macOS portable 为 178 项，Linux 为 165 PASS + 13 SKIP；不将 SKIP 计作通过。矩阵关闭 fail-fast，保留每端完整结果。PDF/ImageIO 的实际 reader 测试仍由独立 Mac 验证覆盖，不冒充 CI 已覆盖。

这次仅修复维护/测试入口和平台标记，不修改产品实现、Client、lockfile 或最终安装包。原始失败运行与标签保留，新候选标签另建，不 force-push 历史。

## 在线文案修订

仓库 main 的首页、在线指南和 Release 页面可以在候选冻结后继续润色。文案修订不自动重打已经验证的安装包；对既有 tgz 做源码成员核对时，以该 Release 对应的候选标签为准。新的产品安装包须按上述流程另行生成并验证。
