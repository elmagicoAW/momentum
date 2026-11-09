import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createBackupService, RecoveryBlocked } from '../src/data/backup-service.ts';
import { canonical, createBackup } from '../src/data/backup-format.ts';
import { createPersistenceCoordinator, persistence } from '../src/data/persistence-coordinator.ts';
import { createSaveQueue } from '../src/data/save-queue.ts';
import { createListStore } from '../src/data/list-store.ts';
import {fullBackupRecords} from './support/backup-fixtures.mjs';
import {createAchievementCoordinator} from '../src/data/achievement-coordinator.ts';
import {loadHabits} from '../src/data/habit-storage.ts';
import {mock} from './support/async-storage-mock.mjs';
import {tick} from './support/fixtures.mjs';
const hash=async(s)=>createHash('sha256').update(s).digest('hex');
const before=[{key:'momentum:habits:v2',raw:' {"version":2,"habits":[],"unknown":true} '},{key:'momentum:checkins:v2:2026-11-08',raw:'{"version":2,"entries":{"deleted":{"type":"tick","done":true}}}'}];
before.sort((a,b)=>a.key<b.key?-1:1);
const after=[{key:'momentum:habits:v2',raw:'{"version":2,"habits":[]}'}];
function fixture(initial=before) {
 const data=new Map(initial.map(r=>[r.key,r.raw])); data.set('unrelated','keep'); const disk=new Map();
 const mutations=[]; let fail=()=>false;
 const op=(name)=>{if(fail(name)) throw Error('injected '+name);};
 const storage={getAllKeys:async()=>{op('keys');return [...data.keys()];},multiGet:async(keys)=>{op('multiGet');return keys.map(k=>[k,data.get(k)??null]);},setItem:async(k,v)=>{op('set');data.set(k,v);mutations.push(k);},removeItem:async(k)=>{op('remove');data.delete(k);mutations.push(k);}};
 const files={list:async()=>{op('list');return [...disk.keys()];},read:async(n)=>{op('read:'+n.split('.').at(-1));return disk.get(n)??null;},write:async(n,v)=>{op('write:'+n.split('.').at(-1));if(disk.has(n))throw Error('exists');disk.set(n,v);},remove:async(n)=>{op('delete');disk.delete(n);}};
 const barrier=createPersistenceCoordinator(); const service=createBackupService(storage,files,hash,barrier);
 return {data,disk,mutations,barrier,service,storage,files,fail:(fn)=>{fail=fn;}};
}
test('exact replacement and recovery copy preserve strings, absence and unrelated data',async()=>{
 const f=fixture(); const b=await createBackup(after,hash);
 assert.equal((await f.service.restore(JSON.stringify(b),before)).restored,true);
 assert.deepEqual(await f.service.capture(),after); assert.equal(f.data.get('unrelated'),'keep');
 assert.deepEqual(JSON.parse(await f.service.recoveryCopy()).payload.records,before);
 f.barrier.freeze(); await f.service.recover(); f.barrier.release();
 // Settled journals must not roll back later normal user changes on restart.
 f.data.set(after[0].key,'later user edit'); f.barrier.freeze();await f.service.recover();f.barrier.release();
 assert.equal(f.data.get(after[0].key),'later user edit');
 await f.service.removeRecoveryCopies(); assert.equal(await f.service.recoveryCopy(),null);
 f.barrier.freeze();await f.service.recover();f.barrier.release();
});
test('invalid import and stale preview never write or create journal',async()=>{
 const f=fixture(); await assert.rejects(f.service.restore('{}',before));
 const b=await createBackup(after,hash); await assert.rejects(f.service.restore(JSON.stringify(b),[]),/changed/);
 assert.equal(f.mutations.length,0); assert.equal(f.disk.size,0); assert.equal(f.barrier.available(),true);
});
test('failure at each durable preparation/apply/commit stage rolls back or never mutates',async()=>{
 for(const stage of ['write:before','write:after','write:prepared','set','remove','write:committed','write:settled']) {
  const f=fixture();let once=true;f.fail(n=>n===stage&&once?(once=false,true):false);
  try {await f.service.restore(JSON.stringify(await createBackup(after,hash)),before);}catch(e){assert.ok(!(e instanceof RecoveryBlocked),stage);}
  assert.deepEqual(await f.service.capture(),before,stage);assert.equal(f.data.get('unrelated'),'keep');
 }
});
test('rollback failure keeps barrier locked, restart retries exact recovery',async()=>{
 const f=fixture();f.fail(n=>n==='remove'||n==='set');
 await assert.rejects(f.service.restore(JSON.stringify(await createBackup(after,hash)),before),RecoveryBlocked);
 assert.equal(f.barrier.available(),false);f.fail(()=>false);await f.service.recover();f.barrier.release();
 assert.deepEqual(await f.service.capture(),before);
});
test('process interruption at every prepared/committed boundary recovers before providers',async()=>{
 for(const stage of ['before','after','prepared','partial-set','partial-remove','applied','committed','settled']){
  const f=fixture();const old=await createBackup(before,hash),next=await createBackup(after,hash);const id='restore-1794225600000-abc';
  const marker=canonical({version:1,id,before:old.integrity.digest,after:next.integrity.digest});
  f.disk.set(id+'.before',JSON.stringify(old));
  if(stage!=='before')f.disk.set(id+'.after',JSON.stringify(next));
  if(!['before','after'].includes(stage))f.disk.set(id+'.prepared',marker);
  if(['partial-set','partial-remove','applied','committed','settled'].includes(stage))f.data.set(after[0].key,after[0].raw);
  if(['partial-remove','applied','committed','settled'].includes(stage))f.data.delete('momentum:checkins:v2:2026-11-08');
  if(['committed','settled'].includes(stage))f.disk.set(id+'.committed',marker);
  if(stage==='settled')f.disk.set(id+'.settled',canonical({version:1,id,outcome:'restored',before:old.integrity.digest,after:next.integrity.digest}));
  f.barrier.freeze();await f.service.recover();f.barrier.release();
  assert.deepEqual(await f.service.capture(),['committed','settled'].includes(stage)?after:before,stage);
 }
});
test('missing/corrupt recovery snapshot never initializes defaults',async()=>{
 const f=fixture();f.disk.set('restore-1794225600000-abc.prepared','bad');f.barrier.freeze();
 await assert.rejects(f.service.recover(),RecoveryBlocked);assert.equal(f.barrier.available(),false);assert.equal(f.mutations.length,0);
});
test('admission blocks concurrent writers synchronously; timeout cannot grant restore access',async()=>{
 const f=fixture();const finish=f.barrier.accept();f.barrier.freeze();
 assert.throws(()=>f.barrier.accept());await assert.rejects(f.barrier.drain(5),/still saving/);assert.equal(f.mutations.length,0);assert.equal(f.barrier.available(),false);
 finish();await f.barrier.drain();f.barrier.advance(true);f.barrier.release();assert.equal(f.barrier.automaticNormalization(),false);
});
test('all accepted serialized work drains; new commits rejected before queueing',async()=>{
 let release;const wait=new Promise(r=>release=r);const saved=[];
 const store=createListStore({load:async()=>[],save:async(v)=>{await wait;saved.push(v);},onChange:()=>{}});
 await store.load();const first=store.commit(()=>({next:[1],result:1}));const second=store.commit(c=>({next:[...c,2],result:2}));
 persistence.freeze();await assert.rejects(store.commit(()=>({next:[99],result:99})));release();await Promise.all([first,second]);await persistence.drain();persistence.release();
 assert.deepEqual(saved,[[1],[1,2]]);
});
test('pending daily records across midnight retain lease through retry and block replacement',async()=>{
 let fail=true;const saved=[];const q=createSaveQueue(async(k,v)=>{if(fail)throw Error('test pending');saved.push([k,v]);},()=>{},[10]);
 q.enqueue('2026-11-08',1);q.enqueue('2026-11-09',2);persistence.freeze();await assert.rejects(persistence.drain(5));
 q.enqueue('2026-11-10',3);fail=false;q.retry();await persistence.drain();persistence.release();assert.deepEqual(saved,[['2026-11-08',1],['2026-11-09',2]]);
});
test('synthetic full export → edit → restore → verify every raw record and recovery bytes',async()=>{
 const raw=fullBackupRecords();const f=fixture(raw);const exported=await f.service.exportBackup();
 f.data.set('momentum:profile:v1','changed');f.data.set('momentum:checkins:v2:2026-11-09','changed');f.data.delete('momentum:routines:v1');
 const edited=await f.service.capture();await f.service.restore(JSON.stringify(exported),edited);
 assert.deepEqual(await f.service.capture(),raw);assert.deepEqual(JSON.parse(await f.service.recoveryCopy()).payload.records,edited);
});
test('corrupt existing known records can be recovered verbatim, future versions are never erased',async()=>{
 const f=fixture([{key:'momentum:profile:v1',raw:'bad old record'}]);const old=await f.service.capture();
 await f.service.restore(JSON.stringify(await createBackup(after,hash)),old);
 assert.deepEqual(JSON.parse(await f.service.recoveryCopy()).payload.records,old);
 for(const oldRecord of [{key:'momentum:profile:v2',raw:'{}'},{key:'momentum:profile:v1',raw:'{"version":2}'}]){
  const g=fixture([oldRecord]);await assert.rejects(g.service.restore(JSON.stringify(await createBackup(after,hash)),[oldRecord]),/unsupported/);assert.equal(g.mutations.length,0);
 }
});
test('corrupt incoming staging cannot prevent exact rollback from verified before snapshot',async()=>{
 const f=fixture();const id='restore-1794225600000-abc';f.disk.set(id+'.before',JSON.stringify(await createBackup(before,hash)));f.disk.set(id+'.after','truncated');f.disk.set(id+'.prepared','truncated');
 f.data.set(after[0].key,after[0].raw);f.barrier.freeze();await f.service.recover();f.barrier.release();assert.deepEqual(await f.service.capture(),before);
});
test('generation retirement blocks stale queues; restore hydration never migrates legacy habits or writes achievement backfill',async()=>{
 const store=createListStore({load:async()=>[],save:async()=>assert.fail('stale write'),onChange:()=>{}});await store.load();
 persistence.freeze();await persistence.drain();persistence.advance(true);persistence.release();await assert.rejects(store.commit(()=>({next:[1],result:1})));
 mock.reset();const legacy=fullBackupRecords().find(r=>r.key==='momentum:habits:v1');mock.seed({[legacy.key]:legacy.raw});await loadHabits();assert.deepEqual(mock.writes(),[]);assert.equal(mock.get(legacy.key),legacy.raw);
 let writes=0;const h=[tick('a')];const c=createAchievementCoordinator({inputs:()=>({today:'2026-11-09',habits:h,ready:true,pending:false,revision:0,finishedRevision:0}),load:async()=>({awards:{},seenBadgeIds:[]}),save:async()=>{writes++;},history:async()=>({days:new Map([['2026-11-08',{entries:{a:{type:'tick',done:true}}}]]),unreadableDays:[]}),now:()=>new Date('2026-11-09T12:00:00.000Z'),onChange:()=>{}});
 await c.request();assert.equal(writes,0);persistence.enableAwards();await c.request(true);assert.equal(writes,1);
 persistence.freeze();await persistence.drain();persistence.advance(false);persistence.release();
});
test('read-back failure after completion publication NEVER begins rollback; restart retains complete imported data',async()=>{
 const f=fixture();let published=false;let failed=false;
 const original=f.files.write;f.files.write=async(n,v)=>{await original(n,v);if(n.endsWith('.settled'))published=true;};
 f.fail(n=>{if(published&&!failed&&n==='read:settled'){failed=true;return true;}return false;});
 await assert.rejects(f.service.restore(JSON.stringify(await createBackup(after,hash)),before),RecoveryBlocked);
 assert.deepEqual(await f.service.capture(),after);assert.equal(f.barrier.available(),false);
 f.fail(()=>false);await f.service.recover();f.barrier.release();assert.deepEqual(await f.service.capture(),after);
});
test('unverifiable settled marker blocks startup instead of exposing partial data',async()=>{
 const f=fixture();const original=f.files.write;f.files.write=async(n,v)=>{await original(n,n.endsWith('.settled')?'truncated':v);};
 await assert.rejects(f.service.restore(JSON.stringify(await createBackup(after,hash)),before),RecoveryBlocked);
 assert.deepEqual(await f.service.capture(),after);await assert.rejects(f.service.recover(),RecoveryBlocked);assert.equal(f.barrier.available(),false);
});
test('one-shot failure at EVERY awaited restore I/O boundary leaves a complete generation or blocks until verified recovery',async()=>{
 const b=JSON.stringify(await createBackup(after,hash));const baseline=fixture();let count=0;baseline.fail(()=>{count++;return false;});await baseline.service.restore(b,before);
 for(let target=1;target<=count;target++){
  const f=fixture();let i=0;f.fail(()=>++i===target);
  try{await f.service.restore(b,before);}catch{/* Rejection is required for failed preflight or blocked recovery. */}
  f.fail(()=>false);
  if(!f.barrier.available()){await f.service.recover();f.barrier.release();}
  const records=await f.service.capture();assert.ok(canonical(records)===canonical(before)||canonical(records)===canonical(after),`boundary ${target}`);assert.equal(f.data.get('unrelated'),'keep');
 }
});
