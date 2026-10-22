import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
mkdirSync('lib',{recursive:true});
await build({entryPoints:['src/product/client/thread-links.mjs'],outfile:'lib/client.js',bundle:true,loader:{'.css':'text'},platform:'browser',format:'cjs',external:['react','react-dom','@deepseek-ai/*'],banner:{js:'window.__ModuleLoader__.load({id:"dsh-project-threads-wave1-spike",factory:(require)=>{var module={exports:{}};var exports=module.exports;'},footer:{js:'return module.exports;}});'},sourcemap:false,logLevel:'info'});
