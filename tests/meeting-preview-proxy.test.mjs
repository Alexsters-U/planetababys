import {test} from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {spawn} from "node:child_process";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {randomBytes} from "node:crypto";

function fetchLocal(url,options={}){
  return new Promise((resolve,reject)=>{
    const request=http.request(url,options,response=>{
      const chunks=[];response.on("data",chunk=>chunks.push(chunk));
      response.on("end",()=>resolve({status:response.statusCode,headers:new Headers(Object.entries(response.headers).map(([key,value])=>[key,Array.isArray(value)?value.join(", "):String(value)])),json:async()=>JSON.parse(Buffer.concat(chunks).toString())}));
    });request.on("error",reject);request.end(options.body);
  });
}

test("el proxy exige acceso, limita origen y mantiene los retornos y cookies en HTTPS",async()=>{
  const received=[];
  const upstream=http.createServer((req,res)=>{
    received.push(req.headers);req.resume();
    if(req.url==="/redirect"){res.writeHead(302,{Location:`http://localhost:${upstream.address().port}/admin/login`});res.end();return;}
    res.writeHead(201,{"Content-Type":"application/json","Set-Cookie":"pbb_admin_token=fixture; HttpOnly; SameSite=Lax; Path=/"});
    res.end(JSON.stringify({paymentUrl:`http://localhost:${upstream.address().port}/pedido/fixture?token=fixture`,orderId:"fixture"}));
  });
  await new Promise(resolve=>upstream.listen(0,"127.0.0.1",resolve));
  const directory=await mkdtemp(join(tmpdir(),"pbb-proxy-test-"));
  const password=randomBytes(16).toString("hex");
  const config=join(directory,"config.json");
  await writeFile(config,JSON.stringify({upstream:`http://localhost:${upstream.address().port}`,port:0,username:"reunion",password,publicOrigin:"https://meeting.example"}));
  const child=spawn(process.execPath,[fileURLToPath(new URL("../scripts/meeting-preview-proxy.mjs",import.meta.url)),config],{stdio:["ignore","pipe","pipe"]});
  let errors="";child.stderr.on("data",data=>errors+=data);
  try{
    const port=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error("Proxy no inicia: "+errors)),5000);
      child.once("exit",()=>{clearTimeout(timer);reject(new Error("Proxy terminó: "+errors));});
      child.stdout.on("data",data=>{const match=String(data).match(/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
    });
    const url=`http://127.0.0.1:${port}`;
    const authorization="Basic "+Buffer.from(`reunion:${password}`).toString("base64");
    const headers={Host:"meeting.example",Authorization:authorization,Origin:"https://meeting.example","Content-Type":"application/json"};
    assert.equal((await fetchLocal(url+"/api/orders",{method:"POST",headers:{Host:"meeting.example"},body:"{}"})).status,401);
    assert.equal(received.length,0);
    assert.equal((await fetchLocal(url+"/api/orders",{method:"POST",headers:{...headers,Origin:"https://foreign.example"},body:"{}"})).status,403);
    assert.equal((await fetchLocal(url+"/api/orders",{method:"POST",headers:{...headers,"sec-fetch-site":"cross-site"},body:"{}"})).status,403);
    assert.equal(received.length,0);
    assert.equal((await fetchLocal(url,{headers:{...headers,Host:"foreign.example"}})).status,421);
    const response=await fetchLocal(url+"/api/orders",{method:"POST",headers,body:"{}"});
    assert.equal(response.status,201);
    assert.equal((await response.json()).paymentUrl,"https://meeting.example/pedido/fixture?token=fixture");
    assert.match(response.headers.get("set-cookie"),/; Secure$/);
    assert.equal(received[0].authorization,undefined);
    assert.equal(received[0].origin,`http://localhost:${upstream.address().port}`);
    const redirect=await fetchLocal(url+"/redirect",{headers});
    assert.equal(redirect.headers.get("location"),"https://meeting.example/admin/login");
  }finally{
    child.kill();await new Promise(resolve=>child.exitCode!==null?resolve():child.once("exit",resolve));
    await new Promise(resolve=>upstream.close(resolve));await rm(directory,{recursive:true,force:true});
  }
});
