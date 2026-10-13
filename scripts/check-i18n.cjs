// Check authored interface literals. Enum values, technical identifiers, user
// content and report text are intentionally outside this display-only check.
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const props = new Set(['label', 'title', 'placeholder', 'aria-label', 'ariaLabel', 'alt', 'description', 'emptyText', 'emptyMessage', 'searchPlaceholder', 'statsLabel', 'loadingLabel', 'unit', 'hint', 'tooltip', 'subtitle', 'content', 'confirmLabel', 'cancelLabel']);
const failures = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!file.endsWith('.tsx') || file.includes('.test.')) continue;
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      const literal = ts.isJsxText(node) ? node.text : ts.isJsxAttribute(node) && props.has(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer) ? node.initializer.text : '';
      if (/[\u4e00-\u9fff]/.test(literal)) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        failures.push(`${file}:${line}: ${literal.trim()}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
walk('src');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log('No hardcoded Chinese interface literals.');
