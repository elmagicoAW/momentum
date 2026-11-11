import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { pluralCategory } from '../src/i18n/format.ts';

test('English/Arabic cardinal rules agree with CLDR Intl reference across integers and fractions', () => {
  for (const language of ['en', 'ar']) {
    const reference = new Intl.PluralRules(language, { maximumFractionDigits: 20 });
    for (const value of [...Array.from({ length: 2001 }, (_, i) => i - 1000), 0.0001, 1.5, 2.5, 3.5, 11.5, 103.5, 1000000]) {
      assert.equal(pluralCategory(language, value), reference.select(value), `${language}:${value}`);
    }
  }
  assert.throws(() => pluralCategory('en', Infinity), RangeError);
});

for (const missing of ['PluralRules', 'NumberFormat', 'DateTimeFormat', 'all']) {
  test(`Android-like runtime without Intl ${missing}: Today, catalogs, numbers and Gregorian dates still render`, () => {
    const script = `
      import assert from 'node:assert/strict';
      const number = (l, n, percent = false) => new Intl.NumberFormat(l === 'ar' ? 'ar-EG' : 'en-US', {
        numberingSystem: l === 'ar' ? 'arab' : 'latn',
        ...(percent ? {style:'percent', maximumFractionDigits:0} : {maximumFractionDigits:20})
      }).format(n);
      const values = [0, -0, 1, -1, 1234.5, -1234.5, 0.0001, 1e-21, 1e21, 0.834, 0.835, 1.005];
      const expected = ['en','ar'].flatMap(l => values.flatMap(n => [false,true].map(p => [l,n,p,number(l,n,p)])));
      if (${JSON.stringify(missing)} === 'all') globalThis.Intl = undefined;
      else Intl[${JSON.stringify(missing)}] = undefined;
      const f = await import('./src/i18n/format.ts');
      const today = await import('./src/i18n/today.ts');
      const {enMessages} = await import('./src/i18n/en-messages.ts');
      const {entryParameters} = await import('./src/i18n/catalog.ts');
      const {NUMERIC_PARAMETERS} = await import('./src/i18n/types.ts');
      const {createTranslator} = await import('./src/i18n/translate.ts');
      const translator = createTranslator({strict:true});
      for (const [l,n,p,text] of expected) assert.equal(p ? f.formatPercent(l,n) : f.formatNumber(l,n), text, l+':'+n+':'+p);
      for (const l of ['en','ar']) {
        for (const count of [0,1,2,3,10,11,99,100,103,111,1.5]) {
          for (const [key, entry] of Object.entries(enMessages)) {
            const params = Object.fromEntries(entryParameters(entry).map(p => [p, NUMERIC_PARAMETERS.includes(p) ? count : 'USER {name}']));
            assert.equal(typeof translator.message(l,key,params), 'string');
          }
          assert.equal(typeof today.todayCopy(l).m('today.remainingCount',{count}), 'string');
        }
      }
      assert.equal(f.formatLocalDate('en','2028-02-29'),'February 29, 2028');
      assert.equal(f.formatLocalDate('ar','2028-02-29'),'٢٩ فبراير ٢٠٢٨');
      assert.equal(f.formatLocalMonth('en','2026-12-01'),'December 2026');
      assert.equal(f.formatLocalWeekday('ar','2026-11-09'),'الاثنين');
      assert.equal(today.todayDate('en',new Date(2026,10,11)),'WEDNESDAY, NOVEMBER 11');
      assert.equal(today.todayDate('ar',new Date(2026,10,11)),'الأربعاء، ١١ نوفمبر');
      assert.throws(() => f.formatLocalDate('en','2026-02-30'), RangeError);
      assert.throws(() => f.formatNumber('ar',NaN), RangeError);
    `;
    assert.doesNotThrow(() => execFileSync(process.execPath, ['--import', './tests/support/register.mjs', '--input-type=module', '-e', script], { cwd: process.cwd(), encoding: 'utf8' }));
  });
}
