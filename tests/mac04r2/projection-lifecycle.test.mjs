import test from 'node:test';
import assert from 'node:assert/strict';
import {createProjectProjection} from '../../src/product/client/project-projection.mjs';
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
async function controlled(run){
 const saved=[globalThis.setTimeout,globalThis.clearTimeout],timers=new Map(),reads=[];let next=0;
 globalThis.setTimeout=fn=>{const id=++next;timers.set(id,fn);return id};globalThis.clearTimeout=id=>timers.delete(id);
 const p=createProjectProjection((id,signal)=>new Promise((resolve,reject)=>{const abort=()=>reject(Object.assign(new Error('cancelled'),{name:'AbortError'}));signal.addEventListener('abort',abort,{once:true});reads.push({id,signal,resolve:v=>{signal.removeEventListener('abort',abort);resolve(v)},reject});}));
 try{await run({p,reads,timers,fire:async()=>{const scheduled=[...timers];timers.clear();for(const [,fn]of scheduled)void fn();await settle()}})}finally{p.dispose();await settle();[globalThis.setTimeout,globalThis.clearTimeout]=saved}
}
test('unsubscribe/resubscribe while abort settles creates only the new polling generation',()=>controlled(async({p,reads,timers,fire})=>{
 const first=p.subscribe('p',()=>{});first();const second=p.subscribe('p',()=>{});assert.equal(reads.length,2);reads[1].resolve({revision:2});await settle();assert.equal(timers.size,1);second();second();assert.equal(timers.size,0);const count=reads.length;await fire();assert.equal(reads.length,count);
}));
test('same callback subscribed twice is independently owned and last unsubscribe clears all work',()=>controlled(async({p,reads,timers,fire})=>{
 let changes=0;const fn=()=>changes++,offA=p.subscribe('p',fn),offB=p.subscribe('p',fn);assert.equal(reads.length,1);reads[0].resolve({revision:1});await settle();assert.equal(changes,2);assert.equal(timers.size,1);offA();await fire();assert.equal(reads.length,2);offB();assert(reads[1].signal.aborted);await settle();assert.equal(timers.size,0);const count=reads.length;await fire();assert.equal(reads.length,count);
}));
test('slow/error responses remain scoped across projects and dispose never schedules another read',()=>controlled(async({p,reads,timers,fire})=>{
 const off=p.subscribe('old',()=>{});off();p.subscribe('new',()=>{});reads[0].resolve({projectId:'old'});reads[1].reject(new Error('temporary'));await settle();assert.equal(p.get('old').data,null);assert.equal(p.get('new').error,'temporary');assert.equal(timers.size,1);await fire();assert.equal(reads[2].id,'new');p.dispose();reads[2].resolve({projectId:'new'});await settle();assert.equal(timers.size,0);assert.equal(p.get('new').data,null);await p.refresh('new');assert.equal(reads.length,3);
}));
