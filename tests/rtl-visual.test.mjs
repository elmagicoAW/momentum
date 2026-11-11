import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {directionStyles} from '../src/utils/direction-styles.ts';
import {numericRun,isNumericDisplay,textAlignment,stackProgress} from '../src/utils/rtl-presentation.ts';
import {applyPresentationLanguage} from '../src/utils/presentation.ts';
import {appLabel} from '../src/i18n/app-copy.ts';
test('RTL spacing leaves geometry, ring borders, direction and text policy untouched',()=>{
 const source={row:{marginLeft:8,paddingRight:12,flexDirection:'row'},arc:{position:'absolute',left:-74,borderLeftColor:'#fff',transform:[{rotate:'90deg'}]},text:{textAlign:'center'}};
 const before=JSON.stringify(source),rtl=directionStyles(source,true);
 assert.equal(rtl.row.marginStart,8);assert.equal(rtl.row.paddingEnd,12);assert.equal(rtl.row.flexDirection,'row');assert.deepEqual(rtl.arc,source.arc);assert.equal(rtl.row.direction,undefined);assert.equal(rtl.text.textAlign,'center');assert.equal(directionStyles(source,false),source);assert.equal(JSON.stringify(source),before);assert.equal(directionStyles(source,true),rtl);
});
test('alignment mirrors logical text once and preserves explicit centering and English',()=>{
 assert.equal(textAlignment(true),'right');assert.equal(textAlignment(true,'right'),'left');assert.equal(textAlignment(true,'center'),'center');assert.equal(textAlignment(false,'right'),'right');assert.equal(textAlignment(false,'auto'),'auto');assert.equal(textAlignment(true,'start'),'right');assert.equal(textAlignment(true,'end'),'left');
});
test('complete numeric runs isolate percent and ratio order without treating mixed user text as numbers',()=>{
 for(const value of ['٨٣٪','١٢ / ٣٤','-١٫٥','١٬٢٣٤','+12']){assert.ok(isNumericDisplay(value));assert.equal(numericRun(value,true),'\u2066'+value+'\u2069');assert.equal(numericRun(value,false),value);}
 for(const name of ['Hello مرحبا 123','Morning walk','٣ خطوات'])assert.equal(isNumericDisplay(name),false);
 const raw='Hello مرحبا 123';numericRun(raw,true);assert.equal(raw,'Hello مرحبا 123');
});
test('Arabic progress stacks on compact or large-type screens; English keeps its layout',()=>{
 assert.equal(stackProgress(true,320,1),true);assert.equal(stackProgress(true,420,1),true);assert.equal(stackProgress(true,700,1.5),true);assert.equal(stackProgress(true,700,1),false);assert.equal(stackProgress(false,320,2),false);
});
test('key screen layout boundaries protect wrapping, geometry and numeric presentation',()=>{
 const source=f=>readFileSync(f,'utf8');
 assert.match(source('src/app/(tabs)/index.tsx'),/stackProgress/);
 assert.match(source('src/app/(tabs)/index.tsx'),/setProgressWidth\(event.nativeEvent.layout.width\)/);
 assert.match(source('src/components/today/progress-ring.tsx'),/direction: 'ltr'/);
 assert.match(source('src/components/today/progress-ring.tsx'),/NumericText/);
 assert.match(source('src/components/settings/settings-row.tsx'),/language === 'ar' \? <View/);
 for(const f of ['stat-tile','habit-insight-row','weekly-review-card']){const s=source(`src/components/insights/${f}.tsx`);assert.match(s,/NumericText/);assert.match(s,/flexBasis:'100%'/);}
 assert.match(source('src/components/goals/consistency-summary.tsx'),/NumericText/);
 const input=source('src/components/localized-native.tsx');assert.doesNotMatch(input,/normalize|onChangeText=|value=/);
});
test('tracking metadata resolves current Arabic and returns to English without module reload',async()=>{
 const source=readFileSync('src/components/habits/tracking-type-picker.tsx','utf8');assert.match(source,/get label\(\)/);assert.match(source,/get hint\(\)/);
 try{applyPresentationLanguage('ar');assert.notEqual(appLabel('habits.tracking-type-picker.tick'),'Tick');applyPresentationLanguage('en');assert.equal(appLabel('habits.tracking-type-picker.tick'),'Tick');}finally{applyPresentationLanguage('en');}
});
