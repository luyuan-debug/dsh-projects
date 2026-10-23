window.__ModuleLoader__.load({id:"dsh-project-threads-wave1-spike",factory:(require)=>{var module={exports:{}};var exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/product/client/thread-links.mjs
var thread_links_exports = {};
__export(thread_links_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(thread_links_exports);

// src/product/client/project-conversation-retention.mjs
function createConversationRetention(sessions) {
  const held = /* @__PURE__ */ new Map();
  let closed = false;
  function drop(id, expected) {
    const entry = held.get(id);
    if (!entry || expected && entry !== expected) return;
    held.delete(id);
    try {
      entry.data.release();
    } finally {
      entry.scope.release();
    }
  }
  return { acquire(id, projectId) {
    if (closed) throw Error("Project client is disposed");
    if (!held.has(id)) {
      const scope = sessions.retainAgentScope(id);
      let data;
      try {
        data = sessions.retain(id, { source: "controllerOperation" });
      } catch (error) {
        scope.release();
        throw error;
      }
      const entry = { scope, data, projectId };
      held.set(id, entry);
      void data.ready.catch(() => drop(id, entry));
    }
    return sessions.retain(id, { source: "controllerOperation" });
  }, releaseProject(projectId) {
    for (const [id, entry] of held) if (entry.projectId === projectId) drop(id);
  }, dispose() {
    if (closed) return;
    closed = true;
    for (const id of held.keys()) drop(id);
  } };
}

// src/product/client/project-navigation.mjs
function createProjectNavigation() {
  let latest = null, view = {};
  return { rememberState(value) {
    if (Array.isArray(value?.projects)) latest = value;
  }, rememberView(value) {
    view = { ...value };
  }, initial(fallback) {
    const state = latest ?? fallback;
    const ids = new Set(state.projects.map((p) => p.projectId));
    const selected = ids.has(view.selected) ? view.selected : ids.has(state.preferredProjectId) ? state.preferredProjectId : state.projects[0]?.projectId ?? "";
    const same = selected === view.selected;
    return { state, selected, threadId: same ? view.threadId ?? "" : "", overview: same ? view.overview ?? true : true, dataTab: same ? view.dataTab ?? "Threads" : "Threads", expanded: same ? view.expanded ?? false : false, create: state.projects.length === 0 };
  } };
}

// src/product/client/project-startup.mjs
async function readInitialProjectState(read, { signal, wait = abortableWait, delays = [50, 150, 400, 1e3, 2e3] } = {}) {
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    try {
      return await read();
    } catch (error) {
      if (signal?.aborted || error.name === "AbortError" || attempt >= delays.length || ![404, 503].includes(error.status) && !(error instanceof TypeError)) throw error;
      await wait(delays[attempt], signal);
    }
  }
}
function abortableWait(ms, signal) {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener("abort", abort);
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      cleanup();
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}

// src/product/client/project-client.mjs
var import_react6 = __toESM(require("react"), 1);
var import_react_dom2 = require("react-dom");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/product/client/project-ui.mjs
var import_react = __toESM(require("react"), 1);
var import_react_dom = require("react-dom");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/product/client/project-ui.css
var project_ui_default = `.pt-root{--pt-canvas:#fcfcfb;--pt-surface:#fff;--pt-line:#d9d9d8;--pt-ink:#202020;--pt-muted:#858581;--pt-soft:#f3f3f3;--pt-active:#e8e8e8;--pt-accent:#9a6b20;--pt-danger:#a63d37;--pt-focus:#557bb0;color:var(--pt-ink);font-family:inherit;font-size:13px;line-height:1.45;box-sizing:border-box}
.pt-root[data-theme=dark]{--pt-canvas:#191919;--pt-surface:#191919;--pt-line:#313131;--pt-ink:#ececea;--pt-muted:#aaa9a5;--pt-soft:#252525;--pt-active:#333333;--pt-accent:#d7b875;--pt-danger:#ef9d96;--pt-focus:#a6c4eb}
.pt-main{height:100%;min-height:0;display:flex;overflow:hidden;position:relative;background:var(--pt-canvas);container-type:inline-size}
.pt-main-column{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0}.pt-main-column[hidden]{display:none}
.pt-header{height:42px;flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px 0 14px}
.pt-project-title{display:flex;align-items:center;gap:7px;min-width:0;position:relative;flex:1}.pt-project-title h1{margin:0;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pt-project-icon{width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:#f0ebfc;color:#7762c7;border-radius:5px;flex:none}.pt-header-actions{display:flex;align-items:center;gap:3px;flex:none}.pt-main-notice{padding:6px 14px}
.pt-button{font:inherit;color:var(--pt-ink);background:var(--pt-surface);border:1px solid var(--pt-line);border-radius:6px;min-height:28px;max-width:100%;padding:4px 8px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;line-height:1.4;text-align:start;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere;transition:background .12s,border-color .12s}
.pt-button:hover{background:var(--pt-soft)}.pt-button:disabled{opacity:.48;cursor:default}.pt-button:focus-visible,.pt-input:focus-visible,.pt-details>summary:focus-visible,.pt-separator:focus-visible{outline:2px solid var(--pt-focus);outline-offset:2px}
.pt-ghost{border-color:transparent;background:transparent}.pt-icon{width:26px;min-height:26px;padding:4px;flex:none;border-color:transparent;background:transparent}.pt-icon>svg{width:15px;height:15px}.pt-header .pt-ghost{min-height:24px;padding:3px 5px}.pt-header .pt-ghost[aria-expanded=true]{background:var(--pt-active)}.pt-primary{background:var(--pt-ink);color:var(--pt-surface);border-color:var(--pt-ink)}.pt-primary:hover{opacity:.88;background:var(--pt-ink)}.pt-danger{color:var(--pt-danger)}
.pt-input{font:inherit;line-height:1.45;background:var(--pt-surface);color:var(--pt-ink);border:1px solid var(--pt-line);border-radius:7px;min-height:30px;min-width:0;max-width:100%;padding:5px 9px;box-sizing:border-box}.pt-input[type=checkbox]{min-height:auto;width:15px;height:15px;padding:0;accent-color:var(--pt-focus)}.pt-label{display:flex;flex-direction:column;gap:6px;font-size:13px;min-width:0}.pt-label:has(>.pt-input[type=checkbox]){flex-direction:row;align-items:center}.pt-fieldset{border:0;margin:0;padding:0;display:grid;gap:12px;min-width:0}.pt-fieldset legend{font-size:14px;font-weight:500;margin-bottom:12px;padding:0}
.pt-coordinator{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;padding:0 12px 8px}.pt-conversation-deck,.pt-conversation-seat{flex:1;min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden}.pt-conversation-seat[hidden]{display:none}
.pt-overview{flex:none;width:var(--pt-pane-width,360px);min-height:0;max-width:100%;display:flex;flex-direction:column;background:var(--pt-surface);border:1px solid var(--pt-line);border-radius:12px;margin:4px 8px 8px 0;box-shadow:0 1px 4px #00000010;position:relative;box-sizing:border-box;overflow:clip}.pt-overview[hidden]{display:none}
.pt-overview-head{height:36px;flex:none;display:flex;align-items:center;justify-content:space-between;gap:2px;padding:2px 5px;min-width:0;box-sizing:border-box}.pt-tabs{display:flex;gap:1px;min-width:0;align-items:center}.pt-tabs>.pt-button{padding:3px 5px;min-height:26px;white-space:nowrap;font-size:12px;gap:4px}.pt-tabs>.pt-button[aria-pressed=true]{background:var(--pt-active)}.pt-tabs svg{width:15px;height:15px}.pt-panel-tools{display:flex;align-items:center;gap:1px;flex:none}.pt-count{font-size:11px;line-height:16px;min-width:16px;text-align:center;background:#2878ca;color:white;border-radius:4px;padding:0 2px}
.pt-breadcrumb{display:flex;align-items:center;gap:5px;min-width:0;flex:1}.pt-breadcrumb>.pt-button{padding:3px;min-height:26px;white-space:nowrap;color:var(--pt-muted);font-size:12px;flex:none}.pt-breadcrumb>span[aria-hidden]{color:var(--pt-muted)}.pt-thread-title{display:flex;align-items:center;gap:6px;min-width:0;font-size:12px}.pt-thread-title>svg{flex:none}.pt-thread-title>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pt-thread-details{padding:6px;max-width:290px}.pt-thread-shell{flex:1;min-height:0;display:flex;flex-direction:column}.pt-thread-shell[hidden]{display:none}
.pt-scroll{overflow:auto;min-height:0;min-width:0;flex:1;padding:8px;scrollbar-gutter:stable}.pt-scroll[hidden]{display:none}.pt-thread-list{padding-top:10px}.pt-separator{width:6px;flex:none;cursor:col-resize;background:transparent;border:0;padding:0;touch-action:none}.pt-separator:hover{background:var(--pt-line)}.pt-separator[hidden]{display:none}
.pt-welcome{padding:8px 7px 20px;color:var(--pt-ink)}.pt-welcome h2{font-family:inherit;font-size:21px;line-height:1.4;font-weight:600;margin:0 0 4px}.pt-welcome p{font-size:12px;color:var(--pt-muted);margin:0}.pt-group-title{display:flex;width:100%;align-items:center;justify-content:flex-start;gap:9px;font-size:12px;font-weight:400;color:#666;background:var(--pt-soft);border:0;border-radius:6px;padding:5px 10px;margin:2px 0 4px;min-height:28px}.pt-root[data-theme=dark] .pt-group-title{color:var(--pt-muted)}.pt-group-title>span{width:12px;text-align:center}.pt-thread-group{margin:0 0 7px}.pt-thread-row{display:flex;align-items:center;justify-content:space-between;width:100%;border:0;border-radius:5px;background:transparent;padding:8px 16px 8px 32px;min-height:50px;gap:12px;font-size:12px;font-weight:400}.pt-thread-row:hover{background:var(--pt-soft)}.pt-row-copy{display:flex;flex:1;min-width:0;flex-direction:column;line-height:1.35;gap:2px}.pt-row-title,.pt-row-summary{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}.pt-row-summary{color:var(--pt-muted);font-size:12px}.pt-row-summary[data-status='Waiting on you']{color:var(--pt-accent)}.pt-row-time{color:var(--pt-muted);font-size:12px;flex:none;white-space:nowrap}.pt-group-empty{padding:9px 16px 14px 32px;font-size:12px;color:var(--pt-muted);margin:0}.pt-search{display:flex;gap:4px;padding:6px 8px}.pt-search .pt-input{width:100%}
.pt-task-card{border:1px solid var(--pt-line);border-radius:8px;background:var(--pt-surface);margin:8px 0;overflow:hidden}.pt-task-open{border:0;background:transparent;width:100%;padding:10px 12px;justify-content:flex-start;align-items:center;border-radius:0}.pt-task-open>svg{flex:none}.pt-task-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}.pt-task-copy strong{font-size:13px;font-weight:500;line-height:1.4;overflow-wrap:anywhere}.pt-task-copy small{font-size:12px;color:var(--pt-muted)}.pt-task-meta{padding:0 12px 8px 36px}.pt-status{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--pt-muted)}.pt-dot{width:5px;height:5px;border-radius:50%;background:currentColor}.pt-status[data-status=Working]{color:#438161}.pt-status[data-status='Waiting on you']{color:var(--pt-accent)}.pt-message-cards{margin:8px 0;max-width:600px}.pt-proposal{padding:12px 8px;border-bottom:1px solid var(--pt-line)}
.pt-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:28px 16px;color:var(--pt-muted);gap:10px}.pt-empty h3{font-size:14px;font-weight:500;color:var(--pt-ink);margin:0}.pt-empty p{font-size:13px;max-width:30ch;margin:0}
.pt-menu{position:relative;flex:none}.pt-menu-pop{position:absolute;right:0;top:calc(100% + 4px);z-index:30;min-width:180px;background:var(--pt-surface);border:1px solid var(--pt-line);padding:5px;border-radius:8px;box-shadow:0 6px 24px #0002}.pt-menu-pop>.pt-button{display:flex;width:100%;justify-content:flex-start;border:0;background:transparent}.pt-menu-pop>.pt-button:hover{background:var(--pt-soft)}.pt-menu-pop>.pt-button[aria-checked=true]{background:var(--pt-soft)}.pt-project-title>.pt-menu{position:static}.pt-project-title>.pt-menu>.pt-menu-pop{left:0;right:auto;max-width:calc(100vw - 48px)}.pt-project-picker{min-width:250px;display:grid;gap:4px;padding:6px}.pt-project-picker .pt-input{width:100%}.pt-project-picker .pt-label>.pt-input[type=checkbox]{width:15px}
.pt-dialog{width:min(950px,calc(100vw - 32px));height:min(760px,calc(100dvh - 90px));max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);margin:auto;padding:0;border:1px solid var(--pt-line);border-radius:12px;background:var(--pt-surface);color:var(--pt-ink);box-shadow:0 15px 50px #0003;overflow:hidden}.pt-dialog::backdrop{background:#0006}.pt-dialog[open]{display:flex;flex-direction:column}.pt-dialog-header{display:flex;justify-content:space-between;align-items:center;padding:12px 18px;border-bottom:1px solid var(--pt-line);flex:none}.pt-dialog-header h2{font-size:14px;margin:0;font-weight:500}.pt-dialog-header-compact{position:absolute;top:10px;right:10px;z-index:2;border:0;padding:0;background:transparent}.pt-dialog-header-compact h2{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.pt-settings-layout{display:flex;flex:1;min-height:0;flex-direction:column}.pt-settings-layout[hidden]{display:none}.pt-settings-body{display:flex;min-height:0;flex:1}.pt-settings-nav{width:192px;box-sizing:border-box;flex:none;border-right:1px solid var(--pt-line);padding:22px 12px;display:flex;flex-direction:column;gap:3px;background:var(--pt-surface)}.pt-settings-nav>p{margin:0 8px 10px;color:var(--pt-muted);font-size:12px}.pt-settings-nav .pt-button{justify-content:flex-start;border:0;background:transparent;min-height:32px;gap:12px}.pt-settings-nav .pt-button[aria-pressed=true]{background:var(--pt-active);font-weight:500}.pt-settings-nav .pt-environment-tab{margin-top:16px}.pt-settings-content{padding:44px 24px 24px;flex:1;min-width:0;min-height:0;overflow:auto}.pt-settings-section{display:grid;gap:20px}.pt-settings-section[hidden]{display:none}.pt-settings-section h3{font-size:14px;font-weight:500;margin:0 0 8px}.pt-settings-heading{font-size:14px;font-weight:600;margin:0 0 14px}.pt-setting-row{display:flex;flex-direction:row;justify-content:space-between;gap:20px;align-items:flex-start;min-width:0}.pt-setting-row>div:first-child{flex:1;min-width:0}.pt-setting-row>.pt-input,.pt-setting-row>.pt-model-controls{width:224px;flex:none}.pt-model-controls{display:grid;gap:7px;min-width:0}.pt-model-controls .pt-input{width:100%}.pt-setting-row p{margin:5px 0 0}.pt-help{font-size:12px;color:var(--pt-muted);margin:0}.pt-character-count{text-align:right;font-size:12px;color:var(--pt-muted)}.pt-footer{border-top:1px solid var(--pt-line);padding:10px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex:none}.pt-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.pt-banner{padding:8px 12px;background:var(--pt-soft);display:flex;gap:10px;align-items:center;font-size:12px;flex:none}.pt-error{padding:10px 12px;border:1px solid color-mix(in srgb,var(--pt-danger) 30%,var(--pt-line));background:var(--pt-surface);border-radius:8px;display:flex;gap:10px;align-items:center;overflow-wrap:anywhere;color:var(--pt-danger)}.pt-error p{margin:4px 0;font-size:12px}.pt-error>div{flex:1;min-width:0}.pt-details{font-size:12px;color:var(--pt-muted);overflow-wrap:anywhere}.pt-details>summary{cursor:pointer;padding:6px 0}.pt-code{white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto;font-size:12px;line-height:1.5;background:var(--pt-soft);padding:10px;border-radius:6px}.pt-danger-zone{border-top:1px solid var(--pt-line);padding-top:20px;margin-top:24px}.pt-lifecycle-rows{display:grid;gap:22px}.pt-lifecycle-row{display:flex;gap:16px;justify-content:space-between;align-items:flex-start}.pt-lifecycle-row>div{flex:1;min-width:0}.pt-lifecycle-row p{margin:4px 0 0}.pt-lifecycle-row>.pt-button{flex:none}
.pt-library-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:2px 0 8px}.pt-library-head h3{font-size:12px;font-weight:400;margin:0;color:var(--pt-muted)}.pt-file-row{display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--pt-soft);padding:4px 2px}.pt-file-row>.pt-button{border:0;background:transparent;justify-content:flex-start;flex:1;min-width:0;padding:5px 0}.pt-file-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.pt-file-copy strong{font-size:12px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pt-file-copy small{font-size:11px;color:var(--pt-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pt-file-icon{display:flex;align-items:center;justify-content:center;width:26px;height:28px;border:1px solid var(--pt-line);border-radius:4px;font-size:8px;flex:none;color:var(--pt-muted);background:var(--pt-surface)}
.pt-reader{display:flex;flex-direction:column;gap:12px;min-width:0}.pt-reader-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.pt-reader-title{font-size:14px;font-weight:500;margin:0;overflow-wrap:anywhere}.pt-reader-source{font-size:12px;color:var(--pt-muted);margin:0}.pt-reader-content{font-size:13px;overflow-wrap:anywhere}.pt-reader-content p{white-space:pre-wrap;margin:8px 0;line-height:1.65}.pt-reader-content h3{font-size:15px;line-height:1.5}.pt-reader-table-wrap{overflow:auto;max-width:100%}.pt-reader-table{border-collapse:collapse;min-width:100%;font-size:12px}.pt-reader-table th,.pt-reader-table td{border:1px solid var(--pt-line);padding:6px 8px;text-align:start;vertical-align:top;white-space:pre-wrap;min-width:60px}.pt-reader-table th{background:var(--pt-soft);font-weight:500}.pt-reader-image{display:block;max-width:100%;max-height:480px;object-fit:contain;margin:auto}.pt-image-view{overflow:auto;background:var(--pt-surface);padding:8px;border:1px solid var(--pt-line);border-radius:6px}.pt-reader-range{display:flex;gap:8px;flex-wrap:wrap;align-items:end;padding:8px;background:var(--pt-soft);border-radius:6px}.pt-reader-range .pt-input{max-width:120px}.pt-reading-expanded{width:min(1120px,calc(100vw - 64px));height:calc(100dvh - 90px)}.pt-memory-list{display:grid;gap:0}.pt-memory-item{border:0;border-bottom:1px solid var(--pt-line);padding:12px 0}.pt-memory-item header{display:flex;justify-content:space-between;align-items:center;gap:10px}.pt-memory-item h4{margin:0;font-size:13px;font-weight:500}.pt-memory-item p{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:130px;overflow:auto}.pt-auth{display:grid;gap:10px;font-size:13px}.pt-auth-card{border:1px solid var(--pt-line);border-radius:12px;background:var(--pt-surface);padding:13px;display:grid;gap:10px;box-shadow:0 1px 4px #0001;overflow-wrap:anywhere}.pt-auth-card p{margin:0}.pt-auth-card .pt-input{width:100%}.pt-auth-head{display:flex;gap:7px;align-items:center;font-size:13px;font-weight:500}.pt-auth-divider{border:0;border-top:1px solid var(--pt-line);margin:5px 0}.pt-auth-add{justify-content:flex-start;border:0;background:transparent;padding-left:0}.pt-divider{border:0;border-top:1px solid var(--pt-line);margin:14px 0}
.pt-main[data-expanded=true]>.pt-overview{flex:1;width:auto;margin-left:8px}.pt-main[data-narrow=true]>.pt-overview{position:absolute;inset:0;width:auto!important;margin:4px 6px 6px;z-index:10}.pt-main[data-narrow=true] .pt-main-column[data-obscured=true]{visibility:hidden}.pt-main[data-narrow=true] .pt-overview-label{display:none}
@container(max-width:720px){.pt-overview-label{display:none}.pt-header{padding-left:10px;padding-right:6px;gap:4px}.pt-project-title{gap:4px}}
@media(max-width:650px){.pt-settings-body{flex-direction:column}.pt-settings-nav{width:auto;flex-direction:row;border-right:0;border-bottom:1px solid var(--pt-line);padding:8px}.pt-settings-nav>p{display:none}.pt-settings-nav .pt-environment-tab{margin-top:0}.pt-settings-content{padding:18px}.pt-dialog{height:calc(100dvh - 24px)}.pt-setting-row{flex-wrap:wrap}.pt-setting-row>.pt-model-controls,.pt-setting-row>.pt-input{width:100%}.pt-dialog-header-compact{top:7px;right:7px}.pt-settings-nav{padding-right:40px}}
@media(prefers-reduced-motion:reduce){.pt-button{transition:none}}

.pt-library-columns{display:flex;justify-content:space-between;padding:7px 4px;border-bottom:1px solid var(--pt-line);font-size:12px;color:var(--pt-muted)}.pt-file-preview-layout{display:flex;flex:1;min-height:0;min-width:0}.pt-file-source-thread{width:33%;min-width:280px;display:flex;flex-direction:column;border-left:1px solid var(--pt-line)}.pt-file-source-thread>header{font-size:12px;padding:10px 12px;border-bottom:1px solid var(--pt-line);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pt-file-preview-layout>.pt-scroll{padding:18px}.pt-file-preview-layout .pt-image-view{border:0;padding:0}.pt-file-preview-layout .pt-reader-image{max-height:calc(100dvh - 230px)}
@media(max-width:700px){.pt-file-source-thread{width:45%;min-width:240px}.pt-file-preview-layout{overflow:auto}}

.pt-settings-section .pt-input[aria-label="\u9879\u76EE\u76EE\u6807"]{min-height:78px}

/* Conversation-linked cards are distinct from the flat Overview rows. */
.pt-message-cards .pt-task-card{width:320px;max-width:100%;background:var(--pt-soft);border:0;border-radius:10px;margin:8px 0}.pt-message-cards .pt-task-open{height:50px;padding:10px 20px;gap:14px}.pt-message-cards .pt-task-copy{flex:0 1 auto}.pt-message-cards .pt-task-copy strong{font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pt-card-dot{width:5px;height:5px;border:1px solid var(--pt-muted);border-radius:50%;flex:none}.pt-card-dot[data-status=Working]{background:#438161;border-color:#438161}.pt-card-dot[data-status='Waiting on you']{background:var(--pt-accent);border-color:var(--pt-accent)}

.pt-native-home,.pt-preview-native-target{display:flex;flex:1;min-height:0;min-width:0;flex-direction:column}.pt-native-home[hidden]{display:none}.pt-resource-dock{max-height:42vh;overflow:auto;padding:2px 2px 12px}.pt-resource-dock:empty{display:none}.pt-resource-dock .pt-auth-card{margin:0}.pt-auth-heading{display:flex;align-items:center;justify-content:space-between;gap:6px}.pt-auth-options{display:grid;gap:10px;padding-top:8px}.pt-auth-target{padding:6px 8px;background:var(--pt-soft);border-radius:6px;overflow-wrap:anywhere}.pt-resource-entry{padding:10px 0;border-bottom:1px solid var(--pt-line);overflow-wrap:anywhere}.pt-request-note{font-size:12px;color:var(--pt-muted);margin:4px 0}

.pt-root.pt-preview-overlay{position:fixed;inset:0;z-index:20;background:#0006}.pt-preview-overlay>.pt-dialog{position:absolute;inset:0}

/* Public layout clearance is zero on Web/expanded sidebar; reserve it only where the plugin reaches the leading frame edge. */
.pt-header{padding-left:max(14px,var(--dsh-frame-leading-clearance,0px))}
.pt-main[data-narrow=true]>.pt-overview>.pt-overview-head,.pt-main[data-expanded=true]>.pt-overview>.pt-overview-head{padding-left:max(8px,var(--dsh-frame-leading-clearance,0px))}
.pt-preview-overlay>.pt-dialog{display:flex;flex-direction:column;position:absolute;inset:0;outline:none}

.pt-tool-choice{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 0;border-bottom:1px solid var(--pt-line)}.pt-tool-choice>.pt-actions{flex-wrap:wrap;flex:none}.pt-tool-choice .pt-help{margin:3px 0}.pt-tool-choice strong{overflow-wrap:anywhere}

/* Memory retains the existing Settings layout and shares its semantic theme tokens. */
.pt-memory-panel{display:grid;gap:16px;margin-top:24px;min-width:0;border-top:1px solid var(--pt-line);padding-top:20px}.pt-memory-panel h4{margin:0;font-size:13px;font-weight:500;overflow-wrap:anywhere}.pt-memory-panel .pt-library-head{margin:0}.pt-memory-panel .pt-help{line-height:1.55}.pt-memory-panel .pt-button{min-height:32px}.pt-memory-panel input:not([type=checkbox]),.pt-memory-panel textarea{width:100%;box-sizing:border-box}.pt-memory-search,.pt-memory-editor{display:grid;gap:12px;min-width:0}.pt-memory-search>.pt-actions{justify-content:flex-end}.pt-memory-search>.pt-actions>.pt-label{margin-right:auto}.pt-memory-list-controls{display:flex;gap:12px;justify-content:space-between;align-items:end}.pt-memory-list-controls .pt-label{flex-direction:row;align-items:center}.pt-memory-files{display:grid;gap:2px;min-width:0}.pt-memory-file{display:flex;justify-content:flex-start;gap:10px;border:0;background:transparent;text-align:start;width:100%;padding:9px 8px;min-height:52px!important}.pt-memory-file:hover,.pt-memory-file[aria-pressed=true]{background:var(--pt-soft)}.pt-memory-file>svg{flex:none;color:var(--pt-muted)}.pt-memory-file>span{display:flex;flex-direction:column;gap:4px;min-width:0}.pt-memory-file strong{font-size:13px;font-weight:500;overflow-wrap:anywhere}.pt-memory-file small{font-size:12px;color:var(--pt-muted);line-height:1.5;overflow-wrap:anywhere}.pt-memory-reader,.pt-memory-source-preview,.pt-memory-editor,.pt-memory-index-confirm{border:1px solid var(--pt-line);border-radius:8px;padding:14px;display:grid;gap:12px;min-width:0}.pt-memory-reader>header,.pt-memory-source-preview>header{display:flex;gap:12px;justify-content:space-between;align-items:center}.pt-memory-content{font:12px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto;margin:0;background:var(--pt-soft);border-radius:6px;padding:12px}.pt-memory-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pt-memory-sources{padding:0;margin:0;list-style:none;display:grid;gap:4px}.pt-memory-sources>li{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}.pt-memory-sources .pt-button{font-size:12px;text-align:start;overflow-wrap:anywhere;white-space:normal;max-width:100%}.pt-memory-notice{font-size:12px;line-height:1.6;overflow-wrap:anywhere;background:var(--pt-soft);padding:8px 10px;border-radius:6px;margin:0}.pt-memory-notice p{margin:2px 0}.pt-memory-evidence,.pt-memory-used{border-top:1px solid var(--pt-line);padding-top:12px;font-size:13px;display:block}.pt-memory-evidence>summary,.pt-memory-used>summary,.pt-memory-packet>summary{cursor:pointer;min-height:32px;line-height:1.6;padding:4px 0;box-sizing:border-box}.pt-memory-evidence>.pt-label{margin:12px 0}.pt-memory-evidence>.pt-help,.pt-memory-used>.pt-help{margin:8px 0}.pt-memory-index-confirm{margin-top:12px}.pt-memory-index-confirm ul{padding-left:20px;margin:0;overflow-wrap:anywhere}.pt-memory-index-confirm p{font-size:12px;margin:0;line-height:1.6}.pt-memory-results{display:grid;gap:16px}.pt-memory-result-group{display:grid;gap:8px;min-width:0}.pt-memory-result{border-bottom:1px solid var(--pt-line);padding:10px 0;display:grid;gap:8px;min-width:0;font-size:13px}.pt-memory-result>strong{overflow-wrap:anywhere;font-weight:500}.pt-memory-snippet{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto;font-size:12px;line-height:1.6}.pt-memory-packet{margin-top:8px;padding:6px 10px;border:1px solid var(--pt-line);border-radius:6px;font-size:12px;overflow-wrap:anywhere}.pt-memory-packet .pt-memory-item>p{margin:6px 0;line-height:1.6}.pt-memory-editor fieldset{max-height:240px;overflow:auto}.pt-memory-editor fieldset label{font-size:12px;overflow-wrap:anywhere}.pt-memory-panel :focus-visible{outline:2px solid var(--pt-focus);outline-offset:3px}
@media(max-width:650px){.pt-memory-panel .pt-library-head{align-items:flex-start;flex-wrap:wrap}.pt-memory-fields{grid-template-columns:1fr}.pt-memory-list-controls{flex-wrap:wrap}.pt-memory-reader,.pt-memory-editor,.pt-memory-source-preview{padding:10px}.pt-memory-content{max-height:300px}}

.pt-memory-library-scope{margin-top:12px}.pt-memory-library-scope>.pt-label{margin:10px 0;font-size:12px;overflow-wrap:anywhere}.pt-memory-library-scope>summary{cursor:pointer;min-height:32px;line-height:1.6}
.pt-hindsight{border-top:1px solid var(--pt-line);padding-top:12px;font-size:13px;min-width:0}.pt-hindsight>summary,.pt-hindsight-body details>summary{cursor:pointer;min-height:32px;box-sizing:border-box;padding:4px 0;line-height:1.6;overflow-wrap:anywhere}.pt-hindsight-body,.pt-hindsight-form,.pt-hindsight-recall,.pt-hindsight-status{display:grid;gap:12px;min-width:0}.pt-hindsight-body{padding-top:12px}.pt-hindsight-form fieldset{border:1px solid var(--pt-line);border-radius:8px;padding:12px;gap:10px}.pt-hindsight-form fieldset legend{margin:0;padding:0 4px;font-size:13px}.pt-hindsight .pt-label:has(>.pt-input[type=checkbox]){align-items:flex-start;line-height:1.6}.pt-hindsight .pt-input[type=checkbox]{flex:none;margin-top:3px}.pt-hindsight-budget{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:10px 0}.pt-hindsight-status dl,.pt-hindsight-meta{display:grid;grid-template-columns:minmax(90px,auto) minmax(0,1fr);gap:6px 12px;margin:0;font-size:12px;line-height:1.6}.pt-hindsight-status dt,.pt-hindsight-meta dt{color:var(--pt-muted)}.pt-hindsight-status dd,.pt-hindsight-meta dd{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}.pt-hindsight-history{display:grid;gap:8px;padding-top:10px;border-top:1px solid var(--pt-line);min-width:0}.pt-hindsight-history .pt-memory-snippet{max-height:220px}.pt-hindsight-disconnect{border-top:1px solid var(--pt-line);padding-top:12px}.pt-hindsight-disconnect>div{margin-top:10px;display:grid;gap:10px}.pt-hindsight .pt-actions>.pt-button{max-width:100%;white-space:normal;overflow-wrap:anywhere;text-align:start}.pt-hindsight-outbox .pt-memory-item{display:grid;gap:8px}
@media(max-width:650px){.pt-hindsight-budget{grid-template-columns:minmax(0,1fr)}.pt-hindsight-form fieldset{padding:10px}.pt-hindsight-status dl,.pt-hindsight-meta{grid-template-columns:minmax(0,1fr);gap:2px}.pt-hindsight-status dd,.pt-hindsight-meta dd{margin-bottom:6px}}
`;

// src/product/client/project-ui.mjs
var h = (tag, props, ...children) => import_react.default.createElement(tag, typeof tag === "string" ? { ...props, className: [{ button: "pt-button", input: "pt-input", select: "pt-input", textarea: "pt-input", fieldset: "pt-fieldset", label: "pt-label", details: "pt-details", pre: "pt-code" }[tag], props?.className].filter(Boolean).join(" ") } : props, ...children);
function installStyles(ctx) {
  ctx.effect(() => {
    const tag = document.createElement("style");
    tag.dataset.projectThreadsStyle = "ui02";
    tag.textContent = project_ui_default;
    document.head.append(tag);
    return () => tag.remove();
  });
}
function Icon({ name, size = 18 }) {
  const paths = { download: "M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4", folder: "M3 6h7l2 2h9v12H3z M3 6V4h7l2 2", library: "M5 3h14v18H5z M5 16h14 M8 7h8 M8 10h6", search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6", sort: "M4 6h16 M7 12h10 M10 18h4", collapse: "M3 8h5V3 M21 8h-5V3 M3 16h5v5 M21 16h-5v5", brain: "M9 4a3 3 0 0 0-5 3 4 4 0 0 0 0 7 4 4 0 0 0 5 6 M15 4a3 3 0 0 1 5 3 4 4 0 0 1 0 7 4 4 0 0 1-5 6 M12 3v18", computer: "M3 4h18v12H3z M8 21h8 M12 16v5", chevron: "M6 9l6 6 6-6", panel: "M4 4h16v16H4z M13 4v16 M16 8h2 M16 12h2", settings: "M10 3h4l.5 2.4 2 1.2 2.4-.8 2 3.4-1.8 1.7v2.2l1.8 1.7-2 3.4-2.4-.8-2 1.2L14 21h-4l-.5-2.4-2-1.2-2.4.8-2-3.4 1.8-1.7v-2.2L3.1 9.2l2-3.4 2.4.8 2-1.2z M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7", more: "M5 12h.01 M12 12h.01 M19 12h.01", add: "M12 5v14 M5 12h14", back: "M14 5l-7 7 7 7", close: "M6 6l12 12 M18 6L6 18", file: "M5 3h9l5 5v13H5z M14 3v6h5 M8 13h8 M8 17h6", chat: "M4 4h16v12H9l-5 4z", arrow: "M5 12h14 M13 6l6 6-6 6", expand: "M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5", check: "M5 12l4 4L19 6" };
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, h("path", { d: paths[name] ?? paths.file }));
}
var Button = ({ children, icon, kind = "", ...props }) => h("button", { type: "button", title: props.title ?? props["aria-label"] ?? (typeof children === "string" ? children : void 0), ...props, className: ["pt-button", kind && "pt-" + kind, props.className].filter(Boolean).join(" ") }, icon && h(Icon, { name: icon }), children);
var Status = ({ value }) => h("span", { className: "pt-status", "data-status": value }, h("span", { className: "pt-dot", "aria-hidden": true }), { Working: "\u8FDB\u884C\u4E2D", "Waiting on you": "\u5F85\u4F60\u786E\u8BA4", Idle: "\u7A7A\u95F2", active: "\u8FDB\u884C\u4E2D", paused: "\u5DF2\u6682\u505C", archived: "\u5DF2\u5F52\u6863", deleting: "\u6E05\u7406\u4E2D" }[value] ?? value);
var Empty = ({ title, children, icon = "chat", action }) => h("div", { className: "pt-empty" }, h(Icon, { name: icon, size: 28 }), h("h3", null, title), children && h("p", null, children), action);
var Details = ({ label = "\u8BE6\u60C5", value }) => h("details", { className: "pt-details" }, h("summary", null, label), h("pre", { className: "pt-code" }, typeof value === "string" ? value : JSON.stringify(value, null, 2)));
function Modal({ title, children, onClose, className = "", theme = "light", compactHeader = false, actions }) {
  const ref = import_react.default.useRef(null);
  (0, import_dsh_client_ui_primitives.useModalLayer)(ref, true, onClose);
  return (0, import_react_dom.createPortal)(h("div", { className: "pt-root pt-preview-overlay", "data-theme": theme }, h("div", { ref, role: "dialog", "aria-modal": true, tabIndex: -1, className: "pt-dialog " + className, "aria-label": title, "data-pt-overlay": "dialog" }, h("header", { className: "pt-dialog-header" + (compactHeader ? " pt-dialog-header-compact" : "") }, h("h2", null, title), h("div", { className: "pt-actions" }, actions, h(Button, { "aria-label": "\u5173\u95ED" + title, icon: "close", kind: "icon", onClick: onClose }))), children)), document.body);
}
function Menu({ label = "\u66F4\u591A\u64CD\u4F5C", children, icon = "more" }) {
  const [open, setOpen] = import_react.default.useState(false), ref = import_react.default.useRef(null);
  import_react.default.useEffect(() => {
    if (open) ref.current.querySelector(".pt-menu-pop button, .pt-menu-pop select")?.focus();
  }, [open]);
  return h("div", { className: "pt-menu", ref, onBlur: (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
  }, onKeyDown: (e) => {
    if (open && ["ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      const items = [...ref.current.querySelectorAll("[role^=menuitem]")], i = items.indexOf(document.activeElement);
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    }
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
      ref.current.querySelector("button")?.focus();
    }
  } }, h(Button, { "aria-label": label, "aria-expanded": open, "aria-haspopup": "menu", icon, kind: "icon", onClick: () => setOpen(!open) }), open && h("div", { className: "pt-menu-pop", "data-pt-overlay": "menu", role: "menu", onClick: () => setOpen(false) }, children));
}
function ErrorNotice({ message, onRetry, onDismiss }) {
  const ref = import_react.default.useRef(null);
  import_react.default.useEffect(() => {
    if (message) ref.current?.scrollIntoView({ block: "nearest" });
  }, [message]);
  if (!message) return null;
  const raw = String(message), summary = /DTD|entity declarations|UNSAFE_XML/i.test(raw) ? "\u6587\u6863\u542B\u4E0D\u5141\u8BB8\u7684 XML \u58F0\u660E\uFF0C\u8BFB\u53D6\u5DF2\u62D2\u7EDD\u3002" : /version|revision|conflict|changed during|settings changed in another view/i.test(raw) ? "\u5185\u5BB9\u7248\u672C\u5DF2\u53D8\u5316\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\uFF1B\u672A\u8986\u76D6\u4F60\u7684\u7F16\u8F91\u3002" : /image input|MODEL_IMAGE/i.test(raw) ? "\u5F53\u524D\u6A21\u578B\u672A\u58F0\u660E\u89C6\u89C9\u8F93\u5165\uFF1B\u8BF7\u9009\u62E9\u5DF2\u83B7\u6388\u6743\u7684\u89C6\u89C9\u6A21\u578B\u3002" : /encrypted|password/i.test(raw) ? "\u6682\u4E0D\u652F\u6301\u8BFB\u53D6\u52A0\u5BC6\u6587\u6863\u3002" : /limit|exceeds|timeout/i.test(raw) ? "\u8BFB\u53D6\u8303\u56F4\u6216\u5904\u7406\u65F6\u95F4\u8D85\u9650\uFF0C\u8BF7\u7F29\u5C0F\u8303\u56F4\u540E\u91CD\u8BD5\u3002" : raw;
  return h("div", { ref, className: "pt-error", role: "alert" }, h("div", null, h("strong", null, "\u64CD\u4F5C\u672A\u5B8C\u6210"), h("p", null, summary), summary !== raw && h(Details, { label: "\u9519\u8BEF\u8BE6\u60C5", value: raw })), onRetry && h(Button, { onClick: onRetry }, "\u91CD\u8BD5"), onDismiss && h(Button, { icon: "close", kind: "icon", "aria-label": "\u5173\u95ED\u9519\u8BEF\u63D0\u793A", onClick: onDismiss }));
}
var basename = (path) => path?.split("/").filter(Boolean).at(-1) ?? "\u5DE5\u4F5C\u533A";
function ThreadCard({ title, status, onOpen, subtitle, children }) {
  const label = { Working: "\u8FDB\u884C\u4E2D", "Waiting on you": "\u7B49\u5F85\u60A8\u5904\u7406", Idle: "\u7A7A\u95F2" }[status] ?? status;
  return h("article", { className: "pt-task-card" }, h(Button, { className: "pt-task-open", onClick: onOpen, "aria-label": title + " \u2014 \u67E5\u770B\u8BA8\u8BBA\u4E32 \u2014 " + label, title: title + " \xB7 " + label }, h("span", { className: "pt-card-dot", "data-status": status, "aria-hidden": true }), h("span", { className: "pt-task-copy" }, h("strong", null, title)), h(Icon, { name: "computer", size: 16 })), children);
}
function ThreadRow({ title, status, summary, time, onOpen }) {
  return h("button", { type: "button", className: "pt-thread-row", onClick: onOpen, title, "aria-label": title }, h("span", { className: "pt-row-copy" }, h("span", { className: "pt-row-title" }, title), h("span", { className: "pt-row-summary", "data-status": status }, summary ?? ({ Working: "\u6B63\u5728\u5904\u7406", "Waiting on you": "\u7B49\u5F85\u60A8\u5904\u7406", Idle: "\u7A7A\u95F2" }[status] ?? status))), time && h("time", { dateTime: new Date(time).toISOString(), className: "pt-row-time" }, new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(time))));
}

// src/product/client/project-data.mjs
var import_react3 = __toESM(require("react"), 1);

// src/product/client/project-projection.mjs
function createProjectProjection(read) {
  const entries = /* @__PURE__ */ new Map(), empty = { data: null, error: null };
  let disposed = false;
  function entry(id) {
    if (!entries.has(id)) entries.set(id, { state: empty, listeners: /* @__PURE__ */ new Set(), seq: 0, loop: 0, timer: null, abort: null });
    return entries.get(id);
  }
  async function refresh(id) {
    if (id === null || disposed) return;
    const e = entry(id), seq = ++e.seq;
    e.abort?.abort();
    const abort = new AbortController();
    e.abort = abort;
    try {
      const data = await read(id, abort.signal);
      if (!disposed && seq === e.seq) {
        e.state = { data, error: null };
        e.listeners.forEach((fn) => fn());
      }
      return data;
    } catch (error) {
      if (error.name !== "AbortError" && !disposed && seq === e.seq) {
        e.state = { ...e.state, error: error.message };
        e.listeners.forEach((fn) => fn());
        throw error;
      }
    }
  }
  function subscribe(id, listener) {
    if (id === null || disposed) return () => {
    };
    const e = entry(id), subscription = () => listener();
    e.listeners.add(subscription);
    if (e.listeners.size === 1) {
      const loop = ++e.loop;
      const active = () => !disposed && e.loop === loop && e.listeners.size > 0;
      const tick = async () => {
        if (!active()) return;
        e.timer = null;
        try {
          await refresh(id);
        } catch {
        }
        if (active()) e.timer = setTimeout(tick, 1500);
      };
      void tick();
    }
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      e.listeners.delete(subscription);
      if (!e.listeners.size) {
        e.loop++;
        clearTimeout(e.timer);
        e.timer = null;
        e.abort?.abort();
        e.seq++;
      }
    };
  }
  return { get: (id) => id === null ? empty : entry(id).state, subscribe, refresh, dispose() {
    disposed = true;
    for (const e of entries.values()) {
      e.loop++;
      clearTimeout(e.timer);
      e.timer = null;
      e.abort?.abort();
      e.seq++;
      e.listeners.clear();
    }
  } };
}
function createReadGeneration() {
  let generation = 0;
  return { next: () => ++generation, isCurrent: (value) => value === generation, invalidate: () => ++generation };
}

// src/product/client/project-memory.mjs
var import_react2 = __toESM(require("react"), 1);
var statusName = (value) => ({ active: "\u5F53\u524D", candidate: "\u5019\u9009", superseded: "\u5DF2\u66FF\u4EE3", archived: "\u5DF2\u5F52\u6863", forgotten: "\u5DF2\u5FD8\u8BB0" })[value] ?? value ?? "\u5F53\u524D";
var kindNames = { brief: "\u9879\u76EE\u6982\u8981", requirement: "\u9700\u6C42", constraint: "\u7EA6\u675F", decision: "\u51B3\u5B9A", open_question: "\u5F85\u89E3\u51B3\u95EE\u9898", observation: "\u89C2\u5BDF", lesson: "\u7ECF\u9A8C", procedure: "\u6D41\u7A0B", reference: "\u53C2\u8003" };
var scopeName = (scope) => scope?.kind === "thread" ? "Thread \xB7 " + scope.threadId : "\u6574\u4E2A\u9879\u76EE";
var stamp = (value) => value ? new Date(value).toLocaleString() : "\u672A\u8BB0\u5F55";
var sourceName = (source) => source?.logicalPath ?? source?.name ?? source?.path ?? source?.itemId ?? source?.sourceMessageId ?? source?.messageId ?? source?.threadId ?? source?.kind ?? "\u67E5\u770B\u6765\u6E90";
var operationId = () => crypto.randomUUID();
var historyStatus = (status) => ["superseded", "archived"].includes(status);
var warningText = (warning) => typeof warning === "string" ? warning : warning?.message ?? JSON.stringify(warning);
var updated = (value) => typeof value === "number" ? value : Date.parse(value ?? "") || 0;
var hindsightDefaults = { revision: 0, enabled: false, endpoint: "", tokenEnv: "", bankId: "", ownership: "external", bankScopeConfirmed: false, recallEnabled: true, retainEnabled: false, shareReportsConfirmed: false, routeAuthorization: "unknown", dataEgressAcknowledged: false, waitMs: 2e3, historyBytes: 6e3, maxResults: 6, maxItemBytes: 2e3, responseBytes: 262144, queryBytes: 4e3 };
var hindsightFields = ["enabled", "endpoint", "tokenEnv", "bankId", "bankScopeConfirmed", "recallEnabled", "retainEnabled", "shareReportsConfirmed", "routeAuthorization", "dataEgressAcknowledged", "waitMs", "historyBytes", "maxResults", "maxItemBytes", "responseBytes", "queryBytes"];
var editableHindsight = (config) => Object.fromEntries(hindsightFields.map((key) => [key, config[key]]));
var hindsightStateNames = { not_checked: "\u672A\u68C0\u67E5", checking: "\u68C0\u67E5\u4E2D", not_tested: "\u672A\u5B9E\u6D4B", not_validated: "\u672A\u9A8C\u8BC1", disabled: "\u5173\u95ED", ok: "\u901A\u8FC7", passed: "\u901A\u8FC7", available: "\u53EF\u7528", success: "\u901A\u8FC7", reachable: "\u53EF\u8FBE", accessible: "\u53EF\u8BBF\u95EE", accesssible: "\u53EF\u8BBF\u95EE", healthy: "\u5065\u5EB7", unhealthy: "\u5F02\u5E38", ready: "\u5DF2\u8FD4\u56DE\u5386\u53F2", completed: "\u5DF2\u786E\u8BA4", confirmed: "\u5DF2\u786E\u8BA4", accepted: "\u5DF2\u63A5\u6536", queued: "\u6392\u961F\u4E2D", pending: "\u7B49\u5F85\u4E2D", sending: "\u53D1\u9001\u4E2D", empty: "\u65E0\u5339\u914D\u7ED3\u679C", degraded: "\u5DF2\u964D\u7EA7\u4E3A\u672C\u5730\u8BB0\u5FC6", readonly: "\u53EA\u8BFB\uFF08\u672A\u542F\u7528\u5199\u56DE\uFF09", timeout: "\u8D85\u65F6", error: "\u9519\u8BEF", failed: "\u5931\u8D25", unknown: "\u672A\u77E5", uncertain: "\u7ED3\u679C\u672A\u77E5", unauthorized: "\u8BA4\u8BC1\u5931\u8D25", forbidden: "\u6743\u9650\u4E0D\u8DB3", unsupported: "\u4E0D\u517C\u5BB9", not_authorized: "\u672A\u6388\u6743", budget_not_authorized: "\u8D39\u7528\u672A\u6388\u6743", cancelled: "\u5DF2\u53D6\u6D88", paused: "\u6682\u505C", suppressed: "\u5DF2\u5728\u672C\u9879\u76EE\u6291\u5236", offline: "\u79BB\u7EBF", skipped: "\u5DF2\u8DF3\u8FC7", delete_pending: "\u8FDC\u7AEF\u5220\u9664\u5F85\u786E\u8BA4", deleted: "\u8FDC\u7AEF\u6587\u6863\u5DF2\u5220\u9664", binding_not_confirmed: "\u8FDE\u63A5\u6216\u8BB0\u5FC6\u5E93\u8303\u56F4\u672A\u786E\u8BA4", route_or_cost_not_authorized: "\u6A21\u578B\u8DEF\u7531\u6216\u8D39\u7528\u672A\u6388\u6743", recall_disabled: "\u53EC\u56DE\u5DF2\u5173\u95ED", private_scope_not_shared: "\u79C1\u6709\u8303\u56F4\u672A\u6388\u6743\u5171\u4EAB", paused_after_forget: "\u5FD8\u8BB0\u540E\u6682\u505C\u589E\u5F3A", another_automatic_memory_hook: "\u68C0\u6D4B\u5230\u91CD\u590D\u81EA\u52A8\u8BB0\u5FC6\uFF0C\u589E\u5F3A\u5DF2\u6682\u505C", not_a_task_message: "\u975E\u4EFB\u52A1\u6D88\u606F\uFF0C\u672A\u53EC\u56DE", binding_changed_wait_next_turn: "\u7ED1\u5B9A\u5DF2\u53D8\u66F4\uFF0C\u7B49\u5F85\u4E0B\u4E00\u56DE\u5408", automatic_recall_already_spent_or_capacity: "\u672C\u56DE\u5408\u5DF2\u53EC\u56DE\u6216\u8FBE\u5230\u8BB0\u5F55\u4E0A\u9650", "user-declared-local-free": "\u7528\u6237\u58F0\u660E\u4EC5\u672C\u5730\u4E14\u65E0\u8BA1\u8D39\uFF08\u672A\u5B9E\u6D4B\uFF09", "user-declared-external-approved": "\u7528\u6237\u58F0\u660E\u5DF2\u6388\u6743\u5916\u90E8\u670D\u52A1\u53CA\u8D39\u7528\uFF08\u672A\u5B9E\u6D4B\uFF09" };
var capabilityName = (value) => hindsightStateNames[value] ?? value ?? "\u672A\u68C0\u67E5";
var hindsightMessages = { "Project lifecycle changed": "\u9879\u76EE\u72B6\u6001\u5DF2\u53D8\u5316\uFF0C\u7B49\u5F85\u4E2D\u7684\u589E\u5F3A\u64CD\u4F5C\u5DF2\u53D6\u6D88\u3002", "Project access changed": "\u9879\u76EE\u8BBF\u95EE\u5DF2\u53D8\u5316\uFF0C\u7B49\u5F85\u4E2D\u7684\u589E\u5F3A\u64CD\u4F5C\u5DF2\u53D6\u6D88\u3002", "External history paused after forgetting; derived or synonymous memories may remain remotely.": "\u5FD8\u8BB0\u540E\u5DF2\u6682\u505C\u5916\u90E8\u5386\u53F2\uFF0C\u8FDC\u7AEF\u4ECD\u53EF\u80FD\u4FDD\u7559\u6D3E\u751F\u6216\u540C\u4E49\u5185\u5BB9\u3002", "Local forgetting paused external history to prevent known or derived memories returning.": "\u672C\u5730\u5FD8\u8BB0\u5DF2\u6682\u505C\u5916\u90E8\u5386\u53F2\uFF0C\u9632\u6B62\u65E7\u5185\u5BB9\u518D\u6B21\u6CE8\u5165\u3002", "Disconnected locally. Remote bank and already submitted operations are retained.": "\u672C\u9879\u76EE\u5DF2\u65AD\u5F00\uFF1B\u8FDC\u7AEF\u8BB0\u5FC6\u5E93\u548C\u5DF2\u63D0\u4EA4\u64CD\u4F5C\u4FDD\u7559\u3002", "The binding changed; no second automatic request in this turn": "\u7ED1\u5B9A\u5DF2\u53D8\u66F4\uFF0C\u672C\u56DE\u5408\u4E0D\u518D\u91CD\u590D\u81EA\u52A8\u53EC\u56DE\u3002", HINDSIGHT_UNHEALTHY: "\u670D\u52A1\u5065\u5EB7\u68C0\u67E5\u8FD4\u56DE\u5F02\u5E38\uFF08HINDSIGHT_UNHEALTHY\uFF09\u3002", HINDSIGHT_CHECK_INTERRUPTED: "\u4E0A\u4E00\u8F6E\u68C0\u67E5\u5DF2\u4E2D\u65AD\uFF0C\u8BF7\u91CD\u65B0\u68C0\u67E5\uFF08HINDSIGHT_CHECK_INTERRUPTED\uFF09\u3002" };
var hindsightMessage = (value) => {
  const raw = warningText(value);
  return hindsightMessages[raw] ?? hindsightStateNames[raw] ?? raw;
};
var checkPhaseName = (value) => ({ idle: "\u5F53\u524D\u6CA1\u6709\u8FDB\u884C\u4E2D\u7684\u68C0\u67E5", checking: "\u8FDE\u63A5\u4E0E\u8BB0\u5FC6\u5E93\u68C0\u67E5\u4E2D", health: "\u670D\u52A1\u5065\u5EB7\u68C0\u67E5", bank: "\u8BB0\u5FC6\u5E93\u8BBF\u95EE\u68C0\u67E5", complete: "\u672C\u6B21\u68C0\u67E5\u5B8C\u6210", failed: "\u672C\u6B21\u68C0\u67E5\u5931\u8D25", cancelled: "\u672C\u6B21\u68C0\u67E5\u5DF2\u53D6\u6D88" })[value] ?? value ?? "\u672A\u8BB0\u5F55";
function displayedCheckStatus(status, local, binding) {
  if (!local || local.binding !== binding) return status;
  if (local.phase === "checking") return { ...status, connection: "checking", bank: "not_checked", checkPhase: "checking", checkAttempt: null, checkStartedAt: local.startedAt, checkedAt: null, checkFailureStage: null, message: null, capabilities: {} };
  if (local.status) {
    if (status.checkAttempt === local.status.checkAttempt || status.checkAttempt && status.checkAttempt !== local.previousAttempt && Number(status.checkStartedAt) >= Number(local.status.checkStartedAt)) return status;
    return local.status;
  }
  if (status.checkAttempt && status.checkAttempt !== local.previousAttempt && Number(status.checkStartedAt) >= local.startedAt) return status;
  return { ...status, connection: "unknown", bank: "not_checked", checkPhase: ["failed", "cancelled"].includes(local.phase) ? local.phase : void 0, checkAttempt: null, checkStartedAt: local.startedAt, checkedAt: local.finishedAt, checkFailureStage: null, capabilities: {}, message: "\u5F53\u524D\u68C0\u67E5\u72B6\u6001\u5C1A\u672A\u5237\u65B0\uFF0C\u65E7\u6210\u529F\u8BB0\u5F55\u4E0D\u4F5C\u4E3A\u672C\u6B21\u7ED3\u8BBA\u3002" };
}
function HindsightHistory({ value, label = "Hindsight \xB7 \u5386\u53F2\u7ECF\u9A8C\u53C2\u8003" }) {
  if (!value) return null;
  return h("section", { className: "pt-hindsight-history", "aria-label": label }, h("h4", null, label), h("p", { className: "pt-help" }, "\u5386\u53F2\u6750\u6599\uFF0C\u4E0D\u6784\u6210\u6307\u4EE4\u3001\u5F53\u524D\u51B3\u5B9A\u6216\u672C\u6B21\u9A8C\u8BC1\u7ED3\u8BBA\u3002"), h("p", { className: "pt-help" }, "\u72B6\u6001\uFF1A" + capabilityName(value.state) + (value.reason ? " \xB7 " + hindsightMessage(value.reason) : "")), h("p", { className: "pt-help" }, "\u8BB0\u5FC6\u5E93\uFF1A" + (value.bankId ?? "\u672A\u77E5") + " \xB7 \u670D\u52A1\uFF1A" + (value.endpoint ?? "\u672A\u77E5")), (value.used ?? []).map((entry, i) => h("article", { key: (entry.factId ?? entry.documentId ?? "history") + "-" + i, className: "pt-memory-item" }, h("strong", null, "\u5916\u90E8\u5386\u53F2 \xB7 external-history"), h("p", { className: "pt-memory-snippet" }, entry.text ?? ""), h("dl", { className: "pt-hindsight-meta" }, h("dt", null, "Fact / Document"), h("dd", null, (entry.factId ?? "\u672A\u77E5") + " / " + (entry.documentId ?? "\u672A\u77E5")), h("dt", null, "\u65E5\u671F"), h("dd", null, entry.date ?? "\u672A\u77E5"), h("dt", null, "\u6765\u6E90"), h("dd", null, typeof entry.source === "string" ? entry.source : entry.source ? JSON.stringify(entry.source) : "\u672A\u77E5")))), !(value.used ?? []).length && h("p", { className: "pt-help" }, "\u672C\u6B21\u6CA1\u6709\u63D0\u4F9B\u5916\u90E8\u5386\u53F2\u6761\u76EE\u3002"), (value.omitted ?? []).length > 0 && h(Details, { label: "\u7701\u7565\u6761\u76EE\u4E0E\u539F\u56E0", value: value.omitted }));
}
function HindsightPanel({ projectId, value, request, refresh, busy, onDirtyChange = () => {
} }) {
  const config = { ...hindsightDefaults, ...value?.config }, serverStatus = value?.status ?? {}, outbox = value?.outbox ?? [];
  const [localCheck, setLocalCheck] = import_react2.default.useState(null);
  const [editor, setEditor] = import_react2.default.useState(null), [pending, setPending] = import_react2.default.useState(""), [error, setError] = import_react2.default.useState(""), [notice, setNotice] = import_react2.default.useState(""), [query, setQuery] = import_react2.default.useState(""), [recall, setRecall] = import_react2.default.useState(null), [forget, setForget] = import_react2.default.useState(null), [deleteRemote, setDeleteRemote] = import_react2.default.useState(false), [disconnect, setDisconnect] = import_react2.default.useState(false);
  const live = import_react2.default.useRef(true), generation = import_react2.default.useRef(0), active = import_react2.default.useRef(null), pendingRef = import_react2.default.useRef(false), errorRef = import_react2.default.useRef(null), bindingRef = import_react2.default.useRef(null);
  const draft = editor?.draft ?? editableHindsight(config), dirty = !!editor && JSON.stringify(editor.draft) !== JSON.stringify(editableHindsight(editor.base)), locked = !!busy || !!pending;
  const bindingKey = JSON.stringify([config.revision, config.endpoint, config.bankId, config.enabled, value?.suppressionPaused]);
  bindingRef.current = bindingKey;
  const status = displayedCheckStatus(serverStatus, localCheck, bindingKey);
  import_react2.default.useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  import_react2.default.useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      generation.current++;
      active.current?.abort();
    };
  }, [projectId]);
  import_react2.default.useEffect(() => {
    setEditor(null);
    setQuery("");
    setRecall(null);
    setForget(null);
    setDisconnect(false);
    setError("");
    setNotice("");
  }, [projectId]);
  import_react2.default.useEffect(() => {
    generation.current++;
    active.current?.abort();
    active.current = null;
    pendingRef.current = false;
    setPending("");
    setRecall(null);
    setForget(null);
    setDisconnect(false);
    setLocalCheck(null);
  }, [bindingKey]);
  import_react2.default.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const change = (key, newValue) => setEditor((old) => {
    const base = old?.base ?? { ...config }, next = { ...old?.draft ?? editableHindsight(config), [key]: newValue };
    if (["endpoint", "bankId"].includes(key)) {
      next.bankScopeConfirmed = false;
      next.retainEnabled = false;
      next.shareReportsConfirmed = false;
    }
    if (key === "shareReportsConfirmed" && !newValue) next.retainEnabled = false;
    return { base, draft: next };
  });
  const execute = async (label, fn) => {
    if (pendingRef.current || busy) return;
    pendingRef.current = true;
    setPending(label);
    setError("");
    setNotice("");
    const token = ++generation.current, abort = new AbortController();
    active.current = abort;
    const current = () => live.current && generation.current === token;
    try {
      await fn(abort.signal, current);
    } catch (e) {
      if (current() && e.name !== "AbortError") setError(e.message);
    } finally {
      if (current()) {
        pendingRef.current = false;
        setPending("");
        active.current = null;
      }
    }
  };
  const action = (name, input, message) => execute("\u6B63\u5728\u5904\u7406 Hindsight\u2026", async (signal, current) => {
    await request(name, { projectId, ...input }, void 0, signal);
    if (current()) {
      setNotice(message);
      setForget(null);
      setDisconnect(false);
      await refresh();
    }
  });
  const check = () => execute("\u6B63\u5728\u68C0\u67E5 Hindsight \u8FDE\u63A5\u2026", async (signal, current) => {
    const binding = bindingKey, startedAt = Date.now(), previousAttempt = status.checkAttempt, valid = () => current() && bindingRef.current === binding;
    setLocalCheck({ binding, startedAt, previousAttempt, phase: "checking" });
    let result, failure, fresh, refreshFailure;
    try {
      result = await request("hindsight.check", { projectId }, void 0, signal);
    } catch (error2) {
      failure = error2;
    }
    if (!valid()) return;
    try {
      fresh = await refresh();
    } catch (error2) {
      refreshFailure = error2;
    }
    if (!valid()) return;
    const candidate = fresh?.hindsight?.status ?? result?.status, snapshot = candidate?.checkAttempt && candidate.checkAttempt !== previousAttempt && Number(candidate.checkStartedAt) >= startedAt ? candidate : null;
    setLocalCheck({ binding, startedAt, previousAttempt, finishedAt: Date.now(), phase: failure || refreshFailure ? "failed" : "complete", status: snapshot ?? null });
    if (failure) throw failure;
    if (refreshFailure) throw refreshFailure;
    setNotice("\u8FDE\u63A5\u68C0\u67E5\u7ED3\u675F\uFF0C\u8BF7\u5206\u522B\u6838\u5BF9\u5404\u9879\u5F53\u524D\u72B6\u6001\u3002");
  });
  const save = (e) => {
    e.preventDefault();
    const snapshot = editor ?? { base: { ...config }, draft: { ...draft } };
    void execute("\u6B63\u5728\u4FDD\u5B58\u589E\u5F3A\u8BB0\u5FC6\u8BBE\u7F6E\u2026", async (signal, current) => {
      await request("hindsight.settings", { projectId, expectedRevision: snapshot.base.revision, config: snapshot.draft }, void 0, signal);
      if (current()) {
        setEditor(null);
        setRecall(null);
        setNotice("\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\uFF1B\u8FDE\u63A5\u4E0E\u80FD\u529B\u4EE5\u5B9E\u9645\u68C0\u67E5\u7ED3\u679C\u4E3A\u51C6\u3002");
        await refresh();
      }
    });
  };
  const routeReady = ["local-free", "external-approved"].includes(config.routeAuthorization) && config.dataEgressAcknowledged, canRecall = config.enabled && config.recallEnabled && config.bankScopeConfirmed && routeReady && !value?.suppressionPaused;
  const remoteOwned = config.ownership === "created-by-plugin";
  const field = (key, label, type = "text", extra = {}) => h("label", null, label, h("input", { type, value: draft[key], "aria-label": label, disabled: locked, onChange: (e) => change(key, type === "number" ? Number(e.target.value) : e.target.value), ...extra }));
  const checkbox = (key, label, disabled = false) => h("label", null, h("input", { type: "checkbox", checked: !!draft[key], "aria-label": label, disabled: locked || disabled, onChange: (e) => change(key, e.target.checked) }), label);
  return h("details", { className: "pt-hindsight", "aria-label": "\u9AD8\u7EA7\u8BB0\u5FC6\uFF08\u53EF\u9009\uFF09" }, h("summary", null, "\u9AD8\u7EA7\u8BB0\u5FC6\uFF08\u53EF\u9009\uFF09 \xB7 " + (config.enabled ? "Hindsight Enhanced" : "Standard")), h(
    "div",
    { className: "pt-hindsight-body" },
    h("p", { className: "pt-help" }, "Standard \u9ED8\u8BA4\u53EA\u7528\u672C\u5730\u8BB0\u5FC6\u3002Hindsight Enhanced \u5728\u6B64\u57FA\u7840\u4E0A\u53EC\u56DE\u957F\u671F\u5386\u53F2\uFF1B\u5173\u95ED\u540E\u672C\u5730\u6587\u4EF6\u3001\u5386\u53F2\u548C\u8D44\u6599\u7D22\u5F15\u4ECD\u53EF\u4F7F\u7528\u3002"),
    error && h("div", { ref: errorRef, tabIndex: -1 }, h(ErrorNotice, { message: error, onDismiss: () => setError("") })),
    pending && h("div", { className: "pt-banner", role: "status" }, pending, h(Button, { onClick: () => {
      active.current?.abort();
      generation.current++;
      pendingRef.current = false;
      setPending("");
      setLocalCheck((old) => old?.phase === "checking" ? { ...old, phase: "cancelled", finishedAt: Date.now(), status: null } : old);
      setNotice("\u5DF2\u53D6\u6D88\u7B49\u5F85\uFF1B\u5DF2\u5230\u8FBE\u670D\u52A1\u7AEF\u7684\u64CD\u4F5C\u53EF\u80FD\u4ECD\u4F1A\u7EE7\u7EED\u3002");
      void Promise.resolve(refresh()).catch(() => {
      });
    } }, "\u53D6\u6D88 Hindsight \u7B49\u5F85")),
    notice && h("p", { className: "pt-memory-notice", role: "status" }, notice),
    h(
      "form",
      { className: "pt-hindsight-form", onSubmit: save },
      checkbox("enabled", "\u542F\u7528 Hindsight Enhanced"),
      field("endpoint", "Hindsight \u670D\u52A1\u5730\u5740", "url", { placeholder: "http://127.0.0.1:8888", autoComplete: "off" }),
      field("tokenEnv", "\u51ED\u636E\u73AF\u5883\u53D8\u91CF\u540D", "text", { placeholder: "\u4F8B\u5982 HINDSIGHT_API_KEY\uFF1B\u53EF\u7559\u7A7A", autoComplete: "off", spellCheck: false }),
      h("p", { className: "pt-help" }, "\u53EA\u586B\u5199 Host \u53EF\u8BFB\u53D6\u7684\u73AF\u5883\u53D8\u91CF\u540D\uFF1B\u4E0D\u8981\u586B\u5199\u5BC6\u94A5\u6B63\u6587\u3002\u5BA2\u6237\u7AEF\u4E0D\u76F4\u63A5\u8FDE\u63A5\u670D\u52A1\u3002"),
      h(
        "fieldset",
        null,
        h("legend", null, "\u9879\u76EE\u8BB0\u5FC6\u5E93"),
        field("bankId", "\u5DF2\u6709\u8BB0\u5FC6\u5E93 ID", "text", { autoComplete: "off", spellCheck: false }),
        checkbox("bankScopeConfirmed", "\u786E\u8BA4\u6B64\u5E93\u6574\u4F53\u5C5E\u4E8E\u5F53\u524D Project"),
        h("p", { className: "pt-help" }, "\u53EA\u7ED1\u5B9A\u8FD9\u91CC\u6307\u5B9A\u7684\u5E93\uFF0C\u4E0D\u626B\u63CF\u5176\u4ED6\u5E93\u3002\u5DF2\u6709\u5E93\u9ED8\u8BA4\u53EA\u8BFB\uFF1B\u7ED1\u5B9A\u8303\u56F4\u9700\u7531\u4F60\u786E\u8BA4\u3002"),
        h("p", { className: "pt-help" }, "\u5DF2\u4FDD\u5B58\u7ED1\u5B9A\u7684\u6240\u6709\u6743\uFF1A" + (remoteOwned ? "\u672C\u63D2\u4EF6\u521B\u5EFA" : "\u5916\u90E8\u8BB0\u5FC6\u5E93")),
        h(Button, { disabled: locked || dirty || !config.endpoint || !routeReady, onClick: () => action("hindsight.createBank", { expectedRevision: config.revision }, "\u5DF2\u8BF7\u6C42\u521B\u5EFA\u672C\u9879\u76EE\u4E13\u5C5E\u5E93\uFF1B\u8BF7\u6838\u5BF9\u5237\u65B0\u540E\u7684\u7ED1\u5B9A\u3002") }, "\u65B0\u5EFA\u9879\u76EE\u4E13\u5C5E\u5E93"),
        h("p", { className: "pt-help" }, "\u65B0\u5E93\u4F1A\u7EE7\u627F\u670D\u52A1\u9ED8\u8BA4\u6A21\u677F\uFF0C\u53EF\u80FD\u89E6\u53D1\u6A21\u578B\u5E76\u4EA7\u751F\u8D39\u7528\u3002\u8BF7\u5148\u786E\u8BA4\u5E76\u4FDD\u5B58\u8DEF\u7531\u6388\u6743\u4E0E\u6570\u636E\u51FA\u53E3\u3002"),
        dirty && h("p", { className: "pt-help" }, "\u5148\u4FDD\u5B58\u8BBE\u7F6E\uFF0C\u518D\u68C0\u67E5\u8FDE\u63A5\u6216\u64CD\u4F5C\u8BB0\u5FC6\u5E93\u3002")
      ),
      checkbox("recallEnabled", "\u53EC\u56DE\u76F8\u5173\u5386\u53F2\u7ECF\u9A8C"),
      checkbox("shareReportsConfirmed", "\u5141\u8BB8\u5171\u4EAB\u5DF2\u5B8C\u6210 Thread \u7684\u4EFB\u52A1\u7ECF\u9A8C"),
      checkbox("retainEnabled", "\u5C06\u5B8C\u6210\u4EFB\u52A1\u7684\u7ECF\u9A8C\u5199\u5165 Hindsight", !draft.shareReportsConfirmed),
      h("p", { className: "pt-help" }, "\u5199\u56DE\u9ED8\u8BA4\u5173\u95ED\uFF0C\u53EA\u5904\u7406\u542F\u7528\u540E\u7684\u7EC8\u6001\u4EFB\u52A1\u62A5\u544A\u3002\u79C1\u6709 Thread \u6216\u8D44\u6599\u672A\u7ECF\u660E\u786E\u5171\u4EAB\u4E0D\u4F1A\u53D1\u9001\uFF1B\u4E0D\u6279\u91CF\u590D\u5236\u4F1A\u8BDD\u3001\u6E90\u7801\u6216\u6B63\u5F0F\u8BB0\u5FC6\u3002"),
      h("fieldset", null, h("legend", null, "\u6A21\u578B\u8DEF\u7531\u4E0E\u6570\u636E\u51FA\u53E3"), h("label", null, "\u8DEF\u7531\u6388\u6743", h("select", { value: draft.routeAuthorization, "aria-label": "Hindsight \u8DEF\u7531\u6388\u6743", disabled: locked, onChange: (e) => change("routeAuthorization", e.target.value) }, h("option", { value: "unknown" }, "\u672A\u77E5 \xB7 \u6682\u4E0D\u6388\u6743\u53EC\u56DE\u6216\u5199\u56DE"), h("option", { value: "local-free" }, "\u5DF2\u6838\u5BF9\u4EC5\u672C\u5730\u4E14\u65E0\u8BA1\u8D39"), h("option", { value: "external-approved" }, "\u5DF2\u6388\u6743\u5916\u90E8\u670D\u52A1\u53CA\u5176\u8D39\u7528"))), checkbox("dataEgressAcknowledged", "\u5DF2\u4E86\u89E3\u5E76\u786E\u8BA4\u6B64\u8FDE\u63A5\u7684\u6570\u636E\u51FA\u53E3"), h("p", { className: "pt-help" }, "\u6B64\u9879\u8BB0\u5F55\u4F60\u7684\u6388\u6743\uFF0C\u4E0D\u4EE3\u8868\u63D2\u4EF6\u9A8C\u8BC1\u4E86\u670D\u52A1\u7684\u6A21\u578B\u8DEF\u7531\u3002\u670D\u52A1\u53EF\u80FD\u8FD0\u884C embedding\u3001LLM\u3001\u91CD\u6392\u548C\u540E\u7EED\u5F52\u5E76\uFF1B\u7531\u73B0\u6709 Hindsight \u7BA1\u7406\u3002")),
      h("details", null, h("summary", null, "\u7B49\u5F85\u4E0E\u4E0A\u4E0B\u6587\u9884\u7B97"), h("div", { className: "pt-hindsight-budget" }, field("waitMs", "\u81EA\u52A8\u53EC\u56DE\u7B49\u5F85\uFF08\u6BEB\u79D2\uFF09", "number", { min: 50, max: 15e3, step: 1 }), field("historyBytes", "\u5386\u53F2\u4E0A\u4E0B\u6587\u4E0A\u9650\uFF08\u5B57\u8282\uFF09", "number", { min: 512, max: 16e3, step: 1 }), field("maxResults", "\u6700\u591A\u5386\u53F2\u6761\u76EE", "number", { min: 1, max: 20, step: 1 }), field("maxItemBytes", "\u5355\u6761\u5386\u53F2\u4E0A\u9650\uFF08\u5B57\u8282\uFF09", "number", { min: 128, max: 8e3, step: 1 }), field("responseBytes", "\u670D\u52A1\u54CD\u5E94\u4E0A\u9650\uFF08\u5B57\u8282\uFF09", "number", { min: 1024, max: 1048576, step: 1 }), field("queryBytes", "\u95EE\u9898\u957F\u5EA6\u4E0A\u9650\uFF08\u5B57\u8282\uFF09", "number", { min: 128, max: 12e3, step: 1 })), h("p", { className: "pt-help" }, "\u672C\u5730\u5F53\u524D\u7EA6\u675F\u4F18\u5148\u3002\u5386\u53F2\u53EA\u4F7F\u7528\u5269\u4F59\u9884\u7B97\uFF1B\u5B8C\u6574\u6761\u76EE\u8D85\u9650\u65F6\u7701\u7565\u5E76\u8BB0\u5F55\u539F\u56E0\u3002")),
      h("div", { className: "pt-actions" }, h("button", { type: "submit", disabled: locked || !dirty, className: "pt-button pt-primary" }, "\u4FDD\u5B58\u9AD8\u7EA7\u8BB0\u5FC6\u8BBE\u7F6E"), dirty && h(Button, { disabled: locked, onClick: () => {
        setEditor(null);
        setError("");
      } }, "\u653E\u5F03\u8BBE\u7F6E\u4FEE\u6539"))
    ),
    h("section", { "aria-label": "Hindsight \u80FD\u529B\u72B6\u6001", className: "pt-hindsight-status" }, h("h4", null, "\u80FD\u529B\u72B6\u6001"), h("dl", null, h("dt", null, "\u670D\u52A1\u53EF\u8FBE"), h("dd", null, capabilityName(status.connection)), h("dt", null, "\u76EE\u6807\u5E93\u53EF\u8BBF\u95EE"), h("dd", null, capabilityName(status.bank)), h("dt", null, "\u8BED\u4E49\u53EC\u56DE"), h("dd", null, capabilityName(status.recall)), h("dt", null, "\u4EFB\u52A1\u7ECF\u9A8C\u5199\u56DE"), h("dd", null, config.retainEnabled ? capabilityName(status.retain) : "\u5173\u95ED"), h("dt", null, "\u8DEF\u7531\u5B9E\u6D4B\u72B6\u6001"), h("dd", null, { local: "\u5DF2\u6838\u5B9E\u672C\u5730", external: "\u5916\u90E8", unknown: "\u672A\u77E5" }[status.route] ?? capabilityName(status.route ?? "unknown"))), (status.checkPhase || status.checkStartedAt || status.checkedAt) && h("div", { "aria-label": "Hindsight \u672C\u6B21\u68C0\u67E5" }, h("p", { className: "pt-help", role: status.connection === "checking" || status.bank === "checking" ? "status" : void 0 }, checkPhaseName(status.checkPhase) + (status.checkFailureStage ? " \xB7 \u5931\u8D25\u9636\u6BB5\uFF1A" + checkPhaseName(status.checkFailureStage) : "")), (status.checkStartedAt || status.checkedAt) && h("p", { className: "pt-help" }, "\u5F00\u59CB\uFF1A" + stamp(status.checkStartedAt) + " \xB7 \u7ED3\u675F\uFF1A" + stamp(status.checkedAt))), status.lastSuccessfulCheckAt && h("p", { className: "pt-help", "aria-label": "\u5386\u53F2\u68C0\u67E5\u6210\u529F\u65F6\u95F4" }, "\u5386\u53F2\u4E0A\u6B21\u6210\u529F\uFF1A" + stamp(status.lastSuccessfulCheckAt) + "\uFF08\u4EC5\u4F9B\u53C2\u8003\uFF0C\u4E0D\u4EE3\u8868\u672C\u6B21\u7ED3\u679C\uFF09"), status.message && h("p", { className: "pt-memory-notice" }, hindsightMessage(status.message)), value?.suppressionPaused && h("p", { className: "pt-memory-notice", role: "status" }, "\u589E\u5F3A\u8BB0\u5FC6\u5DF2\u6682\u505C\uFF1A\u88AB\u5FD8\u8BB0\u6765\u6E90\u7684\u6D3E\u751F\u5386\u53F2\u5C1A\u4E0D\u80FD\u53EF\u9760\u6392\u9664\u3002\u672C\u5730\u8BB0\u5FC6\u7EE7\u7EED\u53EF\u7528\u3002"), h("p", { className: "pt-help" }, "\u8FDE\u63A5\u68C0\u67E5\u53EA\u8BFB\u53D6\u5065\u5EB7\u72B6\u6001\u548C\u76EE\u6807\u5E93\u5143\u6570\u636E\uFF0C\u4E0D\u8C03\u7528 LLM\u3001\u4E0D\u5199\u5165\u8BB0\u5FC6\u5E93\u3002\u5065\u5EB7\u901A\u8FC7\u4E0D\u4EE3\u8868 Recall \u6216 Retain \u5DF2\u9A8C\u8BC1\u3002"), h(Button, { disabled: locked || dirty || !config.endpoint || !config.bankId, onClick: check }, "\u68C0\u67E5 Hindsight \u8FDE\u63A5"), Object.keys(status.capabilities ?? {}).length > 0 && h(Details, { label: "\u670D\u52A1\u80FD\u529B\uFF08\u53EA\u8BFB\uFF09", value: status.capabilities })),
    h("section", { "aria-label": "Hindsight \u6D4B\u8BD5\u53EC\u56DE", className: "pt-hindsight-recall" }, h("h4", null, "\u6D4B\u8BD5\u53EC\u56DE"), h("label", null, "\u5C06\u53D1\u9001\u7684\u95EE\u9898", h("textarea", { rows: 3, value: query, "aria-label": "Hindsight \u6D4B\u8BD5\u95EE\u9898", disabled: locked, onChange: (e) => {
      setQuery(e.target.value);
      setRecall(null);
    }, placeholder: "\u8F93\u5165\u672C\u6B21\u4EFB\u52A1\u9700\u8981\u7684\u6709\u754C\u95EE\u9898" })), h("p", { className: "pt-help" }, "\u53D1\u9001\u5230\u5DF2\u4FDD\u5B58\u670D\u52A1 " + (config.endpoint || "\uFF08\u672A\u8BBE\u7F6E\uFF09") + "\uFF0C\u76EE\u6807\u5E93 " + (config.bankId || "\uFF08\u672A\u7ED1\u5B9A\uFF09") + "\u3002\u6D4B\u8BD5\u53EF\u80FD\u89E6\u53D1\u670D\u52A1\u7AEF\u6A21\u578B\uFF1B\u6388\u6743\u672A\u77E5\u65F6\u4E0D\u4F1A\u53D1\u9001\u3002"), h(Button, { disabled: locked || dirty || !canRecall || !query.trim(), onClick: () => execute("\u6B63\u5728\u6D4B\u8BD5 Hindsight \u53EC\u56DE\u2026", async (signal, current) => {
      const result = await request("hindsight.recall", { projectId, query: query.trim() }, void 0, signal);
      if (current()) {
        setRecall(result?.hindsight ?? result);
        await refresh();
      }
    }) }, "\u53D1\u9001\u95EE\u9898\u5E76\u6D4B\u8BD5\u53EC\u56DE"), recall && h(HindsightHistory, { value: recall, label: "\u672C\u6B21\u624B\u52A8\u53EC\u56DE \xB7 \u5916\u90E8\u5386\u53F2" })),
    h("details", { className: "pt-hindsight-outbox" }, h("summary", null, "\u4EFB\u52A1\u7ECF\u9A8C\u5199\u56DE\u8BB0\u5F55\uFF08" + outbox.length + "\uFF09"), h("p", { className: "pt-help" }, "\u5DF2\u63A5\u6536\u4E0E\u5DF2\u786E\u8BA4\u5206\u522B\u663E\u793A\u3002\u8D85\u65F6\u53EF\u80FD\u610F\u5473\u7740\u7ED3\u679C\u672A\u77E5\uFF1B\u68C0\u67E5\u72B6\u6001\u4E0D\u4F1A\u76F2\u76EE\u91CD\u53D1\u3002\u65AD\u5F00\u8FDE\u63A5\u4E0D\u4F1A\u56DE\u6EDA\u670D\u52A1\u7AEF\u5DF2\u63A5\u6536\u7684\u64CD\u4F5C\u3002"), !outbox.length && h("p", { className: "pt-help" }, "\u6682\u65E0\u5199\u56DE\u8BB0\u5F55\u3002"), outbox.map((row, i) => h("article", { className: "pt-memory-item", key: row.documentId ?? i }, h("strong", null, "\u62A5\u544A " + (row.reportId ?? "\u672A\u77E5")), h("p", { className: "pt-help" }, "Document " + (row.documentId ?? "\u672A\u77E5") + " \xB7 " + capabilityName(row.status) + " \xB7 \u5C1D\u8BD5 " + (row.attempts ?? 0) + " \u6B21"), row.operationId && h("p", { className: "pt-help" }, "Operation " + row.operationId), row.error && h("p", { className: "pt-memory-notice" }, warningText(row.error)), h("div", { className: "pt-actions" }, ["uncertain", "unknown", "accepted", "pending"].includes(row.status) && h(Button, { disabled: locked || dirty, onClick: () => action("hindsight.retry", { documentId: row.documentId }, "\u5199\u56DE\u72B6\u6001\u68C0\u67E5\u7ED3\u675F\uFF0C\u8BF7\u6838\u5BF9\u8BB0\u5F55\uFF1B\u4E0D\u4EE3\u8868\u5DF2\u7ECF\u53EF\u53EC\u56DE\u3002") }, "\u68C0\u67E5\u6B64\u5199\u56DE\u72B6\u6001"), h(Button, { disabled: locked || dirty, onClick: () => {
      setForget(row);
      setDeleteRemote(false);
    } }, "\u5FD8\u8BB0\u6B64\u5199\u56DE\u8BB0\u5F55"))))),
    forget && h("section", { className: "pt-memory-index-confirm", "aria-label": "\u786E\u8BA4\u5FD8\u8BB0 Hindsight \u5199\u56DE" }, h("h4", null, "\u5FD8\u8BB0\u6B64\u5199\u56DE\u8BB0\u5F55"), h("p", { className: "pt-help" }, "\u4EC5\u5904\u7406\u672C\u9879\u76EE\u5DF2\u8FFD\u8E2A\u7684\u6587\u6863 " + forget.documentId + "\u3002\u672C\u5730\u6291\u5236\u540E\u4E0D\u518D\u63D0\u4F9B\u8BE5\u6765\u6E90\uFF1B\u5DF2\u6709\u804A\u5929\u4E0E Library \u539F\u8D44\u6599\u4FDD\u6301\u3002"), h("p", { className: "pt-help" }, remoteOwned ? "\u53EF\u8BF7\u6C42\u5220\u9664\u672C\u63D2\u4EF6\u5199\u5165\u7684\u8FDC\u7AEF\u6587\u6863\uFF0C\u4ECD\u4EE5\u8BE5\u8BB0\u5F55\u539F\u7ED1\u5B9A\u7684\u6743\u9650\u6838\u9A8C\u4E3A\u51C6\u3002\u79BB\u7EBF\u6216\u7ED3\u679C\u672A\u77E5\u65F6\u4E0D\u4F1A\u63D0\u524D\u663E\u793A\u5DF2\u5220\u9664\u3002" : "\u6B64\u7ED1\u5B9A\u662F\u5916\u90E8\u8BB0\u5FC6\u5E93\uFF0C\u4E0D\u80FD\u5728\u8FD9\u91CC\u5220\u9664\u8FDC\u7AEF\u5185\u5BB9\uFF1B\u53EF\u5230 Hindsight \u7BA1\u7406\u3002"), h("label", null, h("input", { type: "checkbox", checked: deleteRemote, "aria-label": "\u540C\u65F6\u8BF7\u6C42\u5220\u9664\u8FDC\u7AEF\u6587\u6863", disabled: locked || !remoteOwned, onChange: (e) => setDeleteRemote(e.target.checked) }), "\u540C\u65F6\u8BF7\u6C42\u5220\u9664\u8FDC\u7AEF\u6587\u6863"), h("p", { className: "pt-help" }, "\u4E0D\u5220\u9664\u6574\u4E2A\u5E93\uFF1B\u540C\u4E49\u526F\u672C\u53CA\u670D\u52A1\u7AEF\u884D\u751F\u89C2\u5BDF\u4E0D\u4FDD\u8BC1\u5168\u90E8\u6D88\u5931\u3002\u65E0\u6CD5\u53EF\u9760\u6392\u9664\u6D3E\u751F\u5386\u53F2\u65F6\uFF0C\u589E\u5F3A\u533A\u4F1A\u6682\u505C\u4F7F\u7528\u3002"), h("div", { className: "pt-actions" }, h(Button, { kind: "danger", disabled: locked || dirty, onClick: () => action("hindsight.forget", { documentId: forget.documentId, deleteRemote: remoteOwned && deleteRemote }, "\u5FD8\u8BB0\u8BF7\u6C42\u5DF2\u5904\u7406\uFF1B\u8BF7\u6838\u5BF9\u72B6\u6001\u548C\u8FDC\u7AEF\u5220\u9664\u7ED3\u679C\u3002") }, "\u786E\u8BA4\u5FD8\u8BB0\u6B64\u5199\u56DE\u8BB0\u5F55"), h(Button, { disabled: locked, onClick: () => setForget(null) }, "\u53D6\u6D88"))),
    h("div", { className: "pt-hindsight-disconnect" }, h(Button, { disabled: locked || dirty || !config.endpoint, onClick: () => setDisconnect(true) }, "\u65AD\u5F00\u672C\u9879\u76EE Hindsight \u8FDE\u63A5"), disconnect && h("div", { role: "group", "aria-label": "\u786E\u8BA4\u65AD\u5F00 Hindsight" }, h("p", { className: "pt-help" }, "\u65AD\u5F00\u540E\u505C\u6B62\u65B0\u8BF7\u6C42\u3001\u53D6\u6D88\u5F85\u53D1\uFF1B\u4FDD\u7559\u8BB0\u5FC6\u5E93\uFF0C\u5DF2\u63D0\u4EA4\u7684\u8FDC\u7AEF\u64CD\u4F5C\u53EF\u80FD\u7EE7\u7EED\u3002"), h("div", { className: "pt-actions" }, h(Button, { kind: "danger", disabled: locked, onClick: () => action("hindsight.disconnect", { expectedRevision: config.revision }, "\u672C\u9879\u76EE\u5DF2\u65AD\u5F00\uFF0C\u8FDC\u7AEF\u8BB0\u5FC6\u5E93\u4FDD\u7559\u3002") }, "\u786E\u8BA4\u65AD\u5F00\u5E76\u4FDD\u7559\u5E93"), h(Button, { disabled: locked, onClick: () => setDisconnect(false) }, "\u53D6\u6D88"))))
  ));
}
function SourceList({ sources, onOpen, disabled }) {
  if (!sources?.length) return h("p", { className: "pt-help" }, "\u672A\u9644\u539F\u59CB\u8D44\u6599\u5F15\u7528\u3002");
  return h("ul", { className: "pt-memory-sources" }, sources.map((source, i) => h("li", { key: i }, h(Button, { kind: "ghost", disabled, onClick: () => onOpen(source), "aria-label": "\u67E5\u770B\u6765\u6E90 " + sourceName(source) }, sourceName(source)), h("span", { className: "pt-help" }, source.version ? "v" + source.version : source.commit ? String(source.commit).slice(0, 12) : source.contentHash ? "\u5185\u5BB9 " + String(source.contentHash).slice(0, 12) : ""))));
}
function PacketMemoryUsage({ packet, onOpenSource, disabled }) {
  const preview = packet.indexPreview, previewEntries = preview?.entries ?? [], fullEntries = (packet.used ?? []).filter((entry) => !entry.delivery || entry.delivery === "full-body");
  return h(
    import_react2.default.Fragment,
    null,
    preview ? h("section", { "aria-label": "\u7D22\u5F15\u9884\u89C8\uFF08\u975E\u5168\u6587\uFF09" }, h("h4", null, "\u7D22\u5F15\u9884\u89C8\uFF08\u975E\u5168\u6587\uFF09"), h("p", { className: "pt-help" }, "\u5F53\u524D\u7D22\u5F15\u5171 " + preview.total + " \u9879\uFF0C\u672C\u6B21\u9884\u89C8 " + preview.shown + " \u9879\uFF0C\u7701\u7565 " + preview.omitted + " \u9879\u3002" + (Number.isInteger(preview.nextOffset) ? "\u540E\u7EED\u4ECE\u7B2C " + (preview.nextOffset + 1) + " \u9879\u7EE7\u7EED\u3002" : "")), h("p", { className: "pt-help" }, "\u8FD9\u91CC\u4EC5\u4FDD\u7559\u63D0\u4F9B\u5C42\u7EA7\u548C\u6761\u76EE\u5F15\u7528\uFF0C\u4E0D\u53E6\u5B58\u5F53\u65F6\u7684\u5B57\u9762\u8BF4\u660E\u3002\u7D22\u5F15\u9884\u89C8\u4E0E\u5168\u6587\u5206\u522B\u8BB0\u5F55\uFF0C\u4E0D\u5408\u5E76\u8BA1\u6570\u3002"), previewEntries.map((entry, i) => h("article", { key: entry.entryId + "@" + entry.revision + "-" + i, className: "pt-memory-item" }, h("strong", null, entry.logicalPath ?? entry.entryId), h("p", { className: "pt-help" }, "v" + entry.revision + " \xB7 " + (kindNames[entry.kind] ?? entry.kind ?? "\u8BB0\u5FC6") + (entry.kind === "open_question" ? "\uFF08\u672A\u5B9A\u95EE\u9898\uFF09" : "") + " \xB7 " + statusName(entry.status) + " \xB7 " + scopeName(entry.scope)), h("p", { className: "pt-help" }, entry.descriptionTruncated ? "\u5B57\u9762\u8BF4\u660E\u5DF2\u622A\u65AD\uFF1B\u5B8C\u6574\u6761\u4EF6\u8BF7\u6838\u5BF9\u5BF9\u5E94\u6587\u4EF6\u3002" : "\u5B57\u9762\u8BF4\u660E\u672A\u622A\u65AD\uFF1B\u6B64\u8BB0\u5F55\u4ECD\u4E0D\u662F\u6B63\u6587\u5168\u6587\u3002")))) : h("p", { className: "pt-help" }, "\u6B64\u5386\u53F2\u8BB0\u5F55\u6CA1\u6709\u7D22\u5F15\u9884\u89C8\u5143\u6570\u636E\uFF0C\u4E0D\u80FD\u636E\u6B64\u5224\u65AD\u5F53\u65F6\u662F\u5426\u63D0\u4F9B\u4E86\u7D22\u5F15\u3002"),
    h("section", { "aria-label": "\u5DF2\u63D0\u4F9B\u5168\u6587" }, h("h4", null, "\u5DF2\u63D0\u4F9B\u5168\u6587\uFF08" + fullEntries.length + "\uFF09"), h("p", { className: "pt-help" }, "\u4EC5\u7EDF\u8BA1\u672C\u5730\u6B63\u5F0F\u8BB0\u5FC6\u7684\u5168\u6587\u8BB0\u5F55\uFF0C\u4E0D\u542B\u7D22\u5F15\u9884\u89C8\u6216\u6765\u6E90\u8D44\u6599\u3002"), !fullEntries.length && h("p", { className: "pt-help" }, "\u6B64\u4F7F\u7528\u8BB0\u5F55\u6CA1\u6709\u6807\u8BB0\u4E3A\u5168\u6587\u7684\u672C\u5730\u8BB0\u5FC6\u6761\u76EE\u3002"), fullEntries.some((entry) => !entry.delivery) && h("p", { className: "pt-help" }, "\u65E7\u8BB0\u5F55\u672A\u6807\u8BB0\u63D0\u4F9B\u5C42\u7EA7\uFF0C\u6309\u6B64\u524D\u7684\u6B63\u6587\u4F7F\u7528\u8BB0\u5F55\u663E\u793A\u3002"), fullEntries.map((entry, i) => h("article", { key: entry.entryId + "@" + entry.revision + "-" + i, className: "pt-memory-item" }, h("strong", null, entry.logicalPath ?? entry.entryId), h("p", { className: "pt-help" }, entry.entryId + " \xB7 v" + entry.revision + " \xB7 " + scopeName(entry.scope)), h("p", null, "\u9009\u53D6\u7406\u7531\uFF1A" + (entry.reason ?? "\u672A\u8BB0\u5F55")), h(SourceList, { sources: entry.sourceRefs, onOpen: onOpenSource, disabled }))))
  );
}
function UsedPackets({ packets, onOpenSource, disabled }) {
  return h("details", { className: "pt-memory-used" }, h("summary", null, "Used This Turn \xB7 \u5DF2\u6CE8\u5165\u8BB0\u5F55" + (packets.length ? "\uFF08" + packets.length + "\uFF09" : "")), h("p", { className: "pt-help" }, "\u4EE5\u4E0B\u4E3A\u5DF2\u7EC4\u88C5\u5230\u672C\u56DE\u5408\u4E0A\u4E0B\u6587\u7684\u8BB0\u5F55\uFF1B\u4E0D\u4EE3\u8868\u8BF7\u6C42\u6210\u529F\u53D1\u9001\uFF0C\u6216\u6A21\u578B\u4E00\u5B9A\u7406\u89E3\u3001\u9075\u5B88\u3002"), !packets.length && h("p", { className: "pt-help" }, "\u5C1A\u65E0\u6CE8\u5165\u8BB0\u5F55\u3002\u5F00\u59CB\u4E0B\u4E00\u6B21\u9879\u76EE\u5BF9\u8BDD\u540E\u53EF\u5728\u8FD9\u91CC\u67E5\u770B\u3002"), packets.map((packet) => h("details", { key: packet.packetId, className: "pt-memory-packet" }, h("summary", null, stamp(packet.createdAt) + " \xB7 " + (packet.turnId ?? packet.packetId)), h("p", { className: "pt-help" }, "Session " + (packet.sessionId ?? "\u2014") + " \xB7 " + (packet.bytes ?? 0) + " \u5B57\u8282" + (packet.estimatedTokens !== void 0 ? " \xB7 \u7EA6 " + packet.estimatedTokens + " tokens\uFF08\u4F30\u7B97\uFF09" : "")), packet.warnings?.length > 0 && h("div", { className: "pt-memory-notice", role: "status" }, packet.warnings.map((warning, i) => h("p", { key: i }, warningText(warning)))), h(PacketMemoryUsage, { packet, onOpenSource, disabled }), (packet.evidence ?? []).length > 0 && h("h4", null, "\u672C\u5730\u6765\u6E90\u8D44\u6599"), (packet.evidence ?? []).map((entry, i) => h("article", { key: "evidence-" + i, className: "pt-memory-item" }, h("strong", null, "\u5DF2\u7EC4\u88C5\u7684\u6765\u6E90\u8D44\u6599"), h("p", { className: "pt-help" }, entry.reason ?? "\u8BCD\u6CD5\u68C0\u7D22\u547D\u4E2D"), h(SourceList, { sources: entry.source ? [entry.source] : [], onOpen: onOpenSource, disabled }))), h(HindsightHistory, { value: packet.hindsight }), h(Details, { label: "Packet \u7248\u672C\u4E0E\u5173\u8054", value: { packetId: packet.packetId, projectRevision: packet.projectRevision, policyVersion: packet.policyVersion, resourceVersions: packet.resourceVersions, turnId: packet.turnId } }))));
}
function MemoryPanel({ projectId, state, request, refresh, busy, onDirtyChange = () => {
} }) {
  const [hindsightDirty, setHindsightDirty] = import_react2.default.useState(false);
  const [filter, setFilter] = import_react2.default.useState("active"), [page, setPage] = import_react2.default.useState(0), [selected, setSelected] = import_react2.default.useState(null), [editing, setEditing] = import_react2.default.useState(null), [draft, setDraft] = import_react2.default.useState(null), [forget, setForget] = import_react2.default.useState(null), [error, setError] = import_react2.default.useState(""), [pending, setPending] = import_react2.default.useState(""), [query, setQuery] = import_react2.default.useState(""), [includeHistory, setIncludeHistory] = import_react2.default.useState(false), [results, setResults] = import_react2.default.useState(null), [source, setSource] = import_react2.default.useState(null), [indexConfirm, setIndexConfirm] = import_react2.default.useState(false), [notice, setNotice] = import_react2.default.useState("");
  const live = import_react2.default.useRef(true), activeRequest = import_react2.default.useRef(null), generation = import_react2.default.useRef(0), pendingRef = import_react2.default.useRef(false), errorRef = import_react2.default.useRef(null);
  const files = state.memoryFiles ?? state.memoryEntries ?? [], indexMeta = state.memoryIndexMeta ?? {}, entries = files.filter((file) => file.logicalPath !== "MEMORY.md" && file.status !== "forgotten").sort((a, b) => updated(b.updatedAt) - updated(a.updatedAt)), packets = state.memoryUsedPackets ?? [];
  const indexFile = files.find((file) => file.logicalPath === "MEMORY.md"), filtered = entries.filter((file) => filter === "history" ? historyStatus(file.status) : filter === "candidate" ? file.status === "candidate" : !file.status || file.status === "active");
  const memoryRevision = files.map((file) => [file.entryId ?? file.logicalPath, file.revision, file.status].join(":")).sort().join("|"), resourceRevision = JSON.stringify([state.bindings ?? [], state.grants ?? [], indexMeta.resources ?? [], indexMeta.excludedLibraryItemIds ?? []]);
  const dirty = !!editing && JSON.stringify(draft) !== JSON.stringify(editing.initial);
  import_react2.default.useEffect(() => {
    onDirtyChange(dirty || hindsightDirty);
    return () => onDirtyChange(false);
  }, [dirty, hindsightDirty, onDirtyChange]);
  import_react2.default.useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      generation.current++;
      activeRequest.current?.abort();
    };
  }, [projectId]);
  import_react2.default.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  import_react2.default.useEffect(() => {
    setPage(0);
  }, [filter]);
  import_react2.default.useEffect(() => {
    setPage((old) => Math.min(old, Math.max(0, Math.ceil(filtered.length / 50) - 1)));
  }, [filtered.length]);
  import_react2.default.useEffect(() => {
    setResults(null);
    setSource(null);
    setSelected((old) => !old || files.some((file) => (old.entryId ? file.entryId === old.entryId : file.logicalPath === old.logicalPath) && file.revision === old.revision && file.status === old.status && file.status !== "forgotten" && (old.logicalPath !== "MEMORY.md" || file.memoryIndexRevision === old.memoryIndexRevision)) ? old : null);
  }, [memoryRevision]);
  import_react2.default.useEffect(() => {
    setSource(null);
    setResults(null);
  }, [resourceRevision]);
  const execute = async (label, fn) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(label);
    setError("");
    setNotice("");
    const token = ++generation.current, abort = new AbortController();
    activeRequest.current = abort;
    try {
      const value = await fn(abort.signal, () => live.current && generation.current === token);
      return value;
    } catch (e) {
      if (live.current && generation.current === token && e.name !== "AbortError") setError(e.message);
    } finally {
      if (live.current && generation.current === token) {
        setPending("");
        activeRequest.current = null;
        pendingRef.current = false;
      }
    }
  };
  const locked = !!busy || !!pending;
  const cancel = () => {
    activeRequest.current?.abort();
    generation.current++;
    pendingRef.current = false;
    setPending("");
    setNotice("\u5DF2\u53D6\u6D88\u7B49\u5F85\uFF1B\u5DF2\u63D0\u4EA4\u7684\u4FDD\u5B58\u4EE5\u5237\u65B0\u540E\u7684\u8BB0\u5F55\u4E3A\u51C6\u3002");
    void refresh();
  };
  const read = (file) => execute("\u6B63\u5728\u8BFB\u53D6\u8BB0\u5FC6\u6587\u4EF6\u2026", async (signal, current) => {
    const value = file.logicalPath ? await request("memory.fileRead", { projectId, logicalPath: file.logicalPath, ...file.entryId ? { entryId: file.entryId } : {}, status: file.logicalPath === "MEMORY.md" ? "active" : historyStatus(file.status) ? "history" : file.status ?? "active", ...file.logicalPath !== "MEMORY.md" && file.revision !== void 0 ? { revision: file.revision } : {}, ...file.scope?.threadId ? { threadId: file.scope.threadId } : {} }, void 0, signal) : await request("memory.read", { projectId, entryId: file.entryId }, void 0, signal);
    if (current()) {
      setSelected({ ...file, ...value });
      setSource(null);
      setForget(null);
    }
  });
  const openSource = (ref) => execute("\u6B63\u5728\u6838\u5BF9\u6765\u6E90\u4E0E\u6388\u6743\u2026", async (signal, current) => {
    const value = await request("memory.source", { projectId, source: ref }, void 0, signal);
    if (current()) setSource(value);
  });
  const startEdit = (file) => {
    const isIndex = file?.logicalPath === "MEMORY.md", initial = isIndex ? { description: indexMeta.description ?? "", pinnedEntryIds: [...indexMeta.pinnedEntryIds ?? []] } : { name: file?.name ?? "", logicalPath: file?.logicalPath ?? "", content: file?.content ?? "", kind: file?.kind ?? "decision", status: file?.status === "candidate" ? "candidate" : "active" };
    setEditing({ file, isIndex, initial, indexRevision: indexMeta.revision ?? file?.revision ?? 0 });
    setDraft(initial);
    setForget(null);
    setSource(null);
    setError("");
  };
  const change = (key, value) => setDraft((old) => ({ ...old, [key]: value }));
  const save = (e) => {
    e.preventDefault();
    void execute("\u6B63\u5728\u4FDD\u5B58\u8BB0\u5FC6\u2026", async (signal, current) => {
      const file = editing.file, value = editing.isIndex ? await request("memory.indexWrite", { projectId, ...draft, expectedRevision: editing.indexRevision, operationId: operationId() }, void 0, signal) : await request("memory.write", { projectId, entryId: file?.entryId, name: draft.name, content: draft.content, ...draft.logicalPath ? { logicalPath: draft.logicalPath } : {}, kind: draft.kind, status: draft.status, scope: file?.scope ?? { kind: "project" }, ...file?.topicKey ? { topicKey: file.topicKey } : {}, expectedRevision: file?.revision ?? 0, reason: "\u7528\u6237\u7F16\u8F91\u9879\u76EE\u8BB0\u5FC6\u6587\u4EF6", operationId: operationId() }, void 0, signal);
      if (current()) {
        setEditing(null);
        setDraft(null);
        setSelected(null);
        setNotice(editing.isIndex ? "\u7D22\u5F15\u8BF4\u660E\u4E0E\u7F6E\u9876\u9879\u5DF2\u4FDD\u5B58\uFF0C\u6587\u4EF6\u94FE\u63A5\u7531\u5F53\u524D\u8BB0\u5F55\u91CD\u65B0\u751F\u6210\u3002" : "\u8BB0\u5FC6\u6587\u4EF6\u5DF2\u4FDD\u5B58\u3002");
        await refresh();
      }
      return value;
    });
  };
  const chooseForget = (file) => {
    const current = files.filter((row) => row.entryId === file.entryId).sort((a, b) => b.revision - a.revision)[0];
    setForget(current ?? file);
  };
  const transition = (file, status) => execute("\u6B63\u5728\u66F4\u65B0\u8BB0\u5FC6\u72B6\u6001\u2026", async (signal, current) => {
    const previous = entries.filter((e) => file.kind && file.topicKey && e.entryId !== file.entryId && e.status === "active" && e.kind === file.kind && e.topicKey === file.topicKey && JSON.stringify(e.scope) === JSON.stringify(file.scope));
    if (status === "active" && previous.length) {
      await request("memory.write", { projectId, entryId: file.entryId, name: file.name, logicalPath: file.logicalPath, content: file.content, kind: file.kind, topicKey: file.topicKey, scope: file.scope, status, expectedRevision: file.revision, supersedes: previous.map((e) => ({ entryId: e.entryId, expectedRevision: e.revision })), reason: "\u7528\u6237\u786E\u8BA4\u5019\u9009\u5E76\u66FF\u4EE3\u540C\u4E3B\u9898\u5F53\u524D\u51B3\u5B9A", operationId: operationId() }, void 0, signal);
    } else await request("memory.transition", { projectId, entryId: file.entryId, expectedRevision: file.revision, status, operationId: operationId() }, void 0, signal);
    if (current()) {
      setSelected(null);
      setNotice(status === "active" ? "\u5DF2\u786E\u8BA4\u5E76\u8BBE\u4E3A\u5F53\u524D\u8BB0\u5FC6\uFF1B\u540C\u4E3B\u9898\u7684\u65E7\u51B3\u5B9A\u5C06\u4FDD\u7559\u5728\u5386\u53F2\u4E2D\u3002" : "\u8BB0\u5FC6\u5DF2\u5F52\u6863\uFF0C\u540E\u7EED\u9ED8\u8BA4\u68C0\u7D22\u4E0E\u6CE8\u5165\u4E0D\u518D\u4F7F\u7528\u3002");
      await refresh();
    }
  });
  const search = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    void execute("\u6B63\u5728\u68C0\u7D22\u9879\u76EE\u8BB0\u5FC6\u4E0E\u8D44\u6599\u2026", async (signal, current) => {
      const value = await request("memory.search", { projectId, query: query.trim(), includeHistory }, void 0, signal);
      if (current()) {
        setResults(value);
        setSource(null);
      }
    });
  };
  const exportMemory = () => execute("\u6B63\u5728\u5BFC\u51FA\u8BB0\u5FC6\u2026", async (signal, current) => {
    const value = await request("memory.export", { projectId }, void 0, signal);
    if (!current()) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json" })), a = document.createElement("a");
    a.href = url;
    a.download = "project-memory-" + projectId + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
    setNotice("\u5DF2\u4E0B\u8F7D\u5F53\u524D\u9879\u76EE\u7684\u8BB0\u5FC6\u5BFC\u51FA\u3002");
  });
  const indexResources = Array.isArray(indexMeta.resources) ? indexMeta.resources : [], excludes = Array.isArray(indexMeta.excludes) ? indexMeta.excludes : [".git", "node_modules", "\u6784\u5EFA\u7F13\u5B58", "\u51ED\u636E", "\u4E8C\u8FDB\u5236", "\u672A\u6388\u6743\u9690\u85CF\u76EE\u5F55"];
  const resultGroup = (label, rows, kind) => h("section", { className: "pt-memory-result-group", key: kind, "aria-label": label }, h("h4", null, label + "\uFF08" + rows.length + "\uFF09"), !rows.length && h("p", { className: "pt-help" }, "\u65E0\u5339\u914D\u7ED3\u679C\u3002"), rows.map((row, i) => h("article", { key: row.id ?? (row.entryId ? row.entryId + "@" + row.revision + "-" + i : row.evidenceId ?? i), className: "pt-memory-result" }, h("strong", null, row.logicalPath ?? row.name ?? row.path ?? row.entryId ?? "\u8D44\u6599\u7247\u6BB5"), h("p", { className: "pt-help" }, (row.revision ? "v" + row.revision + " \xB7 " : "") + (kind === "history" ? (historyStatus(row.status) ? statusName(row.status) : "\u5386\u53F2\u8BB0\u5F55") + " \xB7 \u5386\u53F2\u5185\u5BB9\uFF0C\u4E0D\u662F\u5F53\u524D\u8981\u6C42" : scopeName(row.scope))), h("p", { className: "pt-memory-snippet" }, row.snippet ?? row.content ?? row.text ?? ""), h("div", { className: "pt-actions" }, kind !== "evidence" && row.logicalPath && h(Button, { disabled: locked || !!editing, onClick: () => read(row) }, "\u6253\u5F00\u8BB0\u5FC6\u6587\u4EF6"), (row.source ?? row.sourceRef) && h(Button, { disabled: locked, onClick: () => openSource(row.source ?? row.sourceRef) }, "\u67E5\u770B\u539F\u8D44\u6599")), h(SourceList, { sources: row.sourceRefs, onOpen: openSource, disabled: locked }))));
  return h(
    "section",
    { "aria-label": "Project Memory", className: "pt-memory-panel" },
    h("div", { className: "pt-library-head" }, h("h3", null, "Auto memory \xB7 \u9879\u76EE\u8BB0\u5FC6"), h("div", { className: "pt-actions" }, h(Button, { icon: "add", onClick: () => startEdit(null), disabled: locked || !!editing }, "\u65B0\u5EFA\u6587\u4EF6"), h(Button, { icon: "download", onClick: exportMemory, disabled: locked }, "\u5BFC\u51FA"))),
    h("p", { className: "pt-help" }, "\u9879\u76EE\u6982\u8981\u3001\u51B3\u5B9A\u4E0E\u7ECF\u9A8C\u4FDD\u5B58\u5728\u672C\u5730\u6587\u4EF6\u89C6\u56FE\u4E2D\u3002\u4E3B\u5BF9\u8BDD\u4E0E Thread \u5728\u5404\u81EA\u6743\u9650\u5185\u8BFB\u53D6\uFF1B\u4E0D\u9700\u8981\u6BCF\u6B21\u90FD\u8BF4\u201C\u8BB0\u4F4F\u201D\u3002"),
    error && h("div", { ref: errorRef, tabIndex: -1 }, h(ErrorNotice, { message: error, onDismiss: () => setError("") })),
    pending && h("div", { role: "status", className: "pt-banner" }, pending, h(Button, { onClick: cancel }, "\u53D6\u6D88\u7B49\u5F85")),
    notice && h("p", { role: "status", className: "pt-memory-notice" }, notice),
    h("form", { className: "pt-memory-search", onSubmit: search }, h("label", null, "\u68C0\u7D22\u8BB0\u5FC6\u4E0E\u8D44\u6599", h("input", { type: "search", value: query, "aria-label": "\u68C0\u7D22\u8BB0\u5FC6\u4E0E\u8D44\u6599", placeholder: "\u8F93\u5165\u51B3\u5B9A\u3001\u7EA6\u675F\u6216\u8D44\u6599\u5173\u952E\u8BCD", onChange: (e) => setQuery(e.target.value) })), h("div", { className: "pt-actions" }, h("label", null, h("input", { type: "checkbox", checked: includeHistory, onChange: (e) => setIncludeHistory(e.target.checked) }), "\u5305\u62EC\u5386\u53F2"), h("button", { type: "submit", disabled: locked || !query.trim(), className: "pt-button" }, h(Icon, { name: "search" }), "\u68C0\u7D22"), results && h(Button, { onClick: () => {
      setResults(null);
      setSource(null);
    }, disabled: locked }, "\u6E05\u9664\u7ED3\u679C"))),
    results && h("div", { className: "pt-memory-results", "aria-label": "\u8BB0\u5FC6\u68C0\u7D22\u7ED3\u679C" }, resultGroup("Current memory \xB7 \u5F53\u524D\u8BB0\u5FC6", results.current ?? [], "current"), resultGroup("Evidence \xB7 \u6765\u6E90\u8D44\u6599", results.evidence ?? [], "evidence"), includeHistory && resultGroup("History \xB7 \u5386\u53F2", results.history ?? [], "history"), (results.warnings ?? []).map((warning, i) => h("p", { key: i, className: "pt-memory-notice", role: "status" }, warningText(warning)))),
    !editing && h(
      import_react2.default.Fragment,
      null,
      h("div", { className: "pt-memory-list-controls" }, h("label", null, "\u663E\u793A", h("select", { "aria-label": "\u8BB0\u5FC6\u72B6\u6001\u7B5B\u9009", value: filter, onChange: (e) => {
        setFilter(e.target.value);
        setSelected(null);
      } }, h("option", { value: "active" }, "\u5F53\u524D\u8BB0\u5FC6"), h("option", { value: "candidate" }, "\u5019\u9009 \xB7 \u5F85\u786E\u8BA4"), h("option", { value: "history" }, "\u5386\u53F2 \xB7 \u5DF2\u66FF\u4EE3\u4E0E\u5F52\u6863"))), h("span", { className: "pt-help" }, filtered.length + " \u4E2A\u4E3B\u9898\u6587\u4EF6")),
      h("div", { className: "pt-memory-files" }, indexFile && filter === "active" && h(Button, { className: "pt-memory-file", disabled: locked, onClick: () => read(indexFile), "aria-label": "\u67E5\u770B MEMORY.md" }, h(Icon, { name: "file" }), h("span", null, h("strong", null, "MEMORY.md"), h("small", null, "\u81EA\u52A8\u751F\u6210\u7684\u7D22\u5F15 \xB7 \u53EF\u7F16\u8F91\u8BF4\u660E\u4E0E\u7F6E\u9876\u9879"))), filtered.slice(page * 50, (page + 1) * 50).map((file) => h(Button, { key: file.entryId + "@" + file.revision, className: "pt-memory-file", disabled: locked, onClick: () => read(file), "aria-label": "\u67E5\u770B\u8BB0\u5FC6\u6587\u4EF6 " + (file.logicalPath ?? file.name), "aria-pressed": selected?.entryId === file.entryId }, h(Icon, { name: "file" }), h("span", null, h("strong", null, file.logicalPath ?? file.name), h("small", null, statusName(file.status) + " \xB7 " + (kindNames[file.kind] ?? "\u8BB0\u5FC6") + " \xB7 v" + file.revision + " \xB7 " + scopeName(file.scope)))))),
      !filtered.length && h(Empty, { title: filter === "candidate" ? "\u6CA1\u6709\u5F85\u786E\u8BA4\u7684\u5019\u9009" : filter === "history" ? "\u6682\u65E0\u5386\u53F2\u8BB0\u5F55" : "\u4FDD\u5B58\u9879\u76EE\u7684\u957F\u671F\u7EA6\u5B9A", icon: "file" }, filter === "active" ? "\u6DFB\u52A0\u9879\u76EE\u6982\u8981\u3001\u9700\u6C42\u6216\u51B3\u5B9A\uFF0C\u4E5F\u53EF\u4EE5\u5728\u5BF9\u8BDD\u4E2D\u660E\u786E\u63D0\u51FA\u3002" : "\u6B63\u5F0F\u8BB0\u5FC6\u4E0E\u5386\u53F2\u8BB0\u5F55\u5206\u522B\u4FDD\u7559\u3002"),
      filtered.length > 50 && h("nav", { className: "pt-actions", "aria-label": "\u8BB0\u5FC6\u6587\u4EF6\u5206\u9875" }, h(Button, { disabled: locked || page === 0, onClick: () => setPage(page - 1) }, "\u4E0A\u4E00\u9875"), h("span", { className: "pt-help" }, "\u7B2C " + (page + 1) + " / " + Math.ceil(filtered.length / 50) + " \u9875\uFF1B\u68C0\u7D22\u8986\u76D6\u5168\u90E8\u53EF\u7528\u8BB0\u5F55"), h(Button, { disabled: locked || (page + 1) * 50 >= filtered.length, onClick: () => setPage(page + 1) }, "\u4E0B\u4E00\u9875"))
    ),
    selected && !editing && h("article", { className: "pt-memory-reader", "aria-label": "\u8BB0\u5FC6\u6587\u4EF6\u5185\u5BB9" }, h("header", null, h("h4", null, selected.logicalPath ?? selected.name), h(Button, { icon: "close", kind: "icon", "aria-label": "\u5173\u95ED\u8BB0\u5FC6\u6587\u4EF6", onClick: () => setSelected(null) })), h("p", { className: "pt-help" }, selected.logicalPath === "MEMORY.md" ? "\u81EA\u52A8\u751F\u6210\u7684\u7D22\u5F15\uFF1B\u6587\u4EF6\u94FE\u63A5\u4E0D\u80FD\u81EA\u7531\u7F16\u8F91\u3002" : statusName(selected.status) + " \xB7 v" + selected.revision + " \xB7 " + scopeName(selected.scope) + " \xB7 " + stamp(selected.updatedAt)), historyStatus(selected.status) && h("p", { className: "pt-memory-notice" }, "\u8FD9\u662F\u5386\u53F2\u5185\u5BB9\uFF0C\u9ED8\u8BA4\u4E0D\u4F1A\u4F5C\u4E3A\u5F53\u524D\u8981\u6C42\u6CE8\u5165\u3002"), h("pre", { className: "pt-memory-content" }, selected.content ?? "\u6B64\u6587\u4EF6\u6CA1\u6709\u6B63\u6587\u3002"), h("div", { className: "pt-actions" }, !historyStatus(selected.status) && h(Button, { disabled: locked, onClick: () => startEdit(selected) }, selected.logicalPath === "MEMORY.md" ? "\u7F16\u8F91\u7D22\u5F15\u8BF4\u660E\u4E0E\u7F6E\u9876\u9879" : "\u7F16\u8F91\u6587\u4EF6"), selected.status === "candidate" && h("p", { className: "pt-help" }, "\u786E\u8BA4\u65F6\u4F1A\u66FF\u4EE3\u672C\u8303\u56F4\u5185\u540C\u7C7B\u578B\u3001\u540C\u4E3B\u9898\u7684\u5F53\u524D\u51B3\u5B9A\uFF0C\u5E76\u4FDD\u7559\u5176\u5386\u53F2\u3002"), selected.status === "candidate" && h(Button, { kind: "primary", disabled: locked, onClick: () => transition(selected, "active") }, "\u786E\u8BA4\u4F5C\u4E3A\u5F53\u524D\u8BB0\u5FC6"), selected.entryId && selected.status === "active" && h(Button, { disabled: locked, onClick: () => transition(selected, "archived") }, "\u5F52\u6863"), selected.entryId && h(Button, { kind: "danger", disabled: locked, onClick: () => chooseForget(selected) }, "\u5FD8\u8BB0")), h(SourceList, { sources: selected.sourceRefs ?? (selected.source ? [selected.source] : []), onOpen: openSource, disabled: locked }), h(Details, { label: "\u6765\u6E90\u4E0E\u4FEE\u8BA2\u4FE1\u606F", value: { entryId: selected.entryId, revision: selected.revision, scope: selected.scope, source: selected.source, sourceRefs: selected.sourceRefs, supersedes: selected.supersedes, updatedAt: selected.updatedAt } })),
    editing && h(
      "form",
      { className: "pt-memory-editor", onSubmit: save },
      h("h4", null, editing.isIndex ? "\u7F16\u8F91 MEMORY.md \u7D22\u5F15" : editing.file ? "\u7F16\u8F91\u8BB0\u5FC6\u6587\u4EF6" : "\u65B0\u5EFA\u8BB0\u5FC6\u6587\u4EF6"),
      editing.isIndex ? h(import_react2.default.Fragment, null, h("p", { className: "pt-help" }, "\u53EA\u4FDD\u5B58\u7D22\u5F15\u8BF4\u660E\u548C\u7F6E\u9876\u9879\u3002\u94FE\u63A5\u7531\u5F53\u524D\u8BB0\u5F55\u91CD\u65B0\u751F\u6210\uFF0C\u4E0D\u521B\u5EFA\u7B2C\u4E8C\u4EFD\u6B63\u6587\u3002"), h("label", null, "\u7D22\u5F15\u8BF4\u660E", h("textarea", { value: draft.description, rows: 3, autoFocus: true, "aria-label": "\u7D22\u5F15\u8BF4\u660E", onChange: (e) => change("description", e.target.value) })), h("fieldset", null, h("legend", null, "\u7F6E\u9876\u5F53\u524D\u8BB0\u5FC6"), !entries.some((entry) => entry.status === "active" && entry.scope?.kind !== "thread") && h("p", { className: "pt-help" }, "\u8FD8\u6CA1\u6709\u53EF\u7F6E\u9876\u7684\u5F53\u524D\u8BB0\u5FC6\u3002"), entries.filter((entry) => entry.status === "active" && entry.scope?.kind !== "thread").map((entry) => h("label", { key: entry.entryId }, h("input", { type: "checkbox", checked: draft.pinnedEntryIds.includes(entry.entryId), onChange: (e) => change("pinnedEntryIds", e.target.checked ? [...draft.pinnedEntryIds, entry.entryId] : draft.pinnedEntryIds.filter((id) => id !== entry.entryId)) }), entry.logicalPath ?? entry.name)))) : h(import_react2.default.Fragment, null, h("label", null, "\u8BB0\u5FC6\u540D\u79F0", h("input", { required: true, autoFocus: true, value: draft.name, "aria-label": "\u8BB0\u5FC6\u540D\u79F0", onChange: (e) => change("name", e.target.value) })), h("label", null, "\u903B\u8F91\u6587\u4EF6\u8DEF\u5F84", h("input", { value: draft.logicalPath, "aria-label": "\u8BB0\u5FC6\u6587\u4EF6\u8DEF\u5F84", placeholder: "\u7559\u7A7A\u65F6\u6309\u4E3B\u9898\u751F\u6210\uFF1B\u4F8B\u5982 decisions/storage.md", onChange: (e) => change("logicalPath", e.target.value) })), h("div", { className: "pt-memory-fields" }, h("label", null, "\u5185\u5BB9\u7C7B\u578B", h("select", { value: draft.kind, "aria-label": "\u8BB0\u5FC6\u7C7B\u578B", onChange: (e) => change("kind", e.target.value) }, Object.entries(kindNames).map(([kind, label]) => h("option", { key: kind, value: kind }, label)))), h("label", null, "\u4FDD\u5B58\u4E3A", h("select", { value: draft.status, "aria-label": "\u8BB0\u5FC6\u4FDD\u5B58\u72B6\u6001", onChange: (e) => change("status", e.target.value) }, h("option", { value: "active" }, "\u5F53\u524D\u8BB0\u5FC6"), h("option", { value: "candidate" }, "\u5019\u9009 \xB7 \u6682\u4E0D\u4F5C\u4E3A\u6B63\u5F0F\u51B3\u5B9A")))), h("label", null, "\u6B63\u6587", h("textarea", { rows: 9, required: true, value: draft.content, "aria-label": "\u8BB0\u5FC6\u5185\u5BB9", onChange: (e) => change("content", e.target.value) })), h("p", { className: "pt-help" }, "\u8303\u56F4\uFF1A" + scopeName(editing.file?.scope ?? { kind: "project" }) + "\u3002\u4FDD\u5B58\u91C7\u7528\u7248\u672C\u68C0\u67E5\uFF1B\u540C\u4E3B\u9898\u7684\u5F53\u524D\u51B3\u5B9A\u7531\u670D\u52A1\u7AEF\u539F\u5B50\u66FF\u4EE3\u3002")),
      h("p", { className: "pt-help" }, "\u672C\u6B21\u53EA\u4FDD\u5B58\u8BB0\u5FC6\u6587\u4EF6\u3002\u9879\u76EE\u6307\u4EE4\u5728\u4E0A\u65B9\u5355\u72EC\u7F16\u8F91\u5E76\u901A\u8FC7\u201C\u4FDD\u5B58\u9879\u76EE\u8BBE\u7F6E\u201D\u63D0\u4EA4\u3002"),
      h("div", { className: "pt-actions" }, h("button", { type: "submit", className: "pt-button pt-primary", disabled: locked }, "\u4FDD\u5B58\u8BB0\u5FC6\u6587\u4EF6"), h(Button, { disabled: locked, onClick: () => {
        setEditing(null);
        setDraft(null);
      } }, "\u53D6\u6D88\u7F16\u8F91"))
    ),
    forget && h("div", { role: "group", "aria-label": "\u786E\u8BA4\u5FD8\u8BB0", className: "pt-error" }, h("div", null, h("strong", null, "\u5FD8\u8BB0\u201C" + (forget.logicalPath ?? forget.name) + "\u201D\u53CA\u5176\u5386\u53F2\u7248\u672C\uFF1F"), h("p", null, "\u540E\u7EED\u8BB0\u5FC6\u8BFB\u53D6\u3001\u68C0\u7D22\u548C\u81EA\u52A8\u6CE8\u5165\u5C06\u6392\u9664\u6B64\u5185\u5BB9\u3002\u5DF2\u6709\u804A\u5929\u4E0E Library \u539F\u8D44\u6599\u4FDD\u6301\uFF1B\u540C\u4E00\u4E8B\u5B9E\u4ECD\u53EF\u80FD\u4F5C\u4E3A\u6765\u6E90\u8D44\u6599\u88AB\u68C0\u7D22\u5230\uFF0C\u53EF\u5728\u4E0B\u65B9\u201C\u8D44\u6599\u7D22\u5F15\u8303\u56F4\u201D\u6392\u9664\u8BE5\u8D44\u6599\u3002"), h("div", { className: "pt-actions" }, h(Button, { kind: "danger", disabled: locked, onClick: () => execute("\u6B63\u5728\u5FD8\u8BB0\u8BB0\u5FC6\u2026", async (signal, current) => {
      await request("memory.delete", { projectId, entryId: forget.entryId, expectedRevision: forget.revision, operationId: operationId() }, void 0, signal);
      if (current()) {
        setForget(null);
        setSelected(null);
        setResults(null);
        setNotice("\u5DF2\u5FD8\u8BB0\u3002\u65E7\u4F1A\u8BDD\u6587\u672C\u4E0D\u4F1A\u88AB\u8FFD\u6EAF\u5220\u9664\u3002");
        await refresh();
      }
    }) }, "\u786E\u8BA4\u5FD8\u8BB0"), h(Button, { disabled: locked, onClick: () => setForget(null) }, "\u53D6\u6D88\u5FD8\u8BB0")))),
    source && h("section", { className: "pt-memory-source-preview", "aria-label": "\u8BB0\u5FC6\u6765\u6E90\u8D44\u6599" }, h("header", null, h("h4", null, source.name ?? "\u539F\u59CB\u6765\u6E90"), h(Button, { icon: "close", kind: "icon", "aria-label": "\u5173\u95ED\u6765\u6E90\u8D44\u6599", onClick: () => setSource(null) })), source.stale && h("p", { className: "pt-memory-notice", role: "status" }, "\u6765\u6E90\u5DF2\u53D8\u5316\u6216\u539F\u7248\u672C\u4E0D\u53EF\u7528\uFF0C\u8BF7\u6309\u4E0B\u65B9\u7248\u672C\u4FE1\u606F\u6838\u5BF9\uFF1B\u4E0D\u8981\u89C6\u4E3A\u5F53\u524D\u8BC1\u636E\u3002"), h("pre", { className: "pt-memory-content" }, source.content ?? "\u6B64\u6765\u6E90\u6CA1\u6709\u53EF\u663E\u793A\u7684\u6587\u672C\u3002"), h(Details, { label: "\u6388\u6743\u6765\u6E90\u4E0E\u7248\u672C", value: source.source })),
    h("details", { className: "pt-memory-evidence" }, h("summary", null, "\u8D44\u6599\u7D22\u5F15\u4E0E\u9690\u79C1"), h("p", { className: "pt-help" }, "\u7D22\u5F15\u53EA\u8986\u76D6\u672C\u9879\u76EE\u5DF2\u6388\u6743\u7684\u8D44\u6599\uFF0C\u5B58\u653E\u5728\u63D2\u4EF6\u6570\u636E\u76EE\u5F55\u3002\u4E0D\u4F1A\u4FEE\u6539\u5DE5\u7A0B\u6587\u4EF6\u6216 .gitignore\u3002"), h("label", null, h("input", { type: "checkbox", checked: !!indexMeta.autoEvidence, disabled: locked, onChange: (e) => {
      const autoEvidence = e.target.checked;
      void execute("\u6B63\u5728\u66F4\u65B0\u8D44\u6599\u7D22\u5F15\u8BBE\u7F6E\u2026", async (signal, current) => {
        await request("memory.settings", { projectId, autoEvidence }, void 0, signal);
        if (current()) await refresh();
      });
    } }), "\u81EA\u52A8\u53EC\u56DE\u76F8\u5173\u8BC1\u636E"), h("div", { className: "pt-actions" }, h(Button, { disabled: locked || !indexResources.length, onClick: () => setIndexConfirm(true) }, "\u7D22\u5F15\u5DE5\u7A0B / \u5237\u65B0"), !indexResources.length && h("span", { className: "pt-help" }, "\u6CA1\u6709\u5DF2\u6388\u6743\u7684\u5DE5\u7A0B\u6839\u76EE\u5F55\uFF1B\u9879\u76EE\u8BB0\u5FC6\u548C Library \u4ECD\u53EF\u4F7F\u7528\u3002")), h("details", { className: "pt-memory-library-scope" }, h("summary", null, "\u8D44\u6599\u7D22\u5F15\u8303\u56F4 \xB7 Library"), h("p", { className: "pt-help" }, "\u52FE\u9009\u540E\u6392\u9664\u6B64\u8D44\u6599\u53CA\u540E\u7EED\u7248\u672C\u7684\u6D3E\u751F\u68C0\u7D22\uFF0C\u4E0D\u5220\u9664 Library \u539F\u6587\u4EF6\u3002\u672A\u52FE\u9009\u7684\u8D44\u6599\u4ECD\u6309\u9879\u76EE\u6743\u9650\u4F7F\u7528\u3002"), !(state.libraryItems ?? []).some((item) => !item.deleted) && h("p", { className: "pt-help" }, "Library \u4E2D\u5C1A\u65E0\u8D44\u6599\u3002"), (state.libraryItems ?? []).filter((item) => !item.deleted).map((item) => h("label", { key: item.itemId }, h("input", { type: "checkbox", "aria-label": "\u6392\u9664\u8D44\u6599\u7D22\u5F15 " + item.name, checked: (indexMeta.excludedLibraryItemIds ?? []).includes(item.itemId), disabled: locked, onChange: (e) => {
      const old = indexMeta.excludedLibraryItemIds ?? [], excludedLibraryItemIds = e.target.checked ? [.../* @__PURE__ */ new Set([...old, item.itemId])] : old.filter((id) => id !== item.itemId);
      void execute("\u6B63\u5728\u4FDD\u5B58\u8D44\u6599\u7D22\u5F15\u8303\u56F4\u2026", async (signal, current) => {
        await request("memory.settings", { projectId, excludedLibraryItemIds }, void 0, signal);
        if (current()) {
          setResults(null);
          setSource(null);
          await refresh();
          setNotice("\u8D44\u6599\u7D22\u5F15\u8303\u56F4\u5DF2\u66F4\u65B0\uFF0C\u65E7\u68C0\u7D22\u7ED3\u679C\u5DF2\u6E05\u9664\u3002");
        }
      });
    } }), "\u6392\u9664 " + item.name + " \xB7 v" + item.version))), indexMeta.health && h(Details, { label: "\u7D22\u5F15\u72B6\u6001", value: indexMeta.health }), indexConfirm && h("div", { className: "pt-memory-index-confirm", role: "group", "aria-label": "\u786E\u8BA4\u8D44\u6599\u7D22\u5F15\u8303\u56F4" }, h("h4", null, "\u786E\u8BA4\u672C\u6B21\u7D22\u5F15\u8303\u56F4"), h("p", { className: "pt-help" }, "\u53EA\u626B\u63CF\u4EE5\u4E0B\u5DF2\u6388\u6743\u6839\u76EE\u5F55\uFF1B\u6743\u9650\u4E0E\u5185\u5BB9\u7248\u672C\u5728\u63D0\u4EA4\u65F6\u518D\u6B21\u6821\u9A8C\u3002"), h("ul", null, indexResources.map((resource, i) => h("li", { key: resource.resourceId ?? i }, h("code", null, resource.root), h("p", { className: "pt-help" }, resource.resourceId + " \xB7 " + (resource.workspaceInstanceId ?? "\u4E3B\u8D44\u6E90"))))), h("p", null, "\u6392\u9664\uFF1A" + excludes.join("\u3001")), h("div", { className: "pt-actions" }, h(Button, { kind: "primary", disabled: locked, onClick: () => execute("\u6B63\u5728\u7D22\u5F15\u5DF2\u6388\u6743\u8D44\u6599\u2026", async (signal, current) => {
      const value = await request("evidence.index", { projectId, resources: indexResources.map(({ resourceId, workspaceInstanceId, version }) => ({ resourceId, workspaceInstanceId, version })) }, void 0, signal);
      if (current()) {
        setIndexConfirm(false);
        setNotice(value.cancelled ? "\u7D22\u5F15\u5DF2\u53D6\u6D88\u3002" : "\u8D44\u6599\u7D22\u5F15\u5DF2\u5237\u65B0\u3002");
        await refresh();
      }
    }) }, "\u786E\u8BA4\u5E76\u5F00\u59CB\u7D22\u5F15"), h(Button, { disabled: locked, onClick: () => setIndexConfirm(false) }, "\u53D6\u6D88")))),
    h(HindsightPanel, { key: projectId, projectId, value: state.hindsight, request, refresh, busy: locked || !!editing, onDirtyChange: setHindsightDirty }),
    h(UsedPackets, { packets, onOpenSource: openSource, disabled: locked })
  );
}

