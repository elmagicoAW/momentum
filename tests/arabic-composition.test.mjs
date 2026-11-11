import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {arabicComposition} from '../src/utils/arabic-composition.ts';

// Exercise small native presentation components without pretending to render Android pixels.
function loadComponent(file, mocks, development = true, warnings = []) {
 const output = ts.transpileModule(readFileSync(file,'utf8'), {
  compilerOptions: {module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022},
 }).outputText;
 const exports = {};
 new Function('require','exports','__DEV__','console',output)(name=>{
  assert.ok(name in mocks,`Unexpected dependency: ${name}`);return mocks[name];
 },exports,development,{warn:message=>warnings.push(message)});
 return exports;
}
test('Arabic composition groups compact metrics and gives text an intrinsic, right-anchored column',()=>{
 const normal=arabicComposition(390,1);assert.equal(normal.row.direction,'rtl');assert.equal(normal.row.flexDirection,'row');assert.equal(normal.title.textAlign,'start');assert.equal(normal.textColumn.flexBasis,'auto');assert.equal(normal.metric.flexBasis,0);assert.equal(normal.gridTile.flexBasis,'46%');assert.equal(normal.gridTile.minHeight,0);assert.equal(normal.ringSize,112);assert.equal(normal.progress.flexDirection,'row');
 const small=arabicComposition(320,1),large=arabicComposition(390,1.6);for(const layout of [small,large]){assert.equal(layout.progress.flexDirection,'column');assert.equal(layout.heading.flexDirection,'column');assert.equal(layout.metric.flexBasis,'100%');assert.equal(layout.ringSize,96);}
});
test('major screens and forms apply Arabic composition conditionally and retain original English stylesheet declarations',()=>{
 for(const file of ['src/app/(tabs)/index.tsx','src/app/(tabs)/habits/index.tsx','src/app/(tabs)/goals/index.tsx','src/app/(tabs)/insights/index.tsx','src/app/(tabs)/settings.tsx',...['habits/habit','goals/goal','routines/routine','profile/profile'].map(f=>'src/components/'+f+'-form.tsx')]){
  const s=readFileSync(file,'utf8');assert.match(s,/arabic.active && arabic.surface/,file);assert.doesNotMatch(s,/row-reverse|scaleX/,file);
 }
 const today=readFileSync('src/app/(tabs)/index.tsx','utf8');assert.match(today,/arabic.active \? <View onLayout=/);assert.match(today,/: <View style=\{styles.progressCard\}>/);
 const settings=readFileSync('src/components/settings/settings-row.tsx','utf8');assert.match(settings,/arabic.settingsRow/);assert.match(settings,/textAlign:'start'/);
});
test('language uses globe icon and QA gear belongs exclusively to optional native DevMenu',()=>{
 const language=readFileSync('src/components/settings/language-selector.tsx','utf8');assert.match(language,/ios: 'globe', android: 'language'/);assert.doesNotMatch(language,/moon.fill|dark_mode/);
 const qa=readFileSync('src/components/dev-qa-tools.tsx','utf8');assert.match(qa,/!__DEV__ \|\| Platform.OS !== 'android'/);assert.match(qa,/'ExpoDevMenu'/);assert.match(qa,/setToolsButtonVisible\(false\)/);assert.match(qa,/catch/);assert.doesNotMatch(qa,/AsyncStorage|reload|forceRTL|persistence|router\./);
 const root=readFileSync('src/app/_layout.tsx','utf8');assert.match(root,/<\/ProfileProvider>\s*<DevQaTools \/>/,'Append the null-rendering helper after the existing provider subtree to retain sibling positions.');
});

test('numeric presentation isolates whole Arabic values at the requested edge and preserves English and mixed names',async()=>{
 let language='ar';
 const presentation=await import('../src/utils/rtl-presentation.ts');
 const {NumericText,Text}=loadComponent('src/components/localized-native.tsx',{
  'react-native':{Platform:{OS:'android'},Text:'NativeText',TextInput:'NativeInput',StyleSheet:{flatten:style=>Object.assign({},...[style].flat(Infinity).filter(Boolean))}},
  'expo-symbols':{SymbolView:'NativeSymbol'},
  'react/jsx-runtime':{jsx:(type,props)=>({type,props})},
  '@/hooks/use-presentation-language':{usePresentationLanguage:()=>language},
  '@/utils/rtl-presentation':presentation,
 });
 const style={fontSize:26,color:'#fff'};
 for(const value of ['٨٣٪','١٢ / ٣٤','+12','—']) {
  const ar=NumericText({children:value,align:'start',style});
  assert.equal(ar.props.children,'\u2066'+value+'\u2069');
  assert.deepEqual(ar.props.style[1],{direction:'ltr',writingDirection:'ltr',textAlign:'end',flexShrink:0});
  language='en';const en=NumericText({children:value,align:'start',style});
  assert.equal(en.props.children,value);assert.equal(en.props.style[0],style);assert.equal(en.props.style[1],false);
  language='ar';
 }
 const raw='Hello مرحبا 123';
 const mixed=NumericText({children:raw,style});assert.equal(mixed.type,Text);assert.equal(mixed.props.children,raw);
 assert.equal(Text(mixed.props).props.children,raw);
});

test('QA tools hide only Android debug DevMenu gear and tolerate missing/rejected native capabilities',async()=>{
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 for(const scenario of ['android','ios','release','missing','legacy','rejected']) {
  const calls=[],warnings=[];
  const module=scenario==='missing'?null:scenario==='legacy'?{}:{setToolsButtonVisible:async visible=>{
   calls.push(visible);if(scenario==='rejected')throw Error('Native capability unavailable');
  }};
  const {DevQaTools}=loadComponent('src/components/dev-qa-tools.tsx',{
   react:{useEffect:effect=>effect()},'react-native':{Platform:{OS:scenario==='ios'?'ios':'android'}},
   expo:{requireOptionalNativeModule:name=>{assert.equal(name,'ExpoDevMenu');return module;}},
  },scenario!=='release',warnings);
  assert.equal(DevQaTools(),null);await settle();
  assert.deepEqual(calls,['android','rejected'].includes(scenario)?[false]:[]);
  assert.equal(warnings.length,scenario==='rejected'?1:0);
 }
});
