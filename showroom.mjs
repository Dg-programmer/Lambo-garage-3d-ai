import { ASSEMBLIES } from './catalog.mjs';
import { T, disposeGraph } from './mesh-kit.mjs';
import { garageScene, inspectionScene } from './garage.mjs';
import { buildCar, loadParts } from './vehicle.mjs';
import { buildAssembly } from './assemblies.mjs';
import { orbiter } from './orbit.mjs';

const find=name=>document.querySelector('[data-'+name+']');
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const main=find('main');
const markers=find('hotspots');
const dialog=find('part-dialog');
const help=find('help');
const model=find('model');
const pins=find('pins');
const list=find('component-list');
const slider=document.querySelector('#explode');
const button=find('inspect');
const links=[...document.querySelectorAll('a[data-assembly]')];
const modeTitle=find('mode-title').lastChild;
const ray=new T.Raycaster();
const point=new T.Vector2();
const vector=new T.Vector3();
const viewPreset={
  yaw:-.230,pitch:-.0047,radius:9.802,center:[-.099,.607,-.023],near:4.9,far:14,
  fov:17.30,orbitFov:31,minimumAspect:1.28,minimumPitch:-.03,clipNear:.42,
};
const cutawayPreset={yaw:.91,pitch:.43,radius:6.37,center:[0,.70,0],near:3.5,far:10.1};
const sizes={front:[1.65,.60,.97],engine:[1.16,.65,.85],wheel:[.59,.70,.68],
  aero:[1.89,.37,.54],cockpit:[1.25,.58,1.07],suspension:[.57,.66,.64]};
const angles={front:[-.53,.56],engine:[-.73,.54],wheel:[-.75,.34],aero:[2.51,.61],
  cockpit:[2.87,.40],suspension:[-.48,.37]};
const detailAngles={front:{shell:[-.26,.57],headlamps:[.24,.56]},engine:{block:[-.63,.78],heads:[-.59,.69],transmission:[-1.04,.64]},
  wheel:{tyre:[.64,.30],rim:[.28,.24],disc:[.28,.30],caliper:[-.41,.29]},
  cockpit:{steering:[2.95,.21],cluster:[3.01,.28],seat:[.63,.36],harness:[.52,.36]}};

let life;
let room;
let car;
let stage;
let cutaway=false;
let active;
let timer;
let returnFocus;
let hands;
let brakes;
let brakeRequest;
let dialogRequest=0;

function makePin(className,caption,index){
  const button=document.createElement('button');
  const number=document.createElement('span');
  const text=document.createElement('span');
  button.className='pin '+className;
  button.type='button';
  button.setAttribute('aria-label',caption);
  number.className='pin-number';
  number.textContent=String(index+1);
  number.setAttribute('aria-hidden','true');
  text.className='pin-text';
  text.textContent=caption;
  text.setAttribute('aria-hidden','true');
  button.append(number,text);
  return button;
}

function pinLayout(items,camera,host) {
  const positions=[];
  const w=host.clientWidth,h=host.clientHeight;
  for(const {pin,location} of items){
    vector.copy(location).project(camera);
    const visible=vector.z>=-1&&vector.z<=1&&Math.abs(vector.x)<.96&&Math.abs(vector.y)<.93;
    pin.hidden=!visible;
    if(!visible)continue;
    const x=T.MathUtils.clamp((vector.x+1)*w/2,27,w-27);
    let y=(1-vector.y)*h/2;
    for(const p of positions) if(Math.hypot(x-p.x,y-p.y)<38)y=p.y-39;
    y=T.MathUtils.clamp(y,30,h-30);
    positions.push({x,y});
    pin.style.left=x+'px';pin.style.top=y+'px';
    const left=w-x<205&&x>w-x;
    pin.dataset.labelSide=left?'left':'right';
    pin.dataset.labelEdge=y<52?'top':h-y<52?'bottom':'center';
    pin.style.setProperty('--label-room',Math.floor((left?x:w-x)-32)+'px');
  }
}

