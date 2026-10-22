# 许可记录

用户于 2026-10-22 在本次发布会话明确选择 MIT，并授权检查通过后公开仓库及发布 Prerelease。本项目采用根目录 LICENSE 的标准 MIT 文本，版权署名为 DSH Projects contributors；package.json 与 package-lock.json 的根包 license 均为 MIT。

第三方 zod、immer、zustand、use-sync-external-store 与 esbuild 的原版权/许可文本仍保留在 third_party/licenses；Zod 原 LICENSE 也随依赖打包。MIT 许可允许与本项目 MIT 代码共同分发，原版权及许可声明继续保留。Host peers、React 和系统 Framework 没有被重新打包；公开源码不含历史 evidence 下的官方实现摘录、旧 PoC 或私人参考图。

来源可追溯至用户提供的 FINAL-01 bundle。本轮静态审阅与分发清单核对没有发现新增的第三方实现移植；本记录不把 Git author 或“参考 Claude Projects”当作第三方版权授权，也不为第三方内容重新指定版权归属。

安装包名、插件/Client id、持久化 namespace 与迁移键保持不变。package 的 private=true 只用于阻止误发 npm；本轮以 GitHub Release 分发，不执行 npm publish。

MIT 原文：https://opensource.org/license/mit
