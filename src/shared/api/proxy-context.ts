import "server-only";
import {headers} from "next/headers";
import {ingressIp,proxyHeaders} from "../proxy-context";

export async function apiProxyHeaders(method:string,target:string) {
  const secret=process.env.PROXY_SHARED_SECRET??"";
  const incoming=await headers();
  const ip=ingressIp(new Headers(incoming),secret);
  return ip?proxyHeaders(secret,method,target,ip):{};
}