// src/product/client/project-data.mjs
var operationId2 = () => crypto.randomUUID();
function Table({ rows }) {
  return h("div", { className: "pt-reader-table-wrap" }, h("table", { className: "pt-reader-table" }, h("tbody", null, rows.map((row, i) => h("tr", { key: i }, row.map((cell, j) => h(i === 0 ? "th" : "td", { key: j }, typeof cell === "string" ? cell : Array.isArray(cell.blocks) ? cell.blocks.map((b, k) => h(DocumentBlock, { key: k, block: b })) : cell.text ?? "")))))));
}
function DocumentBlock({ block }) {
  return block.kind === "table" ? h(Table, { rows: block.rows }) : h(/heading|title/i.test(block.style ?? "") ? "h3" : "p", null, block.text);
}
function ReadableContent({ preview }) {
  if (preview.format && !preview.records && preview.truncated) return h("div", null, h("p", { className: "pt-help" }, "\u6B64\u8303\u56F4\u8F83\u5927\uFF0C\u5185\u5BB9\u5DF2\u5206\u6BB5\u3002\u53EF\u7F29\u5C0F\u8303\u56F4\u67E5\u770B\u7ED3\u6784\u5316\u9884\u89C8\uFF0C\u6216\u5C55\u5F00\u5F53\u524D\u6BB5\u5E76\u7EE7\u7EED\u8BFB\u53D6\u3002"), h(Details, { label: "\u5F53\u524D\u6BB5\u63D0\u53D6\u5185\u5BB9", value: preview.text }));
  if (preview.records && preview.format === "docx") return preview.records.map((b, i) => h(DocumentBlock, { block: b, key: b.path ?? i }));
  if (preview.records && preview.format === "pdf") return preview.records.map((p) => h("section", { key: p.page }, h("h3", null, "\u7B2C " + p.page + " \u9875"), h("p", null, p.text)));
  if (preview.records && preview.format === "xlsx") return h(import_react3.default.Fragment, null, h("div", { className: "pt-reader-table-wrap" }, h("table", { className: "pt-reader-table" }, h("thead", null, h("tr", null, ["\u5355\u5143\u683C", "\u503C", "\u516C\u5F0F / \u5DF2\u6709\u7F13\u5B58", "\u53EF\u89C1\u6027"].map((v) => h("th", { key: v }, v)))), h("tbody", null, preview.records.map((c) => h("tr", { key: c.cell }, h("td", null, c.cell), h("td", null, c.value === null ? "\u2014" : String(c.value)), h("td", null, c.formula ? h(import_react3.default.Fragment, null, h("code", null, "=" + c.formula), h("p", null, c.cachedValuePresent ? "\u7F13\u5B58\uFF1A" + c.value : "\u65E0\u7F13\u5B58\u503C\uFF08\u672A\u8BA1\u7B97\uFF09")) : "\u2014"), h("td", null, c.rowHidden ? "\u9690\u85CF\u884C" : "\u53EF\u89C1\u884C")))))), preview.mergedCells?.length > 0 && h("p", { className: "pt-help" }, "\u5408\u5E76\u533A\u57DF\uFF1A" + preview.mergedCells.join("\u3001")));
  if (preview.records && preview.format === "pptx") return preview.records.map((p) => h("section", { key: p.slide }, h("h3", null, "\u7B2C " + p.slide + " \u5F20"), p.shapes.map((s, i) => s.kind === "table" ? h(Table, { key: i, rows: s.rows }) : h("div", { key: i }, s.paragraphs.map((t, j) => h("p", { key: j }, t)))), p.notesIncluded && h("section", null, h("h4", null, "\u8BB2\u8005\u5907\u6CE8"), p.speakerNotes.map((t, i) => h("p", { key: i }, t)))));
  return h("p", { style: { whiteSpace: "pre-wrap" } }, preview.text);
}
function LibraryPanel({ projectId, state, request, refresh, theme = "light", query = "", onSourceTarget }) {
  const files = import_react3.default.useRef(null), folder = import_react3.default.useRef(null), replacement = import_react3.default.useRef(null), replaceTarget = import_react3.default.useRef(null), upload = import_react3.default.useRef(null), readAbort = import_react3.default.useRef(null), generation = import_react3.default.useRef(createReadGeneration()), live = import_react3.default.useRef(true), urls = import_react3.default.useRef(/* @__PURE__ */ new Set()), urlTimers = import_react3.default.useRef(/* @__PURE__ */ new Set());
  const [progress, setProgress] = import_react3.default.useState(null), [results, setResults] = import_react3.default.useState([]), [preview, setPreview] = import_react3.default.useState(null), [remove, setRemove] = import_react3.default.useState(null), [reading, setReading] = import_react3.default.useState(null), [error, setError] = import_react3.default.useState(null), [readOptions, setReadOptions] = import_react3.default.useState({}), [states, setStates] = import_react3.default.useState({}), [expanded, setExpanded] = import_react3.default.useState(false), [zoom, setZoom] = import_react3.default.useState("fit"), [kind, setKind] = import_react3.default.useState("all"), [showSource, setShowSource] = import_react3.default.useState(true);
  const sourceLink = state.links?.find((l) => l.threadId === preview?.source?.threadId), sourceNode = import_react3.default.useRef(null), previewTrigger = import_react3.default.useRef(null), returnFocus = import_react3.default.useRef(false), listRoot = import_react3.default.useRef(null), attempted = import_react3.default.useRef(null);
  const sourceRef = import_react3.default.useCallback((node) => {
    sourceNode.current = node;
    onSourceTarget?.(sourceLink, node);
  }, [sourceLink?.threadSessionId, onSourceTarget]);
  const items = state.libraryItems ?? [];
  const itemsRef = import_react3.default.useRef(items);
  itemsRef.current = items;
  import_react3.default.useLayoutEffect(() => {
    if (returnFocus.current && !preview && !expanded) {
      const button2 = [...listRoot.current.querySelectorAll("[data-library-item]")].find((el) => el.dataset.libraryItem === previewTrigger.current);
      if (button2) {
        returnFocus.current = false;
        button2.focus();
      }
    }
  }, [preview, expanded]);
  import_react3.default.useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      upload.current?.abort();
      readAbort.current?.abort();
      generation.current.invalidate();
      for (const url of urls.current) URL.revokeObjectURL(url);
      for (const timer of urlTimers.current) clearTimeout(timer);
      urls.current.clear();
      urlTimers.current.clear();
    };
  }, [projectId]);
  import_react3.default.useEffect(() => {
    if (preview && !items.some((i) => i.itemId === preview.itemId && i.version === preview.version)) {
      generation.current.invalidate();
      readAbort.current?.abort();
      setPreview(null);
      setExpanded(false);
    }
  }, [items, preview]);
  const read = async (item, options = {}) => {
    readAbort.current?.abort();
    const abort = new AbortController();
    readAbort.current = abort;
    const token = generation.current.next();
    attempted.current = item;
    setReading(item.itemId);
    setError(null);
    try {
      const value = await request("library.read", { projectId, itemId: item.itemId, expectedVersion: item.version, ...options }, void 0, abort.signal);
      if (!live.current || !generation.current.isCurrent(token) || !itemsRef.current.some((i) => i.itemId === item.itemId && i.version === item.version)) return;
      setPreview(value);
      setReadOptions(options);
      setStates((old) => ({ ...old, [item.itemId + "@" + item.version]: value.readable ? "\u53EF\u8BFB\u6587\u672C" : value.visualAvailable ? "\u53EF\u89C6\u5185\u5BB9" : "\u6682\u4E0D\u652F\u6301" }));
    } catch (e) {
      if (live.current && generation.current.isCurrent(token) && e.name !== "AbortError") {
        setError({ message: e.message, code: e.code, retry: () => read(itemsRef.current.find((i) => i.itemId === item.itemId) ?? item, options) });
        setStates((old) => ({ ...old, [item.itemId + "@" + item.version]: "\u8BFB\u53D6\u53D7\u9650" }));
      }
    } finally {
      if (live.current && generation.current.isCurrent(token)) setReading(null);
    }
  };
  async function importFiles(selected, replace) {
    const chosen = Array.from(selected ?? []);
    if (!chosen.length) return;
    const batchId = operationId2();
    if (chosen.length > 1e4 || chosen.reduce((n, f) => n + f.size, 0) > 1024 ** 3) {
      setError({ message: "\u8BF7\u5206\u6279\u5BFC\u5165\uFF1A\u6BCF\u6279\u6700\u591A10000\u4E2A\u6587\u4EF6\u30011 GiB\u3002" });
      return;
    }
    const abort = new AbortController();
    upload.current = abort;
    setResults([]);
    const summary = [];
    for (let i = 0; i < chosen.length; i++) {
      const f = chosen[i], name = replace?.name || (f.webkitRelativePath || f.name);
      if (!live.current) break;
      setProgress({ name, current: i + 1, total: chosen.length, done: i });
      if (abort.signal.aborted) {
        summary.push(...chosen.slice(i).map((f2) => ({ name: f2.webkitRelativePath || f2.name, result: "\u5DF2\u53D6\u6D88" })));
        break;
      }
      try {
        const input = { projectId, name, batchId, operationId: operationId2(), ...replace ? { replaceItemId: replace.itemId, expectedVersion: String(replace.version) } : {} };
        const response = await fetch("/api/project-threads/library/upload?" + new URLSearchParams(input), { method: "POST", credentials: "same-origin", headers: { "content-type": "application/octet-stream" }, body: f, signal: abort.signal });
        const b = await response.json();
        if (!response.ok || !b.ok) throw Error(b.error?.message ?? "\u5BFC\u5165\u5931\u8D25");
        summary.push({ name, result: "\u5DF2\u5BFC\u5165", version: b.value.item.version });
      } catch (e) {
        summary.push({ name, result: abort.signal.aborted ? "\u5DF2\u8BF7\u6C42\u53D6\u6D88" : "\u5931\u8D25", reason: abort.signal.aborted ? "\u63D0\u4EA4\u524D\u53EF\u53D6\u6D88\uFF1B\u5DF2\u63D0\u4EA4\u6761\u76EE\u4EE5\u5217\u8868\u4E3A\u51C6\u3002" : e.message });
      }
      if (live.current) {
        setResults([...summary]);
        await refresh();
      }
    }
    if (live.current) {
      setProgress(null);
      setResults(summary);
      await refresh();
    }
    upload.current = null;
  }
  async function download(item) {
    try {
      const response = await fetch("/api/project-threads/library?" + new URLSearchParams({ projectId, itemId: item.itemId }), { credentials: "same-origin" });
      if (!response.ok) throw Error("\u4E0B\u8F7D\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5");
      const bytes = await response.blob(), url = URL.createObjectURL(bytes), a = document.createElement("a");
      if (!live.current) {
        URL.revokeObjectURL(url);
        return;
      }
      urls.current.add(url);
      a.href = url;
      a.download = basename(item.name);
      a.click();
      const timer = setTimeout(() => {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
        urlTimers.current.delete(timer);
      }, 1e3);
      urlTimers.current.add(timer);
    } catch (e) {
      setError({ message: e.message, retry: () => download(item) });
    }
  }
  const back = () => {
    readAbort.current?.abort();
    generation.current.invalidate();
    setReading(null);
    setPreview(null);
    setExpanded(false);
    returnFocus.current = true;
  };
  const reader = preview && h(
    "section",
    { className: "pt-reader", "aria-label": "\u5B89\u5168\u8D44\u6599\u9884\u89C8" },
    h("div", { className: "pt-reader-toolbar" }, h(Button, { icon: "back", kind: "ghost", onClick: back }, "\u8FD4\u56DE\u8D44\u6599"), h("span", { style: { flex: 1 } }), h(Button, { icon: "expand", kind: "icon", "aria-label": expanded ? "\u7F29\u5C0F\u9605\u8BFB\u9762\u677F" : "\u6269\u5927\u9605\u8BFB\u9762\u677F", onClick: () => setExpanded(!expanded) })),
    !expanded && h("h3", { className: "pt-reader-title" }, preview.name),
    h("p", { className: "pt-reader-source" }, "v" + preview.version + " \xB7 " + (preview.readable ? "\u53EF\u8BFB\u6587\u672C" : preview.visualAvailable ? "\u53EF\u89C6\u5185\u5BB9" : "\u5C1A\u4E0D\u652F\u6301\u8BFB\u53D6") + (preview.sheet ? " \xB7 " + preview.sheet + "!" + preview.range : preview.format === "pdf" ? " \xB7 \u7269\u7406\u9875 " + (readOptions.start ?? 1) : "")),
    ["pdf", "docx", "pptx"].includes(preview.format) && h("form", { className: "pt-reader-range", onSubmit: (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      void read(preview, { start: Number(f.get("start")), end: Number(f.get("end")), includeNotes: f.get("notes") === "on" });
    } }, h("label", null, preview.format === "pdf" ? "\u8D77\u59CB\u9875" : "\u8D77\u59CB\u5355\u5143", h("input", { key: "start-" + preview.itemId + "@" + preview.version + "-" + (readOptions.start ?? 1), type: "number", min: 1, name: "start", "aria-label": "\u8D77\u59CB\u9875\u6216\u5355\u5143", defaultValue: readOptions.start ?? 1, required: true })), h("label", null, "\u81F3", h("input", { key: "end-" + preview.itemId + "@" + preview.version + "-" + (readOptions.end ?? readOptions.start ?? 1), type: "number", min: 1, name: "end", "aria-label": "\u7ED3\u675F\u9875\u6216\u5355\u5143", defaultValue: readOptions.end ?? readOptions.start ?? 1, required: true })), preview.format === "pptx" && h("label", null, h("input", { key: "notes-" + preview.itemId + "-" + readOptions.includeNotes, name: "notes", type: "checkbox", defaultChecked: readOptions.includeNotes }), "\u8BB2\u8005\u5907\u6CE8"), h("button", { type: "submit", disabled: !!reading }, "\u8BFB\u53D6\u8303\u56F4")),
    preview.format === "xlsx" && h("form", { className: "pt-reader-range", onSubmit: (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      void read(preview, { sheet: f.get("sheet"), range: f.get("range") });
    } }, h("label", null, "\u5DE5\u4F5C\u8868", h("select", { key: "sheet-" + preview.itemId + "-" + preview.sheet, name: "sheet", defaultValue: preview.sheet }, preview.sheets.map((s) => h("option", { key: s.name, value: s.name }, s.name + (s.state !== "visible" ? "\uFF08\u9690\u85CF\uFF09" : ""))))), h("label", null, "\u8303\u56F4", h("input", { key: "range-" + preview.itemId + "-" + preview.range, name: "range", defaultValue: preview.range, required: true, "aria-label": "\u5355\u5143\u683C\u8303\u56F4" })), h("button", { type: "submit", disabled: !!reading }, "\u8BFB\u53D6\u8303\u56F4")),
    preview.readable && h("div", { className: "pt-reader-content" }, h(ReadableContent, { preview })),
    !preview.readable && h("p", { className: "pt-help" }, preview.visualAvailable ? "\u6B64\u5185\u5BB9\u53EF\u6309\u5B9E\u9645\u56FE\u50CF\u8BFB\u53D6\u3002\u4F1A\u8BDD\u8BFB\u56FE\u9700\u8981\u5F53\u524D\u6A21\u578B\u652F\u6301\u89C6\u89C9\u3002" : preview.reason),
    (preview.visualAvailable || preview.format === "pdf") && h(import_react3.default.Fragment, null, h("div", { className: "pt-reader-toolbar" }, h("label", null, "\u663E\u793A", h("select", { "aria-label": "\u56FE\u7247\u7F29\u653E", value: zoom, onChange: (e) => setZoom(e.target.value) }, h("option", { value: "fit" }, "\u9002\u5E94\u5BBD\u5EA6"), h("option", { value: "100" }, "100%")))), h("div", { className: "pt-image-view" }, h("img", { className: "pt-reader-image", loading: "lazy", alt: preview.name + (preview.format === "pdf" ? " \u7B2C " + (readOptions.start ?? 1) + " \u9875" : ""), style: zoom === "100" ? { maxWidth: "none", maxHeight: "none" } : {}, src: "/api/project-threads/library/preview?" + new URLSearchParams({ projectId, itemId: preview.itemId, expectedVersion: preview.version, start: readOptions.start ?? 1 }) }))),
    (preview.omissions?.length > 0 || preview.contentStatus === "partial") && h("div", { className: "pt-error", role: "status" }, "\u90E8\u5206\u7ED3\u6784\u672A\u8986\u76D6\uFF0C\u8BF7\u67E5\u770B\u8BFB\u53D6\u8303\u56F4\u4E0E\u9650\u5236\u3002"),
    h("div", { className: "pt-actions" }, preview.truncated && h(Button, { disabled: !!reading, onClick: () => read(preview, { ...readOptions, offset: preview.nextOffset }) }, "\u7EE7\u7EED\u8BFB\u53D6\u8FD9\u4E00\u8303\u56F4"), preview.nextStart && h(Button, { disabled: !!reading, onClick: () => read(preview, { start: preview.nextStart }) }, "\u4E0B\u4E00\u9875\u6216\u5355\u5143"), h(Button, { onClick: () => download(preview) }, "\u4E0B\u8F7D\u539F\u6587\u4EF6")),
    h(Details, { label: "\u6765\u6E90\u4E0E\u7248\u672C", value: { projectId, itemId: preview.itemId, version: preview.version, sha256: preview.sha256, source: preview.source, selection: preview.selection } }),
    h(Details, { label: "\u8BFB\u53D6\u8303\u56F4\u4E0E\u9650\u5236", value: { limitations: preview.limitations, omissions: preview.omissions, omittedParts: preview.omittedParts, embeddedResources: preview.embeddedResources, adapterVersion: preview.adapterVersion } })
  );
  return h(
    "section",
    { ref: listRoot, "aria-label": "Project Library" },
    h("input", { ref: files, type: "file", multiple: true, hidden: true, onChange: (e) => {
      void importFiles(e.target.files);
      e.target.value = "";
    } }),
    h("input", { ref: folder, type: "file", multiple: true, webkitdirectory: "", hidden: true, onChange: (e) => {
      void importFiles(e.target.files);
      e.target.value = "";
    } }),
    h("input", { ref: replacement, type: "file", hidden: true, onChange: (e) => {
      void importFiles(e.target.files, replaceTarget.current);
      e.target.value = "";
    } }),
    error && h(ErrorNotice, { ...error, onRetry: error.retry, onDismiss: () => setError(null) }),
    reading && h("div", { role: "status", className: "pt-banner" }, "\u6B63\u5728\u8BFB\u53D6\u8D44\u6599\u2026", h(Button, { onClick: () => {
      readAbort.current?.abort();
      generation.current.invalidate();
      setReading(null);
    } }, "\u53D6\u6D88\u8BFB\u53D6")),
    progress && h("div", { role: "status", className: "pt-settings-section" }, h("p", null, "\u5BFC\u5165 " + progress.current + "/" + progress.total + " \xB7 " + progress.name), h("progress", { value: progress.done, max: progress.total, "aria-label": "\u8D44\u6599\u5BFC\u5165\u8FDB\u5EA6" }), h(Button, { onClick: () => upload.current?.abort() }, "\u53D6\u6D88\u5BFC\u5165")),
    results.length > 0 && h("details", { className: "pt-details" }, h("summary", null, "\u672C\u6B21\u5BFC\u5165\u7ED3\u679C"), h("ul", null, results.map((r, i) => h("li", { key: i }, r.name + "\uFF1A" + r.result + (r.reason ? " \xB7 " + r.reason : ""))))),
    !preview && h(import_react3.default.Fragment, null, h("div", { className: "pt-library-head" }, h("select", { "aria-label": "\u8D44\u6599\u7C7B\u578B", value: kind, onChange: (e) => setKind(e.target.value) }, h("option", { value: "all" }, "\u7C7B\u578B\uFF1A\u5168\u90E8"), h("option", { value: "import" }, "\u5BFC\u5165\u6587\u4EF6"), h("option", { value: "thread-output" }, "\u8BA8\u8BBA\u4E32\u4EA7\u7269")), h(Menu, { label: "\u6DFB\u52A0\u8D44\u6599", icon: "add" }, h(Button, { role: "menuitem", disabled: !!progress, onClick: () => files.current.click() }, "\u6DFB\u52A0\u6587\u4EF6"), h(Button, { role: "menuitem", disabled: !!progress, onClick: () => folder.current.click() }, "\u6DFB\u52A0\u6587\u4EF6\u5939"))), h("div", { className: "pt-library-columns" }, "\u540D\u79F0", h("span", null, items.length + " \u9879")), !items.length && h(Empty, { title: "\u9879\u76EE\u7684\u8D44\u6599\u4E0E\u4EA7\u7269", icon: "file" }, "\u6DFB\u52A0\u6587\u4EF6\uFF0C\u6216\u8BA9 Thread \u53D1\u5E03\u5B83\u5B8C\u6210\u7684\u5185\u5BB9\u3002"), items.filter((item) => (kind === "all" || item.kind === kind) && (!query || item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))).map((item) => h("article", { className: "pt-file-row", key: item.itemId }, h(Button, { "aria-label": "\u6253\u5F00 " + item.name, "data-library-item": item.itemId, title: item.name, onClick: (e) => {
      previewTrigger.current = item.itemId;
      setExpanded(true);
      void read(item);
    } }, h("span", { className: "pt-file-icon" }, item.name.split(".").at(-1).toUpperCase().slice(0, 5)), h("span", { className: "pt-file-copy" }, h("strong", null, item.name), h("small", null, "v" + item.version + " \xB7 " + (states[item.itemId + "@" + item.version] ?? "\u5DF2\u5BFC\u5165\uFF0C\u6309\u9700\u89E3\u6790") + " \xB7 " + (item.kind === "thread-output" ? "Thread \u4EA7\u7269" : Math.max(1, Math.round(item.size / 1024)) + " KB")))), h(Menu, { label: item.name + " \u64CD\u4F5C" }, h(Button, { role: "menuitem", onClick: () => download(item) }, "\u4E0B\u8F7D\u539F\u6587\u4EF6"), h(Button, { role: "menuitem", disabled: !!progress, onClick: () => {
      replaceTarget.current = item;
      replacement.current.click();
    } }, "\u66FF\u6362"), h(Button, { role: "menuitem", kind: "danger", onClick: () => setRemove(item) }, "\u79FB\u9664")))), h("details", { className: "pt-details" }, h("summary", null, "\u8D44\u6599\u4E0E\u9690\u79C1"), h("p", null, "\u5BFC\u5165\u53EA\u4FDD\u5B58\u672C\u5730\u53EA\u8BFB\u526F\u672C\uFF0C\u4E0D\u6539\u53D8\u539F\u6587\u4EF6\u3002\u4F1A\u8BDD\u8BFB\u56FE\u53EF\u80FD\u53D1\u9001\u7ED9\u6240\u9009\u6A21\u578B\uFF1B\u9884\u89C8\u4E0D\u8C03\u7528\u6A21\u578B\u3002"))),
    preview && !expanded && reader,
    expanded && h(Modal, { title: preview?.name ?? (reading ? "\u6B63\u5728\u8BFB\u53D6\u8D44\u6599" : error ? /DTD|entity|UNSAFE_XML/i.test(error.code + " " + error.message) ? "\u8D44\u6599\u8BFB\u53D6\u5DF2\u62D2\u7EDD" : "\u8D44\u6599\u8BFB\u53D6\u5931\u8D25" : "\u8D44\u6599\u8BFB\u53D6\u5DF2\u53D6\u6D88"), className: "pt-reading-expanded", nativeMenus: true, theme, onClose: back, actions: preview && h(import_react3.default.Fragment, null, h(Button, { icon: "download", kind: "icon", "aria-label": "\u4E0B\u8F7D\u539F\u6587\u4EF6", onClick: () => download(preview) }), sourceLink && h(Button, { icon: "panel", kind: "icon", "aria-label": showSource ? "\u9690\u85CF\u6765\u6E90\u8BA8\u8BBA\u4E32" : "\u663E\u793A\u6765\u6E90\u8BA8\u8BBA\u4E32", onClick: () => setShowSource(!showSource) })) }, h("div", { className: "pt-file-preview-layout" }, h("div", { className: "pt-scroll" }, error ? h(ErrorNotice, { ...error, onRetry: error.retry }) : reader ?? h("p", { role: "status" }, "\u6B63\u5728\u8BFB\u53D6\u8D44\u6599\u2026")), showSource && sourceLink && h("section", { className: "pt-file-source-thread", "aria-label": "\u8D44\u6599\u6765\u6E90\u8BA8\u8BBA\u4E32" }, h("header", null, "\u8BA8\u8BBA\u4E32 \u203A " + sourceLink.title), h("div", { ref: sourceRef, className: "pt-preview-native-target" })))),
    remove && h("div", { role: "group", "aria-label": "\u786E\u8BA4\u79FB\u9664\u8D44\u6599", className: "pt-error" }, h("div", null, h("strong", null, "\u79FB\u9664\u201C" + remove.name + "\u201D\uFF1F"), h("p", null, "\u4EC5\u79FB\u9664 Library \u526F\u672C\u3002\u539F\u6587\u4EF6\u4E0E\u65E2\u6709\u804A\u5929\u4FDD\u7559\u3002"), h("div", { className: "pt-actions" }, h(Button, { kind: "danger", onClick: async () => {
      try {
        await request("library.delete", { projectId, itemId: remove.itemId, expectedVersion: remove.version, operationId: operationId2() });
        setRemove(null);
        back();
        await refresh();
      } catch (e) {
        setError({ message: e.message });
      }
    } }, "\u786E\u8BA4\u79FB\u9664"), h(Button, { onClick: () => setRemove(null) }, "\u53D6\u6D88\u79FB\u9664"))))
  );
}
function ResourcesPanel({ state }) {
  return h("section", { "aria-label": "Project Resources", className: "pt-settings-section" }, h("h3", null, "\u5DE5\u4F5C\u533A\u4E0E\u53EA\u8BFB\u8D44\u6599"), (state.bindings ?? []).map((b) => h("article", { className: "pt-memory-item", key: b.bindingId }, h("strong", null, b.workspacePath === state.managedProjectFolder ? "\u9879\u76EE\u5DE5\u4F5C\u533A" : basename(b.workspacePath)), h("p", null, (b.workspaceMode === "worktree" ? "\u72EC\u7ACB Worktree" : "\u76F4\u63A5\u76EE\u5F55") + " \xB7 " + (b.availableForExecution ? "\u6388\u6743\u6709\u6548" : "\u9700\u91CD\u65B0\u6388\u6743")), h(Details, { label: "\u5B8C\u6574\u5DE5\u4F5C\u533A\u8DEF\u5F84", value: b.workspacePath }))), (state.libraryItems ?? []).map((i) => h("p", { key: i.itemId, className: "pt-help" }, i.name + " \xB7 v" + i.version + " \xB7 \u53EA\u8BFB")));
}
var button = (label, props = {}) => h(Button, props, label);
function LifecycleMenu({ project, request, run, refresh, busy, deleted }) {
  const [confirm, setConfirm] = import_react3.default.useState(false), [name, setName] = import_react3.default.useState(""), [retained, setRetained] = import_react3.default.useState(false);
  const status = project.lifecycle ?? "active";
  const change = (action) => run(async () => {
    await request("project.lifecycle", { projectId: project.projectId, action });
    await refresh();
  });
  const row = (title, description, label, props) => h("div", { className: "pt-lifecycle-row" }, h("div", null, h("span", null, title), h("p", { className: "pt-help" }, description)), button(label, { "aria-label": title, ...props }));
  return h("div", { className: "pt-lifecycle-rows" }, h("span", { role: "status", className: "pt-help" }, { active: "\u6D3B\u52A8", paused: "\u5DF2\u6682\u505C", pausing: "\u6B63\u5728\u505C\u6B62", archiving: "\u6B63\u5728\u5F52\u6863", archived: "\u5DF2\u5F52\u6863", deleting: "\u6B63\u5728\u5220\u9664" }[status] ?? status), status === "active" ? row("\u6682\u505C\u9879\u76EE", "\u6682\u505C\u534F\u8C03\u5668\u4E0E\u65B0\u8BA8\u8BBA\u4E32\u7684\u521B\u5EFA\uFF0C\u53EF\u968F\u65F6\u6062\u590D\u3002", "\u6682\u505C", { disabled: busy, onClick: () => change("pause") }) : status === "paused" ? row("\u6062\u590D\u9879\u76EE", "\u6062\u590D\u540E\u53EF\u7EE7\u7EED\u9879\u76EE\u8BA8\u8BBA\u3002", "\u6062\u590D", { disabled: busy, onClick: () => change("resume") }) : null, status === "archived" ? row("\u53D6\u6D88\u5F52\u6863", "\u91CD\u65B0\u663E\u793A\u6B64\u9879\u76EE\uFF0C\u4FDD\u7559\u539F\u6709\u8D44\u6599\u4E0E\u5386\u53F2\u3002", "\u53D6\u6D88\u5F52\u6863", { disabled: busy, onClick: () => change("unarchive") }) : row("\u5F52\u6863\u9879\u76EE", "\u9690\u85CF\u9879\u76EE\u5E76\u5F52\u6863\u4F1A\u8BDD\uFF0C\u4FDD\u7559\u9879\u76EE\u8D44\u6599\u3002", "\u5F52\u6863", { disabled: busy, onClick: () => change("archive") }), project.cleanup?.state === "failed" && h("span", { role: "alert" }, "\u6E05\u7406\u5931\u8D25\uFF0C\u6267\u884C\u5DF2\u5173\u95ED\u3002\u8BF7\u91CD\u8BD5\u5220\u9664\u3002"), row(status === "deleting" ? "\u91CD\u8BD5\u6E05\u7406\u2026" : "\u5220\u9664\u9879\u76EE\u2026", "\u5220\u9664\u63D2\u4EF6\u8D44\u6599\u4E0E\u5173\u8054\uFF0CDSH \u4F1A\u8BDD\u5386\u53F2\u5F52\u6863\u4FDD\u7559\uFF1B\u6E90\u6587\u4EF6\u3001\u4ED3\u5E93\u548C Worktree \u4FDD\u7559\u3002", status === "deleting" ? "\u91CD\u8BD5" : "\u5220\u9664", { disabled: busy, onClick: () => setConfirm(true) }), confirm && h("div", { role: "group", "aria-label": "\u5220\u9664\u9879\u76EE\u786E\u8BA4", style: { border: "1px solid var(--pt-line)", padding: 12 } }, h("p", null, "\u5220\u9664\u9879\u76EE\u201C" + project.name + "\u201D\u7684\u63D2\u4EF6\u6570\u636E\uFF1A\u505C\u6B62\u6267\u884C\u3001\u64A4\u9500\u672C\u9879\u76EE\u8BB8\u53EF\u3001\u79FB\u9664 Memory \u548C Library \u526F\u672C\u3002\u7528\u6237\u4ED3\u5E93\u3001\u539F\u59CB\u6587\u4EF6\u3001\u8FDC\u7AEF\u5BF9\u8C61\u4E0E\u5176\u4ED6\u9879\u76EE\u4FDD\u7559\u3002"), h("p", null, "DSH \u5BF9\u8BDD\u5386\u53F2\u5C06\u6309\u5DF2\u9009\u884C\u4E3A\u5F52\u6863\u4FDD\u7559\uFF1B\u6B64\u64CD\u4F5C\u4E0D\u80FD\u6E05\u9664\u5386\u53F2\u4E2D\u7684\u5185\u5BB9\u3002"), h("label", null, h("input", { type: "checkbox", checked: retained, onChange: (e) => setRetained(e.target.checked) }), "\u6211\u7406\u89E3 DSH \u4F1A\u8BDD\u5386\u53F2\u4F1A\u4FDD\u7559"), h("label", null, " \u8F93\u5165\u9879\u76EE\u540D\u786E\u8BA4 ", h("input", { value: name, "aria-label": "\u786E\u8BA4\u5220\u9664\u9879\u76EE\u540D", onChange: (e) => setName(e.target.value) })), button("\u786E\u8BA4\u5220\u9664\u63D2\u4EF6\u6570\u636E", { disabled: busy || name !== project.name || !retained, onClick: () => run(async () => {
    const result = await request("project.lifecycle", { projectId: project.projectId, action: "delete", confirmation: { projectId: project.projectId, name, retainSessionHistory: retained } });
    if (result.pluginDataRemoved) {
      setConfirm(false);
      await deleted();
    } else await refresh();
  }) }), button("\u53D6\u6D88\u5220\u9664", { onClick: () => {
    setConfirm(false);
    setName("");
    setRetained(false);
  } })));
}

