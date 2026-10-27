/** Original vector art: the brand's pastel planet, orbit and tiny discoveries. */
export default function BrandScene({variant="lost",className=""}:{variant?:"lost"|"pause"|"empty";className?:string}){
  return <svg viewBox="0 0 360 310" className={className} aria-hidden="true" focusable="false">
    <ellipse cx="181" cy="270" rx="106" ry="12" fill="#E8DEEE" opacity=".6"/>
    <circle cx="180" cy="151" r="110" fill="#F1EAF8"/>
    <path d="M38 233C10 210 44 199 43 167S2 97 60 87M308 225c48-28 8-46 30-64" fill="none" stroke="#B7A0D2" strokeWidth="2" strokeDasharray="5 8"/>
    <circle cx="180" cy="152" r="75" fill="#B8D8C8" stroke="#70508F" strokeWidth="3"/>
    <path d="M146 86c14 24-25 36-12 55s39 5 40 24-39 27-19 55M213 90c-25 29 8 36 7 54s-37 12-31 31 38 11 37 41" fill="#EAF5EE"/>
    <ellipse cx="180" cy="157" rx="122" ry="30" transform="rotate(-24 180 157)" fill="none" stroke="#70508F" strokeWidth="6"/>
    <path d="M59 209c18 15 72 8 117-10" fill="none" stroke="#EAB4C8" strokeWidth="7" strokeLinecap="round"/>
    <circle cx="282" cy="95" r="14" fill="#FAEAF0" stroke="#EAB4C8" strokeWidth="3"/>
    <circle cx="77" cy="227" r="10" fill="#F5DB9A"/>
    <g fill="#F5DB9A"><path d="m76 49 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z"/><path d="m296 215 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/><path d="m238 30 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/></g>
    <g fill="#B7A0D2"><circle cx="49" cy="132" r="3"/><circle cx="298" cy="149" r="3"/><circle cx="130" cy="39" r="3"/></g>
    {variant==="lost"?<g transform="rotate(12 193 126)"><rect x="159" y="89" width="67" height="64" rx="18" fill="#FFF9F3" stroke="#70508F" strokeWidth="2"/><circle cx="192" cy="121" r="19" fill="#FAEAF0" stroke="#EAB4C8" strokeWidth="2"/><path d="m194 105 5 19-15 12 3-18Z" fill="#70508F"/><circle cx="192" cy="121" r="3" fill="#F5DB9A"/></g>:variant==="pause"?<g><rect x="149" y="97" width="62" height="56" rx="18" fill="#FFF9F3" stroke="#70508F" strokeWidth="2"/><path d="M169 112v24M191 112v24" stroke="#70508F" strokeWidth="6" strokeLinecap="round"/></g>:<g fill="#FFF9F3" stroke="#70508F" strokeWidth="2"><path d="M156 130V99h48v31l-24 12Z"/><path d="m156 109 24 11 24-11M180 120v22"/></g>}
    <path d="M107 253q12-20 25 0M248 250q10-17 21 0" fill="none" stroke="#B8D8C8" strokeWidth="3" strokeLinecap="round"/>
  </svg>;
}
