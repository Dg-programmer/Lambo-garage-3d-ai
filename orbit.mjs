import { T } from './mesh-kit.mjs';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const turn=(n)=>Math.atan2(Math.sin(n),Math.cos(n));

export function orbiter({host,scene,preset,signal,onPick,onFrame,onResize,lightweight=false}) {
  const canvas=document.createElement('canvas');
  const context=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'low-power'});
  if(!context)return null;
  const info=context.getExtension('WEBGL_debug_renderer_info');
  const rendererName=info?context.getParameter(info.UNMASKED_RENDERER_WEBGL):'';
  const software=/swiftshader|software|llvmpipe/i.test(rendererName);
  const renderer=new T.WebGLRenderer({canvas,context,antialias:true});
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=lightweight?1.18:1.04;
  const camera=new T.PerspectiveCamera(38,1,preset.clipNear??.08,100);
  canvas.setAttribute('aria-hidden','true');
  host.prepend(canvas);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const coarse=matchMedia('(pointer: coarse)');
  const current={...preset,center:new T.Vector3(...preset.center)};
  const desired={...preset,center:current.center.clone()};
  let initial=preset;
  let bounds={near:preset.near,far:preset.far};
  let frame=0,last=0,dirty=true,resized=true,paused=false,disposed=false;
  let projectionReady=false;
  let viewportWidth=0,viewportHeight=0,viewportRatio=0;
  let picked=false,pinching=false,span=0;
  const pointers=new Map();

  function schedule(){
    dirty=true;
    if(!frame&&!paused&&!disposed&&!document.hidden)frame=requestAnimationFrame(draw);
  }

  function resize(){
    if(!host.clientWidth||!host.clientHeight)return false;
    const w=host.clientWidth,h=host.clientHeight;
    const limit=software?430000:coarse.matches?950000:4000000;
    const maxDimension=renderer.capabilities.maxTextureSize;
    const ratio=Math.min(devicePixelRatio||1,coarse.matches?1.45:2,Math.sqrt(limit/(w*h)),maxDimension/w,maxDimension/h);
    resized=false;
    if(w===viewportWidth&&h===viewportHeight&&ratio===viewportRatio)return true;
    viewportWidth=w;viewportHeight=h;viewportRatio=ratio;
    renderer.setPixelRatio(ratio);
    renderer.setSize(w,h,false);
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
    onResize?.(canvas.width,canvas.height,renderer);
    return true;
  }

  function fittedFov(){
    if(!initial.fov)return camera.aspect<1.03?44:38;
    const rotation=Math.abs(turn(current.yaw-initial.yaw));
    const fov=T.MathUtils.lerp(initial.fov,initial.orbitFov??initial.fov,T.MathUtils.smoothstep(rotation,.14,.88));
    const fit=Math.max(1,(initial.minimumAspect??0)/camera.aspect);
    return T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(fov)*.5)*fit));
  }

  function draw(time){
    frame=0;
    if(resized&&!resize())return;
    const dt=last?Math.min(.13,(time-last)/1000):.028;
    last=time;
    const amount=reduce.matches?1:1-Math.exp(-dt*10.8);
    const yawDifference=turn(desired.yaw-current.yaw);
    current.yaw=turn(current.yaw+yawDifference*amount);
    current.pitch=T.MathUtils.lerp(current.pitch,desired.pitch,amount);
    current.radius=T.MathUtils.lerp(current.radius,desired.radius,amount);
    current.center.lerp(desired.center,amount);
    const targetFov=fittedFov();
    const fovDifference=Math.abs(targetFov-camera.fov);
    if(!projectionReady||fovDifference>.005){
      camera.fov=projectionReady?T.MathUtils.lerp(camera.fov,targetFov,amount):targetFov;
      camera.updateProjectionMatrix();
      projectionReady=true;
    }
    const active=Math.abs(yawDifference)+Math.abs(current.pitch-desired.pitch)+Math.abs(current.radius-desired.radius)+current.center.distanceTo(desired.center)>.0018||fovDifference>.02;
    const horizontal=Math.cos(current.pitch)*current.radius;
    camera.position.set(Math.sin(current.yaw)*horizontal,Math.sin(current.pitch)*current.radius,Math.cos(current.yaw)*horizontal).add(current.center);
    camera.lookAt(current.center);camera.updateMatrixWorld();
    if(onFrame?.(current,time))dirty=true;
    if(dirty||active){
      renderer.render(scene,camera);
      dirty=false;
      host.dataset.ready='true';
    }
    if(active)schedule();
  }

  function setHome(next,immediate=false){
    initial=next;
    bounds={near:next.near,far:next.far};
    desired.yaw=next.yaw;desired.pitch=next.pitch;desired.radius=next.radius;desired.center.fromArray(next.center);
    if(immediate||reduce.matches){
      current.yaw=desired.yaw;current.pitch=desired.pitch;current.radius=desired.radius;current.center.copy(desired.center);
    }
    schedule();
  }

  function zoom(factor){
    desired.radius=clamp(desired.radius*factor,bounds.near,bounds.far);
    schedule();
  }

  function shift(x,y){
    desired.yaw=turn(desired.yaw+x);
    desired.pitch=clamp(desired.pitch+y,initial.minimumPitch??.035,1.38);
    schedule();
  }

  const side=new T.Vector3();
  const up=new T.Vector3();
  function pan(dx,dy){
    camera.matrixWorld.extractBasis(side,up,new T.Vector3());
    const scale=desired.radius*.00142;
    desired.center.addScaledVector(side,-dx*scale).addScaledVector(up,dy*scale);
    desired.center.x=clamp(desired.center.x,initial.center[0]-1.8,initial.center[0]+1.8);
    desired.center.y=clamp(desired.center.y,initial.center[1]-1.05,initial.center[1]+1.45);
    desired.center.z=clamp(desired.center.z,initial.center[2]-1.8,initial.center[2]+1.8);
    schedule();
  }

  const event={signal};
  host.addEventListener('pointerdown',e=>{
    if(e.target!==canvas||(e.pointerType==='mouse'&&e.button!==0))return;
    if(!pointers.size)picked=false;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,ox:e.clientX,oy:e.clientY});
    host.setPointerCapture(e.pointerId);
    if(e.pointerType==='mouse')host.focus({preventScroll:true});
    if(pointers.size===2){
      const [a,b]=pointers.values();span=Math.hypot(a.x-b.x,a.y-b.y);pinching=true;picked=true;
    }
  },event);
  host.addEventListener('pointermove',e=>{
    const p=pointers.get(e.pointerId);
    if(!p)return;
    const dx=e.clientX-p.x,dy=e.clientY-p.y;
    p.x=e.clientX;p.y=e.clientY;
    if(Math.hypot(p.x-p.ox,p.y-p.oy)>5)picked=true;
    if(pointers.size>=2){
      const [a,b]=pointers.values();
      const next=Math.hypot(a.x-b.x,a.y-b.y);
      if(next>10&&span>10)zoom(span/next);
      span=next;
    }else if(picked)shift(-dx*.008,dy*.007);
    if(picked)host.toggleAttribute('data-dragging',true);
  },event);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])host.addEventListener(type,e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.delete(e.pointerId);
    if(pointers.size)return;
    host.removeAttribute('data-dragging');
    if(type==='pointerup'&&!picked&&!pinching)onPick?.(e.clientX,e.clientY);
    pinching=false;
  },event);
  host.addEventListener('wheel',e=>{
    if(e.target!==canvas||e.ctrlKey)return;
    e.preventDefault();
    const delta=e.deltaY*(e.deltaMode===1?14:e.deltaMode===2?host.clientHeight:1);
    zoom(Math.exp(clamp(delta,-480,480)*.00152));
  },{...event,passive:false});
  host.addEventListener('keydown',e=>{
    if(e.target!==host||e.altKey||e.ctrlKey||e.metaKey)return;
    const angle={ArrowLeft:[.18,0],ArrowRight:[-.18,0],ArrowUp:[0,.13],ArrowDown:[0,-.13]}[e.key];
    if(angle){e.preventDefault();shift(...angle);}
    else if(['+','=','-','Home'].includes(e.key)){
      e.preventDefault();
      if(e.key==='Home')setHome(initial);
      else zoom(e.key==='-'?1.15:.87);
    }
  },event);

  function requestResize(){resized=true;schedule();}
  function watchDensity(){
    matchMedia('(resolution: '+(devicePixelRatio||1)+'dppx)').addEventListener('change',()=>{
      requestResize();
      if(!signal.aborted)watchDensity();
    },{once:true,signal});
  }
  watchDensity();
  coarse.addEventListener('change',requestResize,event);
  const sizing=new ResizeObserver(requestResize);
  sizing.observe(host);
  reduce.addEventListener('change',schedule,event);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(frame);frame=0;last=0;}
    else schedule();
  },event);
  function dispose(){
    if(disposed)return;
    disposed=true;
    cancelAnimationFrame(frame);sizing.disconnect();
    renderer.dispose();canvas.remove();
    if(!context.isContextLost())renderer.forceContextLoss();
  }
  signal.addEventListener('abort',dispose,{once:true});
  schedule();
  return {
    camera,canvas,renderer,request:schedule,setHome,zoom,pan,
    drag:(dx,dy)=>shift(-dx*.008,dy*.007),
    pickAt:(x,y)=>onPick?.(x,y),
    reset:()=>setHome(initial),
    pause(value){paused=value;if(value){cancelAnimationFrame(frame);frame=0;last=0;}else schedule();},
  };
}