// src/product/client/project-settings.mjs
var import_react5 = __toESM(require("react"), 1);

// src/product/protocol/project-settings.mjs
function settingsPatch(original, fields) {
  const result = original ? { projectId: original.projectId, expectedSettingsVersion: original.settingsVersion } : {};
  for (const [name, value] of Object.entries(fields)) if (!original || JSON.stringify(value) !== JSON.stringify(original[name])) result[name] = value;
  return result;
}

// src/product/client/local-execution.mjs
var import_react4 = __toESM(require("react"), 1);
var pickerErrors = { PICKER_ALREADY_OPEN: "\u4E0A\u4E00\u6B21\u7CFB\u7EDF\u9009\u62E9\u5668\u4ECD\u5728\u5173\u95ED\uFF0C\u8BF7\u5148\u53D6\u6D88\u8BE5\u7A97\u53E3\u6216\u7A0D\u540E\u91CD\u8BD5\u3002", PICKER_CAPACITY: "\u76EE\u5F55\u9009\u62E9\u8BF7\u6C42\u6682\u65F6\u8FBE\u5230\u4E0A\u9650\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002", PICKER_INVALID_ID: "\u76EE\u5F55\u9009\u62E9\u8BF7\u6C42\u65E0\u6548\uFF0C\u8BF7\u5237\u65B0\u754C\u9762\u540E\u91CD\u8BD5\u3002", NATIVE_PICKER_UNAVAILABLE: "\u6B64\u6267\u884C\u7AEF\u6CA1\u6709\u53EF\u7528\u7684\u539F\u751F\u76EE\u5F55\u9009\u62E9\u5668\u3002", HOST_CLOSING: "\u672C\u5730\u6267\u884C\u7AEF\u6B63\u5728\u5173\u95ED\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u540E\u91CD\u8BD5\u3002" };
var pickerError = (error) => {
  const detail = String(error?.message ?? error), code = typeof error?.code === "string" ? error.code : "";
  return { message: pickerErrors[code] ?? "\u76EE\u5F55\u9009\u62E9\u672A\u5B8C\u6210\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u82E5\u7CFB\u7EDF\u9009\u62E9\u5668\u4ECD\u5728\uFF0C\u8BF7\u5148\u53D6\u6D88\u8BE5\u7A97\u53E3\u3002", detail: (code ? code + ": " : "") + detail };
};
var pickerOutcome = (reason) => ({ cancelled: "\u5DF2\u53D6\u6D88\u672C\u6B21\u9009\u62E9\uFF1B\u4EFB\u52A1\u6388\u6743\u672A\u6539\u53D8\u3002", request_aborted: "\u76EE\u5F55\u9009\u62E9\u8BF7\u6C42\u5DF2\u4E2D\u6B62\uFF1B\u4EFB\u52A1\u6388\u6743\u672A\u6539\u53D8\u3002", closed: "\u672C\u5730\u6267\u884C\u7AEF\u5DF2\u5173\u95ED\uFF0C\u672A\u5E94\u7528\u76EE\u5F55\u9009\u62E9\u3002", superseded: "\u672C\u6B21\u9009\u62E9\u5DF2\u88AB\u66FF\u4EE3\uFF0C\u672A\u5E94\u7528\u8FD4\u56DE\u7684\u76EE\u5F55\u3002" })[reason] ?? "\u76EE\u5F55\u9009\u62E9\u5DF2\u53D6\u6D88\uFF1B\u4EFB\u52A1\u6388\u6743\u672A\u6539\u53D8\u3002";
function useDirectorySelection({ state, projectId, request, run, refresh }) {
  const [selection, setSelection] = import_react4.default.useState({ pending: false, target: null, notice: "", error: null });
  const active = import_react4.default.useRef(null), live = import_react4.default.useRef(true), generation = import_react4.default.useRef(0), current = import_react4.default.useRef(null);
  current.current = { state, projectId, request, run, refresh };
  const cancel = (reason = "cancelled", silent = false) => {
    const attempt = active.current;
    if (!attempt) return Promise.resolve();
    active.current = null;
    const token = ++generation.current;
    clearTimeout(attempt.timer);
    attempt.controller.abort();
    attempt.interrupt?.({ cancelled: true, reason });
    if (live.current && !silent) setSelection((old) => ({ ...old, pending: false, target: null, notice: reason === "timeout" ? "\u7B49\u5F85\u8D85\u8FC7\u670D\u52A1\u7684 120 \u79D2\u4E0A\u9650\uFF0C\u5DF2\u505C\u6B62\u672C\u5730\u7B49\u5F85\u5E76\u8BF7\u6C42\u5173\u95ED\u9009\u62E9\u5668\uFF1B\u53EF\u91CD\u65B0\u9009\u62E9\u3002" : pickerOutcome(reason) }));
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(Object.assign(Error("Cancellation acknowledgement timed out"), { code: "PICKER_CANCEL_TIMEOUT" }));
      }, 5e3);
    });
    return Promise.race([attempt.request("workspace.cancelPick", { pickerId: attempt.pickerId }, void 0, controller.signal), deadline]).catch((error) => {
      if (live.current && !silent && generation.current === token) setSelection((old) => ({ ...old, error: { message: "\u5DF2\u505C\u6B62\u672C\u5730\u7B49\u5F85\uFF0C\u4F46\u672A\u80FD\u786E\u8BA4\u7CFB\u7EDF\u9009\u62E9\u5668\u5DF2\u5173\u95ED\u3002\u8BF7\u53D6\u6D88\u8BE5\u7A97\u53E3\u540E\u518D\u91CD\u8BD5\uFF1B\u5176\u4ED6\u64CD\u4F5C\u4ECD\u53EF\u4F7F\u7528\u3002", detail: (error?.code ? error.code + ": " : "") + String(error?.message ?? error) } }));
    }).finally(() => clearTimeout(timer));
  };
  import_react4.default.useEffect(() => {
    live.current = true;
    setSelection({ pending: false, target: null, notice: "", error: null });
    return () => {
      live.current = false;
      void cancel("closed", true);
    };
  }, [projectId]);
  import_react4.default.useEffect(() => {
    const attempt = active.current;
    if (!attempt || attempt.phase !== "picking" || !attempt.target) return;
    const latest = state.executionRequests?.find((row) => row.requestId === attempt.target.requestId);
    if (!latest || latest.revision !== attempt.target.revision || latest.workspaceMode !== attempt.target.workspaceMode || ["active", "ready", "proposed", "denied", "preparing", "delivering"].includes(latest.phase)) void cancel("superseded");
  }, [state.executionRequests]);
  const pick = async (task) => {
    if (active.current) return;
    const target = task ? { projectId, requestId: task.requestId, revision: task.revision, workspaceMode: task.workspaceMode } : null;
    const attempt = { pickerId: crypto.randomUUID(), controller: new AbortController(), target, request, phase: "picking" }, token = ++generation.current;
    const valid = () => live.current && generation.current === token && active.current === attempt;
    active.current = attempt;
    setSelection((old) => ({ ...old, pending: true, target: target?.requestId ?? null, notice: "" }));
    const interrupted = new Promise((resolve) => {
      attempt.interrupt = resolve;
    });
    attempt.timer = setTimeout(() => {
      void cancel("timeout");
    }, 125e3);
    try {
      const selected = await Promise.race([request("workspace.pick", { pickerId: attempt.pickerId }, void 0, attempt.controller.signal), interrupted]);
      if (!valid()) return;
      clearTimeout(attempt.timer);
      if (selected?.cancelled) {
        setSelection((old) => ({ ...old, pending: false, target: null, notice: selected.reason === "timeout" ? "\u76EE\u5F55\u9009\u62E9\u5DF2\u8D85\u65F6\uFF08\u4E0A\u9650 120 \u79D2\uFF09\uFF0C\u672A\u6539\u53D8\u4EFB\u52A1\u6388\u6743\u3002\u53EF\u91CD\u65B0\u9009\u62E9\u3002" : pickerOutcome(selected.reason) }));
        return;
      }
      if (!selected?.folder?.folderId) throw Object.assign(Error("Picker returned no selected folder"), { code: "PICKER_INVALID_RESPONSE" });
      attempt.phase = "applying";
      setSelection((old) => ({ ...old, pending: false, target: null }));
      if (target) {
        const latest = current.current.state.executionRequests?.find((row) => row.requestId === target.requestId);
        if (!latest || latest.revision !== target.revision || latest.workspaceMode !== target.workspaceMode || ["active", "ready", "proposed", "denied", "preparing", "delivering"].includes(latest.phase)) {
          setSelection((old) => ({ ...old, notice: "\u4EFB\u52A1\u8BF7\u6C42\u5DF2\u53D8\u5316\uFF0C\u672A\u5E94\u7528\u672C\u6B21\u76EE\u5F55\u9009\u62E9\u3002\u8BF7\u91CD\u65B0\u9009\u62E9\u3002" }));
          return;
        }
        let applied = false;
        await run(async () => {
          if (!valid()) return;
          await request("workspace.choose", { ...target, folderId: selected.folder.folderId }, void 0, attempt.controller.signal);
          applied = true;
          if (valid()) await refresh();
        });
        if (!applied) return;
      } else if (valid()) await refresh();
      if (valid()) setSelection((old) => ({ ...old, error: null, notice: target ? "\u5DF2\u9009\u62E9\u76EE\u5F55\uFF0C\u8BF7\u7EE7\u7EED\u786E\u8BA4\u4EFB\u52A1\u6388\u6743\u8303\u56F4\u3002" : "\u6587\u4EF6\u5939\u5DF2\u8FDE\u63A5\uFF1B\u8FDE\u63A5\u4E0D\u4EE3\u8868\u6388\u4E88\u4EFB\u52A1\u6743\u9650\u3002" }));
    } catch (error) {
      if (valid() && error?.name !== "AbortError") setSelection((old) => ({ ...old, error: pickerError(error) }));
    } finally {
      clearTimeout(attempt.timer);
      if (active.current === attempt) {
        active.current = null;
        if (live.current) setSelection((old) => ({ ...old, pending: false, target: null }));
      }
    }
  };
  return { selection, pick, cancel, dismissError: () => setSelection((old) => ({ ...old, error: null })) };
}
function AuthorizationCards({ state, projectId, request, run, refresh, busy = false, inline = false }) {
  const { selection, pick, cancel, dismissError } = useDirectorySelection({ state, projectId, request, run, refresh });
  const operate = (op, input) => {
    void cancel("superseded");
    return run(async () => {
      await request(op, input);
      await refresh();
    });
  };
  const choose = (r, patch) => operate("workspace.choose", { projectId, requestId: r.requestId, revision: r.revision, ...patch });
  const [showDismissed, setShowDismissed] = import_react4.default.useState(false);
  const preparing = (state.executionRequests ?? []).filter((r) => r.projectGrantCheckPending || ["preparing", "delivering"].includes(r.phase));
  const all = (state.executionRequests ?? []).filter((r) => !r.projectGrantCheckPending && !["active", "ready", "proposed", "preparing", "delivering"].includes(r.phase));
  const cards = all.filter((r) => r.reason !== "dismissed" || showDismissed);
  if (inline && !cards.length && !preparing.length && !selection.pending && !selection.error && !selection.notice) return null;
  return h(
    "section",
    { "aria-label": "\u672C\u5730\u5DE5\u4F5C\u533A\u8BB8\u53EF", className: "pt-auth" },
    selection.pending && h("div", { className: "pt-banner", role: "status", "aria-label": "\u76EE\u5F55\u9009\u62E9\u72B6\u6001", "aria-busy": true }, h("span", null, "\u8BF7\u5728\u7CFB\u7EDF\u7A97\u53E3\u9009\u62E9\u76EE\u5F55\u3002\u6700\u957F\u7B49\u5F85 120 \u79D2\uFF1B\u5176\u4ED6\u64CD\u4F5C\u4ECD\u53EF\u4F7F\u7528\u3002"), h(Button, { onClick: () => cancel() }, "\u53D6\u6D88\u76EE\u5F55\u9009\u62E9")),
    selection.notice && h("p", { role: "status", className: "pt-help" }, selection.notice),
    selection.error && h("div", null, h(ErrorNotice, { message: selection.error.message, onDismiss: dismissError }), h(Details, { label: "\u76EE\u5F55\u9009\u62E9\u9519\u8BEF\u8BE6\u60C5", value: selection.error.detail })),
    !inline && h("p", { role: "status" }, "\u672C\u673A DSH \u6267\u884C\u7AEF\uFF1A" + ((state.endpoints ?? []).some((e) => e.availability === "online") ? "\u5728\u7EBF" : "\u5F85\u8FDE\u63A5\u6216\u6838\u9A8C")),
    !inline && h(Button, { disabled: busy || selection.pending, onClick: () => pick() }, "\u9009\u62E9\u672C\u673A\u6587\u4EF6\u5939"),
    !inline && h("details", null, h("summary", null, "\u5DF2\u8FDE\u63A5\u6587\u4EF6\u5939\uFF08\u8FDE\u63A5\u4E0D\u4EE3\u8868\u6388\u6743\uFF09"), (state.folders ?? []).map((f) => h("div", { key: f.folderId, className: "pt-resource-entry" }, h("p", null, f.identity.canonicalPath), h(Button, { disabled: busy, onClick: () => operate("workspace.disconnect", { folderId: f.folderId }) }, "\u65AD\u5F00\u8FDE\u63A5\uFF08\u5F71\u54CD\u4F7F\u7528\u6B64\u6587\u4EF6\u5939\u7684\u6240\u6709\u7EBF\u7A0B\uFF09")))),
    !inline && h("details", null, h("summary", null, "\u5DF2\u6388\u6743\u76EE\u5F55"), (state.bindings ?? []).filter((b) => state.grants?.some((g) => g.grantId === b.grantId && g.state === "granted")).map((b) => h("div", { key: b.bindingId, className: "pt-resource-entry" }, h("p", null, ((state.links ?? []).find((l) => l.threadId === b.threadId)?.title ?? "\u8BA8\u8BBA\u4E32") + "\uFF1A" + b.workspacePath), h(Button, { disabled: busy, onClick: () => operate("workspace.revoke", { grantId: b.grantId }) }, state.grants?.find((g) => g.grantId === b.grantId)?.scope === "project" ? "\u64A4\u9500\u9879\u76EE\u76EE\u5F55\u6388\u6743\u53CA\u5176\u6D3E\u751F\u7EBF\u7A0B\u8BB8\u53EF" : "\u64A4\u9500\u8BE5 Thread \u6388\u6743"), h(Button, { disabled: busy, onClick: () => operate("workspace.disconnect", { folderId: b.folderId }) }, "\u65AD\u5F00\u6B64\u6587\u4EF6\u5939\uFF08\u5F71\u54CD\u5176\u5168\u90E8\u6388\u6743\u7EBF\u7A0B\uFF09")))),
    !state.localCapabilities?.nativePicker && h("p", { role: "status" }, "\u6B64\u6267\u884C\u7AEF\u5C1A\u65E0\u5DF2\u9A8C\u8BC1\u7684\u539F\u751F\u6587\u4EF6\u5939\u9009\u62E9\u901A\u8DEF\u3002"),
    preparing.length > 0 && h("p", { role: "status" }, "\u6B63\u5728\u51C6\u5907\u5DF2\u6388\u6743\u7684\u672C\u5730\u5DE5\u4F5C\u533A\u2026"),
    all.some((r) => r.reason === "dismissed") && h(Button, { onClick: () => setShowDismissed(!showDismissed) }, showDismissed ? "\u9690\u85CF\u5DF2\u5173\u95ED\u8BF7\u6C42" : "\u663E\u793A\u5DF2\u5173\u95ED\u7684\u6388\u6743\u8BF7\u6C42"),
    cards.map((r) => {
      const folder = (state.folders ?? []).find((f) => f.folderId === r.folderId), source = (state.messages ?? []).find((m) => m.id === r.messageId);
      const input = { projectId, requestId: r.requestId, revision: r.revision, confirmationToken: r.confirmationToken };
      const workspaceOptions = h("div", { className: "pt-auth-options" }, state.managedProjectFolder && h(Button, { disabled: busy, onClick: () => operate("workspace.managed", { projectId, requestId: r.requestId, revision: r.revision }) }, "\u4F7F\u7528\u9879\u76EE\u7BA1\u7406\u76EE\u5F55"), state.managedProjectFolder && !folder && h("details", null, h("summary", null, "\u9879\u76EE\u7BA1\u7406\u76EE\u5F55\u8DEF\u5F84"), h("p", null, state.managedProjectFolder)), h("label", null, "\u6587\u4EF6\u5939", h("select", { "aria-label": r.title + " \u6587\u4EF6\u5939", value: r.folderId ?? "", onChange: (e) => choose(r, { folderId: e.target.value, workspaceMode: r.workspaceMode === "legacy-fixture" ? "legacy-fixture" : r.workspaceMode }) }, h("option", { value: "" }, "\u8BF7\u9009\u62E9\u5DF2\u8FDE\u63A5\u6587\u4EF6\u5939"), (state.folders ?? []).map((f) => h("option", { key: f.folderId, value: f.folderId }, f.selectedPath)))), !r.legacy && h("label", null, "\u5DE5\u4F5C\u533A", h("select", { "aria-label": r.title + " \u5DE5\u4F5C\u533A", value: r.workspaceMode, onChange: (e) => choose(r, { workspaceMode: e.target.value, folderId: r.folderId }) }, h("option", { value: "direct" }, "\u76F4\u63A5\u4F7F\u7528\u6240\u9009\u76EE\u5F55"), h("option", { value: "worktree" }, "\u521B\u5EFA\u72EC\u7ACB Git worktree"))), r.workspaceMode === "worktree" ? h(import_react4.default.Fragment, null, h("label", null, "\u672C\u5730 base/ref", h("input", { "aria-label": r.title + " base/ref", defaultValue: r.baseRef ?? "", placeholder: "\u7559\u7A7A\u4F7F\u7528\u5DF2\u8BB0\u5F55\u7684\u672C\u5730 HEAD", onBlur: (e) => {
        if ((e.target.value || void 0) !== r.baseRef) choose(r, { baseRef: e.target.value, folderId: r.folderId, workspaceMode: "worktree" });
      } })), h("p", null, "\u65B0 worktree \u4ECE\u5DF2\u63D0\u4EA4 base \u5F00\u59CB\uFF0C\u4E0D\u590D\u5236\u5F53\u524D\u672A\u63D0\u4EA4\u4FEE\u6539\u3002")) : h("p", null, "\u76F4\u63A5\u76EE\u5F55\u5171\u4EAB\u73B0\u6709\u6587\u4EF6\uFF1B\u5E76\u53D1\u7EBF\u7A0B\u53EF\u80FD\u4FEE\u6539\u540C\u4E00\u6587\u4EF6\uFF0C\u8FD9\u4E0D\u662F\u72EC\u7ACB\u5DE5\u4F5C\u533A\u3002"));
      return h(
        "article",
        { key: r.requestId + "-" + r.revision, "data-origin-message-id": r.messageId, "data-request-id": r.requestId, className: "pt-auth-card" },
        h("div", { className: "pt-auth-heading" }, h("strong", { className: "pt-auth-head" }, h(Icon, { name: "computer", size: 15 }), "\u5141\u8BB8 DSH \u5728\u60A8\u8BBE\u5907\u4E0A\u7684\u6587\u4EF6\u5939\u4E2D\u5DE5\u4F5C"), h(Menu, { label: r.title + " \u8BF7\u6C42\u64CD\u4F5C" }, h(Button, { role: "menuitem", onClick: () => operate("workspace.decide", { ...input, decision: "dismissed" }) }, "\u5173\u95ED\u5361\u7247"))),
        h("p", { className: "pt-help" }, folder ? "\u8BF7\u786E\u8BA4\u76EE\u5F55\u3001\u6267\u884C\u6A21\u5F0F\u4E0E\u6388\u6743\u8303\u56F4\u3002" : "\u5C1A\u672A\u9009\u62E9\u8FD9\u4E2A\u4EFB\u52A1\u7684\u5DE5\u4F5C\u76EE\u5F55\u3002"),
        r.phase === "legacy-intent" || r.phase === "implementation-gap" ? h(import_react4.default.Fragment, null, h("p", { role: "status" }, "\u65E7\u7248\u672C\u6267\u884C\u610F\u56FE\u5C1A\u672A\u8FD0\u884C\uFF0C\u9700\u8981\u660E\u786E\u91CD\u65B0\u7ED1\u5B9A\u3002"), h(Button, { onClick: () => choose(r, { workspaceMode: "direct" }) }, "\u5904\u7406\u65E7\u8BF7\u6C42\uFF0C\u9009\u62E9\u672C\u5730\u5DE5\u4F5C\u533A")) : h(
          import_react4.default.Fragment,
          null,
          (r.phase === "preparation-failed" || r.reason === "LEGACY_AUTHORIZATION_NOT_PROVEN") && h("p", { role: "alert" }, r.phase === "preparation-failed" ? "\u5DE5\u4F5C\u533A\u51C6\u5907\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u8BE6\u60C5\u5E76\u91CD\u65B0\u9009\u62E9\u3002" : "\u5386\u53F2\u53EF\u67E5\u770B\uFF0C\u6267\u884C\u524D\u8BF7\u786E\u8BA4\u539F\u76EE\u5F55\u3002"),
          h("hr", { className: "pt-auth-divider" }),
          h(Button, { className: "pt-auth-add", "aria-label": "\u9009\u62E9\u6B64\u4EFB\u52A1\u7684\u6587\u4EF6\u5939", disabled: busy || selection.pending, onClick: () => pick(r) }, h(Icon, { name: "add", size: 14 }), folder ? "\u66F4\u6362\u6587\u4EF6\u5939" : "\u6DFB\u52A0\u6587\u4EF6\u5939"),
          folder && h("div", { className: "pt-auth-target" }, h("p", null, folder.identity.canonicalPath), h("p", { className: "pt-help" }, r.workspaceMode === "worktree" ? "\u72EC\u7ACB Git worktree" : "\u76F4\u63A5\u4F7F\u7528\u6240\u9009\u76EE\u5F55"), r.baseCommit && h("p", { className: "pt-help" }, "\u5DF2\u9009 base\uFF1A" + r.baseCommit)),
          h("details", null, h("summary", null, "\u76EE\u5F55\u3001\u6A21\u5F0F\u4E0E\u4EFB\u52A1\u8BE6\u60C5"), workspaceOptions, h("strong", null, r.title), source && h("p", null, "\u6765\u81EA\u6D88\u606F\uFF1A" + source.text), h("p", null, r.task), r.reason && h("p", { role: "status" }, r.reason)),
          h("div", { className: "pt-actions" }, folder && h(Button, { disabled: busy || r.phase === "denied", onClick: () => operate("workspace.confirm", { ...input, grantScope: "thread" }) }, "\u4EC5\u5141\u8BB8\u672C\u7EBF\u7A0B"), folder && !r.legacy && h(Button, { disabled: busy || r.phase === "denied", onClick: () => operate("workspace.confirm", { ...input, grantScope: "project" }) }, "\u5141\u8BB8\u672C\u9879\u76EE\u540E\u7EED\u4EFB\u52A1\u4F7F\u7528\u6B64\u76EE\u5F55\u548C\u6A21\u5F0F"), h(Button, { onClick: () => operate("workspace.decide", { ...input, decision: "denied" }) }, "\u62D2\u7EDD"))
        )
      );
    })
  );
}

