# 上游代码与修改记录

源仓库：`https://github.com/00080000/dsh-project-memory`；版本 `0.6.3`；固定提交 `21fc69e3e98f3864677e091477b7d543a0e54939`。逐文件来源和双方 SHA-256 见 `UPSTREAM_PROVENANCE.json`，MIT 原文见 `third_party/licenses/dsh-project-memory-MIT.txt`。

## 依赖闭包与实际调用

保留 tokenizer、BM25、CJK 双字片段、文本切块、代码符号扫描、唯一来源 ID、结构词项提取核心。上游模块不依赖外部包；symbols 原有未使用的 `readFileSync` 导入移除后核心完全纯函数。Projects adapter 只接收运行时授权资源、Project 正式记录与已有 LibraryReader 的提取结果。它不会加载 donor 插件入口、根解析器、Store、watcher、TaskBridge、任务 UI、global insight、autoContext、反思、LLM 查询扩展或任何向量模块。无需安装 leanvec 或 pdfjs-dist。

实际查询调用链：`ProjectEvidenceIndex.query` → `chunkText` / `scanSymbols` / `entryIdPrefix` → `extractKeywords` / `extractTermText` → donor `tokenizeRaw` → donor `buildBm25(...).score(query)`。正式记录、工程文本和 Library 证据都走同一 donor 词法核心，没有第二搜索引擎。

## 最小补丁

1. `symbols.js`：只移除未使用的同步文件读取导入；实际符号规则不变。
2. `util/search.js`：词频表由普通对象改为无原型对象。原表的 `constructor` / `__proto__` 等合法标识符会碰到 Object 原型字段，导致词频非数字；补丁修复这一表示问题，不更改 BM25 公式和排序策略。
3. 上游 `test/chunker.test.mjs` 原样保留差分断言，仅调整导入位置到 vendor。

```diff
--- ../mem03-upstream/src/symbols.js	2026-10-23 02:06:50
+++ src/product/vendor/dsh-project-memory/symbols.js	2026-10-23 02:09:40
@@ -1,4 +1,3 @@
-import { readFileSync } from 'node:fs'
 import { oneLineDeclaration } from './util/text.js'
 import { entryIdPrefix } from './util/entry-id.js'
 
@@ -503,4 +502,4 @@
     if (matched) symbols.push(buildSymbol(matched, relPath, raw, i + 1))
   }
   return symbols
-}
\ No newline at end of file
+}
--- ../mem03-upstream/src/util/search.js	2026-10-23 02:06:50
+++ src/product/vendor/dsh-project-memory/util/search.js	2026-10-23 02:15:29
@@ -78,14 +78,14 @@
   const documents = docs.map((doc) => {
     const text = getFieldText(doc)
     const terms = tokenizeRaw(text)
-    const tf = {}
+    const tf = Object.create(null)
     for (const t of terms) tf[t] = (tf[t] || 0) + 1
     const rawFields = getPhraseFields ? getPhraseFields(doc) : [(doc.title || ''), (doc.keywords || []).join(' ')]
     const phraseFields = Array.isArray(rawFields) ? rawFields : [rawFields]
     const phraseText = phraseFields.filter(Boolean).join(' ').toLowerCase()
     return { doc, length: terms.length, tf, phraseText }
   })
-  const df = {}
+  const df = Object.create(null)
   for (const d of documents) {
     for (const t of Object.keys(d.tf)) df[t] = (df[t] || 0) + 1
   }
@@ -253,4 +253,4 @@
   return [...merged.values()]
     .sort((a, b) => b.score - a.score)
     .slice(0, limit)
-}
\ No newline at end of file
+}
```

## 有界适配与限制

派生索引只在进程内，失去即可重建；不向用户工程写入数据。每次查询重新读取授权范围并计算内容哈希，未变文件复用分块；命中源文件在返回前再次核对哈希。根、Project、资源、工作树、版本纳入缓存身份。取消或 validate 拒绝使整次查询失败，不提交迟到结果。

扫描遵守根及嵌套 `.gitignore`（包含目录、锚定、通配符与顺序否定规则）、显式 excludes，并排除 symlink、隐藏目录、凭据文件、依赖/构建目录和二进制。默认 2,000 文件、32 MiB、20,000 个派生块；所有有界遗漏可见。Library 保持已有读取器限制；扫描 PDF/图片无文本时仅能图像阅读；Library 收集器通过既有 reader 单次至多 65,536 字节分页，累计至多 512 KiB、50 页/单元、8 工作表和64次读取；结构化 JSON 必须收集完整后解析，超过限额不把半截 JSON 当正文。XLSX 逐工作表保留 sheet/cell，默认每表 A1:T50 明确标记有界；DOCX/PPTX 表格正文沿既有结构保留来源。界面文字预览另限制64 KiB，原 records 仍按已成功收集的完整数据索引。没有语义/向量召回或跨语言同义保证。

## 验证

`node --test tests/mem03/donor*.test.mjs`：包含上游 chunker 1,200 例固定随机差分及 84 组边界参数、直接 donor 核心断言、来源/双工作树隔离、50 条之外的全量正式记录、撤权/取消/清空迟到回调、Library 更新/结构位置、敏感路径与 symlink 排除。

`node tests/mem03/performance.mjs --output <path>`：可配置、可重跑的本机实际测量；默认 1,000 份合成文档 / 10,000 分段 / 100 条正式记录，输出冷查询、暖查询 p50/p95、RSS、事件循环延迟、取消。结果由脚本实际计算，不使用上游跑分。
