// Browser-only illustration of source normalization and idempotent upserts.
export const catalog = {
 'ARCHIVE-TEE-M': {name:'Archive tee',variant:'M / Washed black',price:4500},
 'ARCHIVE-TEE-L': {name:'Archive tee',variant:'L / Washed black',price:4500},
 'STUDIO-HOOD-L': {name:'Studio hoodie',variant:'L / Ash',price:8500},
 'EVENT-GA': {name:'Release night',variant:'General admission',price:2500}
};
export const sourceNames={shopify:'Shopify',ticketing:'Ticketing',instagram:'Instagram / UTM'};
export function normalize(raw){
 const source=raw.source;
 if(source==='instagram')return {source,id:raw.session_date+':'+raw.utm_campaign,version:raw.updated_at,date:raw.session_date,campaign:raw.utm_campaign,sessions:raw.sessions,clicks:raw.link_clicks};
 const ticket=source==='ticketing';
 return {source,id:String(ticket?raw.booking_id:raw.id),version:raw.updated_at,date:raw.created_at?.slice(0,10),sku:ticket?'EVENT-GA':raw.sku?.trim().toUpperCase(),qty:Number(ticket?raw.ticket_count:raw.quantity),refund:Number(raw.refund_total??0),campaign:raw.utm_campaign||'direct'};
}
function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
export function createWorkflow(){
 const orders=new Map(),traffic=new Map(),held=new Map(),seen=new Set();let duplicates=0;
 function run(batch){
  const entries=[];let loaded=0,skipped=0;
  for(const raw of batch){
   const row=normalize(raw),key=row.source+':'+row.id,stamp=key+':'+row.version;
   let reason;
   if(!['shopify','ticketing','instagram'].includes(row.source))reason='Unknown source';
   else if(!row.id||row.id==='undefined'||!Number.isFinite(Date.parse(row.version)))reason='Missing record ID or invalid update timestamp';
   else if(!validDate(row.date))reason='Invalid transaction date';
   else if(row.source==='instagram'){
    if(!row.campaign||![row.sessions,row.clicks].every(n=>Number.isInteger(n)&&n>=0)||row.clicks<row.sessions)reason='Invalid traffic counts or campaign';
   }else if(!catalog[row.sku])reason='SKU missing or not in product catalog';
   else if(!Number.isInteger(row.qty)||row.qty<1||!Number.isInteger(row.refund)||row.refund<0||row.refund>catalog[row.sku].price*row.qty)reason='Invalid quantity or refund amount';
   if(reason){held.set(key,{raw:{...raw},reason});entries.push({state:'held',id:key,message:reason});continue;}
   if(seen.has(stamp)){duplicates++;skipped++;entries.push({state:'skipped',id:key,message:'Same source ID + version; no additional revenue.'});continue;}
   const target=row.source==='instagram'?traffic:orders,previous=target.get(key);
   if(previous&&Date.parse(row.version)<Date.parse(previous.version)){seen.add(stamp);duplicates++;skipped++;entries.push({state:'skipped',id:key,message:'Older source version; current record retained.'});continue;}
   target.set(key,row);seen.add(stamp);held.delete(key);loaded++;
   entries.push({state:'loaded',id:key,message:previous?'Updated existing record; totals recalculated.':'Normalized and upserted into reporting data.'});
  }
  return {loaded,skipped,held:entries.filter(e=>e.state==='held').length,entries};
 }
 return {run,orders,traffic,held,get duplicates(){return duplicates;}};
}
export function sampleHistory(){
 const records=[];let id=1040;
 for(let day=1;day<=7;day++){
  const date=`2026-11-${String(day).padStart(2,'0')}`,version=date+'T23:00:00Z';
  ['ARCHIVE-TEE-M','ARCHIVE-TEE-L','STUDIO-HOOD-L'].forEach((sku,i)=>records.push({source:'shopify',id:String(id++),created_at:date+'T12:00:00Z',updated_at:version,sku,quantity:1+(day+i)%3,refund_total:day===3&&i===1?4500:0,utm_campaign:i===2?'direct':'archive_drop'}));
  for(let i=0;i<2;i++)records.push({source:'ticketing',booking_id:'T'+id++,created_at:date+'T15:00:00Z',updated_at:version,ticket_count:1+(day+i)%4,refund_total:0,utm_campaign:i?'direct':'release_night'});
  for(const [campaign,base]of [['archive_drop',120],['release_night',85]])records.push({source:'instagram',session_date:date,updated_at:version,utm_campaign:campaign,link_clicks:base+day*16,sessions:base-20+day*12});
 }
 return records;
}
export function nextBatch(){
 const date='2026-11-07T23:30:00Z';
 const merch={source:'shopify',id:'1080',created_at:date,updated_at:date,sku:' archive-tee-m ',quantity:2,refund_total:0,utm_campaign:'archive_drop'};
 return [merch,{...merch}, {...merch,id:'1081',sku:'STUDIO-HOOD-L',quantity:1,utm_campaign:'direct'}, {...merch,id:'1082',sku:''}, {source:'ticketing',booking_id:'T1083',created_at:date,updated_at:date,ticket_count:3,refund_total:0,utm_campaign:'release_night'}, ...['archive_drop','release_night'].map((campaign,i)=>({source:'instagram',session_date:'2026-11-07',updated_at:date,utm_campaign:campaign,link_clicks:300-i*55,sessions:245-i*45}))];
}
