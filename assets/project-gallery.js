(() => {
 'use strict';
 const dialog=document.getElementById('project-dialog');
 const pack=document.getElementById('project-pack');
 const expanded=document.getElementById('project-expanded');
 const title=document.getElementById('project-dialog-title');
 const back=document.getElementById('project-back');
 const opener=document.getElementById('open-projects');
 const sources=[document.querySelector('.project-feature'),...document.querySelectorAll('#project-library>article')];
 let selected=null,returnPoint=null,lastCard=null;
 const canAnimate=()=>!matchMedia('(prefers-reduced-motion: reduce)').matches&&!document.documentElement.classList.contains('no-motion');
 const animate=(element,frames,options)=>{if(canAnimate())element.animate(frames,options);};
 function restore(){
  if(selected&&returnPoint){returnPoint.replaceWith(selected);selected.classList.remove('expanded-project');}
  selected=null;returnPoint=null;
 }
 function showPack(focus=true){
  restore();expanded.hidden=true;pack.hidden=false;back.hidden=true;title.textContent='Projects.';
  if(focus)lastCard?.focus();
 }
 sources.forEach((source,index)=>{
  const button=document.createElement('button');button.type='button';button.className='pack-card';
  const number=document.createElement('span');number.className='pack-number';number.textContent=String(index+1).padStart(2,'0');
  const category=document.createElement('span');category.className='pack-category';category.textContent=index===0?'DATA ENGINEERING · WORKFLOW DEMO':source.querySelector('.project-card-label,.custom-card-kind')?.textContent||'PROJECT';
  const heading=document.createElement('h3');heading.textContent=source.querySelector('h3').textContent;
  const summary=document.createElement('p');summary.textContent=source.querySelector('p')?.textContent||'';
  const action=document.createElement('span');action.className='pack-action';action.textContent=index===0?'Explore demo':'Explore project';
  button.append(number,category,heading,summary,action);pack.append(button);
  button.addEventListener('click',()=>{
   lastCard=button;selected=source;returnPoint=document.createComment('project return position');source.replaceWith(returnPoint);
   expanded.replaceChildren(source);source.classList.add('expanded-project');pack.hidden=true;expanded.hidden=false;back.hidden=false;title.textContent=heading.textContent;
   source.querySelectorAll('.project-card-details').forEach(details=>details.open=true);
   expanded.focus({preventScroll:true});dialog.scrollTop=0;
   animate(expanded,[{opacity:0,transform:'perspective(1400px) rotateY(-18deg) scale(.9)'},{opacity:1,transform:'perspective(1400px) rotateY(0deg) scale(1)'}],{duration:450,easing:'cubic-bezier(.2,.8,.2,1)'});
   window.dispatchEvent(new Event('resize'));
  });
 });
 opener.querySelector('span').textContent=String(sources.length).padStart(2,'0');
 opener.addEventListener('click',()=>{
  showPack(false);dialog.showModal();document.body.classList.add('project-modal-open');dialog.scrollTop=0;
  [...pack.children].forEach((card,index)=>animate(card,[{opacity:0,transform:`translateY(70px) translateX(${(1-index)*90}px) rotateY(65deg) rotateZ(${(index-1)*9}deg) scale(.8)`},{opacity:1,transform:'translateY(0) translateX(0) rotateY(0) rotateZ(0) scale(1)'}],{duration:650,delay:index*85,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'}));
 });
 back.addEventListener('click',()=>showPack());
 document.getElementById('project-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
 dialog.addEventListener('close',()=>{restore();document.body.classList.remove('project-modal-open');opener.focus({preventScroll:true});window.dispatchEvent(new Event('resize'));});
 const gallery=document.getElementById('gallery');
 const prev=document.getElementById('gallery-prev'),next=document.getElementById('gallery-next');
 function update(){prev.disabled=gallery.scrollLeft<2;next.disabled=gallery.scrollLeft+gallery.clientWidth>=gallery.scrollWidth-2;}
 function move(direction){gallery.scrollBy({left:direction*(gallery.firstElementChild?.getBoundingClientRect().width+20||gallery.clientWidth*.85),behavior:canAnimate()?'smooth':'instant'});}
 prev.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
 gallery.addEventListener('scroll',update,{passive:true});
 gallery.addEventListener('keydown',event=>{if(event.target!==gallery)return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();move(event.key==='ArrowRight'?1:-1);}});
 new ResizeObserver(update).observe(gallery);
 new MutationObserver(()=>{gallery.scrollLeft=0;requestAnimationFrame(update);}).observe(gallery,{childList:true});
 update();
})();
