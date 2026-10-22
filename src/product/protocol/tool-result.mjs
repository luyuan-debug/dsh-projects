import {fail} from '../domain/projects.mjs';

/** Optional runtime fields may be undefined; model results omit them and reject every other non-JSON value. */
export function projectToolResult(value){
 if(value===null||typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number'&&Number.isFinite(value))return value;
 if(Array.isArray(value))return value.map(projectToolResult);
 if(typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value)))return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([key,v])=>[key,projectToolResult(v)]));
 fail('PROJECT_OUTPUT_JSON','Project tool result contains an unsupported non-JSON value');
}
