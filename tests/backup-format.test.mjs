import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonical, createBackup, parseBackup, inspectRecords, strictJSON, requireRestorable, LIMITS } from '../src/data/backup-format.ts';
import {fullBackupRecords} from './support/backup-fixtures.mjs';
const hash = async (s) => createHash('sha256').update(s).digest('hex');
const records = [
  {key:'momentum:habits:v2',raw:' {"version":2,"habits":[],"unknown":"مرحبا 🌟"} '},
  {key:'momentum:checkins:v2:2026-11-08',raw:'{"version":2,"entries":{"deleted":{"type":"count","value":3,"target":8},"old":{"type":"checklist","done":["optional","removed"],"required":["removed"]},"tick":{"type":"tick","done":true}}}'},
  {key:'momentum:completions:v1:2026-11-08',raw:'["tick"]'},
];
test('lossless Unicode/raw round trip with precedence and legitimate orphans',async()=>{
 const b=await createBackup(records,hash); const parsed=await parseBackup(JSON.stringify(b),hash);
 assert.deepEqual(parsed.payload.records,[...records].sort((a,b)=>a.key<b.key?-1:1));
 const p=requireRestorable(parsed); assert.equal(p.restorable,true); assert.ok(p.warnings.length>=2);
});
test('archive preserves corrupt/future raw records but normal import rejects',async()=>{
 const raw=[{key:'momentum:habits:v3',raw:'bad JSON'}];
 const b=await parseBackup(JSON.stringify(await createBackup(raw,hash)),hash);
 assert.deepEqual(b.payload.records,raw); assert.throws(()=>requireRestorable(b));
});
test('integrity covers metadata, raw strings and manifest',async()=>{
 const b=await createBackup(records,hash); b.createdAt='2026-11-01T00:00:00.000Z';
 await assert.rejects(parseBackup(JSON.stringify(b),hash),/checksum/);
});
test('reject duplicate/escaped members, trailing data, depth, unrelated keys and limits',async()=>{
 for(const s of ['{"a":1,"\\u0061":2}', '{}{}', '['.repeat(34)+'0'+']'.repeat(34)]) assert.throws(()=>strictJSON(s));
 await assert.rejects(createBackup([{key:'other',raw:'x'}],hash));
 await assert.rejects(createBackup([records[0],records[0]],hash));
 await assert.rejects(createBackup([{key:'momentum:profile:v1',raw:'a'.repeat(LIMITS.raw+1)}],hash));
 await assert.rejects(parseBackup(' '.repeat(LIMITS.file+1),hash));
});
test('canonical digest vector is deterministic across property ordering',async()=>{
 assert.equal(canonical({b:['مرحبا 🌟'],a:1}),'{"a":1,"b":["مرحبا 🌟"]}');
 assert.equal(await hash(canonical({b:2,a:1})), '43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777');
});
test('completion-only, invalid dates and prototype members are archive-only',()=>{
 assert.equal(inspectRecords(records.slice(1)).restorable,false);
 assert.equal(inspectRecords([{key:'momentum:checkins:v2:2026-02-30',raw:'{"version":2,"entries":{}}'}]).restorable,false);
 assert.equal(inspectRecords([{key:'momentum:habits:v2',raw:'{"version":2,"habits":[],"__proto__":{}}'}]).restorable,false);
});
test('all nine data families, historical snapshots, schedules, ordered relations, profile and awards round-trip exactly',async()=>{
 const raw=fullBackupRecords(); const b=await parseBackup(JSON.stringify(await createBackup(raw,hash)),hash);
 assert.deepEqual(b.payload.records,raw); const p=requireRestorable(b);assert.equal(p.errors.length,0);assert.ok(p.summary.some(s=>s.includes('2 awards, 2 acknowledged')));
});
test('invalid evidence, unsupported backup/schema versions, corrupted v2 shadows and corrupt legacy records reject activation',async()=>{
 const raw=fullBackupRecords();
 for(const key of ['momentum:achievements:v1','momentum:checkins:v2:2026-10-31','momentum:habits:v1']) {
  const changed=raw.map(r=>r.key===key?{...r,raw:'corrupt'}:r);const b=await createBackup(changed,hash);assert.throws(()=>requireRestorable(b));
 }
 const b=await createBackup(raw,hash);await assert.rejects(parseBackup(JSON.stringify({...b,backupVersion:2}),hash),/version/);
 await assert.rejects(parseBackup(JSON.stringify({...b,schemaVersions:{...b.schemaVersions,habits:[3]}}),hash),/version/);
 const a=raw.find(r=>r.key==='momentum:achievements:v1');const parsed=JSON.parse(a.raw);parsed.seenBadgeIds.push('missing');
 assert.equal(inspectRecords([{...a,raw:JSON.stringify(parsed)}]).restorable,false);
});
test('record/key/aggregate bounds reject without truncation; exact raw bound remains lossless',async()=>{
 await assert.rejects(createBackup(Array.from({length:LIMITS.records+1},(_,i)=>({key:`momentum:checkins:v2:${i}`,raw:'{}'})),hash),/many/);
 await assert.rejects(createBackup([{key:'momentum:habits:v'+'1'.repeat(LIMITS.key),raw:'{}'}],hash),/limit/);
 await assert.rejects(createBackup(Array.from({length:5},(_,i)=>({key:`momentum:checkins:v2:${i}`,raw:' '.repeat(LIMITS.raw)})),hash),/limit/);
 const raw=[{key:'momentum:profile:v1',raw:' '.repeat(LIMITS.raw)}];
 assert.deepEqual((await parseBackup(JSON.stringify(await createBackup(raw,hash)),hash)).payload.records,raw);
});
