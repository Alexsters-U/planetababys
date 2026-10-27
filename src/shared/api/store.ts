import {serverApi} from "./server";
import {storeProfile} from "../store-profile";
export type StoreConfig={shippingCents:number|null;shippingMode:"quote"|"fixed";shippingConfigured:boolean;coverage:string;paymentMode:"wompi"|"test";legal:{name:string;taxId:string;address:string;email:string;phone:string}};
export async function storeConfig():Promise<StoreConfig>{
  try{return await serverApi<StoreConfig>("/store/config");}
  catch{return {shippingCents:null,shippingMode:"quote",shippingConfigured:false,coverage:"",paymentMode:"wompi",legal:storeProfile};}
}
