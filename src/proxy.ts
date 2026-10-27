import {NextResponse,type NextRequest} from "next/server";
export async function proxy(req:NextRequest) {
  const nonce=Buffer.from(crypto.randomUUID()).toString("base64");
  const dev=process.env.NODE_ENV!=="production";
  const csp=[
    "default-src 'self'",`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev?" 'unsafe-eval'":""}`,
    "style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","font-src 'self' data:",
    `connect-src 'self'${dev?" ws:":""}`,"object-src 'none'","base-uri 'self'",
    "frame-ancestors 'none'","form-action 'self' https://checkout.wompi.co",
  ].join("; ");
  const headers=new Headers(req.headers);headers.set("x-nonce",nonce);headers.set("Content-Security-Policy",csp);
  let response=NextResponse.next({request:{headers}});
  if(req.nextUrl.pathname.startsWith("/admin") && req.nextUrl.pathname!=="/admin/login") {
    let authenticated=false;
    try{const result=await fetch(`${process.env.API_INTERNAL_URL??"http://127.0.0.1:4000"}/api/auth/me`,{headers:{Cookie:req.headers.get("cookie")??""},cache:"no-store",signal:AbortSignal.timeout(5000)});authenticated=result.ok;}catch{}
    if(!authenticated){const login=new URL("/admin/login",req.url);login.searchParams.set("next",req.nextUrl.pathname);response=NextResponse.redirect(login);}
  }
  response.headers.set("Content-Security-Policy",csp);
  response.headers.set("X-Content-Type-Options","nosniff");
  response.headers.set("X-Frame-Options","DENY");
  response.headers.set("Referrer-Policy","no-referrer");
  response.headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");
  if(process.env.COOKIE_SECURE==="true") response.headers.set("Strict-Transport-Security","max-age=31536000; includeSubDomains");
  return response;
}
export const config={matcher:["/((?!api/|_next/static|_next/image|favicon.ico|images/).*)"]};
