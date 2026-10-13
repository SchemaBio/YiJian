const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const entries = new Map();
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(name);
    else if (/\.(tsx|ts)$/.test(name) && !/\.test\.|i18n[\\/]|privacy-policy/.test(name)) {
      const source = ts.createSourceFile(name, fs.readFileSync(name, 'utf8'), ts.ScriptTarget.Latest, true);
      function visit(node) {
        if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) && /[\u4e00-\u9fff]/.test(node.text)) {
          const text = node.text.trim();
          const loc = source.getLineAndCharacterOfPosition(node.getStart());
          const list = entries.get(text) || [];
          list.push(`${name.replaceAll('\\','/')}:${loc.line + 1}:${ts.SyntaxKind[node.kind]}`);
          entries.set(text,list);
        }
        ts.forEachChild(node,visit);
      }
      visit(source);
    }
  }
}
walk('src');
if (process.argv.includes('--json')) process.stdout.write(JSON.stringify([...entries].map(([text, locations])=>({text,locations})),null,2));
else console.log(`${entries.size} unique Chinese strings`, [...entries].slice(0,50));
