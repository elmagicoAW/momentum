// Generates ONLY synthetic files in a new temp folder. Does not touch app data.
// Run: node --import ./tests/support/register.mjs scripts/create-backup-test-files.mjs
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBackup,LIMITS} from '../src/data/backup-format.ts';
import {fullBackupRecords} from '../tests/support/backup-fixtures.mjs';
const hash=async(s)=>createHash('sha256').update(s).digest('hex');
const folder=mkdtempSync(join(tmpdir(),'momentum-SYNTHETIC-backups-'));
const backup=await createBackup(fullBackupRecords(),hash);
const write=(name,value)=>writeFileSync(join(folder,name),typeof value==='string'?value:JSON.stringify(value),'utf8');
write('TEST-valid.json',backup);
write('TEST-empty.json',await createBackup([],hash));
write('TEST-archive-only.json',await createBackup([{key:'momentum:profile:v1',raw:'corrupt synthetic record'}],hash));
write('TEST-unsupported.json',{...backup,backupVersion:999});
write('TEST-bad-checksum.json',{...backup,integrity:{algorithm:'SHA-256',digest:'0'.repeat(64)}});
write('TEST-truncated.json','{"format":"momentum.local-backup"');
write('TEST-oversized.json',' '.repeat(LIMITS.file+1));
console.log(`Synthetic test files: ${folder}\nOn your main phone: export/preview/cancel ONLY. Replace data only in an isolated disposable sandbox.`);
