import { T, kitForScene, paintedTexture } from './mesh-kit.mjs';
import { HDRLoader } from './vendor/HDRLoader.js';
import { Reflector } from './vendor/Reflector.js';

const workshopIntensity=.46;
const smooth=T.MathUtils.smoothstep;
const textureUrl=name=>new URL('./assets/'+name,import.meta.url).href;

function lights(scene,inspection=false) {
  const environment=paintedTexture(512,256,(g,w,h)=>{
    const grad=g.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,'#2b323f');
    grad.addColorStop(.37,'#7a818a');
    grad.addColorStop(.56,'#525961');
    grad.addColorStop(.72,'#242930');
    grad.addColorStop(1,'#101319');
    g.fillStyle=grad;g.fillRect(0,0,w,h);
    g.fillStyle='#fcfcf3';g.fillRect(57,29,128,35);g.fillRect(307,33,121,29);
    g.fillStyle='#c9e8f9';g.fillRect(30,90,176,21);g.fillRect(253,82,67,17);
  });
  environment.mapping=T.EquirectangularReflectionMapping;
  scene.environment=environment;
  scene.environmentIntensity=inspection?.91:.63;
  const key=new T.DirectionalLight(0xf3f6ff,inspection?2.65:2.5);
  const rim=new T.DirectionalLight(0xd0eaff,inspection?1.48:1.27);
  const fill=new T.HemisphereLight(0xd9e1eb,0x333c4b,inspection?1.04:.61);
  const bounce=new T.DirectionalLight(inspection?0xffe7d9:0xddeaff,inspection?.43:.38);
  key.position.set(5.6,4.9,1.1);
  rim.position.set(2.6,3.3,-4.9);
  bounce.position.set(-4.2,2.6,4.8);
  if(inspection){
    key.position.set(4.2,5.4,5.7);
    rim.position.set(-5.2,4.3,-3.95);
    const frontFill=new T.DirectionalLight(0xe3eaf2,.89);
    frontFill.position.set(.6,2.9,-4.5);
    scene.add(frontFill);
  }else{
    key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);
    Object.assign(key.shadow.camera,{left:-4.7,right:4.7,bottom:-4.7,top:4.7,near:.65,far:19});
    key.shadow.normalBias=.011;
    key.shadow.bias=-.00028;
    key.shadow.intensity=.78;
  }
  scene.add(key,rim,fill,bounce);
}

async function loadEnvironment(scene,signal){
  const texture=await new HDRLoader().loadAsync(textureUrl('small-workshop-1k.hdr'));
  if(signal.aborted){texture.dispose();return;}
  const {fromHalfFloat,toHalfFloat}=T.DataUtils;
  const data=texture.image.data;
  for(let i=0;i<data.length;i+=4){
    const r=fromHalfFloat(data[i]),g=fromHalfFloat(data[i+1]),b=fromHalfFloat(data[i+2]);
    const peak=Math.max(r,g,b);
    const scale=peak<=1.35?1:(1.35+1.55*(1-Math.exp((1.35-peak)/1.55)))/peak;
    const gray=r*.2126+g*.7152+b*.0722;
    data[i]=toHalfFloat(T.MathUtils.lerp(r,gray,.82)*scale);
    data[i+1]=toHalfFloat(T.MathUtils.lerp(g,gray,.82)*scale);
    data[i+2]=toHalfFloat(T.MathUtils.lerp(b,gray,.82)*scale);
  }
  texture.mapping=T.EquirectangularReflectionMapping;
  scene.environment?.dispose();
  scene.environment=texture;
  scene.environmentRotation.y=-1.49;
}

async function loadFloor(material,signal){
  const loader=new T.TextureLoader();
  const maps={
    map:'reference-concrete-color.webp',
    normalMap:'reference-concrete-normal.webp',
    roughnessMap:'reference-concrete-rough.webp',
  };
  await Promise.allSettled(Object.entries(maps).map(async([slot,name])=>{
    const texture=await loader.loadAsync(textureUrl(name));
    if(signal.aborted){texture.dispose();return;}
    if(slot==='map')texture.colorSpace=T.SRGBColorSpace;
    texture.wrapS=texture.wrapT=T.RepeatWrapping;
    texture.repeat.set(11,11);
    texture.anisotropy=8;
    material[slot]=texture;
    material.needsUpdate=true;
  }));
}

function floor(parent,material,y=-.009){
  const slab=new T.Mesh(new T.PlaneGeometry(33,33),material);
  slab.rotation.x=-Math.PI/2;
  slab.position.y=y;
  parent.add(slab);
  return slab;
}

