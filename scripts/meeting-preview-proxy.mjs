// Proxy temporal para reuniones. La configuración y clave viven fuera del proyecto.
import http from "node:http";
import {readFileSync} from "node:fs";
import {timingSafeEqual} from "node:crypto";

const configPath=process.argv[2];
if(!configPath) throw new Error("Indica el archivo privado de configuración");
const initial=JSON.parse(readFileSync(configPath,"utf8"));
const upstream=new URL(initial.upstream);
if(!["localhost","127.0.0.1"].includes(upstream.hostname) || upstream.protocol!=="http:") throw new Error("El destino debe ser HTTP local");
const failures=new Map();
const server=http.createServer((req,res)=>{
  const config=JSON.parse(readFileSync(configPath,"utf8"));
  const origin=config.publicOrigin;
  const expected=Buffer.from("Basic "+Buffer.from(`${config.username}:${config.password}`).toString("base64"));
  const supplied=Buffer.from(req.headers.authorization??"");
  const visitor=req.headers["cf-connecting-ip"]??req.socket.remoteAddress;
  const recent=failures.get(visitor);
  const fail=recent&&Date.now()-recent.start<60000?recent:{start:Date.now(),count:0};
  if(supplied.length!==expected.length || !timingSafeEqual(supplied,expected)) {
    if(++fail.count>20){res.writeHead(429,{"Retry-After":"60"});res.end("Espera un minuto antes de intentar nuevamente.");}
    else {res.writeHead(401,{"WWW-Authenticate":'Basic realm="Planeta Babys - Reunion", charset="UTF-8"',"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"});res.end("Demostración privada. Introduce el acceso de la reunión.");}
    failures.set(visitor,fail);req.resume();return;
  }
  if(failures.size>1000) for(const [key,value] of failures) if(Date.now()-value.start>60000) failures.delete(key);
  if(!origin || req.headers.host!==new URL(origin).host){res.writeHead(421);res.end("Demostración aún no disponible en este dominio.");req.resume();return;}
  if(!["GET","HEAD","OPTIONS"].includes(req.method) && (req.headers.origin!==origin || req.headers["sec-fetch-site"]==="cross-site")){
    res.writeHead(403,{"Content-Type":"application/json; charset=utf-8"});res.end(JSON.stringify({error:"Origen no permitido"}));req.resume();return;
  }
  const headers={...req.headers,host:upstream.host,"accept-encoding":"identity","x-forwarded-host":upstream.host,"x-forwarded-proto":"http"};
  delete headers.authorization;delete headers["x-forwarded-for"];delete headers.forwarded;
  if(headers.origin===origin)headers.origin=upstream.origin;
  if(headers.referer?.startsWith(origin+"/"))headers.referer=upstream.origin+headers.referer.slice(origin.length);
  const proxy=http.request({hostname:upstream.hostname,port:upstream.port,method:req.method,path:req.url,headers,timeout:30000},response=>{
    const output={...response.headers,"cache-control":"no-store","x-robots-tag":"noindex, nofollow, noarchive"};
    if(output.location?.startsWith(upstream.origin+"/"))output.location=origin+output.location.slice(upstream.origin.length);
    if(output["set-cookie"])output["set-cookie"]=output["set-cookie"].map(cookie=>/;\s*secure(?:;|$)/i.test(cookie)?cookie:cookie+"; Secure");
    const pathname=new URL(req.url,"http://local").pathname;
    if(pathname==="/api/orders" && req.method==="POST" && response.statusCode===201){
      const chunks=[];let size=0;
      response.on("data",chunk=>{size+=chunk.length;if(size>262144)response.destroy();else chunks.push(chunk);});
      response.on("end",()=>{
        try{
          const body=JSON.parse(Buffer.concat(chunks).toString());
          if(typeof body.paymentUrl==="string" && body.paymentUrl.startsWith(upstream.origin+"/"))body.paymentUrl=origin+body.paymentUrl.slice(upstream.origin.length);
          const encoded=Buffer.from(JSON.stringify(body));delete output["transfer-encoding"];delete output.etag;output["content-length"]=encoded.length;
          res.writeHead(response.statusCode,output);res.end(encoded);
        }catch{if(!res.headersSent)res.writeHead(502);res.end("No se pudo preparar la respuesta de demostración.");}
      });
      response.on("error",()=>{if(!res.headersSent)res.writeHead(502);res.end("Respuesta interrumpida.");});
    }else{res.writeHead(response.statusCode,output);response.pipe(res);}
  });
  proxy.on("timeout",()=>proxy.destroy());
  proxy.on("error",()=>{if(!res.headersSent)res.writeHead(502,{"Content-Type":"text/plain; charset=utf-8"});res.end("El entorno local no está disponible.");});
  req.on("aborted",()=>proxy.destroy());req.pipe(proxy);
});
server.listen(initial.port,"127.0.0.1",()=>console.log(`Proxy de reunión en 127.0.0.1:${server.address().port}`));
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>server.close(()=>process.exit(0)));
