// Inventory only. --write refreshes the root JSON artifact; otherwise prints JSON to stdout.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { sourceTextHash } from './source-text-hash.mjs';
import path from 'node:path';
import ts from 'typescript';

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory()
  ? walk(path.join(dir, e.name)) : [path.join(dir, e.name).replaceAll('\\', '/')]);
const files = walk('src').filter((file) => /\.tsx?$/.test(file)).sort();
const roots = files.filter((file) => file.startsWith('src/app/'));
const trees = new Map(files.map((file) => [file, ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true,
  file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)]));
const imports = new Map();
for (const [file, tree] of trees) {
  const edges = new Set();
  function visit(node) {
    const source = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier :
      ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(tree) === 'require') ? node.arguments[0] : null;
    if (source && ts.isStringLiteral(source)) {
      const name = source.text;
      const base = name.startsWith('@/') ? `src/${name.slice(2)}` : name.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), name)) : null;
      if (base) for (const extension of ['', '.ts', '.tsx', '.native.ts', '.native.tsx', '.web.ts', '.web.tsx', '/index.ts', '/index.tsx']) {
        if (trees.has(base + extension)) edges.add(base + extension);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); imports.set(file, [...edges]);
}
const reachable = new Set();
function reach(file) { if (reachable.has(file)) return; reachable.add(file); for (const target of imports.get(file) ?? []) reach(target); }
roots.forEach(reach);
const inventory = [];
for (const [file, tree] of trees) {
  const candidates = [];
  if (!file.startsWith('src/i18n/')) {
    function visit(node) {
      let text;
      if (ts.isJsxText(node)) text = node.text.replace(/\s+/g, ' ').trim();
      else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
      else if (ts.isTemplateExpression(node)) text = node.getText(tree).slice(1, -1);
      if (text && /[A-Za-z\u0600-\u06ff]/.test(text)) {
        const parent = node.parent;
        const attribute = ts.isJsxAttribute(parent) ? parent.name.getText(tree) : null;
        const key = ts.isPropertyAssignment(parent) ? parent.name.getText(tree) : null;
        let ancestor = parent;
        while (ancestor && !ts.isCallExpression(ancestor) && !ts.isNewExpression(ancestor) && !ts.isJsxAttribute(ancestor)) ancestor = ancestor.parent;
        const call = ancestor && (ts.isCallExpression(ancestor) || ts.isNewExpression(ancestor)) ? ancestor.expression.getText(tree) : '';
        const typeOnly = ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isLiteralTypeNode(parent) ||
          (ts.isPropertyAssignment(parent) && parent.name === node) || ts.isImportTypeNode(parent);
        const explicit = attribute && /^(title|label|placeholder|accessibilityLabel|accessibilityHint|actionLabel|description|footer|text|value)$/.test(attribute);
        const prose = /[A-Za-z]+[ ,.?!:;—–’'\n]+[A-Za-z]|^[A-Z][a-z]+(?:[A-Z][a-z]+)*$/.test(text);
        const error = /Error$|Alert\.alert|confirmDestructive/.test(call);
        if (!typeOnly && (ts.isJsxText(node) || explicit || prose || error)) {
          const kind = attribute?.startsWith('accessibility') ? 'accessibility' : explicit ? 'ui-prop' :
            ts.isJsxText(node) ? 'visible-jsx' : error ? 'error-or-dialog' :
            ['name', 'label', 'title', 'detail', 'criterion', 'group', 'description'].includes(key) ? 'metadata-or-user-default' :
              ts.isTemplateExpression(node) ? 'dynamic-template' : 'copy-or-technical-review';
          const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
          candidates.push({ line, kind, text });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  inventory.push({ file, sourceSha256: sourceTextHash(readFileSync(file, 'utf8')),
    reachable: reachable.has(file), imports: imports.get(file), candidates });
}
const report = {
  schemaVersion: 1,
  sourceHashPolicy: 'SHA-256 of UTF-8 source text with CRLF replaced by LF; no other normalization.',
  method: 'All Expo Router route files are roots; local static imports/re-exports/literal dynamic imports, including platform variants, form an intentionally conservative dependency graph. Type-only imports may overstate reachability. Candidates are not automatic translation instructions.',
  limitations: 'May include developer errors/identifiers/URLs and miss one-word lowercase copy, computed copy, OS-owned strings, external dependencies and arbitrary runtime imports. Dynamic JSX expressions require manual data-producer review. No user/device data is read.',
  summary: { sourceFiles: files.length, routeRoots: roots.length, reachableFiles: reachable.size,
    candidateFiles: inventory.filter((item) => item.candidates.length).length,
    candidates: inventory.reduce((sum, item) => sum + item.candidates.length, 0) },
  files: inventory,
};
const output = JSON.stringify(report, null, 2) + '\n';
if (process.argv.includes('--write')) {
  writeFileSync('LOCALIZATION_COPY_INVENTORY.json', output, 'utf8');
  console.log(JSON.stringify(report.summary));
} else console.log(output.trimEnd());