function studioReflection(){
  const base=Reflector.ReflectorShader;
  const shader={
    ...base,
    uniforms:{
      ...base.uniforms,texel:{value:new T.Vector2(1/384,1/384)},
      floorNormal:{value:null},floorColor:{value:null},floorRoughness:{value:null},floorReady:{value:0},
    },
    vertexShader:base.vertexShader
      .replace('varying vec4 vUv;','varying vec4 vUv;\n\t\tvarying vec2 vSurfaceUv;')
      .replace('vUv = textureMatrix','vSurfaceUv = uv * 11.0;\n\t\t\tvUv = textureMatrix'),
    fragmentShader:base.fragmentShader
      .replace('varying vec4 vUv;',[
        'varying vec4 vUv;','varying vec2 vSurfaceUv;','uniform vec2 texel;',
        'uniform sampler2D floorNormal;','uniform sampler2D floorColor;',
        'uniform sampler2D floorRoughness;','uniform float floorReady;',
      ].join('\n'))
      .replace('vec4 base = texture2DProj( tDiffuse, vUv );',[
        'vec2 p = vUv.xy / vUv.w;',
        'float roughness = 0.68;',
        'float scuffs = 0.43;',
        'if ( floorReady > 0.5 ) {',
        '  vec2 relief = texture2D( floorNormal, vSurfaceUv ).rg * 2.0 - 1.0;',
        '  roughness = texture2D( floorRoughness, vSurfaceUv ).g;',
        '  scuffs = smoothstep( 0.065, 0.31, texture2D( floorColor, vSurfaceUv ).g );',
        '  p += relief * (0.009 + roughness * 0.016);',
        '}',
        'vec2 blur = texel * (0.85 + roughness * 2.4);',
        'vec4 base = texture2D( tDiffuse, p ) * 0.52;',
        'base += (texture2D( tDiffuse, p + vec2( blur.x, 0.0 ) )',
        '       + texture2D( tDiffuse, p - vec2( blur.x, 0.0 ) )',
        '       + texture2D( tDiffuse, p + vec2( 0.0, blur.y ) )',
        '       + texture2D( tDiffuse, p - vec2( 0.0, blur.y ) )) * 0.12;',
        'vec3 cement = color * mix( 0.16, 1.08, scuffs );',
        'vec3 sheen = base.rgb / ( 1.0 + base.rgb * 0.55 );',
        'float reflectance = mix( 0.10, 0.35, 1.0 - roughness ) * (1.18 - scuffs * 0.57);',
      ].join('\n'))
      .replace('blendOverlay( base.rgb, color )','cement + sheen * reflectance'),
  };
  const reflection=new Reflector(new T.PlaneGeometry(33,33),{
    color:0x434c58,textureWidth:384,textureHeight:384,multisample:0,clipBias:.0015,shader,
  });
  reflection.position.y=-.028;
  reflection.rotation.x=-Math.PI/2;
  return reflection;
}

function steelLighting(width,height){
  return paintedTexture(1800,896,(ctx,w,h)=>{
    const frame=ctx.createImageData(w,h);
    let seed=487921;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const px=(x/(w-1)-.5)*width,py=(1-y/(h-1))*height;
      const lightEdge=py-(.59+.77*px);
      const lamp=smooth(lightEdge,-.095,.16);
      const shaft=lamp*Math.exp(-(Math.max(0,lightEdge-.32)**2)/1.48);
      const sideShadow=1-.83*smooth(px,.44,2.20)*(1-lamp);
      const fill=78+48*smooth(px,-2.27,-.71);
      const ribs=Math.cos((px+width*.5)/.087*Math.PI*2+.55);
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const grain=(seed>>>29)*.62+1.0*Math.sin(x*.79)+1.8*Math.sin(x*.13);
      const intensity=(fill+(5+4*shaft)*ribs+grain)*sideShadow+119*shaft*smooth(px,-.85,1.34);
      const i=(y*w+x)*4;
      frame.data.set([intensity*.99,intensity*.975,intensity*1.005+3,255],i);
    }
    ctx.putImageData(frame,0,0);
  });
}

function corrugatedPanel(k,root,width,height,material,x,z,angle){
  const mesh=new T.PlaneGeometry(width,height,Math.ceil(width/.087)*7,1);
  const points=mesh.attributes.position;
  for(let i=0;i<points.count;i++){
    const v=(points.getX(i)+width*.5)/.087;
    const ridge=.5+.5*Math.cos(v*Math.PI*2);
    points.setZ(i,.010*ridge**1.65);
  }
  mesh.computeVertexNormals();
  const panel=k.put(root,mesh,material,x,height*.5,z);
  panel.rotation.y=angle;
}

