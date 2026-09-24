// Restore the build inputs from the already-published lossless packet.
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const root=new URL('../',import.meta.url),published=new URL('../../rally/',import.meta.url);
const names=(await readdir(published)).filter(f=>/^data-\d+\.js$/.test(f)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));
const hex=(await Promise.all(names.map(n=>readFile(new URL(n,published),'utf8')))).map(t=>t.match(/push\("([0-9a-f]+)"\)/)[1]).join('');
const raw=gunzipSync(Buffer.from(hex,'hex')),length=raw.readUInt32LE(0),meta=JSON.parse(raw.subarray(4,4+length));
await mkdir(new URL('public/assets/',root),{recursive:true});
for(const [name,[offset,size]]of Object.entries(meta.files))if(name.startsWith('assets/'))await writeFile(new URL(`public/${name}`,root),raw.subarray(4+length+offset,4+length+offset+size));
console.log('Restored packaged physics assets and policy.');
