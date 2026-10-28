import {test} from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {ingressIp,proxyHeaders,verifiedProxyIp} from "../src/shared/proxy-context";
const secret=randomBytes(32).toString("hex"),now=Date.now(),target="/api/products?q=bebe";
test("el proxy firma identidad, método y ruta sin confiar en cabeceras públicas",()=>{
  const headers=new Headers(proxyHeaders(secret,"GET",target,"203.0.113.10",now));
  assert.equal(verifiedProxyIp(secret,"GET",target,headers,now),"203.0.113.10");
  assert.equal(verifiedProxyIp(secret,"POST",target,headers,now),null);
  assert.equal(verifiedProxyIp(secret,"GET","/api/auth/login",headers,now),null);
  headers.set("x-pbb-client-ip","203.0.113.11");assert.equal(verifiedProxyIp(secret,"GET",target,headers,now),null);
});
test("rechaza firma vencida, secreto ausente e IP inválida",()=>{
  const headers=new Headers(proxyHeaders(secret,"GET",target,"203.0.113.10",now));
  assert.equal(verifiedProxyIp(secret,"GET",target,headers,now+31000),null);
  assert.equal(verifiedProxyIp("","GET",target,headers,now),null);
  assert.deepEqual(proxyHeaders(secret,"GET",target,"fake",now),{});
});
test("solo la entrada autenticada puede establecer la IP original",()=>{
  const headers=new Headers({"x-real-ip":"198.51.100.2","cf-connecting-ip":"198.51.100.3","x-forwarded-for":"198.51.100.4"});
  assert.equal(ingressIp(headers,secret),null);
  headers.set("x-pbb-ingress",secret);assert.equal(ingressIp(headers,secret),"198.51.100.2");
  headers.set("x-real-ip","198.51.100.1, 198.51.100.2");assert.equal(ingressIp(headers,secret),null);
});
