import { T, loft, paintedTexture } from './mesh-kit.mjs';
import { mechanicalParts } from './mechanical.mjs';

const TAU = 2 * Math.PI;

function sourcePart(parent,asset,key,offset=[0,0,0],yaw=0) {
  const transform=new T.Group();
  transform.rotation.y=yaw;
  const placement=new T.Group();
  placement.position.fromArray(offset).multiplyScalar(-1);
  placement.add(asset.parts.get(key).clone(true));
  transform.add(placement);
  parent.add(transform);
  return transform;
}

function castCenter(k,root) {
  const profile=[
    [.032,-.070],[.064,-.070],[.096,-.058],[.111,-.045],[.111,-.025],[.106,-.014],
    [.072,-.005],[.069,.043],[.051,.065],[.041,.076],[.033,.075],[.032,-.070],
  ];
  const geo=new T.LatheGeometry(profile.map(([r,h])=>new T.Vector2(r,h)),80);
  k.put(root,geo,k.m.darkMetal,0,0,-.066).rotation.x=Math.PI/2;
  const center=new T.CylinderGeometry(.042,.043,.029,12,1,false,Math.PI/12);
  k.put(root,center,k.m.steel,0,0,.006).rotation.x=Math.PI/2;
  const collar=k.ring(root,k.m.steel,0,0,-.018,.068);
  collar.scale.z*=.43;
}

