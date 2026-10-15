type VisibleViewport={height:number;offsetTop:number;scale:number};

export function chatViewportBounds(viewport:VisibleViewport|null,layoutHeight:number){
 // Pinch zoom should retain the browser's normal panning behaviour.
 if(!viewport||Math.abs(viewport.scale-1)>.01)return {height:layoutHeight,top:0,keyboard:false};
 const height=Number.isFinite(viewport.height)&&viewport.height>0?viewport.height:layoutHeight;
 const reduced=height<layoutHeight-1;
 // Some iOS versions retain a stale offset after the keyboard is dismissed.
 const top=reduced&&Number.isFinite(viewport.offsetTop)?Math.max(0,viewport.offsetTop):0;
 return {height,top,keyboard:layoutHeight-height>100};
}

export function bindChatViewport(frame:HTMLElement,thread:HTMLElement){
 const root=document.documentElement,viewport=window.visualViewport,mobile=window.matchMedia('(max-width:767px)');
 const previousScroll={left:window.scrollX,top:window.scrollY},hadClass=root.classList.contains('chat-viewport-active');
 let raf=0,disposed=false,pinned=thread.scrollHeight-thread.scrollTop-thread.clientHeight<100;
 const timers=new Set<ReturnType<typeof setTimeout>>();
 root.classList.add('chat-viewport-active');
 const onThreadScroll=()=>{pinned=thread.scrollHeight-thread.scrollTop-thread.clientHeight<100};
 const update=()=>{
  raf=0;if(disposed)return;
  const bounds=chatViewportBounds(viewport,window.innerHeight);
  frame.style.setProperty('--chat-viewport',bounds.height+'px');
  frame.style.setProperty('--chat-viewport-top',bounds.top+'px');
  frame.style.setProperty('--chat-bottom-inset',bounds.keyboard?'0px':'env(safe-area-inset-bottom)');
  // iOS may also scroll the document to reveal a focused textarea. The thread
  // owns scrolling while chat is open; moving the document hides the header.
  if(mobile.matches&&(!viewport||Math.abs(viewport.scale-1)<.01)&&(window.scrollX||window.scrollY))window.scrollTo({left:0,top:0,behavior:'instant'});
  if(pinned)thread.scrollTop=thread.scrollHeight;
 };
 const schedule=()=>{if(!disposed&&!raf)raf=requestAnimationFrame(update)};
 const settle=()=>{
  schedule();
  for(const delay of [100,350]){const timer=setTimeout(()=>{timers.delete(timer);schedule()},delay);timers.add(timer)}
 };
 thread.addEventListener('scroll',onThreadScroll,{passive:true});
 viewport?.addEventListener('resize',schedule);viewport?.addEventListener('scroll',schedule);
 window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('orientationchange',settle);
 frame.addEventListener('focusin',settle);frame.addEventListener('focusout',settle);
 update();
 return()=>{
  disposed=true;cancelAnimationFrame(raf);for(const timer of timers)clearTimeout(timer);
  thread.removeEventListener('scroll',onThreadScroll);
  viewport?.removeEventListener('resize',schedule);viewport?.removeEventListener('scroll',schedule);
  window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule);window.removeEventListener('orientationchange',settle);
  frame.removeEventListener('focusin',settle);frame.removeEventListener('focusout',settle);
  for(const key of ['--chat-viewport','--chat-viewport-top','--chat-bottom-inset'])frame.style.removeProperty(key);
  if(!hadClass)root.classList.remove('chat-viewport-active');
  window.scrollTo({...previousScroll,behavior:'instant'});
 };
}
