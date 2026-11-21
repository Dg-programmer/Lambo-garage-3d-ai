let landmarker;

self.addEventListener('message',async({data})=>{
  if(data.type==='init'){
    try{
      const module=await import('./vendor/mediapipe/vision_bundle.mjs');
      const options=await module.FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm',self.location.href).href);
      landmarker=await module.HandLandmarker.createFromOptions(options,{
        baseOptions:{modelAssetPath:new URL('./vendor/mediapipe/hand_landmarker.task',self.location.href).href,delegate:'CPU'},
        runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.54,minHandPresenceConfidence:.53,minTrackingConfidence:.52,
        canvas:new OffscreenCanvas(320,240),
      });
      self.postMessage({type:'ready'});
    }catch(error){
      self.postMessage({type:'error',message:error.message});
    }
  }
  if(data.type==='frame'){
    try{
      const result=landmarker.detectForVideo(data.image,data.time);
      const hands=result.landmarks.map((points,index)=>({
        id:result.handedness?.[index]?.[0]?.categoryName??String(index),
        points,
      }));
      self.postMessage({type:'hands',hands});
    }catch(error){
      self.postMessage({type:'error',message:error.message});
    }finally{
      data.image.close();
    }
  }
});
