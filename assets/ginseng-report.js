import {catalog} from './ginseng-engine.js?v=20261117';
export function report(workflow,filter='all'){
 const all=[...workflow.orders.values()];
 const rows=all.filter(o=>filter==='all'||o.source===filter).map(o=>({...o,gross:catalog[o.sku].price*o.qty,net:catalog[o.sku].price*o.qty-o.refund}));
 const sum=(list,key)=>list.reduce((s,r)=>s+r[key],0);
 const products=Object.entries(catalog).filter(([sku])=>filter==='all'||(filter==='ticketing')===(sku==='EVENT-GA')).map(([sku,item])=>{const match=rows.filter(o=>o.sku===sku);return {...item,sku,units:sum(match,'qty'),gross:sum(match,'gross'),refund:sum(match,'refund'),net:sum(match,'net')};});
 const days=Array.from({length:7},(_,i)=>{const date=`2026-11-0${i+1}`,match=rows.filter(o=>o.date===date);return {day:i+1,shopify:sum(match.filter(o=>o.source==='shopify'),'net'),ticketing:sum(match.filter(o=>o.source==='ticketing'),'net')};});
 const campaigns=['archive_drop','release_night'].map(campaign=>{const visits=[...workflow.traffic.values()].filter(t=>t.campaign===campaign),match=rows.filter(o=>o.campaign===campaign);return {campaign,clicks:sum(visits,'clicks'),sessions:sum(visits,'sessions'),orders:match.length,net:sum(match,'net')};});
 return {rows,products,days,campaigns,gross:sum(rows,'gross'),refund:sum(rows,'refund'),net:sum(rows,'net'),units:sum(rows,'qty'),sessions:sum([...workflow.traffic.values()],'sessions')};
}