function walls(k,room){
  const width=18,height=5.8,back=-4.38;
  const wallMap=steelLighting(width,height);
  const painted=new T.MeshBasicMaterial({map:wallMap,toneMapped:false});
  const side=k.std(0x2b3038,.76,.27);
  corrugatedPanel(k,room,width,height,painted,0,back,0);
  corrugatedPanel(k,room,20,height,side,-9.0,4.25,Math.PI/2);
  corrugatedPanel(k,room,20,height,side,9.0,4.25,-Math.PI/2);
  const molding=k.std(0x575a60,.49,.41);
  const seal=k.std(0x232328,.79,.14);
  const doorY=2.25,doorLeft=-2.53,doorRight=-.176;
  for(const x of [doorLeft,doorRight]){
    k.box(room,seal,x,doorY*.5,back+.026,.037,doorY,.014);
    k.box(room,molding,x+.024,doorY*.5,back+.040,.029,doorY,.028);
  }
  const middle=(doorLeft+doorRight)*.5;
  k.box(room,seal,middle,doorY,back+.025,doorRight-doorLeft,.034,.016);
  k.box(room,molding,middle,doorY+.031,back+.044,doorRight-doorLeft+.10,.046,.043);
  k.box(room,seal,1.96,2.9,back+.024,.018,5.8,.021);
  k.box(room,seal,0,.017,back+.055,width,.034,.095);
  const bench=k.std(0x202429,.51,.33);
  k.box(room,bench,4.05,.68,-3.86,1.62,.062,.43);
  k.box(room,bench,4.05,.29,-3.86,1.62,.045,.43);
  for(const x of [3.29,4.81])k.box(room,bench,x,.33,-3.85,.055,.66,.38);
  for(let row=0;row<3;row++)k.box(room,bench,4.17,1.12+row*.25,-4.31,1.0,.025,.13);
}

function pressureWasher(k,room){
  const trolley=new T.Group();
  trolley.position.set(-2.02,0,-3.50);
  trolley.rotation.y=-.36;
  trolley.scale.y=.95;
  room.add(trolley);
  const steel=k.std(0x5d6061,.39,.69);
  const dark=k.std(0x17181b,.42,.31);
  const rubber=k.m.rubber;
  const hoseMat=k.std(0xef6716,.30,.12);
  for(const side of [-1,1]){
    const x=side*.225;
    k.tube(trolley,steel,[[x,.055,-.23],[x,.12,.17],[x,.77,.115],[x,1.105,.038],[x,1.193,-.13]],.024,47);
    const wheel=k.cyl(trolley,rubber,x,.088,.155,.084,.052);wheel.rotation.z=Math.PI/2;
    const hub=k.cyl(trolley,steel,x+side*.027,.088,.155,.035,.015);hub.rotation.z=Math.PI/2;
  }
  k.rod(trolley,dark,[-.23,1.19,-.13],[.23,1.19,-.13],.033);
  k.box(trolley,dark,0,.10,-.014,.51,.102,.41);
  const tank=k.cyl(trolley,dark,0,.384,.023,.122,.46);
  tank.scale.z*=.78;
  k.cyl(trolley,steel,0,.627,.022,.068,.036);
  k.cyl(trolley,k.m.darkMetal,0,.673,.019,.041,.072);
  for(const x of [-.13,.086]){
    const gauge=k.cyl(trolley,steel,x,.761,.084,.028,.016);gauge.rotation.x=Math.PI/2;
    k.rod(trolley,steel,[x,.742,.076],[0,.652,.04],.010);
  }
  const coil=Array.from({length:161},(_,i)=>{
    const t=i/160,angle=t*Math.PI*7.7;
    const radius=.219-.061*t;
    return [.043+Math.cos(angle)*radius,.509+Math.sin(angle)*(radius*1.13),.159+t*.085+Math.sin(angle*.22)*.029];
  });
  k.tube(trolley,hoseMat,coil,.0127,146);
  k.tube(trolley,hoseMat,[[.17,.59,.22],[.207,.403,.27],[.061,.224,.25],[-.192,.26,.19],[-.275,.096,.08]],.013,47);
  return trolley.position;
}

