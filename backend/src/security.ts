import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { createClient } from "redis";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { config } from "./config";
export const redis = createClient({ url: config.REDIS_URL });
redis.on("error", () => console.error("Redis no disponible"));
export const ADMIN_COOKIE = "pbb_admin_token";
export const cookieOptions = { httpOnly: true, secure: config.COOKIE_SECURE, sameSite: "lax" as const, path: "/", maxAge: 8*60*60*1000 };
export async function signSession(user: {id:string;email:string}) {
  return new SignJWT({ email:user.email }).setProtectedHeader({alg:"HS256"}).setSubject(user.id)
    .setIssuer("planetababys").setAudience("planetababys-admin").setJti(randomBytes(16).toString("hex"))
    .setIssuedAt().setExpirationTime("8h").sign(new TextEncoder().encode(config.JWT_SECRET));
}
export async function readSession(req: Request) {
  try {
    const token = req.cookies?.[ADMIN_COOKIE]; if (!token) return null;
    const {payload} = await jwtVerify(token, new TextEncoder().encode(config.JWT_SECRET), {issuer:"planetababys",audience:"planetababys-admin",algorithms:["HS256"]});
    if (!payload.sub || !payload.jti || await redis.exists(`revoked:${payload.jti}`)) return null;
    const user = await db.adminUser.findUnique({where:{id:payload.sub},select:{id:true,email:true}});
    return user ? {...user,jti:payload.jti} : null;
  } catch { return null; }
}
export async function requireAdmin(req:Request,res:Response,next:NextFunction) {
  const user=await readSession(req); if (!user) {res.status(401).json({error:"No autorizado"});return;}
  res.locals.admin=user; next();
}
export function isAllowedOrigin(origin?:string) {
  const expected=new URL(config.SITE_URL);
  if(origin===expected.origin)return true;
  if(!origin || config.APP_ENV==="production")return false;
  try {
    const actual=new URL(origin);
    const loopback=new Set(["localhost","127.0.0.1","[::1]"]);
    return origin===actual.origin && loopback.has(actual.hostname) && loopback.has(expected.hostname)
      && actual.protocol===expected.protocol && actual.port===expected.port;
  }catch{return false;}
}
export function sameOrigin(req:Request,res:Response,next:NextFunction) {
  if (["GET","HEAD","OPTIONS"].includes(req.method) || req.path === "/api/webhooks/wompi") {next();return;}
  if (!isAllowedOrigin(req.headers.origin) || req.headers["sec-fetch-site"] === "cross-site") {
    res.status(403).json({error:"Origen no permitido"+(config.APP_ENV!=="production"?`. Abre la tienda desde ${new URL(config.SITE_URL).origin}`:"")});return;
  }
  next();
}
export function limit(scope:string,max:number,seconds:number) {
  return async (req:Request,res:Response,next:NextFunction) => {
    try {
      const identifier=createHash("sha256").update(`${scope}:${req.ip}`).digest("hex");
      const key=`limit:${identifier}`;
      const count=Number(await redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",{keys:[key],arguments:[String(seconds)]}));
      if(count>max) {res.setHeader("Retry-After",String(Math.max(1,await redis.ttl(key))));res.status(429).json({error:"Demasiadas peticiones. Inténtalo en un momento."});return;}
      next();
    } catch {res.status(503).json({error:"Servicio de protección temporalmente no disponible"});}
  };
}
export function orderToken(orderId:string) {
  return new SignJWT({orderId}).setProtectedHeader({alg:"HS256"}).setIssuer("planetababys-order").setAudience("guest-order").setIssuedAt().setExpirationTime("30d").sign(new TextEncoder().encode(config.SESSION_SECRET));
}
export async function canReadOrder(req:Request,id:string) {
  const token=typeof req.query.token === "string" ? req.query.token : "";
  try {const {payload}=await jwtVerify(token,new TextEncoder().encode(config.SESSION_SECRET),{issuer:"planetababys-order",audience:"guest-order",algorithms:["HS256"]});return payload.orderId === id;}catch{return false;}
}
