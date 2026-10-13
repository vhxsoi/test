import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {runWizard,validateInput,WizardError} from './lib/wizard.js';
const routes={'/manual-model.js':['manual-model.js','text/javascript; charset=utf-8'],'/manual.js':['manual.js','text/javascript; charset=utf-8'],'/vendor/marked.js':['../node_modules/marked/lib/marked.esm.js','text/javascript; charset=utf-8'],'/board.js':['board.js','text/javascript; charset=utf-8'],'/schedule.js':['schedule.js','text/javascript; charset=utf-8'],'/admin.js':['admin.js','text/javascript; charset=utf-8'],'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/routes.js':['routes.js','text/javascript; charset=utf-8'],'/wizard.js':['wizard.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function readBody(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>65536)throw new WizardError(413,'전송 데이터가 너무 큽니다. 원문을 줄여주세요.');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new WizardError(400,'올바른 JSON 요청이 필요합니다.');}}
export function createApp({runner=runWizard,configured=()=>Boolean(process.env.OPENAI_API_KEY)}={}){
  const token=randomBytes(32).toString('hex');let busy=false;
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const port=req.socket.localPort;
    const allowedHosts=[`127.0.0.1:${port}`,`localhost:${port}`];
    if(!allowedHosts.includes(req.headers.host)){json(res,403,{error:'허용되지 않은 호스트입니다.'});return;}
    const path=new URL(req.url,`http://${req.headers.host}`).pathname;
    if(path.startsWith('/api/')){
      if((req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)||req.headers['sec-fetch-site']==='cross-site'){json(res,403,{error:'외부 웹사이트의 접근을 허용하지 않습니다.'});return;}
      if(path==='/api/session'&&req.method==='GET'){json(res,200,{token,configured:configured(),model:process.env.OPENAI_MODEL||'gpt-4.1-mini'});return;}
      if(path!=='/api/wizard'){json(res,404,{error:'API를 찾을 수 없습니다.'});return;}
      if(req.method!=='POST'){json(res,405,{error:'POST 요청이 필요합니다.'});return;}
      if(req.headers['x-worknote-token']!==token){json(res,403,{error:'앱 인증이 만료되었습니다. 화면을 새로고침하세요.'});return;}
      if(!req.headers['content-type']?.startsWith('application/json')){json(res,415,{error:'JSON 형식으로 전송하세요.'});return;}
      if(busy){json(res,429,{error:'정리 작업이 진행 중입니다. 완료 후 다시 시도하세요.'});return;}
      busy=true;
      try{const input=validateInput(await readBody(req));json(res,200,await runner(input));}
      catch(error){json(res,error instanceof WizardError?error.status:500,{error:error instanceof WizardError?error.message:'요청을 처리하지 못했습니다.'});}
      finally{busy=false;}
      return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    const route=routes[path];if(!route){res.writeHead(404);res.end('Not found');return;}
    try{const data=await readFile(new URL(`./public/${route[0]}`,import.meta.url));res.writeHead(200,{'Content-Type':route[1],'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(500);res.end('Unable to load page');}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const server=createApp();server.on('error',()=>{console.error('서버를 시작하지 못했습니다. 포트가 사용 중인지 확인하세요.');process.exitCode=1;});
  server.listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log('Worknote local UI · port '+server.address().port));
}
