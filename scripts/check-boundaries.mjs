import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
let imports = 0;
const errors = [];
const layers = {
  'shared-types': [], config: ['shared-types'], protocol: ['shared-types', 'config'],
  'backend-interface': ['shared-types'], 'transport-interface': ['shared-types', 'protocol'],
  'game-core': ['shared-types'], 'network-core': ['shared-types', 'protocol', 'transport-interface', 'backend-interface'],
  'host-core': ['shared-types', 'config'], matchmaking: ['shared-types', 'config'],
  'community-provider': ['shared-types', 'config', 'backend-interface', 'host-core', 'matchmaking'],
  'arena-2d': ['shared-types', 'game-core'],
};
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(resolve(directory, entry.name)) : [resolve(directory, entry.name)]);
}
for (const parent of ['packages', 'games']) for (const entry of readdirSync(resolve(root, parent))) {
  const directory = resolve(root, parent, entry);
  const pkg = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  const allowed = layers[entry];
  if (!allowed) { errors.push(`Defina a fronteira do módulo ${entry}.`); continue; }
  for (const file of walk(resolve(directory, 'src')).filter(f => f.endsWith('.ts'))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      let specifier;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) specifier = node.arguments[0];
      if (specifier) {
        imports++;
        if (!ts.isStringLiteral(specifier)) errors.push(`${relative(root, file)}: import dinâmico não auditável.`);
        else {
          const name = specifier.text;
          if (name.startsWith('.')) {
            if (!resolve(file, '..', name).startsWith(directory + sep)) errors.push(`${entry}: import relativo atravessa pacote: ${name}`);
          } else if (!name.startsWith('@countryballs/') || !allowed.includes(name.slice(14)) || !pkg.dependencies?.[name]) {
            errors.push(`${entry}: dependência proibida ou não declarada: ${name}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Fronteiras verificadas: ${Object.keys(layers).length} módulos, ${imports} imports/exports.`);