function contacts(scene,room,cart){
  const texture=paintedTexture(256,256,(g,w,h)=>{
    const shadow=g.createRadialGradient(w*.5,h*.5,16,w*.5,h*.5,w*.5);
    shadow.addColorStop(0,'#020508ee');
    shadow.addColorStop(.60,'#0206099f');
    shadow.addColorStop(1,'#01030800');
    g.fillStyle=shadow;g.fillRect(0,0,w,h);
  });
  const material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false});
  const shadow=(parent,w,h,x,z,y)=>{
    const mark=new T.Mesh(new T.PlaneGeometry(w,h),material);
    mark.rotation.x=-Math.PI/2;mark.position.set(x,y,z);
    parent.add(mark);
  };
  shadow(scene,2.95,5.68,-.12,-.08,.013);
  shadow(room,.84,.72,cart.x,cart.z,.016);
  for(const x of [-.81,.81])for(const z of [-1.435,1.172])shadow(scene,.53,.76,x,z,.019);
}

export function garageScene() {
  const scene=new T.Scene();
  const k=kitForScene();
  scene.background=new T.Color(0x10151c);
  scene.fog=new T.Fog(0x11161b,23,44);
  lights(scene);
  const room=new T.Group(),tech=new T.Group();
  room.position.set(-.099,0,-.023);
  room.rotation.y=-.230;
  scene.add(room,tech);
  const polished=new T.MeshPhysicalMaterial({
    color:0x494f57,roughness:.38,metalness:.07,clearcoat:.13,clearcoatRoughness:.30,
    normalScale:new T.Vector2(.35,.35),transparent:true,opacity:.48,depthWrite:false,
  });
  const reflection=studioReflection();
  room.add(reflection);
  const slab=floor(room,polished);
  slab.receiveShadow=true;
  slab.renderOrder=-2;
  const seam=k.std(0x4c5157,.67,.08);
  for(const x of [-4.1,-1.30,2.28,5.65])k.box(room,seam,x,-.006,1.04,.004,.003,20);
  for(const z of [-3.86,1.98])k.box(room,seam,0,-.006,z,20,.003,.004);
  walls(k,room);
  const prop=pressureWasher(k,room);
  contacts(scene,room,prop);

  floor(tech,k.std(0x152730,.84,.12));
  const grid=new T.GridHelper(64,64,0x5b7886,0x3f5867);
  grid.position.y=.001;
  grid.material.transparent=true;grid.material.opacity=.34;grid.material.depthWrite=false;
  tech.add(grid);
  for(const r of [2.92,3.53]){
    const ring=new T.Mesh(new T.RingGeometry(r-.012,r,100),new T.MeshBasicMaterial({color:0x698798,transparent:true,opacity:.38,depthWrite:false,side:T.DoubleSide}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.018;tech.add(ring);
  }
  tech.visible=false;
  function xray(value){
    room.visible=!value;
    tech.visible=value;
    scene.background.set(value?0x0c1821:0x10151c);
    scene.fog.color.copy(scene.background);
    scene.environmentIntensity=value?.35:workshopIntensity;
  }
  function configure(renderer){
    if(!renderer.extensions.has('EXT_color_buffer_float')){
      reflection.visible=false;
      polished.transparent=false;
      polished.opacity=1;
      polished.depthWrite=true;
      polished.needsUpdate=true;
    }
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=T.PCFShadowMap;
    renderer.shadowMap.autoUpdate=false;
    renderer.shadowMap.needsUpdate=true;
  }
  function resizeReflection(width,height){
    if(!reflection.visible)return;
    const w=T.MathUtils.clamp(Math.round(width*.68),256,928);
    const h=T.MathUtils.clamp(Math.round(height*.68),240,840);
    reflection.getRenderTarget().setSize(w,h);
    reflection.material.uniforms.texel.value.set(1.35/w,1.35/h);
  }
  return {
    scene,k,xray,configure,resizeReflection,
    async loadAppearance(signal){
      await Promise.allSettled([loadEnvironment(scene,signal),loadFloor(polished,signal)]);
      if(signal.aborted||!polished.map||!polished.normalMap||!polished.roughnessMap)return;
      const uniforms=reflection.material.uniforms;
      uniforms.floorColor.value=polished.map;
      uniforms.floorNormal.value=polished.normalMap;
      uniforms.floorRoughness.value=polished.roughnessMap;
      uniforms.floorReady.value=1;
    },
    dispose:()=>reflection.dispose(),
  };
}

export function inspectionScene() {
  const scene=new T.Scene();
  const k=kitForScene();
  scene.background=new T.Color(0x16232b);
  scene.fog=new T.FogExp2(0x16232b,.059);
  lights(scene,true);
  const grid=new T.GridHelper(28,56,0x698599,0x3b525e);
  grid.position.y=-1.29;
  grid.material.transparent=true;grid.material.opacity=.29;grid.material.depthWrite=false;
  scene.add(grid);
  return {scene,k};
}
