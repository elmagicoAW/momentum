import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedText,pickedText} from '../src/data/backup-io.ts';
test('unknown-size chunked input stops at byte limit and cancels source',async()=>{
 let canceled=false;
 const stream=new ReadableStream({pull(c){c.enqueue(new Uint8Array(6));},cancel(){canceled=true;}});
 await assert.rejects(boundedText(stream,10),/limit/);assert.equal(canceled,true);
});
test('strict UTF-8 supports split Unicode and rejects invalid encoding',async()=>{
 const raw=new TextEncoder().encode('مرحبا 🌟');let i=0;
 assert.equal(await boundedText(new ReadableStream({pull(c){if(i===raw.length)c.close();else c.enqueue(raw.slice(i,++i));}})),'مرحبا 🌟');
 await assert.rejects(boundedText(new ReadableStream({start(c){c.enqueue(new Uint8Array([0xff]));c.close();}})));
});
test('picker cancellation never reads a file or mutates data',async()=>{
 let read=false;assert.equal(await pickedText(async()=>({canceled:true}),async()=>{read=true;}),null);assert.equal(read,false);
 assert.equal(await pickedText(async()=>({canceled:false,result:'file'}),async(f)=>f),'file');
});