function selectRay(x,y,host,camera){
  const rect=host.getBoundingClientRect();
  point.set((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2);
  ray.setFromCamera(point,camera);
}

function setMode(xray,part){
  if(!stage)return;
  cutaway=xray;
  main.dataset.mode=cutaway?'xray':'garage';
  modeTitle.textContent=cutaway?' X-ray inspection':' Garage view';
  room.xray(cutaway);
  car.setXray(cutaway,part?.id);
  markers.hidden=!cutaway;
  button.setAttribute('aria-pressed',String(cutaway));
  find('inspect-label').textContent=cutaway?'Return to garage':'Inspect the car';
  find('orbit-hint').textContent=cutaway?'Select a marker · Drag to rotate':'Drag to rotate · Scroll or pinch to zoom';
  for(const link of links){
    if(link.dataset.assembly===part?.id)link.setAttribute('aria-current','true');
    else link.removeAttribute('aria-current');
  }
  for(const pin of markers.children){
    if(pin.dataset.part===part?.id)pin.setAttribute('aria-current','true');
    else pin.removeAttribute('aria-current');
  }
  const pose=part?{
    ...cutawayPreset,yaw:part.yaw,pitch:part.pitch,radius:5.98,
    center:[part.anchor[0]*.35,.62+part.anchor[1]*.21,part.anchor[2]*.39],
  }:cutaway?cutawayPreset:viewPreset;
  stage.setHome(pose);
}

function setComponent(part,key){
  if(!active)return;
  const item=part.components.find(component=>component.id===key);
  if(!item)return;
  active.selected=key;
  model.dataset.component=key;
  find('component-name').textContent=item.name;
  find('component-text').textContent=item.text;
  find('part-status').textContent=item.name+' selected.';
  for(const child of list.children)child.setAttribute('aria-pressed',String(child.dataset.component===key));
  for(const child of pins.children){
    if(child.dataset.component===key)child.setAttribute('aria-current','true');
    else child.removeAttribute('aria-current');
  }
  if(active.focused)focusComponent(true);
  active.view?.request();
}

function focusComponent(enabled){
  if(!active?.view)return;
  if(enabled&&active.motion)spreadTo(active.destination,false);
  active.focused=enabled;
  const control=find('component-focus');
  control.setAttribute('aria-pressed',String(enabled));
  control.textContent=enabled?'Frame whole assembly':'Focus component';
  for(const piece of active.assembly.parts)piece.group.visible=!enabled||piece.key===active.selected;
  if(!enabled){active.view.setHome(active.preset);return;}
  const chosen=active.assembly.parts.find(part=>part.key===active.selected);
  if(!chosen)return;
  const box=new T.Box3().setFromObject(chosen.group,true);
  if(active.part.id==='front'&&['louvers','headlamps'].includes(active.selected)){
    box.min.x=box.max.x-(box.max.x-box.min.x)*.31;
  }
  const sphere=box.getBoundingSphere(new T.Sphere());
  const radius=Math.max(.56,sphere.radius*3.51);
  const [yaw,pitch]=detailAngles[active.part.id]?.[active.selected]??[active.preset.yaw,active.preset.pitch];
  active.view.setHome({...active.preset,yaw,pitch,center:sphere.center.toArray(),radius,near:radius*.57,far:Math.max(radius*1.4,active.preset.far)});
}

function spreadTo(value,animate) {
  if(!active)return;
  if(active.focused)focusComponent(false);
  active.destination=value;
  if(animate&&!reduce.matches)active.motion={from:active.amount,to:value,elapsed:0,last:null};
  else {
    active.motion=null;
    active.amount=value;
    active.assembly.setSpread(value);
  }
  slider.value=String(Math.round(value*100));
  slider.setAttribute('aria-valuetext',String(Math.round(value*100))+' percent separated');
  find('spread-output').textContent=slider.value+'%';
  find('spread-toggle').textContent=value>.02?'Assemble':'Explode';
  active.view?.request();
}

function showPart(part,trigger){
  if(!stage||dialog.open)return;
  clearTimeout(timer);
  returnFocus=trigger;
  setMode(true,part);
  timer=setTimeout(()=>{
    stage.pause(true);
    dialog.showModal();
    hands?.syncLayer();
    dialog.scrollTop=0;
    openInspector(part);
  },reduce.matches?0:270);
}

async function openInspector(part){
  const request=++dialogRequest;
  find('assembly-label').textContent=part.label;
  find('assembly-title').textContent=part.name;
  document.querySelector('#assembly-description').textContent=part.description;
  find('source').href=part.source;
  find('spread-toggle').disabled=true;
  slider.disabled=true;
  list.replaceChildren();
  pins.replaceChildren();
  find('component-detail').hidden=true;
  if(part.id==='wheel'&&!brakes){
    find('model-loading').hidden=false;
    brakeRequest??=loadParts('ceramic-brakes.glb',life.signal).then(asset=>{
      if(life.signal.aborted){disposeGraph(asset.scene);return;}
      brakes=asset;
      for(const resource of asset.resources)car.resources.add(resource);
    }).catch(()=>{brakeRequest=null;});
    await brakeRequest;
  }
  if(request!==dialogRequest||!dialog.open)return;
  find('model-loading').hidden=true;
  createInspector(part);
}

function createInspector(part){
  model.dataset.assembly=part.id;
  model.removeAttribute('data-unavailable');
  find('part-message')?.remove();
  find('spread-toggle').disabled=false;
  slider.disabled=false;
  const context=new AbortController();
  const {scene,k}=inspectionScene();
  const assembly=buildAssembly(part.id,k,{car,brakes});
  scene.add(assembly.root);
  assembly.setSpread(1);
  scene.updateMatrixWorld(true);
  const envelope=new T.Box3().setFromObject(assembly.root);
  const center=envelope.getCenter(new T.Vector3());
  const size=envelope.getSize(new T.Vector3());
  const range=Math.max(2.75,2.05*Math.max(size.x*.87,size.z*.83,size.y));
  assembly.setSpread(0);
  scene.updateMatrixWorld(true);
  const [yaw,pitch]=angles[part.id];
  const preset={yaw,pitch,radius:range,
    center:center.toArray(),near:Math.max(1.32,range*.44),far:range*1.8};
  const labelNodes=[];
  for(const [index,piece] of part.components.entries()){
    const item=assembly.parts.find(part=>part.key===piece.id);
    const offset=new T.Box3().setFromObject(item.group).getCenter(new T.Vector3()).sub(item.origin);
    const control=document.createElement('button');
    const count=document.createElement('span');
    const pin=makePin('component-pin',piece.name,index);
    count.textContent=String(index+1);
    count.setAttribute('aria-hidden','true');
    control.type='button';control.dataset.component=piece.id;pin.dataset.component=piece.id;
    control.append(count,document.createTextNode(piece.name));
    control.addEventListener('click',()=>setComponent(part,piece.id),{signal:context.signal});
    pin.addEventListener('click',()=>setComponent(part,piece.id),{signal:context.signal});
    list.append(control);
    pins.append(pin);
    labelNodes.push({pin,location:new T.Vector3(),offset,group:item.group});
  }
  const outline=new T.BoxHelper(assembly.parts[0].group,0xffad7b);
  outline.material.transparent=true;outline.material.opacity=.78;outline.material.depthWrite=false;
  scene.add(outline);
  active={part,scene,assembly,context,preset,amount:0,destination:0,selected:null,focused:false,motion:null,view:null};
  const focus=find('component-focus');
  find('component-detail').hidden=false;
  focus.hidden=false;
  focus.setAttribute('aria-pressed','false');
  focus.textContent='Focus component';
  let view;
  view=orbiter({
    host:model,scene,preset,signal:context.signal,lightweight:true,
    onPick(x,y){
      if(active.focused)return;
      selectRay(x,y,model,view.camera);
      const [hit]=ray.intersectObject(assembly.root,true);
      let node=hit?.object;
      while(node&&!node.userData.component)node=node.parent;
      if(node)setComponent(part,node.userData.component);
    },
    onFrame(_,time){
      if(!active)return false;
      if(active.motion){
        const motion=active.motion;
        if(motion.last!==null)motion.elapsed+=Math.min(135,time-motion.last);
        motion.last=time;
        const progress=Math.min(1,motion.elapsed/770);
        const t=1-(1-progress)**3;
        active.amount=T.MathUtils.lerp(motion.from,motion.to,t);
        assembly.setSpread(active.amount);
        if(progress<1)view.request();
        else active.motion=null;
      }
      outline.visible=!active.focused;
      if(outline.visible){
        const object=assembly.parts.find(item=>item.key===active.selected);
        if(object)outline.setFromObject(object.group);
      }
      if(active.amount>.27&&!active.focused){
        for(const {group,offset,location} of labelNodes)location.copy(group.position).add(offset);
        pinLayout(labelNodes,view.camera,model);
      }else for(const {pin} of labelNodes)pin.hidden=true;
      model.dataset.separation=active.amount.toFixed(3);
      return true;
    },
  });
  active.view=view;
  function showPartFallback(){
    view?.pause(true);
    view?.canvas.remove();
    model.removeAttribute('data-ready');
    model.setAttribute('data-unavailable','');
    pins.hidden=true;
    find('part-message')?.remove();
    const p=document.createElement('p');
    p.dataset.partMessage='';
    p.textContent='The 3D assembly is unavailable. Select a component to read its description.';
    model.append(p);
    find('spread-toggle').disabled=true;
    focus.hidden=true;
    slider.disabled=true;
  }
  pins.hidden=false;
  if(!view)showPartFallback();
  else view.canvas.addEventListener('webglcontextlost',showPartFallback,{signal:context.signal});
  setComponent(part,part.components[0].id);
  spreadTo(1,true);
}

async function enable(){
  if(!('ResizeObserver' in window)||typeof dialog.showModal!=='function')throw new Error('Viewer support is unavailable');
  life=new AbortController();
  let loading=true;
  window.addEventListener('pagehide',()=>{if(loading)life.abort();},{signal:life.signal});
  const asset=await loadParts('huracan-sto.glb',life.signal);
  loading=false;
  if(life.signal.aborted){disposeGraph(asset.scene);return;}
  room=garageScene();
  car=buildCar(room.k,asset);
  room.scene.add(car.root);
  const carBounds=new T.Box3().setFromObject(car.root);
  const projection=[];
  const material=new T.MeshBasicMaterial();
  const geometry=new T.BoxGeometry(1,1,1);
  const proxies=[];
  for(const [i,part] of ASSEMBLIES.entries()){
    const pin=makePin('assembly-pin',part.name,i);
    pin.dataset.part=part.id;
    pin.addEventListener('click',()=>showPart(part,pin),{signal:life.signal});
    markers.append(pin);
    projection.push({pin,location:new T.Vector3(...part.anchor)});
    const box=new T.Mesh(geometry,material);
    box.position.fromArray(part.anchor);box.scale.fromArray(sizes[part.id]);box.updateMatrixWorld();
    box.userData.part=part;
    proxies.push(box);
  }
  stage=orbiter({
    host:main,scene:room.scene,preset:viewPreset,signal:life.signal,
    onResize:room.resizeReflection,
    onPick(x,y){
      selectRay(x,y,main,stage.camera);
      if(!cutaway){
        if(ray.ray.intersectsBox(carBounds))setMode(true);
      }else{
        const [hit]=ray.intersectObjects(proxies);
        if(hit)showPart(hit.object.userData.part,main);
      }
    },
    onFrame(current){
      main.dataset.radius=current.radius.toFixed(2);
      main.dataset.azimuth=current.yaw.toFixed(4);
      if(cutaway)pinLayout(projection,stage.camera,main);
    },
  });
  if(!stage)throw new Error('WebGL is unavailable');
  room.configure(stage.renderer);
  room.loadAppearance(life.signal).then(()=>{
    if(life.signal.aborted)return;
    room.xray(cutaway);
    main.dataset.workshopLight='ready';
    stage?.request();
  }).catch(()=>{});
  main.dataset.triangles=String(car.root.userData.triangles);
  stage.canvas.addEventListener('webglcontextlost',fallback,{signal:life.signal});
  const event={signal:life.signal};
  for(const link of links)link.addEventListener('click',e=>{
    if(e.metaKey||e.altKey||e.ctrlKey||e.shiftKey)return;
    e.preventDefault();
    showPart(ASSEMBLIES.find(part=>part.id===link.dataset.assembly),link);
  },event);
  main.addEventListener('keydown',e=>{
    if(e.target===main&&['Enter',' '].includes(e.key)&&!cutaway){
      e.preventDefault();setMode(true);
    }
  },event);
  button.addEventListener('click',()=>{clearTimeout(timer);setMode(!cutaway);},event);
  find('main-reset').addEventListener('click',()=>stage.reset(),event);
  for(const zoom of document.querySelectorAll('[data-main-zoom]'))zoom.addEventListener('click',()=>{
    stage.zoom(zoom.dataset.mainZoom==='in'?.84:1.18);
  },event);
  find('part-reset').addEventListener('click',()=>active?.view?.reset(),event);
  for(const zoom of document.querySelectorAll('[data-part-zoom]'))zoom.addEventListener('click',()=>{
    active?.view?.zoom(zoom.dataset.partZoom==='in'?.84:1.18);
  },event);
  slider.addEventListener('input',()=>spreadTo(Number(slider.value)/100,false),event);
  find('component-focus').addEventListener('click',()=>focusComponent(!active?.focused),event);
  find('spread-toggle').addEventListener('click',()=>{if(active)spreadTo(active.destination>.02?0:1,true);},event);
  dialog.addEventListener('close',()=>{
    ++dialogRequest;
    find('model-loading').hidden=true;
    if(active){
      active.context.abort();
      disposeGraph(active.scene,car.resources);
      active=null;
    }
    model.removeAttribute('data-ready');
    delete model.dataset.assembly;
    delete model.dataset.component;
    delete model.dataset.separation;
    hands?.syncLayer();
    stage?.pause(false);
    if(!returnFocus?.isConnected||returnFocus.hidden)main.focus({preventScroll:true});
    else returnFocus.focus({preventScroll:true});
  },event);
  find('help-open').addEventListener('click',()=>{
    clearTimeout(timer);stage.pause(true);help.showModal();hands?.syncLayer();
  },event);
  help.addEventListener('close',()=>{hands?.syncLayer();stage?.pause(false);},event);
  const handButton=find('hand-open');
  handButton.addEventListener('click',async()=>{
    if(!hands){
      const {installHandControls}=await import('./hand-controls.mjs');
      if(life.signal.aborted)return;
      hands??=installHandControls({
        signal:life.signal,
        layer:()=>dialog.open?dialog:help.open?help:null,
        currentViewer:()=>help.open?null:dialog.open?active?.view:stage,
        viewer:element=>element.closest('[data-model]')?active?.view:
          element.closest('[data-main]')?stage:null,
      });
    }
    hands.open();
  },event);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!help.open&&!dialog.open&&cutaway){
      clearTimeout(timer);setMode(false);
    }
  },event);
  button.hidden=false;
  find('main-controls').hidden=false;
  find('orbit-hint').textContent='Drag to rotate · Scroll or pinch to zoom';
  find('help-open').hidden=false;
  handButton.hidden=false;
  life.signal.addEventListener('abort',()=>{geometry.dispose();material.dispose();},{once:true});
  window.addEventListener('pagehide',e=>{
    if(!e.persisted){
      if(active){active.context.abort();disposeGraph(active.scene,car.resources);active=null;}
      life.abort();
      car.dispose();
      if(brakes)disposeGraph(brakes.scene);
      room.dispose();
      disposeGraph(room.scene);
    }
  },event);
}

function fallback(){
  clearTimeout(timer);
  if(active){active.context.abort();disposeGraph(active.scene,car?.resources);active=null;}
  if(dialog.open)dialog.close();
  if(help.open)help.close();
  life?.abort();
  if(brakes)disposeGraph(brakes.scene);
  if(room){car?.dispose();room.dispose();disposeGraph(room.scene);}
  main.removeAttribute('data-ready');
  main.removeAttribute('data-mode');
  main.removeAttribute('tabindex');
  main.setAttribute('aria-label','Huracán STO garage preview');
  stage=null;
  modeTitle.textContent=' Garage preview';
  find('orbit-hint').textContent='Open an assembly in the technical guide for its components.';
  for(const item of [button,markers,find('main-controls'),find('help-open'),find('hand-open'),find('hand-dock')])item.hidden=true;
  find('fallback').hidden=false;
}

enable().catch(error=>{if(error.name!=='AbortError')fallback();});
