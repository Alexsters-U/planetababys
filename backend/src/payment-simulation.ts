import {z} from "zod";
import {config} from "./config";
import {db} from "./db";
import {HttpError} from "./errors";
import {applyTransaction} from "./orders";
import {validOrderToken} from "./security";

const input=z.object({orderId:z.string().min(1).max(64),token:z.string().max(1500),
  status:z.enum(["APPROVED","DECLINED","PENDING"]),method:z.enum(["CARD","PSE","NEQUI"]).default("CARD")}).strict();
export async function simulatePayment(body:unknown) {
  if(config.APP_ENV!=="test" || config.PAYMENT_MODE!=="test")throw new HttpError(404,"Ruta no encontrada");
  const data=input.parse(body);
  if(!await validOrderToken(data.token,data.orderId))throw new HttpError(404,"Pedido no encontrado");
  const order=await db.order.findUnique({where:{id:data.orderId},include:{payments:true}});
  if(!order)throw new HttpError(404,"Pedido no encontrado");
  if(order.payments[0]?.provider!=="simulator")throw new HttpError(409,"Este pago no pertenece al simulador.");
  if(order.payments[0].status!=="PENDING" && order.payments[0].status!==data.status)throw new HttpError(409,"Esta compra de prueba ya terminó. Inicia otra para ver un resultado distinto.");
  await applyTransaction({id:`SIM-${order.id}`,reference:order.reference,amount_in_cents:order.totalCents,currency:"COP",status:data.status,payment_method_type:data.method},"simulator");
  return {orderUrl:`${config.SITE_URL}/pedido/${order.id}?token=${encodeURIComponent(data.token)}`,simulated:true};
}
