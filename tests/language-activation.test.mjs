import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createPreferencesStore } from '../src/data/preferences-store.ts';
import { createLanguageEditor } from '../src/utils/language-editor.ts';
import { applyPresentationLanguage, ACTIVE_PRESENTATION } from '../src/utils/presentation.ts';
import { appLabel } from '../src/i18n/app-copy.ts';
import { describeSchedule, WEEKDAY_LONG } from '../src/utils/schedule.ts';
import { directionStyles } from '../src/utils/direction-styles.ts';
test('hydration, save-first language, retry, cancel, busy and rapid taps preserve appearance and apply only persisted values',async()=>{
 let stored={appearance:'system',language:'en'};let fail=true, writes=0;const applied=[];
 const store=createPreferencesStore({load:async()=>stored,save:async value=>{writes++;assert.equal(ACTIVE_PRESENTATION.language,'en');if(fail)throw Error('disk');stored=value;},onAppliedLanguage:language=>{applied.push(language);applyPresentationLanguage(language);}});
 try{
  await store.load();const editor=createLanguageEditor({getPreferences:store.getSnapshot,save:language=>store.update({language})});
  editor.open();editor.choose('ar');editor.cancel();assert.equal(writes,0);assert.equal(ACTIVE_PRESENTATION.language,'en');
  editor.setBackupBusy(true);editor.open();assert.equal(editor.getSnapshot().open,false);editor.setBackupBusy(false);
  editor.open();editor.choose('ar');await editor.save();assert.equal(editor.getSnapshot().failed,true);assert.equal(ACTIVE_PRESENTATION.language,'en');assert.equal(stored.language,'en');
  fail=false;await Promise.all([editor.save(),editor.save()]);assert.equal(writes,2);assert.equal(stored.appearance,'system');assert.equal(stored.language,'ar');assert.equal(ACTIVE_PRESENTATION.direction,'rtl');assert.deepEqual(applied,['en','ar']);
  assert.equal(appLabel('navigation.today'),'اليوم');assert.notEqual(WEEKDAY_LONG[1],'Monday');assert.notEqual(describeSchedule({kind:'daily'}),'Every day');
  applyPresentationLanguage('en');const restarted=createPreferencesStore({load:async()=>stored,onAppliedLanguage:applyPresentationLanguage});await restarted.load();assert.equal(ACTIVE_PRESENTATION.language,'ar');assert.equal(restarted.getSnapshot().preferences.appearance,'system');
 }finally{applyPresentationLanguage('en');}
});
test('direction styles are presentation-only; mixed input is not normalized or rewritten',()=>{
 const source={row:{marginLeft:12,paddingRight:8,textAlign:'left'}};const original=JSON.stringify(source);const rtl=directionStyles(source,true);assert.equal(rtl.row.marginStart,12);assert.equal(rtl.row.textAlign,'left');assert.equal(JSON.stringify(source),original);assert.equal(directionStyles(source,false),source);
 const primitive=readFileSync('src/components/localized-native.tsx','utf8');assert.match(primitive,/writingDirection: 'auto'/);assert.doesNotMatch(primitive,/normalize|onChangeText=|value=/);
 const layout=readFileSync('src/components/app-presentation.tsx','utf8');assert.match(layout,/LocaleProvider direction=\{direction\}/);assert.doesNotMatch(layout,/key=|reload|forceRTL/);
 const selector=readFileSync('src/components/settings/language-selector.tsx','utf8');assert.match(selector,/updatePreferences\(\{ language \}\)/);assert.match(selector,/onRequestClose=\{editor.cancel\}/);
});
