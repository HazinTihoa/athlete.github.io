// Package a static build that also works inside Anonymous GitHub's opaque-origin
// sandbox. Classic same-host scripts deliver compressed bytes; no sandbox or
// CORS policy is relaxed, and all physics/inference assets stay on that host.
import {build} from 'esbuild';
import {readFile,writeFile,mkdir,readdir,unlink} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.resolve(process.argv[2]??path.join(root,'project-dist'));
await mkdir(out,{recursive:true});
for(const f of await readdir(out))if(/^data-\d+\.js$/.test(f))await unlink(path.join(out,f));
const common={absWorkingDir:root,bundle:true,write:false,minify:true,target:'es2022',conditions:['onnxruntime-web-use-extern-wasm','browser'],platform:'browser',external:['module'],legalComments:'eof'};
const worker=await build({...common,entryPoints:['src/engine.worker.js'],format:'iife',conditions:['browser'],define:{'import.meta.url':'self.location.href'},plugins:[{name:'embedded-wasm',setup(b){b.onResolve({filter:/mujoco\.wasm\?url$/},()=>({path:'mujoco.wasm',namespace:'embedded'}));b.onLoad({filter:/.*/,namespace:'embedded'},()=>({contents:'export default "mujoco.wasm";'}));}}]});
const app=await build({...common,entryPoints:['src/main.js'],format:'iife',loader:{'.css':'empty'},define:{'import.meta.url':'location.href'}});
const files={};
for(const f of await readdir(path.join(root,'public/assets'))){if(f==='perturb-parity.json')continue;files[`assets/${f}`]=await readFile(path.join(root,'public/assets',f));}
for(const [name,file] of Object.entries({'runtime/mujoco.wasm':'@mujoco/mujoco/mujoco.wasm','runtime/ort.wasm':'onnxruntime-web/dist/ort-wasm-simd-threaded.wasm','runtime/ort.mjs':'onnxruntime-web/dist/ort-wasm-simd-threaded.mjs'}))files[name]=await readFile(path.join(root,'node_modules',file));
const offsets={};let offset=0;for(const [name,bytes]of Object.entries(files)){offsets[name]=[offset,bytes.length];offset+=bytes.length;}
const header=Buffer.from(JSON.stringify({worker:worker.outputFiles[0].text,files:offsets}));const length=Buffer.alloc(4);length.writeUInt32LE(header.length);
const packet=gzipSync(Buffer.concat([length,header,...Object.values(files)]),{level:9});
// Hex prevents identifier anonymization from altering encoded model/WASM bytes.
const hex=packet.toString('hex'),chunkSize=3_000_000,scripts=[];
for(let i=0;i<hex.length;i+=chunkSize){const name=`data-${scripts.length}.js`;scripts.push(name);await writeFile(path.join(out,name),`(window.__ATHLETE_PACKED__??=[]).push("${hex.slice(i,i+chunkSize)}");\n`);}
await writeFile(path.join(out,'app.js'),app.outputFiles[0].text);
await writeFile(path.join(out,'style.css'),await readFile(path.join(root,'src/style.css')));
await writeFile(path.join(out,'boot.js'),`(async()=>{try{
const hex=window.__ATHLETE_PACKED__.join('');window.__ATHLETE_PACKED__=null;
document.getElementById('load-text').textContent='解压模型与物理引擎…';
const bytes=new Uint8Array(hex.length/2);for(let i=0;i<bytes.length;i++)bytes[i]=parseInt(hex.slice(i*2,i*2+2),16);
const raw=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
const headerLength=new DataView(raw.buffer).getUint32(0,true);const decoded=JSON.parse(new TextDecoder().decode(raw.subarray(4,4+headerLength)));
for(const [name,[offset,size]] of Object.entries(decoded.files))decoded.files[name]=raw.subarray(4+headerLength+offset,4+headerLength+offset+size);
window.__ATHLETE_BUNDLE__=decoded;
const script=document.createElement('script');script.src='./app.js';script.onerror=()=>{document.getElementById('load-text').textContent='应用加载失败，请刷新重试';};document.body.append(script);
}catch(e){document.getElementById('load-text').textContent='加载失败';document.querySelector('#loading p').textContent=String(e);}})();\n`);
let html=await readFile(path.join(root,'index.html'),'utf8');
html=html.replace('<script type="module" src="/src/main.js"></script>',scripts.map(s=>`<script defer src="./${s}"></script>`).join('')+'<script defer src="./boot.js"></script>');
html=html.replace('</head>','<link rel="stylesheet" href="./style.css"></head>').replace('href="./">ATHLETE','href="../">ATHLETE').replace('关于这个实验 ↗','Project page ↗').replace('href="#about"','href="../"').replace('LOCAL PREVIEW','BROWSER DEMO').replace('本地原型','浏览器交互演示');
await writeFile(path.join(out,'index.html'),html);
console.log(JSON.stringify({out,compressedBytes:packet.length,scriptChunks:scripts.length}));
