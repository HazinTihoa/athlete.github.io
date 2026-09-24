(async()=>{try{
const hex=window.__ATHLETE_PACKED__.join('');window.__ATHLETE_PACKED__=null;
document.getElementById('load-text').textContent='解压模型与物理引擎…';
const bytes=new Uint8Array(hex.length/2);for(let i=0;i<bytes.length;i++)bytes[i]=parseInt(hex.slice(i*2,i*2+2),16);
const raw=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
const headerLength=new DataView(raw.buffer).getUint32(0,true);const decoded=JSON.parse(new TextDecoder().decode(raw.subarray(4,4+headerLength)));
for(const [name,[offset,size]] of Object.entries(decoded.files))decoded.files[name]=raw.subarray(4+headerLength+offset,4+headerLength+offset+size);
window.__ATHLETE_BUNDLE__=decoded;
const script=document.createElement('script');script.src='./app.js';script.onerror=()=>{document.getElementById('load-text').textContent='应用加载失败，请刷新重试';};document.body.append(script);
}catch(e){document.getElementById('load-text').textContent='加载失败';document.querySelector('#loading p').textContent=String(e);}})();
