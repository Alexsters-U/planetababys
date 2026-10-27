import type {SVGProps} from "react";
export type BrandIconName="planet"|"products"|"orders"|"sales"|"clock"|"ticket"|"stock"|"alert"|"tag"|"refresh"|"logout"|"plus"|"photo"|"arrow"|"chevron"|"check"|"copy"|"location"|"status-approved"|"status-rejected"|"status-pending"|"store";
const paths:Record<BrandIconName,React.ReactNode>={
  planet:<><circle cx="12" cy="12" r="6"/><ellipse cx="12" cy="12" rx="11" ry="3.5" transform="rotate(-28 12 12)"/><path d="m16 2 .7 1.3L18 4l-1.3.7L16 6l-.7-1.3L14 4l1.3-.7Z" fill="var(--icon-accent,#F5DB9A)" stroke="none"/></>,
  products:<><path d="m4 7 8-4 8 4v11l-8 4-8-4Z M4 7l8 4 8-4M12 11v11M8 5l8 4v4"/><path d="m3 2 .5 1L5 4l-1.5.5L3 6l-.5-1.5L1 4l1.5-1Z" fill="var(--icon-accent,#B8D8C8)" stroke="none"/></>,
  orders:<><path d="M6 3h12v19l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6M9 16h3"/><circle cx="19" cy="5" r="3" fill="var(--icon-accent,#F5DB9A)" stroke="none"/></>,
  sales:<><path d="M4 18V8M10 18V12M16 18V5M2 21h20M3 5l6 3 7-6 5 2"/><circle cx="21" cy="4" r="2" fill="var(--icon-accent,#B8D8C8)" stroke="none"/></>,
  clock:<><circle cx="12" cy="12" r="8"/><path d="M12 7v5l4 2M3 5l2-2M19 3l2 2"/><circle cx="20" cy="19" r="2" fill="var(--icon-accent,#F5DB9A)" stroke="none"/></>,
  ticket:<><path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4ZM15 5v3m0 3v2m0 3v3M7 9h4M7 13h3"/><path d="m10 2 1 1h-2Z" fill="var(--icon-accent,#EAB4C8)" stroke="none"/></>,
  stock:<><path d="M3 6h18v15H3ZM3 10h18M8 6V3h8v3M9 14h6M12 12v4"/><circle cx="19" cy="3" r="2" fill="var(--icon-accent,#B8D8C8)" stroke="none"/></>,
  alert:<><path d="m12 3 10 18H2ZM12 9v5M12 17h.01"/><circle cx="20" cy="4" r="2" fill="var(--icon-accent,#F5DB9A)" stroke="none"/></>,
  tag:<><path d="M3 3h9l10 10-9 9L3 12ZM7 7h.01M10 14l5-5"/><circle cx="19" cy="4" r="2" fill="var(--icon-accent,#EAB4C8)" stroke="none"/></>,
  refresh:<><path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/><circle cx="12" cy="12" r="2" fill="var(--icon-accent,#B8D8C8)" stroke="none"/></>,
  logout:<><path d="M10 4H4v16h6M9 12h12m-4-4 4 4-4 4"/><circle cx="13" cy="3" r="2" fill="var(--icon-accent,#EAB4C8)" stroke="none"/></>,
  plus:<><circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/><circle cx="21" cy="4" r="2" fill="var(--icon-accent,#F5DB9A)" stroke="none"/></>,
  photo:<><path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/><circle cx="19" cy="4" r="2" fill="var(--icon-accent,#B8D8C8)" stroke="none"/></>,
  arrow:<><path d="M4 12h16m-6-6 6 6-6 6"/><circle cx="4" cy="5" r="2" fill="var(--icon-accent,#F5DB9A)" stroke="none"/></>,
  chevron:<path d="m8 5 7 7-7 7"/>,
  check:<><circle cx="12" cy="12" r="8"/><path d="m8 12 3 3 5-6"/><circle cx="21" cy="4" r="2" fill="var(--icon-accent,#B8D8C8)" stroke="none"/></>,
  "status-approved":<><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
  "status-rejected":<><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></>,
  "status-pending":<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  store:<><path d="M3 10v11h18V10M2 10l2-7h16l2 7M2 10a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0M9 21v-7h6v7M8 3l-1 7M16 3l1 7"/></>,
  copy:<><path d="M6 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"/><rect x="8" y="8" width="11" height="13" rx="2.5"/><path d="M11 12h5M11 16h3"/><path d="m20 1 .8 1.7L23 3.5l-2.2.8L20 6l-.8-1.7-2.2-.8 2.2-.8Z" fill="var(--icon-accent,#F5DB9A)" stroke="none"/></>,
  location:<><ellipse cx="12" cy="19" rx="9" ry="2.5" transform="rotate(-12 12 19)"/><path d="M18 9c0 4-6 10-6 10S6 13 6 9a6 6 0 0 1 12 0Z" fill="var(--icon-surface,#F1EAF8)"/><circle cx="12" cy="9" r="2"/><path d="m20 2 .7 1.4L22.5 4l-1.8.7L20 6l-.7-1.3L17.5 4l1.8-.6Z" fill="var(--icon-accent,#EAB4C8)" stroke="none"/></>,
};
/** Original orbital icon set; control labels belong on the parent button or link. */
export default function BrandIcon({name,size=24,...props}:SVGProps<SVGSVGElement>&{name:BrandIconName;size?:number}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{paths[name]}</svg>;
}
