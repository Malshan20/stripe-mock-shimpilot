import { rmSync,existsSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
const database=resolve(process.env.DATABASE_PATH || '.data/demo.sqlite');
const allowed=resolve('.data');
if(database!==resolve(allowed,'demo.sqlite')) throw new Error('Reset only supports default .data/demo.sqlite; custom paths must be managed explicitly');
for(const suffix of ['', '-wal', '-shm']) if(existsSync(database+suffix)) rmSync(database+suffix);
rmSync(resolve(dirname(database),'files'),{recursive:true,force:true});
console.log('Local database and local uploads reset. Remote resources are untouched. Stop the app before running this command.');
