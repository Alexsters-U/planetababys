import {spawn} from "node:child_process";
import {createWriteStream} from "node:fs";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {pipeline} from "node:stream/promises";
import path from "node:path";
const envFile=process.argv[2]??".env";
const project=process.argv[3]??"planetababys";
if(!/^[a-z0-9][a-z0-9_-]+$/.test(project)) throw new Error("Nombre de proyecto inválido");
const env=Object.fromEntries((await readFile(envFile,"utf8")).split(/\r?\n/).filter(l=>l && !l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1)];}));
const user=env.POSTGRES_USER??"planetababys",database=env.POSTGRES_DB??"planetababys";
if(!/^[a-zA-Z0-9_]+$/.test(user) || !/^[a-zA-Z0-9_]+$/.test(database)) throw new Error("Nombre PostgreSQL inválido");
const timestamp=new Date().toISOString().replace(/[:.]/g,"-");
const directory=path.resolve("backups",timestamp);
await mkdir(directory,{recursive:true});
async function capture(name,args){
  const child=spawn("docker",["compose","--env-file",envFile,"-p",project,"exec","-T",...args],{stdio:["ignore","pipe","inherit"],shell:false});
  const finished=new Promise((resolve,reject)=>{child.on("error",reject);child.on("exit",code=>code===0?resolve():reject(new Error("Backup falló: "+name)));});
  await Promise.all([pipeline(child.stdout,createWriteStream(path.join(directory,name),{flags:"wx"})),finished]);
}
await capture("database.dump",["db","pg_dump","-U",user,"-d",database,"-Fc"]);
await capture("uploads.tar.gz",["backend","tar","-cz","-C","/app","uploads"]);
await writeFile(path.join(directory,"metadata.json"),JSON.stringify({project,database,date:new Date().toISOString(),consistentSnapshot:false,warning:"DB y archivos son capturas sucesivas: coordina ventana sin escrituras y verifica restauración"},null,2));
console.log("Backup creado en "+directory);
