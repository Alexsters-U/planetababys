import {apiProxyHeaders} from "@/shared/api/proxy-context";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const allowedHeaders=["accept","content-type","cookie","origin","sec-fetch-site","idempotency-key","if-none-match","range"];
async function forward(request:Request) {
  const encoding=request.headers.get("content-encoding");
  if(encoding&&encoding!=="identity")return Response.json({error:"Las solicitudes comprimidas no están admitidas."},{status:415});
  const url=new URL(request.url),target=url.pathname+url.search;
  const outgoing=new Headers();
  for(const name of allowedHeaders){const value=request.headers.get(name);if(value)outgoing.set(name,value);}
  for(const [name,value] of Object.entries(await apiProxyHeaders(request.method,target)))outgoing.set(name,value);
  try {
    const upstream=await fetch(new URL(target,process.env.API_INTERNAL_URL??"http://127.0.0.1:4000"),{
      method:request.method,headers:outgoing,redirect:"manual",cache:"no-store",
      body:["GET","HEAD"].includes(request.method)?undefined:request.body,
      signal:AbortSignal.timeout(30000),...{duplex:"half"},
    });
    const responseHeaders=new Headers(upstream.headers);
    for(const name of ["connection","transfer-encoding","content-encoding","content-length"])responseHeaders.delete(name);
    return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
  }catch{return Response.json({error:"No pudimos conectar con la tienda. Inténtalo en un momento."},{status:502});}
}
export {forward as GET,forward as HEAD,forward as POST,forward as PATCH,forward as DELETE,forward as OPTIONS};
