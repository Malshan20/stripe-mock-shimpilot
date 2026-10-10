import {readFileSync} from 'node:fs';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
console.table(['stripe','openai','@supabase/supabase-js','@anthropic-ai/sdk','aws-sdk'].map(name=>({package:name,declared:pkg.dependencies[name],resolved:lock.packages[`node_modules/${name}`]?.version ?? 'unresolved'})));
console.log('Fixture expectations: docs/SHIMPILOT-DEMO.md. These are not Shimpilot scan results.');