// src/product/client/project-settings.mjs
function ModelChoice({ label, value, onChange, providers, request }) {
  const [models, setModels] = import_react5.default.useState([]), [error, setError] = import_react5.default.useState("");
  const provider = value?.provider ?? "";
  import_react5.default.useEffect(() => {
    let live = true;
    setModels([]);
    setError("");
    if (provider) request("project.models", { provider }).then((m) => {
      if (live) setModels(m);
    }, (e) => {
      if (live) setError(e.message);
    });
    return () => {
      live = false;
    };
  }, [provider]);
  const model = models.find((m) => m.id === value?.model), efforts = model?.capabilities?.reasoning?.efforts ?? [];
  return h("div", { className: "pt-setting-row" }, h("div", null, h("span", null, label === "Coordinator" ? "\u534F\u8C03\u5668\u6A21\u578B" : "\u8BA8\u8BBA\u4E32\u6A21\u578B"), h("p", { className: "pt-help" }, label === "Coordinator" ? "\u7528\u4E8E\u7BA1\u7406\u548C\u521B\u5EFA\u8BA8\u8BBA\u4E32\u7684\u6A21\u578B\u3002" : "\u65B0\u8BA8\u8BBA\u4E32\u7684\u9ED8\u8BA4\u6A21\u578B\u3002")), h("div", { className: "pt-model-controls" }, h("select", { "aria-label": label + " Provider", title: "\u63D0\u4F9B\u65B9", value: provider, onChange: (e) => onChange(e.target.value ? { provider: e.target.value, model: "" } : null) }, h("option", { value: "" }, "\u672A\u914D\u7F6E\u63D0\u4F9B\u65B9"), providers.map((p) => h("option", { key: p.id, value: p.id }, p.name))), h("select", { "aria-label": label + " \u6A21\u578B", value: value?.model ?? "", disabled: !provider, onChange: (e) => onChange({ provider, model: e.target.value }) }, h("option", { value: "" }, "\u9009\u62E9\u6A21\u578B"), models.map((m) => h("option", { key: m.id, value: m.id }, m.name)), value?.model && !models.some((m) => m.id === value.model) && h("option", { value: value.model }, value.model)), efforts.length > 0 && h("label", null, "\u601D\u8003\u5F3A\u5EA6", h("select", { "aria-label": label + " Effort", value: value?.reasoningEffort ?? "", onChange: (e) => onChange({ provider, model: value.model, ...e.target.value ? { reasoningEffort: e.target.value } : {} }) }, h("option", { value: "" }, "\u9ED8\u8BA4"), efforts.map((e) => h("option", { key: e.id, value: e.id }, e.name)))), error && h(ErrorNotice, { message: error })));
}
function ProjectSettings({ project, state, request, refresh, onSaved, onClose, onDeleted, onOpenSchedules, onReviewPending, initialTab = "General", theme }) {
  const [original] = import_react5.default.useState(() => project ? structuredClone(project) : null), [tab, setTab] = import_react5.default.useState(initialTab), [fields, setFields] = import_react5.default.useState(() => ({ name: project?.name ?? "", goal: project?.goal ?? "", instructions: project?.instructions ?? "", coordinatorModel: project ? project.coordinatorModel : state.defaultModel ?? null, threadModel: project ? project.threadModel : state.defaultModel ?? null, ...project ? { toolPolicy: structuredClone(state.effectiveToolPolicy ?? { version: 1, coordinator: [], thread: ["read", "write", "edit", "bash", "workspace_commit"] }) } : {} }));
  const [initial] = import_react5.default.useState(() => JSON.stringify(fields)), [memoryDirty, setMemoryDirty] = import_react5.default.useState(false), [discard, setDiscard] = import_react5.default.useState(false), [reviewAfterClose, setReviewAfterClose] = import_react5.default.useState(false), [error, setError] = import_react5.default.useState(""), [busy, setBusy] = import_react5.default.useState(false);
  const dirty = JSON.stringify(fields) !== initial || memoryDirty;
  const set = (name, value) => setFields((old) => ({ ...old, [name]: value }));
  const close = () => {
    setReviewAfterClose(false);
    dirty ? setDiscard(true) : onClose();
  };
  const cancelDiscard = () => {
    setDiscard(false);
    setReviewAfterClose(false);
  };
  const finishClose = () => reviewAfterClose && onReviewPending ? onReviewPending() : onClose();
  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const save = (e) => {
    e?.preventDefault();
    if (memoryDirty) {
      setError("\u8BF7\u5148\u4FDD\u5B58\u6216\u53D6\u6D88\u6B63\u5728\u7F16\u8F91\u7684\u8BB0\u5FC6\u3002");
      return;
    }
    void run(async () => {
      const p = await request(project ? "project.update" : "project.create", settingsPatch(original, fields));
      await onSaved(p);
    });
  };
  return h(Modal, { title: project ? "\u9879\u76EE\u8BBE\u7F6E" : "\u65B0\u5EFA\u9879\u76EE", onClose: () => discard ? cancelDiscard() : close(), theme, compactHeader: true, className: "pt-settings-dialog" }, discard && h("div", { className: "pt-settings-content" }, h("h3", null, "\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539"), h("p", null, "\u79BB\u5F00\u4F1A\u653E\u5F03\u672C\u6B21\u7F16\u8F91\u3002\u9879\u76EE\u5F53\u524D\u8BBE\u7F6E\u4E0D\u4F1A\u6539\u53D8\u3002"), h("div", { className: "pt-actions" }, h(Button, { kind: "primary", autoFocus: true, onClick: cancelDiscard }, "\u7EE7\u7EED\u7F16\u8F91"), h(Button, { kind: "danger", onClick: finishClose }, "\u653E\u5F03\u5E76\u5173\u95ED"))), h(
    "div",
    { className: "pt-settings-layout", hidden: discard },
    (state.runs ?? []).some((r) => r.waiting?.kind === "approval") && h("div", { className: "pt-banner", role: "status" }, "\u6709\u4EFB\u52A1\u7B49\u5F85\u786E\u8BA4", h(Button, { onClick: () => {
      if (dirty) {
        setReviewAfterClose(true);
        setDiscard(true);
      } else if (onReviewPending) onReviewPending();
      else onClose();
    } }, "\u8FD4\u56DE\u67E5\u770B\u4EFB\u52A1")),
    h("div", { className: "pt-settings-body" }, h("nav", { className: "pt-settings-nav", "aria-label": "\u8BBE\u7F6E\u5206\u7EC4" }, h("p", null, "\u8BBE\u7F6E"), ["General", "Memory", "Environment"].map((name) => h(Button, { key: name, icon: { General: "settings", Memory: "brain", Environment: "computer" }[name], className: name === "Environment" ? "pt-environment-tab" : "", "aria-pressed": tab === name, onClick: () => setTab(name) }, { General: "\u901A\u7528", Memory: "\u8BB0\u5FC6", Environment: "\u73AF\u5883" }[name]))), h(
      "div",
      { className: "pt-settings-content" },
      error && h(ErrorNotice, { message: error, onDismiss: () => setError("") }),
      h(
        "form",
        { id: "pt-settings-form", onSubmit: save },
        h("section", { className: "pt-settings-section", hidden: tab !== "General" }, h("h2", { className: "pt-settings-heading" }, "\u901A\u7528"), h("label", { className: "pt-setting-row" }, h("span", null, "\u540D\u79F0\u548C\u56FE\u6807"), h("input", { value: fields.name, required: true, maxLength: 200, "aria-label": "\u9879\u76EE\u540D\u79F0", onChange: (e) => set("name", e.target.value) })), h("label", null, h("span", null, "\u76EE\u6807"), h("span", { className: "pt-help" }, "\u5E0C\u671B\u534F\u8C03\u8005\u52AA\u529B\u5B9E\u73B0\u7684\u7ED3\u679C\u3002"), h("textarea", { value: fields.goal, rows: 3, "aria-label": "\u9879\u76EE\u76EE\u6807", placeholder: "\u8FD9\u4E2A\u9879\u76EE\u5E0C\u671B\u8FBE\u6210\u4EC0\u4E48\uFF1F", onChange: (e) => set("goal", e.target.value) })), h(ModelChoice, { label: "Coordinator", value: fields.coordinatorModel, onChange: (v) => set("coordinatorModel", v), providers: state.providers ?? [], request }), h(ModelChoice, { label: "\u65B0 Thread", value: fields.threadModel, onChange: (v) => set("threadModel", v), providers: state.providers ?? [], request }), h("p", { className: "pt-help" }, "\u65B0\u7684 Thread \u4F7F\u7528\u5F53\u524D\u6A21\u578B\u8BBE\u7F6E\uFF0C\u5DF2\u6709 Thread \u4FDD\u7559\u542F\u52A8\u914D\u7F6E\u3002")),
        h("section", { className: "pt-settings-section", hidden: tab !== "Memory" }, h("h2", { className: "pt-settings-heading" }, "\u8BB0\u5FC6"), h("label", null, h("span", null, "\u9879\u76EE\u6307\u4EE4"), h("textarea", { value: fields.instructions, rows: 7, "aria-label": "\u9879\u76EE instructions", onChange: (e) => set("instructions", e.target.value) })), h("p", { className: "pt-help" }, "\u4E3B\u5BF9\u8BDD\u540E\u7EED\u56DE\u5408\u8BFB\u53D6\u65B0\u6307\u5F15\uFF1B\u5DF2\u6709 Thread \u4FDD\u7559\u542F\u52A8\u5FEB\u7167\u3002"), h(Details, { label: "\u957F\u5EA6\u4E0E\u517C\u5BB9\u89C4\u5219", value: "Instructions\uFF1A" + Array.from(fields.instructions).length + " / 16000 \u5B57\u7B26\u3002\u5386\u53F2\u8D85\u957F\u503C\u4E0D\u4F1A\u56E0\u65E0\u5173\u7F16\u8F91\u88AB\u622A\u65AD\uFF1B\u4FEE\u6539\u65F6\u9700\u7F29\u81F3\u4E0A\u9650\u3002\u76EE\u6807\u4E0A\u965032000\u5B57\u7B26\u3002" }))
      ),
      h("section", { hidden: tab !== "Memory", className: "pt-settings-section" }, project ? h(MemoryPanel, { key: project.projectId, projectId: project.projectId, state, request, run, refresh, busy, onDirtyChange: setMemoryDirty }) : h("p", { className: "pt-help" }, "\u521B\u5EFA\u9879\u76EE\u540E\u53EF\u4EE5\u6DFB\u52A0\u5171\u4EAB\u8BB0\u5FC6\u3002")),
      h("section", { hidden: tab !== "Environment", className: "pt-settings-section" }, h("h2", { className: "pt-settings-heading" }, "\u73AF\u5883"), h("h3", null, "\u672C\u5730"), h("p", { className: "pt-help" }, "\u4EFB\u52A1\u9ED8\u8BA4\u5728\u672C\u673A\u6267\u884C\uFF1B\u8FDE\u63A5\u6587\u4EF6\u5939\u4E0D\u7B49\u4E8E\u6388\u4E88\u4EFB\u52A1\u6743\u9650\u3002"), project && h(AuthorizationCards, { state, projectId: project.projectId, request, run, refresh, busy }), h(ResourcesPanel, { state }), h("section", { className: "pt-settings-section" }, h("h3", null, "\u5BBF\u4E3B\u81EA\u52A8\u5316\u4EFB\u52A1"), h("p", { className: "pt-help" }, "\u8FD9\u91CC\u53EA\u5173\u8054\u539F\u4F1A\u8BDD\u7684\u5BBF\u4E3B\u63D0\u9192\uFF0C\u5C1A\u672A\u63D0\u4F9B\u81EA\u52A8\u521B\u5EFA\u9879\u76EE Thread\u3002\u6682\u505C\u9879\u76EE\u4ECD\u963B\u6B62\u9879\u76EE\u6267\u884C\uFF1B\u539F\u63D0\u9192\u7531\u5BBF\u4E3B\u7BA1\u7406\u3002"), state.hostCapabilities?.schedule && h(Button, { disabled: dirty || busy, onClick: onOpenSchedules }, "\u6253\u5F00\u5BBF\u4E3B\u81EA\u52A8\u5316\u4EFB\u52A1"), (state.schedules ?? []).map((r) => h("p", { key: r.id }, r.title + " \xB7 " + r.status)), h("h3", null, "\u6587\u6863\u540E\u7AEF"), (state.hostCapabilities?.readerBackends ?? []).map((b) => h("p", { key: b.id, className: "pt-help" }, b.id + " \xB7 " + b.version)), h("p", { className: "pt-help" }, "\u672A\u5B89\u88C5\u989D\u5916\u6587\u6863\u540E\u7AEF\u65F6\u7EE7\u7EED\u4F7F\u7528\u5F53\u524D\u672C\u5730\u8BFB\u53D6\u5668\uFF0C\u4E0D\u81EA\u52A8\u4E0B\u8F7D\u6216\u53D1\u9001\u4E91\u7AEF\u3002")), project && h(ProjectToolChoices, { catalog: state.toolCatalog ?? [], value: fields.toolPolicy, onChange: (value) => set("toolPolicy", value) })),
      project && h("section", { hidden: tab !== "General", className: "pt-settings-section pt-danger-zone" }, h("div", { className: "pt-lifecycle-row" }, h("div", null, h("span", null, "\u91CD\u542F\u534F\u8C03\u5668"), h("p", { className: "pt-help" }, "\u56DE\u6536\u6B64\u9879\u76EE\u7684\u534F\u8C03\u5668\u8FDB\u7A0B\uFF0C\u8FDB\u884C\u4E2D\u7684\u56DE\u5408\u4F1A\u4E2D\u65AD\u3002")), h(Button, { "aria-label": "\u91CD\u542F Coordinator", disabled: busy || (project.lifecycle ?? "active") !== "active", onClick: () => run(async () => {
        await request("project.restart", { projectId: project.projectId });
        await refresh();
      }) }, "\u91CD\u542F")), h(LifecycleMenu, { project, request, run, refresh, busy, deleted: onDeleted }))
    )),
    h("footer", { className: "pt-footer" }, h("span", { className: "pt-help", role: "status" }, busy ? "\u6B63\u5728\u4FDD\u5B58\u2026" : memoryDirty ? "\u8BF7\u5148\u4FDD\u5B58\u6216\u53D6\u6D88\u8FD9\u6761\u8BB0\u5FC6" : dirty ? "\u6709\u672A\u4FDD\u5B58\u7684\u9879\u76EE\u8BBE\u7F6E" : "\u9879\u76EE\u8BBE\u7F6E\u5DF2\u540C\u6B65"), h("div", { className: "pt-actions" }, h(Button, { onClick: close }, "\u53D6\u6D88"), h("button", { type: "submit", form: "pt-settings-form", className: "pt-button pt-primary", disabled: busy || memoryDirty }, project ? "\u4FDD\u5B58\u9879\u76EE\u8BBE\u7F6E" : "\u521B\u5EFA\u9879\u76EE")))
  ));
}
function ProjectToolChoices({ catalog, value, onChange }) {
  const change = (role, name, checked) => onChange({ ...value, [role]: checked ? [...value[role], name] : value[role].filter((x) => x !== name) });
  return h("section", { className: "pt-settings-section", "aria-label": "\u9879\u76EE\u5DE5\u5177\u7B56\u7565" }, h("h3", null, "\u4F7F\u7528\u5DF2\u6709\u5DE5\u5177"), h("p", { className: "pt-help" }, "\u4EC5\u7BA1\u7406\u6B64\u9879\u76EE\u7684\u4F7F\u7528\u8303\u56F4\uFF0C\u4E0D\u5B89\u88C5\u6216\u542F\u7528\u5168\u5C40\u63D2\u4EF6\u3002\u4FDD\u5B58\u540E\u5BF9\u540E\u7EED\u8C03\u7528\u7ACB\u5373\u751F\u6548\uFF1B\u5DF2\u8FD0\u884C\u4E14\u4E0D\u80FD\u4E2D\u65AD\u7684\u64CD\u4F5C\u4E0D\u4F1A\u56DE\u6EDA\u3002\u76EE\u5F55\u6388\u6743\u4E0E\u539F\u751F\u5BA1\u6279\u4ECD\u9700\u6EE1\u8DB3\u3002"), ["core", "workspace", "host", "mcp"].map((group) => h("section", { key: group }, h("h4", null, { core: "\u9879\u76EE\u6838\u5FC3\u5DE5\u5177", workspace: "\u5DE5\u4F5C\u533A\u5DE5\u5177", host: "\u5176\u4ED6\u5BBF\u4E3B\u5DE5\u5177", mcp: "MCP \u5DE5\u5177" }[group]), !catalog.some((x) => x.group === group) && h("p", { className: "pt-help" }, "\u5F53\u524D\u6CA1\u6709\u5DF2\u6CE8\u518C\u7684\u5DE5\u5177\u3002"), catalog.filter((x) => x.group === group).map((x) => h("div", { className: "pt-tool-choice", key: x.name }, h("div", null, h("strong", null, x.name), h("p", { className: "pt-help" }, x.source + " \xB7 " + x.availability), h("p", { className: "pt-help" }, x.reason)), x.required ? h("span", { className: "pt-help" }, "\u6309\u65E2\u6709\u89D2\u8272\u4FDD\u7559") : h("div", { className: "pt-actions" }, ["coordinator", "thread"].map((role) => h("label", { key: role }, h("input", { type: "checkbox", "aria-label": x.name + " " + role, checked: !!value?.[role]?.includes(x.name), disabled: !x.selectableRoles.includes(role), onChange: (e) => change(role, x.name, e.target.checked) }), role === "coordinator" ? "\u534F\u8C03\u5668" : "\u8BA8\u8BBA\u4E32"))))))));
}