function tire(k,root) {
  const tyre=k.m.rubber;
  const shoulder=.123;
  const profile=[[.255,.112],[.266,.137],[.288,.148],[.308,.144],[.321,.131],[.329,shoulder]];
  const outer=new T.LatheGeometry(profile.map(([r,z])=>new T.Vector2(r,z)),144);
  k.put(root,outer,tyre,0,0,0).rotation.x=Math.PI/2;
  const inner=new T.LatheGeometry(profile.slice().reverse().map(([r,z])=>new T.Vector2(r,-z)),144);
  k.put(root,inner,tyre,0,0,0).rotation.x=Math.PI/2;

  const coords=[],uv=[],faces=[];
  const circum=384,width=64;
  for(let step=0;step<=circum;step++){
    const turn=step/circum;
    const theta=turn*TAU;
    for(let i=0;i<=width;i++){
      const z=(i/width-.5)*2*shoulder;
      const street=1-Math.pow(Math.abs(z)/shoulder,8);
      const channel=Math.min(...[-.075,-.032,.021,.074].map(lane=>Math.abs(z-lane)));
      const longitudinal=(1-T.MathUtils.smoothstep(channel,.0026,.0065))*street;
      const groove=turn*43+3.85*z+Math.sign(z)*.08;
      const angleGap=Math.abs(groove-Math.round(groove));
      const cuts=(1-T.MathUtils.smoothstep(angleGap,.042,.106))
        *T.MathUtils.smoothstep(Math.abs(z),.018,.066);
      const radius=.329+.011*street-.0052*Math.max(longitudinal,cuts);
      coords.push(radius*Math.cos(theta),radius*Math.sin(theta),z);
      uv.push(turn,i/width);
      if(step<circum&&i<width){
        const a=step*(width+1)+i,b=a+width+1;
        faces.push(a,b,a+1,b,b+1,a+1);
      }
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(coords,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  k.put(root,geometry,tyre,0,0,0);
  const sidewall=paintedTexture(1024,1024,(ctx,w,h)=>{
    ctx.textAlign='center';ctx.textBaseline='middle';
    function curve(text,angle,arc,size,value){
      ctx.font='700 '+size+'px Arial';ctx.fillStyle=value;
      for(const [i,char] of [...text].entries()){
        const a=angle+(i/(text.length-1)-.5)*arc;
        ctx.save();ctx.translate(w/2+Math.sin(a)*454,h/2-Math.cos(a)*454);
        ctx.rotate(a);ctx.fillText(char,0,0);ctx.restore();
      }
    }
    curve('POTENZA',0,.78,31,'#767a7d');
    curve('245/30 ZR20',1.87,.83,19,'#65696b');
    curve('BRIDGESTONE',-2.01,.93,20,'#6a6e71');
    ctx.strokeStyle='#86909338';ctx.lineWidth=2.5;
    for(const radius of [433,473]){ctx.beginPath();ctx.arc(w/2,h/2,radius,0,TAU);ctx.stroke();}
  });
  const lettering=new T.MeshStandardMaterial({map:sidewall,roughness:.92,transparent:true,depthWrite:false});
  const stamp=k.put(root,new T.PlaneGeometry(.650,.650),lettering,0,0,.1494);
  stamp.renderOrder=2;
}

function fenderVents(k,root) {
  for(const side of [-1,1]){
    const bank=new T.Group();
    bank.position.set(side*.70,.269,-.265);
    bank.rotation.set(.09,side*.17,side*-.19);
    root.add(bank);
    for(const x of [-.129,.129]){
      k.tube(bank,k.m.carbon,[[x,-.024,-.223],[x,.012,-.12],[x,.016,.15],[x,-.018,.211]],.018,34);
    }
    for(let i=0;i<5;i++){
      const z=(i-2)*.079;
      const chord=[[-.036,-.015],[-.027,.014],[.021,.032],[.037,.022],[.034,.010],[-.022,-.019]];
      loft(k,bank,k.m.carbon,[-.127,0,.127].map(x=>chord.map(([d,y])=>[x,y+.012*(1-Math.abs(x/.127)),z+d])));
    }
    for(const x of [-.132,.132])for(const z of [-.188,.168]){
      const fastener=new T.CylinderGeometry(.010,.01,.005,8);
      k.put(bank,fastener,k.m.darkMetal,x,.009,z);
    }
  }
}

const partLayouts={
  front:{
    pivot:[0,.43,1.53],
    offsets:[
      ['shell',[-.08,.83,-.36]],['duct',[1.12,-.11,-.59]],['louvers',[-1.03,.33,-.44]],
      ['splitter',[.02,-.46,.54]],['headlamps',[.65,.36,.80]],
    ],
  },
  aero:{
    pivot:[0,.65,-2.04],
    offsets:[
      ['main-plane',[-.17,.45,-.27]],['flap',[.56,.38,.65]],['stays',[-.58,.03,.24]],
      ['endplates',[.58,.19,-.62]],['diffuser',[.05,-.39,.58]],
    ],
  },
  cockpit:{
    pivot:[.358,.56,.16],
    offsets:[
      ['steering',[-.46,.21,-.51]],['cluster',[.43,.55,.06]],['paddles',[.46,.06,-.39]],
      ['seat',[-.36,-.17,.28]],['harness',[.52,-.12,-.075]],
    ],
  },
};

function wheelParts(k,add,car,brakes) {
  const pivot=[.810,.340,1.172];
  const actual=(root,key)=>sourcePart(root,car,'wheel_'+key,pivot,-Math.PI/2);
  function cutaway(root,key){
    if(!brakes){actual(root,key);return;}
    const replica=sourcePart(root,brakes,key);
    replica.scale.setScalar(.727);
    replica.position.z=-.028;
    if(key==='caliper')replica.rotation.z=Math.PI*.29;
  }
  add('tyre',[0,0,0],[-.23,.12,1.10],root=>tire(k,root));
  add('rim',[0,0,0],[-.11,.10,.53],root=>actual(root,'rim'));
  add('disc',[0,0,0],[.20,-.12,-.35],root=>cutaway(root,'disc'));
  add('caliper',[0,0,0],[.55,.32,-.055],root=>cutaway(root,'caliper'));
  add('hub',[0,0,0],[.40,-.11,-.86],root=>{
    castCenter(k,root);
    actual(root,'hub');
  });
}

export function buildAssembly(id,k,{car,brakes}={}) {
  const root=new T.Group();
  const parts=[];
  function add(key,rest,move,create) {
    const group=new T.Group();
    group.userData.component=key;
    const origin=new T.Vector3(...rest);
    group.position.copy(origin);
    create(group);
    root.add(group);
    parts.push({key,group,origin,move:new T.Vector3(...move)});
  }
  const layout=partLayouts[id];
  if(layout){
    for(const [key,motion] of layout.offsets){
      add(key,[0,0,0],motion,group=>{
        if(id==='front'&&key==='louvers')fenderVents(k,group);
        else sourcePart(group,car,id+'_'+key,layout.pivot);
      });
    }
  }else if(id==='wheel')wheelParts(k,add,car,brakes);
  else mechanicalParts(id,k,add);
  return {
    root,parts,
    setSpread(amount) {
      for(const {group,origin,move} of parts)group.position.copy(origin).addScaledVector(move,amount);
    },
  };
}
