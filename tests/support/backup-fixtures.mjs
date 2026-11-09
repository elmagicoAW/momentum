import {tick,count,checklist,profile,routine} from './fixtures.mjs';
const stamp='2026-11-01T12:00:00.000Z';
const raw=(key,value)=>({key,raw:' '+JSON.stringify(value)+'\n'});
export function fullBackupRecords(){
 const habits=[tick('tick',{kind:'weekdays',days:[1,3,5]}),count('count',12),checklist('check')];
 const legacy=habits.map(({tracking,...h})=>h);
 const award={ruleVersion:1,awardedAt:stamp,source:'backfill',evidenceThrough:'2026-10-31',evidence:{metric:1,windowEnd:'2026-10-31',habitId:'deleted'}};
 const day={version:2,entries:{tick:{type:'tick',done:true},count:{type:'count',value:8,target:8},check:{type:'checklist',done:['renamed','optional'],required:['renamed']},deleted:{type:'count',value:2,target:3}}};
 const historical=JSON.stringify(day);
 return [
 raw('momentum:habits:v2',{version:2,habits,unknown:{text:'مرحبا 🌟'}}),
 raw('momentum:habits:v1',{version:1,habits:legacy}),
 raw('momentum:checkins:v2:2026-10-31',day),
 raw('momentum:completions:v1:2026-10-31',['tick','old-legacy']),
 raw('momentum:goals:v1',{version:1,goals:[{id:'goal',title:'TEST goal',startDate:'2026-10-01',targetDate:'2026-12-01',status:'completed',completedAt:'2026-11-01',habitIds:['count','deleted'],createdAt:stamp,updatedAt:stamp,unknown:42}]}),
 raw('momentum:routines:v1',{version:1,routines:[routine('evening',['check','tick'],{timeOfDay:'evening'}),routine('morning',['count','deleted'],{timeOfDay:'morning'})]}),
 raw('momentum:profile:v1',{version:1,profile:profile({displayName:'مريم',avatar:{kind:'icon',icon:'unknown-icon',color:'#5B8DEF'},namePrompt:'completed',unknown:'keep'})}),
 raw('momentum:achievements:v1',{version:1,awards:{'first-checkin':award,'future-badge':{...award,ruleVersion:7,unknown:'retain'}},seenBadgeIds:['first-checkin','future-badge'],unknown:['keep']}),
 raw('momentum:backup:pre-habits-v1',{version:1,reason:'Before migration',createdAt:stamp,legacyHabitIds:['tick'],completions:{'momentum:checkins:v2:2026-10-31':historical}}),
 ].sort((a,b)=>a.key<b.key?-1:1);
}
