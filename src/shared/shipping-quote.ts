import type {CheckoutInput} from "./validation";
export type ShippingQuoteView = {
  id:string;reference:string;status:"REQUESTED"|"QUOTED"|"CONSUMED"|"DECLINED";
  request:CheckoutInput;lines:{name:string;quantity:number;unitCents:number}[];
  subtotalCents:number;shippingCents:number|null;deliveryEstimate:string|null;
  expiresAt:string;createdAt:string;expired:boolean;policyVersion:string;reviewUrl?:string;
};
