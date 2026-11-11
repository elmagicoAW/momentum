import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {weekSummary} from '../src/i18n/insight-summary.ts';
import ts from 'typescript';
import {en} from '../src/i18n/en.ts';
import {ar} from '../src/i18n/ar.ts';
import {enMessages} from '../src/i18n/en-messages.ts';
import {arMessages} from '../src/i18n/ar-messages.ts';
import {remainingEn} from '../src/i18n/remaining-en.ts';
import {remainingEnMessages} from '../src/i18n/remaining-en-messages.ts';
import {createTranslator} from '../src/i18n/translate.ts';
import {appLabel,appMessage,appRich,withErrorMessage,displayError} from '../src/i18n/app-copy.ts';
import {entryParameters,catalogIssues} from '../src/i18n/catalog.ts';
import {NUMERIC_PARAMETERS} from '../src/i18n/types.ts';
import {RecoveryBlocked} from '../src/data/backup-service.ts';
import {fullBackupRecords} from './support/backup-fixtures.mjs';
import {canonical,createBackup} from '../src/data/backup-format.ts';
import {ACTIVE_PRESENTATION} from '../src/utils/presentation.ts';

const baseline=JSON.parse(readFileSync('tests/support/phase4b-preservation-baseline.json','utf8'));
const inventory=JSON.parse(readFileSync('LOCALIZATION_COPY_INVENTORY.json','utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
test('dynamic achievement filters and calendar weekday keys remain in both catalogs',()=>{
 for(const value of ['all','earned','locked'])for(const language of ['en','ar'])assert.ok(createTranslator({strict:true}).label(language,`achievements.${value}`));
 for(let day=0;day<7;day++)for(const language of ['en','ar'])assert.ok(createTranslator({strict:true}).label(language,`calendar.weekday.${day}`));
});
test('weekly summary preserves English across every optional count, percent and provisional clause',()=>{
 for(const isCurrent of [false,true])for(const finished of [0,3])for(const rate of [null,0.834])for(const unknown of [0,2])for(const todayDone of [0,1])for(const remaining of [0,4]){
  const facts={empty:false,isCurrent,counts:{done:2,finished,unknown,rate},todayDone,remaining};
  const pct=rate===null?'':` (${Math.round(rate*100)}%)`;
  const unread=unknown>0?` · ${unknown} couldn’t be read`:'';
  const today=todayDone>0?` · ${todayDone} done today (provisional)`:'';
  const left=remaining>0?` · ${remaining} still to come`:'';
  const expected=isCurrent ? (finished===0?`No finished days yet this week${today}${left}${unread}`:`So far: 2 of ${finished} finished check-ins completed${pct}${today}${left}${unread}`) : (finished===0&&unknown===0?'Nothing was scheduled this week.':`2 of ${finished} scheduled check-ins completed${pct}${unread}`);
  assert.equal(weekSummary(facts),expected,JSON.stringify(facts));
 }
});

test('shared presentation and backup descriptors initialize and render without any Intl object',()=>{
 const script=`
  import assert from 'node:assert/strict';
  globalThis.Intl=undefined;
  const {appMessage,withErrorMessage,displayError}=await import('./src/i18n/app-copy.ts');
  const {formatTimestamp}=await import('./src/i18n/presentation-date.ts');
  const {weekSummary}=await import('./src/i18n/insight-summary.ts');
  const {RecoveryBlocked}=await import('./src/data/backup-service.ts');
  const {ACHIEVEMENTS}=await import('./src/data/achievement-definitions.ts');
  assert.equal(ACHIEVEMENTS.length,12);
  assert.equal(appMessage('routines.card.habits',{count:2}),'2 habits');
  assert.ok(formatTimestamp('2026-11-11T12:34:56.000Z').includes('2026'));
  const error=new RecoveryBlocked('original');
  assert.equal(withErrorMessage(error,{key:'backup-format.backupIsIncompleteOrChangedChecksumMismatch'}),error);
  assert.equal(displayError(error,'fallback'),'Backup is incomplete or changed (checksum mismatch)');
  assert.equal(weekSummary({empty:false,isCurrent:true,counts:{done:0,finished:0,unknown:0,rate:null},todayDone:0,remaining:0}),'No finished days yet this week');
 `;
 assert.doesNotThrow(()=>execFileSync(process.execPath,['--import','./tests/support/register.mjs','--input-type=module','-e',script],{encoding:'utf8'}));
});
test('all reachable screen/component/recovery JSX copy and literal presentation attributes use localization',()=>{
 const failures=[];const presentationProps=/^(?:title|label|placeholder|description|footer|accessibilityLabel|accessibilityHint|actionLabel|submitLabel|confirmLabel|disabledHint|resetLabel|hint)$/;
 for(const {file}of inventory.files.filter(f=>f.reachable&&(/src\/(app|components)\//.test(f.file)||f.file==='src/hooks/use-data-backup.tsx'))){
  const source=readFileSync(file,'utf8'),tree=ts.createSourceFile(file,source,99,true,file.endsWith('tsx')?4:3);
  function visit(n){
   if(ts.isJsxText(n)&&/[A-Za-z\u0600-\u06ff]/.test(n.text))failures.push(`${file}:${n.text.trim()}`);
   if(ts.isJsxAttribute(n)&&presentationProps.test(n.name.getText(tree))&&n.initializer&&ts.isStringLiteral(n.initializer)&&/[A-Za-z\u0600-\u06ff]/.test(n.initializer.text))failures.push(`${file}:${n.name.getText(tree)}=${n.initializer.text}`);
   // Technical keys, symbol names, layout percentages and original exception contracts are not copy.
   if(ts.isTemplateExpression(n)&&n.head.text+ n.templateSpans.map(s=>s.literal.text).join('')){
    const words=[n.head.text,...n.templateSpans.map(s=>s.literal.text)].join('');
    if(/[A-Za-z]/.test(words)&&!words.startsWith('blank-')&&!/^(?:today\.|routines\.|achievements\.|tracking\.)/.test(words)){
     let p=n.parent;while(p&&!ts.isJsxExpression(p)&&!ts.isNewExpression(p))p=p.parent;
     if(p&&ts.isJsxExpression(p)&&!file.includes('/today/')&&!words.includes('.count'))failures.push(`${file}:untranslated template ${words}`);
    }
   }
   ts.forEachChild(n,visit);
  }visit(tree);
 }
 assert.deepEqual(failures,[]);
});

test('remaining bilingual labels/messages are complete, typed in the shared catalog and safe for literal names',()=>{
 assert.deepEqual(catalogIssues(),[]);
 for(const [key,value]of Object.entries(remainingEn)){assert.equal(en[key],value);assert.ok(ar[key].trim());assert.ok(/[\u0600-\u06ff]/.test(ar[key])||['Momentum','MOMENTUM'].includes(value),key);}
 const translator=createTranslator({strict:true,numberFormat:(language,n)=>language==='en'?String(n):String(n).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[Number(d)])});
 for(const [key,entry]of Object.entries(remainingEnMessages))for(const language of ['en','ar'])for(const count of [0,1,2,3,10,11,99,100,102,103,111,1.5]){
  const params=Object.fromEntries(entryParameters(entry).map(name=>[name,NUMERIC_PARAMETERS.includes(name)?count:'USER {name} $&\nاسم']));
  const rendered=translator.message(language,key,params);assert.ok(rendered.trim(),key);assert.ok(arMessages[key]);
 }
 assert.equal(appMessage('validation.habit.nameLength',{limit:40}),'Keep the name under 40 characters.');
 assert.equal(appMessage('goals.list.activeCount',{count:1}),'1 active goal');
 assert.equal(appMessage('goals.list.activeCount',{count:2}),'2 active goals');
 assert.equal(appMessage('display.ratio',{value:1234,maximum:9999}),'1234/9999');
 assert.equal(appLabel('settings.english'),'English');
 const name='USER {name} $&\u0000localized-slot\u0000';const rich=appRich('insights.week.best',{name,done:1,total:3},'name');assert.equal(rich.parts.join(name),'Strongest: '+name+' · 1 of 3');
 assert.equal(typeof enMessages['backup.summary.habits'],'string');
});

test('Arabic full messages select correct six-form count phrases, fractions and named interpolation',()=>{
 const t=createTranslator({strict:true});const forms=[0,1,2,3,11,100].map(count=>t.message('ar','routines.card.habits',{count}));
 assert.deepEqual(forms,['لا عادات','عادة واحدة','عادتان','٣ عادات','١١ عادة','١٠٠ عادة']);
 assert.equal(t.message('ar','habits.tracking.steps',{count:2}),'خطوتان');
 assert.match(t.message('ar','habits.tracking.steps',{count:1.5}),/١٫٥/);
 assert.equal(t.message('ar','goals.delete.title',{name:'USER {x} $&'}),'حذف «USER {x} $&»؟');
});

test('known service errors retain identity, class, original message and classification; unknown native paths stay private',()=>{
 const error=new RecoveryBlocked('Original diagnostic');const same=withErrorMessage(error,{key:'backup-format.backupIsIncompleteOrChangedChecksumMismatch'});
 assert.equal(same,error);assert.ok(same instanceof RecoveryBlocked);assert.equal(error.message,'Original diagnostic');
 assert.equal(displayError(same,'fallback'),'Backup is incomplete or changed (checksum mismatch)');
 assert.equal(displayError(new Error('C:/private/SECRET.json'),'safe fallback'),'safe fallback');
});

test('Phase 3B/3C/4A reports/config/storage and validated Phase 4B-1 runtime/source fixtures remain byte-identical',()=>{
 const activated = new Set(['src/hooks/use-app-theme.ts','src/hooks/use-language.ts','src/hooks/use-preferences.tsx','src/data/preferences-store.ts','src/i18n/today.ts']);
 for(const [file,expected]of Object.entries(baseline.protectedFiles).filter(([file])=>!activated.has(file)))assert.equal(hash(readFileSync(file)),expected,file);
 assert.deepEqual(ACTIVE_PRESENTATION,{scheme:'dark',language:'en',direction:'ltr'});
});

test('all migrated screen/component stylesheet declarations retain checkpoint visual values',()=>{
 for(const [file,expected]of Object.entries(baseline.styles)){
  const source=readFileSync(file,'utf8'),tree=ts.createSourceFile(file,source,99,true,4),actual=[];function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(tree)==='StyleSheet.create')actual.push(ts.createPrinter().printNode(ts.EmitHint.Unspecified,n,tree));ts.forEachChild(n,visit);}visit(tree);assert.deepEqual(actual,expected,file);
 }
});

test('backup wire/recovery and business calculations retain their complete original AST after presentation annotations are removed',()=>{
 for(const [file,functions]of Object.entries(baseline.pure)){
  const source=readFileSync(file,'utf8'),tree=ts.createSourceFile(file,source,99,true);
  for(const [name,expected]of Object.entries(functions)){
   const node=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(node,name);
   const result=ts.transform(node,[context=>root=>{const visit=n=>{
    if(ts.isCallExpression(n)&&n.expression.getText(tree)==='withErrorMessage')return ts.visitNode(n.arguments[0],visit);
    if(ts.isCallExpression(n)&&n.expression.getText(tree)==='appLabel'&&ts.isStringLiteral(n.arguments[0]))return ts.factory.createStringLiteral(en[n.arguments[0].text]);
    if(ts.isStringLiteral(n))return ts.factory.createStringLiteral(n.text);
    return ts.visitEachChild(n,visit,context);
   };return ts.visitNode(root,visit);}]);
   const actual=ts.createPrinter({removeComments:true}).printNode(ts.EmitHint.Unspecified,result.transformed[0],tree);result.dispose();assert.equal(hash(actual),expected,`${file}:${name}`);
  }
 }
});

test('rendering every remaining message does not mutate records or backup v1 body/checksum',async()=>{
 const records=fullBackupRecords();const snapshot=structuredClone(records);const digest=async text=>hash(text);const date=new Date('2026-11-11T12:00:00.000Z');
 const before=await createBackup(records,digest,'1.0.0',date);const translator=createTranslator({strict:true});
 for(const [key,entry]of Object.entries(remainingEnMessages)){const params=Object.fromEntries(entryParameters(entry).map(name=>[name,NUMERIC_PARAMETERS.includes(name)?3:'raw {USER} $&']));for(const language of ['en','ar'])translator.message(language,key,params);}
 assert.deepEqual(records,snapshot);assert.equal(canonical(await createBackup(records,digest,'1.0.0',date)),canonical(before));assert.equal(before.backupVersion,1);
});
