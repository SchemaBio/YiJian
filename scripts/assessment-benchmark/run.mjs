// Reuse the repository's locked Vitest -> Vite dependency without resolving or
// downloading any additional packages (including private GitHub dependencies).
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const fromVitest=createRequire(require.resolve('vitest/package.json'));
const vite=await import(pathToFileURL(resolve(dirname(fromVitest.resolve('vite/package.json')),'dist/node/index.js')).href);
const configFile=resolve('scripts/assessment-benchmark/vite.config.ts');
if(process.argv[2]==='build')await vite.build({configFile});
else if(process.argv[2]==='serve'){const server=await vite.preview({configFile});server.printUrls();}
else throw new Error('Usage: node scripts/assessment-benchmark/run.mjs build|serve');
