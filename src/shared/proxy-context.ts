import {createHmac,timingSafeEqual} from "node:crypto";
import {isIP} from "node:net";

export function sameSecret(actual:string,expected:string) {
  const a=Buffer.from(actual),b=Buffer.from(expected);
  return b.length>=32 && a.length===b.length && timingSafeEqual(a,b);
}
function signature(secret:string,method:string,target:string,ip:string,time:string) {
  return createHmac("sha256",secret).update(`pbb-proxy-v1\n${method}\n${target}\n${ip}\n${time}`).digest("hex");
}
export function proxyHeaders(secret:string,method:string,target:string,ip:string,now=Date.now()):Record<string,string> {
  if(secret.length<32 || !isIP(ip)) return {};
  const time=String(Math.floor(now/1000));
  return {"x-pbb-client-ip":ip,"x-pbb-proxy-time":time,"x-pbb-proxy-signature":signature(secret,method,target,ip,time)};
}
export function verifiedProxyIp(secret:string,method:string,target:string,headers:Headers,now=Date.now()) {
  if(secret.length<32)return null;
  const ip=headers.get("x-pbb-client-ip")??"",time=headers.get("x-pbb-proxy-time")??"";
  if(!isIP(ip) || !/^\d{10}$/.test(time) || Math.abs(now/1000-Number(time))>30) return null;
  return sameSecret(headers.get("x-pbb-proxy-signature")??"",signature(secret,method,target,ip,time))?ip:null;
}
export function ingressIp(headers:Headers,secret:string) {
  if(!sameSecret(headers.get("x-pbb-ingress")??"",secret)) return null;
  const ip=headers.get("x-real-ip")??"";
  return isIP(ip)?ip:null;
}
