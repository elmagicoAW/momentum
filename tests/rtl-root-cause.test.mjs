import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {textAlignment,inputTextAlignment} from '../src/utils/rtl-presentation.ts';
import {arabicTodayProgress} from '../src/utils/today-presentation.ts';
import {todayCopy,todayMessage,todayAchievementProgress,todayBadgeName} from '../src/i18n/today.ts';
import {ACHIEVEMENTS} from '../src/data/achievement-definitions.ts';

// Reference model of the inspected RN 0.88 Android algorithm, NOT a native rendering test.
function androidEdge(alignment, paragraphRTL, scriptRTL) {
 if(alignment==='center')return 'center';
 const swapped=paragraphRTL!==scriptRTL;
 const opposite=['right','end'].includes(alignment)?!swapped:swapped;
 return opposite?(scriptRTL?'left':'right'):(scriptRTL?'right':'left');
}
const flattenStyle=style=>Object.assign({},...[style].flat(Infinity).filter(Boolean));
const jsx=(type,props)=>({type,props});
function load(file,mocks) {
 const output=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',output)(name=>{assert.ok(name in mocks,`Unexpected import ${name}`);return mocks[name];},exports);return exports;
}
const nodes=value=>[value].flat(Infinity).filter(v=>v!==false&&v!==null&&v!==undefined);

test('Android paragraph contract exposes the old double resolution; logical encoding retains physical intent',()=>{
 const native=readFileSync('node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/views/text/TextLayoutManager.kt','utf8');
 assert.match(native,/isParagraphRTL != isScriptRTL/);assert.match(native,/alignmentAttr == "right" \|\| alignmentAttr == "end"/);
 for(const scriptRTL of [true,false]) {
  assert.equal(androidEdge('right',true,scriptRTL),'left','old wrapper prop reaches the wrong edge');
  for(const paragraphRTL of [true,false])for(const [intent,edge]of [[undefined,'right'],['start','right'],['right','right'],['end','left'],['left','left'],['center','center']]) {
   assert.equal(androidEdge(textAlignment(true,intent,'android',paragraphRTL),paragraphRTL,scriptRTL),edge);
  }
 }
 for(const platform of ['android','ios','web'])for(const [intent,expected]of [[undefined,'left'],['auto','auto'],['left','left'],['right','right'],['start','left'],['end','right'],['center','center'],['justify','justify']]) {
  assert.equal(textAlignment(false,intent,platform),expected,'English props remain unchanged');
 }
 assert.equal(textAlignment(true,'right','ios'),'right');assert.equal(textAlignment(true,'left','web'),'left');
 assert.equal(textAlignment(true,'justify','android'),'justify');
});

test('Text knows its paragraph direction; Input keeps its distinct contract; center, numbers and mixed values survive',()=>{
 let language='ar',platform='android';
 const native={Platform:{get OS(){return platform;}},Text:'NativeText',TextInput:'NativeInput',StyleSheet:{flatten:flattenStyle}};
 const {Text,TextInput,NumericText,SymbolView}=load('src/components/localized-native.tsx',{
  'react-native':native,'expo-symbols':{SymbolView:'NativeSymbol'},'react/jsx-runtime':{jsx},
  '@/hooks/use-presentation-language':{usePresentationLanguage:()=>language},
  '@/utils/rtl-presentation':{textAlignment,inputTextAlignment,isNumericDisplay:t=>/^[\d٠-٩٪/ ]+$/.test(t),numericRun:(t,rtl)=>rtl?'\u2066'+t+'\u2069':t},
 });
 for(const component of [Text]) {
  const value='Hello مرحبا 123',onChangeText=()=>{};
  const ar=component({children:value,value,onChangeText,style:{textAlign:'right'}});
  const style=flattenStyle(ar.props.style);assert.equal(style.direction,'rtl');assert.equal(style.textAlign,'start');assert.equal(ar.props.value,value);assert.equal(ar.props.onChangeText,onChangeText);
  assert.equal(flattenStyle(component({style:{textAlign:'center'}}).props.style).textAlign,'center');
  assert.equal(flattenStyle(component({style:{direction:'ltr',textAlign:'right'}}).props.style).textAlign,'end');
  language='en';const en=flattenStyle(component({style:{fontSize:14,textAlign:'right'}}).props.style);assert.equal(en.textAlign,'right');assert.equal(en.direction,undefined);language='ar';
 }
 const originalInput=(rtl,explicit)=>explicit==='start'?(rtl?'right':'left'):explicit==='end'?(rtl?'left':'right'):!rtl?(explicit??'left'):['center','justify'].includes(explicit)?explicit:explicit==='right'?'left':'right';
 for(const rtl of [true,false])for(const intent of [undefined,'auto','left','right','center','justify','start','end'])assert.equal(inputTextAlignment(rtl,intent),originalInput(rtl,intent));
 const raw='Hello مرحبا 123',onChangeText=()=>{};
 const input=TextInput({value:raw,onChangeText});assert.deepEqual(flattenStyle(input.props.style),{textAlign:'right',writingDirection:'auto'});assert.equal(input.props.value,raw);assert.equal(input.props.onChangeText,onChangeText);
 for(const align of ['start','center','end']) {
  const number=NumericText({children:'٤ / ٤',align});const style=flattenStyle(number.props.style);
  assert.equal(style.direction,'ltr');assert.equal(style.writingDirection,'ltr');assert.equal(number.props.children,'\u2066٤ / ٤\u2069');
  assert.equal(androidEdge(style.textAlign,false,false),align==='start'?'right':align==='end'?'left':'center');
 }
 const arrow=SymbolView({name:{android:'chevron_right'}});assert.deepEqual(flattenStyle(arrow.props.style).transform,[{scaleX:-1}]);
 language='en';assert.equal(flattenStyle(SymbolView({name:{android:'chevron_right'}}).props.style).transform,undefined);
 assert.equal(NumericText({children:'4 / 4'}).props.children,'4 / 4');
 platform='ios';language='ar';assert.equal(flattenStyle(Text({style:{textAlign:'start'}}).props.style).textAlign,'right');
});

