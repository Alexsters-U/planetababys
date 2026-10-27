export type DashboardDays = 7 | 30 | 90;
export const DASHBOARD_DAYS = [7,30,90] as const;
const DAY = 86400000;
export function dashboardWindow(days:DashboardDays, now=new Date()) {
  const end=new Date(now),start=new Date(end.getTime()-days*DAY);
  return {days,start,end,previousStart:new Date(start.getTime()-days*DAY),previousEnd:start};
}
export function colombiaDay(value:Date|string) {
  return new Date(new Date(value).getTime()-5*3600000).toISOString().slice(0,10);
}
export function fillSalesDays(start:Date,end:Date,rows:{date:string;salesCents:number;orders:number}[]) {
  const byDay=new Map(rows.map(row=>[row.date,row]));
  const first=new Date(colombiaDay(start)+"T00:00:00Z");
  const last=new Date(colombiaDay(new Date(end.getTime()-1))+"T00:00:00Z");
  const result=[];
  for(let time=first.getTime();time<=last.getTime();time+=DAY){const date=new Date(time).toISOString().slice(0,10);result.push(byDay.get(date)??{date,salesCents:0,orders:0});}
  return result;
}
export function metricChange(current:number,previous:number) {
  // No fabricated 100% growth against a zero or empty baseline.
  return previous===0 ? null : Math.round((current-previous)*1000/previous)/10;
}
export type DashboardSummary = {
  productCount:number;orderCount:number;pendingOrders:number;paidCount:number;
  period:{days:DashboardDays;start:string;end:string;previousStart:string;previousEnd:string};generatedAt:string;testMode:boolean;
  metrics:{salesCents:number;paidOrders:number;placedOrders:number;averageTicketCents:number;confirmationRate:number;previousSalesCents:number;previousPaidOrders:number;previousPlacedOrders:number;previousAverageTicketCents:number};
  dailySales:{date:string;salesCents:number;orders:number}[];
  orderStatuses:{status:string;count:number}[];
  topProducts:{productId:string;name:string;quantity:number;salesCents:number}[];
  inventory:{visible:number;lowStock:number;outOfStock:number;activePromotions:number};
  operations:{readyToPack:number;reviewRequired:number};
  recentOrders:{id:string;reference:string;totalCents:number;status:string;createdAt:string}[];
  channels:{web:{salesCents:number;completedSales:number};local:{salesCents:number;completedSales:number}};
};
