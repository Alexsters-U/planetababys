// Descifra un archivo .enc creado por backup.mjs. Uso: BACKUP_ENCRYPTION_KEY=... node scripts/backup-decrypt.mjs archivo.enc [destino]
import {createDecipheriv} from "node:crypto";
import {createReadStream,createWriteStream} from "node:fs";
import {open,stat} from "node:fs/promises";
import {pipeline} from "node:stream/promises";
const [source,targetArg]=process.argv.slice(2);
const keyHex=process.env.BACKUP_ENCRYPTION_KEY??"";
if(!source?.endsWith(".enc")) throw new Error("Indica un archivo .enc");
if(!/^[0-9a-fA-F]{64}$/.test(keyHex)) throw new Error("Define BACKUP_ENCRYPTION_KEY con 64 caracteres hexadecimales");
const target=targetArg??source.slice(0,-4),{size}=await stat(source);
const handle=await open(source,"r"),header=Buffer.alloc(16),tag=Buffer.alloc(16);
await handle.read(header,0,16,0);await handle.read(tag,0,16,size-16);await handle.close();
if(header.subarray(0,4).toString()!=="PBB1") throw new Error("Formato de respaldo desconocido");
const decipher=createDecipheriv("aes-256-gcm",Buffer.from(keyHex,"hex"),header.subarray(4,16));
decipher.setAuthTag(tag);
// Si la llave es incorrecta o el archivo fue alterado, final() falla y el destino queda incompleto: bórralo.
await pipeline(createReadStream(source,{start:16,end:size-17}),decipher,createWriteStream(target,{flags:"wx"}));
console.log("Descifrado en "+target);