test('progress uses measured card space and font scale, starts safely, and reflows after width changes',()=>{
 assert.equal(arabicTodayProgress(null,1).stacked,true);
 assert.equal(arabicTodayProgress(320,1).stacked,true);
 assert.equal(arabicTodayProgress(350,1).stacked,false);
 assert.equal(arabicTodayProgress(350,1.5).stacked,true);
 assert.equal(arabicTodayProgress(350,1).captionBelow,false);
 assert.equal(arabicTodayProgress(350,1.5).captionBelow,true);
 assert.equal(arabicTodayProgress(600,1.5).stacked,false);
 for(const width of [200,260,320,350,420,600,800])for(const scale of [1,1.3,1.6,2,3]) {
  const layout=arabicTodayProgress(width,scale);assert.ok(layout.ringSize<=width-34);
  if(!layout.stacked)assert.ok(width-34-layout.ringSize-16>=176*scale);
  assert.equal(layout.text.flexGrow,layout.stacked?0:1);assert.equal(layout.container.flexDirection,layout.stacked?'column':'row');
 }
 const route=readFileSync('src/app/(tabs)/index.tsx','utf8');
 assert.match(route,/arabicTodayProgress\(progressWidth, fontScale\)/);assert.match(route,/event.nativeEvent.layout.width/);assert.match(route,/Math.abs\(previous - width\) < 0.5/);
 assert.match(route,/styles.date, arabic.active && arabic.title/);assert.match(route,/styles.greeting, arabic.active && arabic.title/);
 assert.match(route,/: <View style=\{styles.progressCard\}>/,'original English progress branch retained');
 const ring=readFileSync('src/components/today/progress-ring.tsx','utf8');
 assert.match(ring,/captionBelow = false/);assert.match(ring,/!captionBelow && <Text/);assert.match(ring,/maxFontSizeMultiplier=\{1.2\}/);
});

test('Arabic achievements group heading then count, badge strip, summary and action; English grouping stays intact',()=>{
 let language='ar';
 const collection={awards:Object.fromEntries(ACHIEVEMENTS.slice(0,2).map((badge,i)=>[badge.id,{awardedAt:`2026-11-0${i+1}`,source:'backfill'}])),seenBadgeIds:[]};
 const before=JSON.stringify(collection),evaluation={metrics:Object.fromEntries(ACHIEVEMENTS.map(b=>[b.metric,0]))};
 const {AchievementsSummaryCard}=load('src/components/achievements/achievements-summary-card.tsx',{
  'react-native':{Pressable:'Pressable',View:'View',StyleSheet:{create:s=>s}},'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'Fragment'},
  '@/components/localized-native':{Text:'Text',SymbolView:'Symbol'},
  '@/hooks/use-app-styles':{useAppStyles:()=>({styles:new Proxy({},{get:(_,key)=>key}),palette:{accent:'accent',accentBlue:'blue'}})},
  '@/hooks/use-language':{useLanguage:()=>({language})},'@/i18n/today':{todayCopy,todayAchievementProgress,todayBadgeName},
  '@/constants/theme':{Radius:{}},'@/data/achievement-definitions':{ACHIEVEMENTS},
  '@/data/habit-options':{habitIconSymbol:icon=>icon},
  '@/hooks/use-achievements':{useAchievements:()=>({collection,storeReady:true,status:'ready',evaluation,acknowledge:()=>{throw Error('render must not acknowledge');}})},
  '@/hooks/use-daily-progress':{useDailyProgress:()=>({status:'ready'})},'@/hooks/use-habits':{useHabits:()=>({habits:[],status:'ready'})},
  '@/utils/achievements':{hasProvisionalEffort:()=>false},'@/utils/navigation':{openAchievements:()=>{throw Error('render must not navigate');}},
 });
 const body=()=>nodes(nodes(AchievementsSummaryCard({}).props.children)[0].props.children)[0].props.children;
 const ar=nodes(body()),heading=nodes(ar[0].props.children),headingText=nodes(heading[0].props.children);
 assert.equal(headingText[1].props.children,todayCopy('ar').t('navigation.achievements'));assert.equal(heading[1].props.name.android,'chevron_right');
 assert.equal(ar[1].type,'Text');assert.equal(ar[2].props.importantForAccessibility,'no-hide-descendants');assert.equal(ar[2].props.style[1].direction,'rtl');
 assert.equal(ar.at(-1).props.children,todayCopy('ar').t('today.achievement.view'));
 language='en';const en=nodes(body());assert.equal(nodes(en[0].props.children)[1].props.name.android,'north_east');
 assert.equal(en[1].props.children,'Achievements');assert.equal(en[2].props.style,'row');assert.equal(nodes(en[2].props.children)[1].props.style,'symbols');
 assert.equal(JSON.stringify(collection),before);
});

test('progress is a complete natural Arabic sentence with unchanged English and parameter semantics',()=>{
 assert.equal(todayMessage('ar','today.progress',{completed:4,total:4}),'أكملت ٤ من أصل ٤ اليوم.');
 assert.equal(todayMessage('en','today.progress',{completed:4,total:4}),'4 of 4 habits');
});
