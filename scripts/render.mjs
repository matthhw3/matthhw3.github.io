const escape=(value)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function renderContent(template,content,owner){
 const tagged=template.replace(/__TAGS_([a-z_]+)__/g,(_,key)=>(content.copy[key]||'').split(',').map((tag)=>tag.trim()).filter(Boolean).map((tag)=>`<span>${escape(tag)}</span>`).join(''));
 return tagged.replace(/__COPY_([a-z_]+)__|__LINK_(LINKEDIN|EMAIL)__|__BLOCKS_(home|interests|experience|projects|photos|contact)__|__OWNER_EDIT__/g,(token,key,link,section)=>{
  if(key)return escape(content.copy[key]??'');
  if(link)return escape(link==='LINKEDIN'?content.links.linkedin:content.links.email);
  if(section)return content.blocks.filter(block=>block.section===section).map(block=>`<article class="custom-card"><span class="custom-card-kind">${escape(block.kind==='note'?'':block.kind)}</span><h3>${escape(block.title)}</h3><p>${escape(block.body)}</p>${block.stack?`<div class="stack-chips">${block.stack.split(',').map(tag=>tag.trim()).filter(Boolean).map(tag=>`<span>${escape(tag)}</span>`).join('')}</div>`:''}${block.url?`<a href="${escape(block.url)}" target="_blank" rel="noopener noreferrer">${escape(block.linkLabel||'Learn more')}</a>`:''}</article>`).join('');
  return owner?'<a class="owner-edit" href="/edit">Edit site</a>':'';
 });
}
