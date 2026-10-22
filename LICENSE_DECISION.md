# 许可证决策（待用户选择）

当前源码根无明确 LICENSE，package 未声明本项目 license，且 private=true。本轮不添加本项目 LICENSE；第三方许可仅适用于各自代码。没有许可证不构成开放使用授权，参见 [GitHub Choose a License](https://choosealicense.com/no-permission/)。保持 Private + Draft。

## 来源审计

本项目产品代码、构建/测试与文档由提供的 FINAL-01 bundle 及其历史恢复；历史包含多阶段本地开发与维护。可追溯到提供的项目，但 Git author 或“原创”标注本身不足以证明用户持有全部权利。没有找到自有代码明确授权或完整贡献权属证明，因此对自有部分仅标记“本项目维护代码，最终权属待维护者确认”，不擅自宣称全部属于用户。

Host API 通过 import/公开接口调用；筛选树没有包含历史 evidence 下的官方实现/接口摘录、旧 PoC 或第三方社区 reader/MCP transport。Apple Framework 作为系统链接依赖，未复制其实现。Swift/Python reader 源码位于产品树。有限静态审阅未发现额外复制实现；这不等于完整权属保证。

zod、immer、zustand、use-sync-external-store、esbuild 及其平台分发包在 lockfile 中为 MIT，实际许可证文本见 third_party/licenses。zod 随 tgz 打包；Client 内嵌实现一并保留版权/许可；Host peers 不随包分发。完整列表见 THIRD_PARTY_NOTICES.md。

## 可供选择的方案（本轮均未采用）

| 选项 | 条件与主要约束 |
| --- | --- |
| 保持私有、暂不授予开放许可 | 当前默认；确认来源与贡献授权后再定，不发布为开源 |
| MIT | 宽松复用，保留版权/许可声明；先确认自有部分的授权权利；[MIT 原文](https://opensource.org/license/mit) |
| Apache-2.0 | 含明确专利条款；分发时保留许可、适用 NOTICE 及修改声明；先确认贡献者授权；[官方原文](https://www.apache.org/licenses/LICENSE-2.0) |

建议先补全权属确认；若目标为宽松社区复用，可由用户在 MIT 与 Apache-2.0 中明确选择。选择后需重新核对第三方实际分发内容并复验，不能据此自动公开。
