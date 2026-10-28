export type ShippingNotice={id:string;reference:string;createdAt:string};
export type NoticeCursor={createdAt:string;id:string};
export function newerNotices(recent:readonly ShippingNotice[],cursor:NoticeCursor|null) {
  if(!cursor)return [];
  const time=new Date(cursor.createdAt).getTime();
  return recent.filter(item=>new Date(item.createdAt).getTime()>time || (new Date(item.createdAt).getTime()===time&&item.id>cursor.id));
}
