export function publicSiteUrl() {
  const url=new URL(process.env.SITE_URL??"http://localhost:3000");
  if(!["http:","https:"].includes(url.protocol)||url.username||url.password||url.pathname!=="/"||url.search||url.hash)throw new Error("SITE_URL debe contener solo el origen público de la tienda");
  return url;
}
export function indexingEnabled(){return process.env.INDEXING_ENABLED==="true" && publicSiteUrl().protocol==="https:";}
