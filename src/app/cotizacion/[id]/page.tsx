import QuotationReview from "./review";
export const metadata={title:"Revisa tu cotización",robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{token?:string}>}) {
  const {id}=await params,{token}=await searchParams;
  return <QuotationReview id={id} token={typeof token==="string"?token:""}/>;
}