// src/product/protocol/thread-card.mjs
var REQUEST_RECORD = "plugin:dsh-project-threads/resource-request";
var LOCAL_RECORD = "plugin:dsh-project-threads/local-intent";
var LINK_RECORD = "plugin:dsh-project-threads/thread-link";
var isHumanUserEvent = (event) => event.type === "user/message" && event.data?.source?.kind === "user";
var threadCardDefinition = {
  kind: "project-thread-cards",
  target: "chat",
  match(event) {
    if (isHumanUserEvent(event)) return { id: String(event.data.id), role: "start" };
    if (event.type === REQUEST_RECORD && event.ignorable === true && event.data?.messageId) return { id: event.data.messageId, role: "update" };
    if (event.type === LOCAL_RECORD && event.ignorable === true && event.data?.messageId) return { id: event.data.messageId, role: "update" };
    if (event.type === LINK_RECORD && event.ignorable === true && event.data?.association?.messageId) return { id: event.data.association.messageId, role: "update" };
    return null;
  },
  start(_context, match) {
    return { messageId: match.event.data.id, messageSeq: match.event.seq, links: {} };
  },
  update(context, match) {
    if (!context.state) return context.state;
    if (match.event.type === REQUEST_RECORD) {
      const d = match.event.data;
      return d.messageId === context.state.messageId ? { ...context.state, request: { projectId: d.projectId, requestId: d.requestId } } : context.state;
    }
    if (match.event.type === LOCAL_RECORD) {
      const d = match.event.data;
      if (d.messageId === context.state.messageId && d.messageSeq === context.state.messageSeq) return { ...context.state, localIntent: { executionKind: "local" } };
      return context.state;
    }
    if (match.event.type !== LINK_RECORD) return context.state;
    const link = match.event.data.association;
    if (link.messageId !== context.state.messageId || link.messageSeq !== context.state.messageSeq || !Number.isInteger(link.version) || link.version < 1) return context.state;
    const previous = context.state.links[link.threadId];
    if (previous && previous.version >= link.version) return context.state;
    return { ...context.state, links: { ...context.state.links, [link.threadId]: link } };
  },
  buildViewNode(context) {
    if (!context.state || Object.keys(context.state.links).length === 0 && !context.state.localIntent && !context.state.request) return null;
    return { key: context.key, kind: "project-thread-cards", id: context.id, target: "chat", anchorSeq: context.state.messageSeq + 0.01, location: context.start?.location ?? { kind: "unresolved" }, groupTree: "input", visibility: "visible", data: context.state };
  }
};

