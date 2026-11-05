import {spawn} from "node:child_process";
import {createCipheriv,randomBytes} from "node:crypto";
import {createReadStream} from "node:fs";
import {readdir,rm,stat} from "node:fs/promises";
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
// Cifrado opcional AES-256-GCM: formato PBB1 | IV (12 bytes) | datos | etiqueta (16 bytes).
// La llave (64 hexadecimales) vive fuera del servidor de respaldo y del repositorio; sin ella no se puede restaurar.
const keyHex=process.env.BACKUP_ENCRYPTION_KEY??env.BACKUP_ENCRYPTION_KEY??"";
const encrypted=Boolean(keyHex);
if(encrypted && !/^[0-9a-fA-F]{64}$/.test(keyHex)) throw new Error("BACKUP_ENCRYPTION_KEY debe tener 64 caracteres hexadecimales");
async function encryptFile(name){
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",Buffer.from(keyHex,"hex"),iv);
  const source=path.join(directory,name),target=source+".enc";
  const output=createWriteStream(target,{flags:"wx"});
  output.write(Buffer.concat([Buffer.from("PBB1"),iv]));
  await pipeline(createReadStream(source),cipher,output,{end:false});
  await new Promise((resolve,reject)=>output.end(cipher.getAuthTag(),error=>error?reject(error):resolve()));
  await rm(source);
}
if(encrypted) for(const name of ["database.dump","uploads.tar.gz"]) await encryptFile(name);
await writeFile(path.join(directory,"metadata.json"),JSON.stringify({project,database,date:new Date().toISOString(),encrypted,consistentSnapshot:false,warning:"DB y archivos son capturas sucesivas: coordina ventana sin escrituras y verifica restauración"},null,2));
console.log("Backup creado en "+directory+(encrypted?" (cifrado)":" (SIN cifrar: define BACKUP_ENCRYPTION_KEY antes de copiarlo fuera del servidor)"));

// Retención: conserva los N respaldos más recientes con nombre de fecha; nunca toca otras carpetas.
const keep=Number(process.env.BACKUP_KEEP??env.BACKUP_KEEP??14);
if(Number.isInteger(keep) && keep>0){
  const root=path.resolve("backups");
  const dated=(await readdir(root)).filter(name=>/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(name)).sort();
  for(const name of dated.slice(0,Math.max(0,dated.length-keep))){
    if((await stat(path.join(root,name))).isDirectory()){await rm(path.join(root,name),{recursive:true});console.log("Retención: eliminado "+name);}
  }
}
