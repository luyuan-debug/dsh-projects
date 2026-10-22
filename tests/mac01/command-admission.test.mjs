import test from 'node:test';
import assert from 'node:assert/strict';
import { HostLifecycle } from '../../src/product/host/host-lifecycle.mjs';
import { executeCommand } from '../../src/product/host/command-admission.mjs';
test('an API failure reaches its caller unchanged without poisoning a later successful teardown',async()=>{const io=Object.assign(new Error('write failed'),{code:'EIO'}),calls=[];const h=new HostLifecycle({runtime:{dispose:async()=>calls.push('runtime')},store:{close:async()=>calls.push('store')}});await assert.rejects(executeCommand(h,async()=>{throw io;}),e=>e===io);assert.equal(await executeCommand(h,async()=>17),17);await h.dispose();assert.deepEqual(calls,['runtime','store']);});
test('resource close errors still propagate after handled command failures',async()=>{const io=new Error('close failed');const h=new HostLifecycle({runtime:{dispose:async()=>{}},store:{close:async()=>{throw io;}}});await assert.rejects(executeCommand(h,async()=>{throw new Error('bad input');}));await assert.rejects(h.dispose(),e=>e instanceof AggregateError&&e.errors.includes(io));});
