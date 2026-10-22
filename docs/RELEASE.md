# 发布维护

当前只准备私有仓库的 Draft Prerelease，不自动公开、不选择许可证、不标记 Latest。当前 tag 为 final01-candidate，package version 保留 0.0.0-final01.5。

1. 固定 Node/npm，执行 npm ci，确认 lockfile 无变化。
2. npm run build；核对 Client 与 FINAL-01 基线哈希。
3. npm run test:portable；Mac arm64 另运行 npm run test:mac。
4. 保留第三方许可，npm pack --ignore-scripts；逐成员核对源码和 tgz。
5. 用新的 DSH_HOME/Profile 安装、启用、冷启动、项目/Thread 创建与继续、停用、卸载；只允许脚本 fixture，禁止收费模型。
6. 对提交树、拟推送全部历史、发布包扫描秘密/隐私/运行环境；任何未分类匹配阻止 push。
7. 生成资产和 SHA256SUMS，人工确认许可证后才能另行考虑公开。

GitHub 工作流仅 build + portable offline tests，不使用 secrets、不自动发布。真实 Host/Desktop/Mac reader/模型不由该 CI 覆盖。工作流在托管端运行前只能称已配置，不能称 GitHub CI 已通过。

本地完整原历史和原包存于发布仓库之外，不得推送这些备份。最短后续动作见 MANUAL_PUBLISH_STEPS.md。