// src/product/client/project-client.mjs
var inject = ["slots", "layout", "uiConversation", "sessions", "uiWorkspace", "inputTriggers", "conversation", "theme"];
var openThread = (link) => window.dispatchEvent(new CustomEvent("project-thread-open", { detail: link }));
async function apply(ctx) {
  installStyles(ctx);
  const navigation = createProjectNavigation();
  const notified = /* @__PURE__ */ new Set(), notificationProjects = /* @__PURE__ */ new Set();
  const sessionProjects = /* @__PURE__ */ new Map(), indexListeners = /* @__PURE__ */ new Set();
  let indexRevision = 0;
  function rememberProjects(value) {
    const rows = Array.isArray(value?.projects) ? value.projects : value?.coordinatorSessionId ? [value] : null;
    if (!rows) return;
    let changed = false;
    if (Array.isArray(value?.projects)) {
      const ids = new Set(rows.map((p) => p.projectId));
      for (const [sid, pid] of sessionProjects) if (!ids.has(pid)) {
        sessionProjects.delete(sid);
        changed = true;
      }
    }
    for (const p of rows) if (p.coordinatorSessionId && sessionProjects.get(p.coordinatorSessionId) !== p.projectId) {
      sessionProjects.set(p.coordinatorSessionId, p.projectId);
      changed = true;
    }
    if (changed) {
      indexRevision++;
      for (const fn of indexListeners) fn();
    }
  }
  ctx.effect(() => () => {
    indexListeners.clear();
    sessionProjects.clear();
  });
  async function request(op, input, projectId, signal) {
    const response = await fetch("/api/project-threads" + (projectId ? "?projectId=" + encodeURIComponent(projectId) : ""), { credentials: "same-origin", signal, ...op ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op, input }) } : {} });
    let body;
    try {
      body = await response.json();
    } catch {
      throw Object.assign(Error("\u9879\u76EE\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA"), { status: response.status });
    }
    if (!response.ok || !body.ok) throw Object.assign(Error(body.error?.message ?? "\u9879\u76EE\u64CD\u4F5C\u5931\u8D25"), { status: response.status, code: body.error?.code });
    rememberProjects(body.value);
    navigation.rememberState(body.value);
    return body.value;
  }
  const startupAbort = new AbortController();
  ctx.effect(() => () => startupAbort.abort());
  const initial = await readInitialProjectState(() => request(null, null, void 0, startupAbort.signal), { signal: startupAbort.signal });
  const projection = createProjectProjection((id, signal) => request(null, null, id, signal));
  ctx.effect(() => () => projection.dispose());
  function useProjection(id) {
    const subscribe = import_react6.default.useCallback((fn) => projection.subscribe(id, fn), [id]), snapshot = import_react6.default.useCallback(() => projection.get(id), [id]);
    return import_react6.default.useSyncExternalStore(subscribe, snapshot, snapshot);
  }
  function useTheme() {
    const [theme, setTheme] = import_react6.default.useState(() => ctx.theme.getTheme().active.colorScheme);
    import_react6.default.useEffect(() => ctx.on("theme/change", (s) => setTheme(s.active.colorScheme)), []);
    return theme;
  }
  const retention = createConversationRetention(ctx.sessions);
  ctx.effect(() => () => retention.dispose());
  function retain(id, projectId) {
    return retention.acquire(id, projectId);
  }
  ctx.effect(() => ctx.uiConversation.events.register(threadCardDefinition));
  function MessageCards({ node }) {
    const links = Object.values(node.data.links ?? {}), id = node.data.request?.projectId ?? links[0]?.projectId ?? null, { data: state } = useProjection(id), theme = useTheme();
    const pending = state?.executionRequests?.filter((r) => r.messageId === node.data.messageId && !["active", "ready", "proposed", "denied"].includes(r.phase) && r.reason !== "dismissed") ?? [];
    return h("div", { className: "pt-root pt-message-cards", "data-theme": theme, "data-message-id": node.data.messageId }, pending.map((r) => h("p", { key: r.requestId, className: "pt-request-note" }, r.title + " \xB7 \u7B49\u5F85\u76EE\u5F55\u6388\u6743")), links.sort((a, b) => a.createdAt - b.createdAt || a.threadId.localeCompare(b.threadId)).map((link) => h(ThreadCard, { key: link.threadId, title: link.title, status: state?.runs?.filter((r) => r.threadId === link.threadId).sort((a, b) => b.turn - a.turn)[0]?.activity ?? link.status, onOpen: () => openThread(link) })));
  }
  function WorkspaceDock({ sessionId }) {
    const subscribe = import_react6.default.useCallback((fn) => {
      indexListeners.add(fn);
      return () => indexListeners.delete(fn);
    }, []);
    import_react6.default.useSyncExternalStore(subscribe, () => indexRevision, () => indexRevision);
    const id = sessionProjects.get(sessionId) ?? null, { data: state } = useProjection(id), theme = useTheme(), [error, setError] = import_react6.default.useState(""), [busy, setBusy] = import_react6.default.useState(false);
    const run = async (fn) => {
      setBusy(true);
      setError("");
      try {
        await fn();
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    };
    if (!state || state.selectedProject?.projectId !== id) return null;
    return h("div", { className: "pt-root pt-resource-dock", "data-theme": theme }, h(ErrorNotice, { message: error }), h(AuthorizationCards, { state, projectId: id, request, run, refresh: () => projection.refresh(id), busy, inline: true }));
  }
  ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({ name: "conversation.input.dock", id: "project-workspace-request", order: 10 }, WorkspaceDock));
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({ name: "conversation.chat.node", key: "project-thread-cards" }, MessageCards));
  for (const name of ["project-threads.coordinator", "project-threads.thread"]) ctx.slots.inject(name, () => ctx.slots.register({ name }, ({ renderFactorySlot }) => renderFactorySlot("conversation.content", { variant: "embedded", phase: "active", hero: false })));
  function NativeConversation({ id, projectId, SessionProvider, renderSlot, slot, writable = true }) {
    const [ref, setRef] = import_react6.default.useState(null), [error, setError] = import_react6.default.useState("");
    import_react6.default.useEffect(() => {
      const reason = "\u9879\u76EE\u5DF2\u6682\u505C/\u5F52\u6863\uFF0C\u6216\u76EE\u5F55\u6388\u6743\u5C1A\u672A\u6709\u6548\uFF1B\u5386\u53F2\u53EF\u67E5\u770B\u3002";
      if (!writable) ctx.conversation.blocks.set(id, { reason });
      else if (ctx.conversation.blocks.storeFor(id).getSnapshot()?.reason === reason) ctx.conversation.blocks.set(id, void 0);
      return () => {
        if (ctx.conversation.blocks.storeFor(id).getSnapshot()?.reason === reason) ctx.conversation.blocks.set(id, void 0);
      };
    }, [id, writable]);
    import_react6.default.useEffect(() => {
      let live = true;
      const r = retain(id, projectId);
      r.ready.then(() => {
        if (live) setRef(r);
      }, (e) => {
        if (live) setError(e.message);
      });
      return () => {
        live = false;
        r.release();
      };
    }, [id]);
    return error ? h(ErrorNotice, { message: error }) : ref ? h(SessionProvider, { session: ref }, renderSlot(slot, {})) : h("p", { role: "status", className: "pt-help" }, "\u6B63\u5728\u6253\u5F00\u4F1A\u8BDD\u2026");
  }
  function ThreadSeat({ thread, active, target, SessionProvider, renderSlot }) {
    const home = import_react6.default.useRef(null), [host] = import_react6.default.useState(() => {
      const el = document.createElement("section");
      el.className = "pt-conversation-seat";
      el.setAttribute("aria-label", "Thread Conversation");
      el.dataset.projectPane = "thread";
      el.dataset.sessionId = thread.id;
      return el;
    });
    import_react6.default.useLayoutEffect(() => {
      const parent = target ?? home.current;
      parent?.appendChild(host);
      return () => host.remove();
    }, [target, host]);
    return h("div", { ref: home, className: "pt-native-home", hidden: !active || !!target }, (0, import_react_dom2.createPortal)(h(NativeConversation, { id: thread.id, projectId: thread.projectId, SessionProvider, renderSlot, slot: "project-threads.thread", writable: thread.writable }), host, thread.id));
  }
  function Main({ SessionProvider, renderSlot }) {
    const [entry] = import_react6.default.useState(() => navigation.initial(initial));
    const [selected, setSelected] = import_react6.default.useState(entry.selected);
    const [threadId, setThread] = import_react6.default.useState(entry.threadId), [overview, setOverview] = import_react6.default.useState(entry.overview), [expanded, setExpanded] = import_react6.default.useState(entry.expanded), [dataTab, setDataTab] = import_react6.default.useState(entry.dataTab);
    const [settings, setSettings] = import_react6.default.useState(entry.create ? "create" : ""), [settingsTab, setSettingsTab] = import_react6.default.useState("General"), [archived, setArchived] = import_react6.default.useState(false);
    const [error, setError] = import_react6.default.useState(""), [busy, setBusy] = import_react6.default.useState(false), [coordinators, setCoordinators] = import_react6.default.useState([]), [threads, setThreads] = import_react6.default.useState([]);
    const [width, setWidth] = import_react6.default.useState(0), [ratio, setRatio] = import_react6.default.useState(() => {
      try {
        return Number(localStorage.getItem("pt-ui02-pane-ratio")) || 360 / 917;
      } catch {
        return 360 / 917;
      }
    });
    const [searchOpen, setSearchOpen] = import_react6.default.useState(false), [query, setQuery] = import_react6.default.useState(""), [sort, setSort] = import_react6.default.useState("activity"), [collapsed, setCollapsed] = import_react6.default.useState({}), [sourceMount, setSourceMount] = import_react6.default.useState(null), [notice, setNotice] = import_react6.default.useState(null);
    const root = import_react6.default.useRef(null), selectionRef = import_react6.default.useRef(selected);
    selectionRef.current = selected;
    import_react6.default.useLayoutEffect(() => navigation.rememberView({ selected, threadId, overview, expanded, dataTab }), [selected, threadId, overview, expanded, dataTab]);
    const { data: loaded, error: networkError } = useProjection(selected), state = loaded ?? entry.state, project = state.projects.find((p) => p.projectId === selected);
    const scopeState = state.selectedProject?.projectId === selected ? state : { ...state, links: [], runs: [], libraryItems: [], memoryEntries: [], memoryFiles: [], memoryUsedPackets: [], memoryIndexMeta: {}, hindsight: null, executionRequests: [], bindings: [], grants: [], proposals: [], reports: [] };
    const link = scopeState.links?.find((l) => l.threadId === threadId), theme = useTheme();
    import_react6.default.useEffect(() => {
      if (scopeState.selectedProject?.projectId !== selected) return;
      const entries = (scopeState.runs ?? []).filter((r) => r.endedAt || r.waiting?.kind === "approval").map((r) => ({ key: r.runId + ":" + (r.endedAt ?? r.waiting.eventSeq), run: r }));
      const ready = notificationProjects.has(selected);
      notificationProjects.add(selected);
      for (const e of entries) {
        if (notified.has(e.key)) continue;
        notified.add(e.key);
        if (ready) {
          const l = scopeState.links.find((l2) => l2.threadId === e.run.threadId);
          if (l) setNotice({ key: e.key, link: l, text: (e.run.waiting?.kind === "approval" ? "\u4EFB\u52A1\u7B49\u5F85\u786E\u8BA4\uFF1A" : "\u4EFB\u52A1\u5DF2\u7ED3\u675F\uFF1A") + l.title });
        }
      }
    }, [selected, scopeState.runs]);
    const narrow = width > 0 && width < 280 * 2 + 14;
    const refresh = () => projection.refresh(selected);
    const run = async (fn) => {
      setBusy(true);
      setError("");
      try {
        await fn();
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    };
    const choose = (id) => {
      setSelected(id);
      setThread("");
      setSettings("");
      setExpanded(false);
      setQuery("");
      if (id) void request("project.activate", { projectId: id }).catch((e) => setError(e.message));
    };
    import_react6.default.useEffect(() => {
      const ob = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
      ob.observe(root.current);
      return () => ob.disconnect();
    }, []);
    import_react6.default.useEffect(() => {
      if (project) setCoordinators((old) => {
        const next = { id: project.coordinatorSessionId, projectId: project.projectId, writable: (project.lifecycle ?? "active") === "active" };
        return old.some((c) => c.id === next.id) ? old.map((c) => c.id === next.id ? next : c) : [...old, next];
      });
    }, [project?.projectId, project?.coordinatorSessionId, project?.lifecycle]);
    const writableThread = (l) => (project?.lifecycle ?? "active") === "active" && !!scopeState.bindings?.some((b) => b.threadId === l.threadId && b.availableForExecution !== false && scopeState.grants?.some((g) => g.grantId === b.grantId && g.state === "granted" && g.version === b.grantVersion));
    const writableRef = import_react6.default.useRef(writableThread);
    writableRef.current = writableThread;
    const sourceTarget = import_react6.default.useCallback((l, node) => {
      if (node && l) {
        setThreads((old) => old.some((t) => t.id === l.threadSessionId) ? old : [...old, { ...l, id: l.threadSessionId, writable: writableRef.current(l) }]);
        setSourceMount({ id: l.threadSessionId, node });
      } else setSourceMount((old) => old?.id === l?.threadSessionId ? null : old);
    }, []);
    import_react6.default.useEffect(() => {
      if (scopeState.selectedProject?.projectId !== selected) return;
      setThreads((old) => {
        const updated2 = old.map((t) => t.projectId === selected ? { ...t, writable: writableThread(t) } : t);
        if (!link) return updated2;
        const next = { ...link, id: link.threadSessionId, writable: writableThread(link) };
        return updated2.some((t) => t.id === next.id) ? updated2.map((t) => t.id === next.id ? next : t) : [...updated2, next];
      });
    }, [link, scopeState.bindings, scopeState.grants, project?.lifecycle]);
    import_react6.default.useEffect(() => {
      const listener = (e) => {
        setSelected(e.detail.projectId);
        setThread(e.detail.threadId);
        setOverview(true);
        void request("project.activate", { projectId: e.detail.projectId }).catch((e2) => setError(e2.message));
      };
      window.addEventListener("project-thread-open", listener);
      return () => window.removeEventListener("project-thread-open", listener);
    }, []);
    const actualWidth = Math.min(Math.max(width * ratio, 280), Math.max(280, width - 294));
    const resize = (value) => {
      const next = Math.max(280, Math.min(width - 294, value)) / Math.max(width, 1);
      setRatio(next);
      try {
        localStorage.setItem("pt-ui02-pane-ratio", String(next));
      } catch {
      }
    };
    const latest = (l) => scopeState.runs?.filter((r) => r.threadId === l.threadId).sort((a, b) => b.turn - a.turn)[0];
    const pending = scopeState.executionRequests?.filter((r) => !["active", "ready", "proposed", "denied"].includes(r.phase) && r.reason !== "dismissed") ?? [];
    const activity = (l) => latest(l)?.resolved ? "Resolved" : latest(l)?.activity ?? "Waiting on you";
    const pendingRows = pending.filter((r) => !scopeState.links?.some((l) => l.threadId === r.threadId));
    const waiting = (/* @__PURE__ */ new Set([...(scopeState.links ?? []).filter((l) => activity(l) === "Waiting on you").map((l) => l.threadId), ...pending.map((r) => r.threadId ?? r.requestId)])).size;
    const visible = (scopeState.links ?? []).filter((l) => !query || l.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a, b) => sort === "name" ? a.title.localeCompare(b.title) : sort === "created" ? b.createdAt - a.createdAt : (latest(b)?.endedAt ?? latest(b)?.startedAt ?? b.updatedAt) - (latest(a)?.endedAt ?? latest(a)?.startedAt ?? a.updatedAt));
    const rowSummary = (l) => {
      const r = latest(l);
      if (r?.waiting?.kind === "approval") return "\u7B49\u5F85\u5BA1\u6279";
      if (r?.endReason?.kind === "cancelled" || r?.reason?.kind === "cancelled") return "\u5DF2\u505C\u6B62";
      if (r?.activity === "Waiting on you") return "\u9700\u8981\u60A8\u786E\u8BA4";
      if (r?.activity === "Working") return "\u6B63\u5728\u5904\u7406";
      const published = scopeState.libraryItems?.filter((i) => i.source?.threadId === l.threadId).length;
      return published ? "\u5DF2\u53D1\u5E03 " + published + " \u4EFD\u8D44\u6599" : r ? "\u672C\u8F6E\u5DF2\u5B8C\u6210" : "\u7B49\u5F85\u9009\u62E9\u5DE5\u4F5C\u76EE\u5F55";
    };
    const open = (l) => {
      setThread(l.threadId);
      setOverview(true);
    };
    const openSettings = (tab = "General") => {
      setSettingsTab(tab);
      setSettings("edit");
    };
    const closePanel = () => {
      setOverview(false);
      setExpanded(false);
    };
    const tabButton = (tab, icon, label) => h(Button, { key: tab, icon, kind: "ghost", "aria-label": label, "aria-pressed": dataTab === tab, onClick: () => {
      setDataTab(tab);
      setSearchOpen(false);
      setQuery("");
    } }, dataTab === tab && h("span", null, label), tab === "Threads" && waiting > 0 && h("span", { className: "pt-count" }, waiting));
    const panelTools = h("div", { className: "pt-panel-tools" }, !link && h(Button, { kind: "icon", icon: "search", "aria-label": dataTab === "Threads" ? "\u641C\u7D22\u8BA8\u8BBA\u4E32" : "\u641C\u7D22\u5E93", onClick: () => setSearchOpen((v) => !v) }), !link && dataTab === "Threads" && h(Menu, { label: "\u89C6\u56FE\u9009\u9879", icon: "sort" }, [["activity", "\u4E0A\u6B21\u6D3B\u52A8"], ["name", "\u540D\u79F0"], ["created", "\u521B\u5EFA\u65E5\u671F"]].map(([v, t]) => h(Button, { key: v, role: "menuitemradio", "aria-checked": sort === v, onClick: () => setSort(v) }, t))), link && h(Menu, { label: "\u8BA8\u8BBA\u4E32\u8BE6\u60C5" }, h("div", { className: "pt-thread-details", onClick: (e) => e.stopPropagation() }, h(Status, { value: latest(link)?.activity ?? "\u7B49\u5F85\u6388\u6743" }), h(Details, { label: "\u8FD0\u884C\u4E0E\u5DE5\u4F5C\u533A", value: { workspace: scopeState.bindings?.find((b) => b.threadId === link.threadId)?.workspacePath ?? "\u5C1A\u672A\u6388\u6743", reason: latest(link)?.reason } }))), h(Button, { icon: expanded ? "collapse" : "expand", kind: "icon", "aria-label": expanded ? "\u6062\u590D\u9762\u677F" : "\u5C55\u5F00\u9762\u677F", onClick: () => setExpanded(!expanded) }), h(Button, { icon: "close", kind: "icon", "aria-label": "\u5173\u95ED\u6982\u89C8", onClick: closePanel }));
    return h(
      "main",
      { ref: root, className: "pt-root pt-main", "data-theme": theme, "data-narrow": narrow, "data-expanded": expanded && overview, "data-testid": "project-main" },
      notice && !settings && !(0, import_dsh_client_ui_primitives2.isBehindModal)(root.current) && h(import_dsh_client_ui_primitives2.Toast, { key: notice.key, text: notice.text, holdMs: 8e3, onDone: () => setNotice(null), actions: [{ label: "\u67E5\u770B\u4EFB\u52A1", onClick: () => {
        openThread(notice.link);
        setNotice(null);
      } }, { label: "\u5173\u95ED\u63D0\u9192", onClick: () => setNotice(null) }] }),
      h(
        "div",
        { className: "pt-main-column", hidden: expanded && overview, "data-obscured": narrow && overview },
        h("header", { className: "pt-header" }, h("div", { className: "pt-project-title" }, h("span", { className: "pt-project-icon" }, h(Icon, { name: "folder", size: 16 })), h("h1", null, project?.name ?? "Projects"), h(Menu, { label: "\u9879\u76EE\u83DC\u5355", icon: "chevron" }, h("div", { className: "pt-project-picker", onClick: (e) => e.stopPropagation() }, h("label", null, "\u5207\u6362\u9879\u76EE", h("select", { "aria-label": "\u9009\u62E9\u9879\u76EE", value: selected, onChange: (e) => choose(e.target.value) }, h("option", { value: "" }, "\u9009\u62E9\u9879\u76EE"), state.projects.filter((p) => archived || p.lifecycle !== "archived").map((p) => h("option", { key: p.projectId, value: p.projectId }, p.name)))), h("label", null, h("input", { type: "checkbox", checked: archived, onChange: (e) => setArchived(e.target.checked) }), "\u663E\u793A\u5F52\u6863")), h(Button, { role: "menuitem", icon: "add", onClick: () => {
          setSettings("create");
          setSettingsTab("General");
        } }, "\u65B0\u5EFA\u9879\u76EE"), project && h(Button, { role: "menuitem", onClick: () => openSettings() }, "\u91CD\u547D\u540D\u4E0E\u9879\u76EE\u8BBE\u7F6E"), project && h(Button, { role: "menuitem", onClick: () => openSettings() }, "\u6682\u505C\u3001\u5F52\u6863\u4E0E\u5220\u9664"))), h("div", { className: "pt-header-actions" }, project && h(Button, { icon: "panel", kind: "ghost", "aria-label": overview ? "\u6536\u8D77\u6982\u89C8" : "\u6253\u5F00\u6982\u89C8", "aria-expanded": overview, onClick: () => {
          setOverview(!overview);
          setExpanded(false);
        } }, h("span", { className: "pt-overview-label" }, "\u6982\u89C8")), project && h(Button, { icon: "settings", kind: "icon", "aria-label": "\u9879\u76EE\u8BBE\u7F6E", onClick: () => openSettings() }))),
        (error || networkError) && h("div", { className: "pt-main-notice" }, h(ErrorNotice, { message: error || networkError, onRetry: refresh, onDismiss: () => setError("") })),
        project && (project.lifecycle ?? "active") !== "active" && h("div", { className: "pt-banner", role: "status" }, h(Status, { value: project.lifecycle }), h("span", null, project.lifecycle === "deleting" ? "\u6E05\u7406\u672A\u5B8C\u6210\uFF0C\u53EF\u91CD\u8BD5\u3002" : "\u5386\u53F2\u548C\u8D44\u6599\u4ECD\u53EF\u67E5\u770B\u3002"), h(Button, { disabled: busy, onClick: () => project.lifecycle === "paused" || project.lifecycle === "archived" ? run(async () => {
          await request("project.lifecycle", { projectId: selected, action: project.lifecycle === "paused" ? "resume" : "unarchive" });
          await refresh();
        }) : openSettings() }, project.lifecycle === "paused" ? "\u6062\u590D\u9879\u76EE" : project.lifecycle === "archived" ? "\u53D6\u6D88\u5F52\u6863" : "\u67E5\u770B\u6E05\u7406\u72B6\u6001")),
        h("section", { className: "pt-coordinator", "aria-label": "Project Conversation", "data-testid": "coordinator-pane" }, !project && h(Empty, { title: "\u65B0\u5EFA\u9879\u76EE", action: h(Button, { kind: "primary", onClick: () => setSettings("create") }, "\u65B0\u5EFA\u9879\u76EE") }, "\u5728\u9879\u76EE\u4E2D\u96C6\u4E2D\u8BA8\u8BBA\u3001\u8D44\u6599\u548C\u4EFB\u52A1\u3002"), project && !project.coordinatorModel && h(Empty, { title: "\u9009\u62E9\u6A21\u578B\u4EE5\u5F00\u59CB", action: h(Button, { onClick: () => openSettings() }, "\u9879\u76EE\u8BBE\u7F6E") }), h("div", { className: "pt-conversation-deck" }, coordinators.map((c) => h("div", { key: c.id, className: "pt-conversation-seat", hidden: c.id !== project?.coordinatorSessionId, "data-project-pane": "coordinator", "data-session-id": c.id }, h(NativeConversation, { id: c.id, projectId: c.projectId, SessionProvider, renderSlot, slot: "project-threads.coordinator", writable: c.writable })))))
      ),
      h("div", { role: "separator", "aria-label": "\u8C03\u6574\u6982\u89C8\u5BBD\u5EA6", "aria-orientation": "vertical", "aria-valuenow": Math.round(actualWidth), "aria-valuemin": 280, "aria-valuemax": Math.max(280, width - 294), tabIndex: 0, className: "pt-separator", hidden: !overview || !project || expanded || narrow, onKeyDown: (e) => {
        if (["ArrowLeft", "ArrowRight", "Home"].includes(e.key)) {
          e.preventDefault();
          resize(e.key === "Home" ? width * 360 / 917 : actualWidth + (e.key === "ArrowLeft" ? 20 : -20));
        }
      }, onPointerDown: (e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.dataset.start = String(e.clientX);
        e.currentTarget.dataset.initial = String(actualWidth);
      }, onPointerMove: (e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) resize(Number(e.currentTarget.dataset.initial) + Number(e.currentTarget.dataset.start) - e.clientX);
      }, onPointerUp: (e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      } }),
      h(
        "aside",
        { className: "pt-overview", "aria-label": "\u6982\u89C8", "data-testid": "overview-pane", hidden: !overview || !project, style: { "--pt-pane-width": actualWidth + "px" } },
        h("header", { className: "pt-overview-head" }, link ? h("div", { className: "pt-breadcrumb" }, h(Button, { kind: "ghost", "aria-label": "\u8FD4\u56DE\u8BA8\u8BBA\u4E32", onClick: () => setThread("") }, "\u8BA8\u8BBA\u4E32"), h("span", { "aria-hidden": true }, "\u203A"), h("span", { className: "pt-thread-title", title: link.title }, h(Icon, { name: "computer", size: 16 }), h("span", null, link.title))) : h("nav", { className: "pt-tabs", "aria-label": "\u6982\u89C8\u89C6\u56FE" }, tabButton("Threads", "chat", "\u8BA8\u8BBA\u4E32"), tabButton("Library", "library", "\u5E93"), h(Menu, { label: "\u89C6\u56FE", icon: "add" }, h(Button, { role: "menuitem", onClick: () => setDataTab("Threads") }, "\u8BA8\u8BBA\u4E32"), h(Button, { role: "menuitem", onClick: () => setDataTab("Library") }, "\u5E93"))), panelTools),
        h(
          "div",
          { className: "pt-thread-shell", hidden: !!link },
          searchOpen && h("div", { className: "pt-search" }, h("input", { type: "search", autoFocus: true, "aria-label": dataTab === "Threads" ? "\u641C\u7D22\u8BA8\u8BBA\u4E32" : "\u641C\u7D22\u5E93", placeholder: dataTab === "Threads" ? "\u641C\u7D22\u8BA8\u8BBA\u4E32" : "\u641C\u7D22\u5E93", value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: (e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setQuery("");
              setSearchOpen(false);
            }
          } }), h(Button, { icon: "close", kind: "icon", "aria-label": "\u5173\u95ED\u641C\u7D22", onClick: () => {
            setSearchOpen(false);
            setQuery("");
          } })),
          h(
            "div",
            { className: "pt-scroll pt-thread-list", hidden: dataTab !== "Threads" },
            h("div", { className: "pt-welcome" }, h("h2", null, "\u6B22\u8FCE\u56DE\u6765\u3002"), h("p", null, waiting ? "\u6709 " + waiting + " \u4E2A\u8BA8\u8BBA\u4E32\u7B49\u5F85\u60A8\u5904\u7406\u3002" : "\u76EE\u524D\u6CA1\u6709\u8BA8\u8BBA\u4E32\u7B49\u5F85\u60A8\u5904\u7406\u3002")),
            [["Working", "\u8FDB\u884C\u4E2D"], ["Waiting on you", "\u7B49\u5F85\u60A8\u5904\u7406"], ["Idle", "\u7A7A\u95F2"], ["Resolved", "\u5DF2\u89E3\u51B3"]].map(([group, label]) => {
              const rows = visible.filter((l) => activity(l) === group), requests = group === "Waiting on you" ? pendingRows.filter((r) => !query || r.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())) : [];
              if (group === "Working" && !rows.length) return null;
              return h("section", { className: "pt-thread-group", key: group }, h(Button, { className: "pt-group-title", "aria-expanded": !collapsed[group], onClick: () => setCollapsed((v) => ({ ...v, [group]: !v[group] })) }, h("span", { "aria-hidden": true }, collapsed[group] ? "\u203A" : "\u2304"), label + " " + (rows.length + requests.length)), h("div", { hidden: !!collapsed[group] }, rows.map((l) => h(ThreadRow, { key: l.threadId, title: l.title, status: activity(l), summary: rowSummary(l), time: latest(l)?.endedAt ?? latest(l)?.startedAt ?? l.updatedAt, onOpen: () => open(l) })), requests.map((r) => h(ThreadRow, { key: r.requestId, title: r.title, status: "Waiting on you", summary: "\u7B49\u5F85\u76EE\u5F55\u6388\u6743", time: r.createdAt, onOpen: () => openSettings("Environment") })), !rows.length && !requests.length && h("p", { className: "pt-group-empty" }, group === "Resolved" ? "\u5DF2\u5B8C\u6210\u7684\u8BA8\u8BBA\u4E32\u3002" : query ? "\u6CA1\u6709\u5339\u914D\u7684\u8BA8\u8BBA\u4E32\u3002" : "\u6682\u65E0\u8BA8\u8BBA\u4E32\u3002")));
            }),
            scopeState.proposals?.some((p) => p.proposal) && h("section", null, h("h3", { className: "pt-group-title" }, "\u5EFA\u8BAE\u4EFB\u52A1"), scopeState.proposals.filter((p) => p.proposal).map((p) => h("article", { className: "pt-proposal", key: p.dispatchId }, h("strong", null, p.title), h("p", { className: "pt-help" }, p.task), h(Button, { disabled: busy, onClick: () => run(async () => {
              await request("proposal.start", { projectId: selected, dispatchIds: [p.dispatchId] });
              await refresh();
            }) }, "\u542F\u52A8"))), h(Button, { disabled: busy, onClick: () => run(async () => {
              await request("proposal.start", { projectId: selected });
              await refresh();
            }) }, "\u5168\u90E8\u542F\u52A8")),
            scopeState.reports?.filter((r) => r.delivery !== "integrated").map((r) => h("div", { key: r.reportId, className: "pt-error" }, h("div", null, h("strong", null, "\u62A5\u544A\u7B49\u5F85\u6574\u5408"), h("p", null, "\u5DF2\u6709\u4EA7\u7269\u4F1A\u4FDD\u7559\uFF0C\u4E0D\u91CD\u65B0\u6267\u884C\u4EFB\u52A1\u3002"), h(Button, { disabled: busy, onClick: () => run(async () => {
              await request("report.retry", { projectId: selected, reportId: r.reportId });
              await refresh();
            }) }, "\u91CD\u8BD5\u6574\u5408"))))
          ),
          h("div", { className: "pt-scroll pt-library-scroll", hidden: dataTab !== "Library" }, project && h(LibraryPanel, { key: selected, projectId: selected, state: scopeState, request, refresh, theme, query: dataTab === "Library" ? query : "", onSourceTarget: sourceTarget }))
        ),
        h("div", { className: "pt-thread-shell", hidden: !link }, h("div", { className: "pt-conversation-deck" }, threads.map((t) => h(ThreadSeat, { key: t.id, thread: t, active: t.id === link?.threadSessionId, target: sourceMount?.id === t.id ? sourceMount.node : null, SessionProvider, renderSlot }))))
      ),
      settings && h(ProjectSettings, { key: settings === "create" ? "create" : selected, theme, initialTab: settingsTab, project: settings === "edit" ? project : null, state: scopeState, request, refresh, onClose: () => setSettings(""), onOpenSchedules: () => ctx.layout.selectPanel("schedules"), onReviewPending: () => {
        const r = scopeState.runs?.find((r2) => r2.waiting?.kind === "approval");
        if (r) {
          setThread(r.threadId);
          setOverview(true);
        }
        setSettings("");
      }, onSaved: async (p) => {
        if (selectionRef.current === selected) {
          setSettings("");
          setSelected(p.projectId);
        }
        await projection.refresh(p.projectId);
      }, onDeleted: async () => {
        retention.releaseProject(selected);
        if (selectionRef.current === selected) {
          setSettings("");
          setSelected("");
          setThread("");
        }
        await projection.refresh("");
      } })
    );
  }
  ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: "project-threads", children: { "project-threads.coordinator": { kind: "single", scope: "session" }, "project-threads.thread": { kind: "single", scope: "session" } } }, Main));
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({ name: "sidebar.panellist", id: "project-threads", order: 1, label: () => "Projects" }, () => h("span", { "aria-hidden": true }, "P")));
}
return module.exports;}});
