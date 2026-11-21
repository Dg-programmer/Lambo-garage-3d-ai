import { gestureTracker } from './gestures.mjs';

const here=name=>new URL(name,import.meta.url).href;
const query=name=>document.querySelector('[data-hand-'+name+']');
const chains=[[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[17,0]];
const aborted=()=>new DOMException('Tracking stopped','AbortError');

function workerBackend(signal) {
  return new Promise((resolve,reject)=>{
    const worker=new Worker(here('./hand-worker.js'));
    let pending,initialized=false;
    const timeout=setTimeout(()=>fail(new Error('Hand model did not load')),16000);
    function fail(reason) {
      clearTimeout(timeout);
      worker.terminate();
      if(!initialized)reject(reason);
      else pending?.reject(reason);
    }
    signal.addEventListener('abort',()=>fail(aborted()),{once:true});
    worker.addEventListener('error',event=>{event.preventDefault();fail(new Error(event.message||'Worker failed'));});
    worker.addEventListener('message',({data})=>{
      if(data.type==='ready'){
        clearTimeout(timeout);
        initialized=true;
        resolve({
          async infer(video,time) {
            const image=await createImageBitmap(video);
            if(signal.aborted){image.close();throw aborted();}
            return new Promise((resolve,reject)=>{
              pending={resolve,reject};
              try{worker.postMessage({type:'frame',image,time},[image]);}
              catch(error){image.close();pending=null;reject(error);}
            });
          },
          close:()=>worker.terminate(),
          period:42,
          name:'worker',
        });
      }else if(data.type==='hands'){
        pending?.resolve(data.hands);
        pending=null;
      }else if(data.type==='error')fail(new Error(data.message));
    });
    worker.postMessage({type:'init'});
  });
}

async function trackingBackend(signal){
  if(typeof Worker==='function'&&typeof OffscreenCanvas==='function'&&typeof createImageBitmap==='function'){
    try{return await workerBackend(signal);}
    catch(error){if(signal.aborted)throw error;}
  }
  const vision=await import('./vendor/mediapipe/vision_bundle.mjs');
  const files=await vision.FilesetResolver.forVisionTasks(here('./vendor/mediapipe/wasm'));
  if(signal.aborted)throw aborted();
  const landmarker=await vision.HandLandmarker.createFromOptions(files,{
    baseOptions:{modelAssetPath:here('./vendor/mediapipe/hand_landmarker.task'),delegate:'CPU'},
    runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.54,minHandPresenceConfidence:.53,minTrackingConfidence:.52,
  });
  if(signal.aborted){landmarker.close();throw aborted();}
  return {
    infer(video,time){
      const result=landmarker.detectForVideo(video,time);
      return result.landmarks.map((points,index)=>({id:result.handedness?.[index]?.[0]?.categoryName??String(index),points}));
    },
    close:()=>landmarker.close(),
    period:75,
    name:'browser',
  };
}

function scrollOwner(element){
  for(let parent=element;parent&&parent!==document.body;parent=parent.parentElement){
    if(parent.scrollHeight>parent.clientHeight+3&&/auto|scroll/.test(getComputedStyle(parent).overflowY))return parent;
  }
  return window;
}

function adjustRange(range,x){
  const box=range.getBoundingClientRect();
  const min=Number(range.min||0),max=Number(range.max||100);
  const value=min+(max-min)*Math.max(0,Math.min(1,(x-box.left)/box.width));
  range.value=String(value);
  range.dispatchEvent(new Event('input',{bubbles:true}));
}

export function installHandControls({signal,layer,viewer,currentViewer}){
  const dock=query('dock'),video=query('video'),cursor=query('cursor'),status=query('status');
  const preview=query('preview'),canvas=query('skeleton');
  const toggle=query('open'),start=query('start'),stop=query('stop');
  const compact=query('compact');
  const tip=canvas.getContext('2d');
  const gesture=gestureTracker();
  let controller,stream,backend,frame;
  let isBusy=false,last=-1,lastVideo=-1;
  let hold=null;

  function message(text,state){
    if(status.textContent!==text)status.textContent=text;
    status.dataset.state=state;
  }

  function moveDock(){
    const surface=layer()||document.body;
    if(dock.parentElement!==surface){
      if(surface.moveBefore){
        surface.moveBefore(dock,null);surface.moveBefore(cursor,null);
      }else{
        surface.append(dock,cursor);
        if(stream)video.play().catch(()=>{});
      }
    }
  }

  function requestDock(){
    if(!dock.hidden){closeDock();return;}
    moveDock();
    dock.hidden=false;
    toggle.setAttribute('aria-expanded','true');
    start.focus({preventScroll:true});
  }

  function compactMode(value){
    dock.toggleAttribute('data-compact',value);
    compact.setAttribute('aria-expanded',String(!value));
    compact.textContent=value?'Expand':'Minimize';
  }

  function shutdown(text='Camera off. Enable it to resume.',state='off'){
    controller?.abort();
    controller=null;
    if(frame)cancelAnimationFrame(frame);
    frame=0;
    stream?.getTracks().forEach(track=>track.stop());
    backend?.close();
    stream=backend=null;
    video.srcObject=null;
    isBusy=false;
    gesture.reset();
    hold=null;
    preview.hidden=cursor.hidden=true;
    start.hidden=false;
    start.disabled=false;
    stop.hidden=true;
    compact.hidden=true;
    compactMode(false);
    dock.removeAttribute('data-backend');
    message(text,state);
  }

  function closeDock(){
    shutdown();
    dock.hidden=true;
    toggle.setAttribute('aria-expanded','false');
    if(!layer())toggle.focus({preventScroll:true});
  }

  function displayHands(hands){
    if(!tip)return;
    const w=canvas.width,h=canvas.height;
    tip.clearRect(0,0,w,h);
    tip.strokeStyle='#ffad78';
    tip.lineWidth=1.15;
    tip.fillStyle='#d8f5ff';
    for(const {points} of hands){
      for(const chain of chains){
        tip.beginPath();
        chain.forEach((i,idx)=>{
          const p=points[i],x=(1-p.x)*w,y=p.y*h;
          if(idx===0)tip.moveTo(x,y);else tip.lineTo(x,y);
        });
        tip.stroke();
      }
      for(const p of points){
        tip.beginPath();tip.arc((1-p.x)*w,p.y*h,1.7,0,Math.PI*2);tip.fill();
      }
    }
  }

  function act(command){
    if(command.type==='cancel'){hold=null;return;}
    if(command.type==='zoom'){
      const rig=currentViewer();
      rig?.zoom(command.factor);
      if(Math.hypot(command.dx,command.dy)>2)rig?.pan(command.dx,command.dy);
      return;
    }
    if(command.type==='down'){
      const element=document.elementFromPoint(command.at.x,command.at.y);
      if(!element)return;
      const control=element.closest('button,a[href],input');
      hold={element,control,rig:control?null:viewer(element),owner:scrollOwner(element)};
      return;
    }
    if(!hold)return;
    if(command.type==='drag'){
      if(hold.control?.matches('input[type="range"]'))adjustRange(hold.control,command.at.x);
      else if(hold.rig)hold.rig.drag(command.dx,command.dy);
      else hold.owner.scrollBy({top:-command.dy*1.48,left:0,behavior:'instant'});
    }else if(command.type==='tap'){
      if(hold.control?.matches('input[type="range"]'))adjustRange(hold.control,command.at.x);
      else if(hold.control?.isConnected&&!hold.control.disabled&&hold.control!==start)hold.control.click();
      else if(hold.element.isConnected)hold.rig?.pickAt(command.at.x,command.at.y);
      hold=null;
    }
  }

  function result(hands,time){
    displayHands(hands);
    const pose=gesture.update(hands,{width:innerWidth,height:innerHeight},time,video.videoWidth/video.videoHeight||4/3);
    cursor.hidden=!pose.cursor;
    if(pose.cursor){
      cursor.style.transform='translate('+(pose.cursor.x-13)+'px,'+(pose.cursor.y-13)+'px)';
      cursor.dataset.pose=pose.pose;
    }
    for(const command of pose.commands) act(command);
    if(!controller)return;
    const text={waiting:'Show an open hand in the preview.',point:'Hand detected. Point to aim.',pinch:'Pinch active. Move to orbit or scroll.',zoom:'Two hands tracking. Spread to zoom.'};
    message(text[pose.pose],'tracking');
  }

  function tick(time){
    frame=0;
    if(!controller||!backend)return;
    frame=requestAnimationFrame(tick);
    if(isBusy || time-last<backend.period || video.readyState<2 || lastVideo===video.currentTime)return;
    const request=controller;
    last=time;
    lastVideo=video.currentTime;
    isBusy=true;
    Promise.resolve().then(()=>backend.infer(video,time)).then(hands=>{
      if(request!==controller)return;
      isBusy=false;
      result(hands,time);
    }).catch(()=>{
      if(request===controller)shutdown('Hand tracking paused after a camera error. Try enabling it again.','error');
    });
  }

  async function turnOn(){
    if(controller)return;
    if(!navigator.mediaDevices?.getUserMedia){
      message('Open the showroom on HTTPS or localhost to use a camera.','error');
      return;
    }
    const request=new AbortController();
    controller=request;
    start.hidden=true;stop.hidden=false;
    message('Waiting for camera permission…','loading');
    try{
      const captured=await navigator.mediaDevices.getUserMedia({
        audio:false,video:{facingMode:{ideal:'user'},width:{ideal:640},height:{ideal:480}},
      });
      if(controller!==request){captured.getTracks().forEach(track=>track.stop());return;}
      stream=captured;
      video.srcObject=stream;
      for(const track of stream.getVideoTracks())track.addEventListener('ended',()=>{
        if(controller===request)shutdown('Camera disconnected. Enable it again to continue.','error');
      },{once:true,signal:request.signal});
      preview.hidden=false;
      await video.play();
      if(controller!==request)return;
      message('Loading the hand-tracking model…','loading');
      const ready=await trackingBackend(request.signal);
      if(controller!==request){ready.close();return;}
      backend=ready;
      dock.dataset.backend=backend.name;
      compact.hidden=false;
      compactMode(true);
      last=lastVideo=-1;
      message('Show an open hand in the preview.','tracking');
      frame=requestAnimationFrame(tick);
    }catch(error){
      if(controller!==request)return;
      const denied=error.name==='NotAllowedError';
      const missing=error.name==='NotFoundError';
      shutdown(denied?'Camera permission is blocked. Allow access to use hand controls.':missing?'A front camera could not be found.':'The camera or hand model could not start. Try again.','error');
    }
  }

  query('close').addEventListener('click',closeDock,{signal});
  start.addEventListener('click',turnOn,{signal});
  stop.addEventListener('click',()=>shutdown(),{signal});
  compact.addEventListener('click',()=>compactMode(!dock.hasAttribute('data-compact')),{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&controller)shutdown('Camera paused while this tab was hidden.');},{signal});
  window.addEventListener('pagehide',()=>{if(controller)shutdown();},{signal});
  signal.addEventListener('abort',()=>shutdown(),{once:true});
  return {open:requestDock,syncLayer:moveDock};
}
