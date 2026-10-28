import PaymentSimulation from "./simulation";
export const metadata={title:"Demostración de pago",robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{token?:string}>}) {
  const {id}=await params,{token}=await searchParams;
  return <PaymentSimulation id={id} token={typeof token==="string"?token:""}/>;
}
