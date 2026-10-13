import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join,relative} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
function collect(directory){return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?collect(join(directory,entry.name)):entry.isFile()&&entry.name.endsWith('.js')?[join(directory,entry.name)]:[]);}
const files=[join(root,'server.js'),...['public','lib','scripts','tests'].flatMap(dir=>collect(join(root,dir)))].sort();
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.error||result.status!==0){console.error('Syntax check failed:',relative(root,file));process.exit(1);}}
console.log(`JavaScript syntax verified: ${files.length} files.`);
