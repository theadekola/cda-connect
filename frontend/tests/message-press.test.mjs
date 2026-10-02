import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import ts from 'typescript';
const source=readFileSync(new URL('../src/MessageActions.tsx',import.meta.url),'utf8');
function harness(){let now=0,next=0,cleanup;const timers=new Map(),opened=[],exports={};const react={useRef:initial=>({current:initial}),useEffect:fn=>{cleanup=fn()}};const require=name=>name==='react'?react:{};
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 runInNewContext(compiled,{exports,require,setTimeout(fn,delay){const id=++next;timers.set(id,{fn,time:now+delay});return id},clearTimeout:id=>timers.delete(id)});
 const handlers=exports.useMessagePress(m=>opened.push(m))({Id:'message'});return{handlers,opened,cleanup:()=>cleanup?.(),tick(ms){now+=ms;for(const [id,t] of timers)if(t.time<=now){timers.delete(id);t.fn()}},down(extra={}){handlers.onPointerDown({button:0,isPrimary:true,clientX:20,clientY:30,...extra})}};
}
test('a message hold opens options at two seconds, not before',()=>{const h=harness();h.down();h.tick(1999);assert.equal(h.opened.length,0);h.tick(1);assert.equal(h.opened.length,1);assert.equal(h.opened[0].Id,'message');h.tick(2000);assert.equal(h.opened.length,1)});
test('tap, scroll, cancellation, leaving and unmount prevent the menu opening',()=>{for(const action of ['onPointerUp','onPointerCancel','onPointerLeave','scroll','unmount']){const h=harness();h.down();h.tick(1000);if(action==='scroll')h.handlers.onPointerMove({clientX:20,clientY:50});else if(action==='unmount')h.cleanup();else h.handlers[action]();h.tick(2000);assert.equal(h.opened.length,0,action)}});
test('secondary buttons and additional fingers do not start a hold',()=>{for(const extra of [{button:2},{isPrimary:false}]){const h=harness();h.down(extra);h.tick(2000);assert.equal(h.opened.length,0)}});
