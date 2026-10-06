export const prices={tea:12,ticket:18};
export function report(entries,filter='all'){
 const seen=new Set();
 const rows=entries.map(([id,o],i)=>{const returning=seen.has(o.customerId);seen.add(o.customerId);const keys=Object.keys(prices).filter(k=>filter==='all'||filter===k);const gross=keys.reduce((s,k)=>s+(o.items[k]||0)*prices[k],0);const refunds=keys.reduce((s,k)=>s+(o.refunds?.[k]||0),0);return {id,label:`Order ${i+1}`,items:o.items,refundsByProduct:o.refunds||{},gross,refunds,net:gross-refunds,returning};}).filter(o=>o.gross>0);
 const gross=rows.reduce((s,o)=>s+o.gross,0),refunds=rows.reduce((s,o)=>s+o.refunds,0),net=gross-refunds,returningNet=rows.filter(o=>o.returning).reduce((s,o)=>s+o.net,0);
 const products=Object.keys(prices).filter(k=>filter==='all'||filter===k).map(key=>{const gross=rows.reduce((s,o)=>s+(o.items[key]||0)*prices[key],0),refunds=rows.reduce((s,o)=>s+(o.refundsByProduct[key]||0),0);return {key,name:key==='tea'?'Tea gift box':'Museum visit',gross,refunds,net:gross-refunds,rate:gross?refunds/gross:0};});
 return {rows,products,gross,refunds,net,returningNet,newNet:net-returningNet,returningShare:net?returningNet/net:0,refundRate:gross?refunds/gross:0};
}
