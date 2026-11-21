import { T, loft, paintedTexture, roundedPlate } from './mesh-kit.mjs';

const TAU = Math.PI * 2;
const stations = Array.from({length:5}, (_, i) => (i - 2) * .204);

function group(parent, x=0, y=0, z=0) {
  const object=new T.Group();
  object.position.set(x,y,z);
  parent.add(object);
  return object;
}

function circularHole(shape, x, y, radius) {
  const hole=new T.Path();
  hole.absarc(x,y,radius,0,TAU,true);
  shape.holes.push(hole);
}

function plate(k,root,material,corners,depth,holes=[],bevel=.007) {
  const shape=new T.Shape(corners.map(([x,y])=>new T.Vector2(x,y)));
  for(const hole of holes)circularHole(shape,...hole);
  const geo=new T.ExtrudeGeometry(shape,{
    depth,steps:1,curveSegments:16,bevelEnabled:true,bevelSegments:2,
    bevelSize:bevel,bevelThickness:bevel,
  });
  geo.translate(0,0,-depth/2);
  return k.put(root,geo,material,0,0,0);
}

function lathe(k,root,material,profile,x,y,z,axis='y',angle=TAU) {
  const geo=new T.LatheGeometry(profile.map(([r,h])=>new T.Vector2(r,h)),72,0,angle);
  const mesh=k.put(root,geo,material,x,y,z);
  if(axis==='z')mesh.rotation.x=Math.PI/2;
  if(axis==='x')mesh.rotation.z=-Math.PI/2;
  return mesh;
}

function collar(k,root,material,inner,outer,height,x,y,z,axis='y') {
  return lathe(k,root,material,[
    [inner,-height*.5],[outer*.96,-height*.5],[outer,-height*.38],
    [outer,height*.38],[outer*.96,height*.5],[inner,height*.5],[inner,-height*.5],
  ],x,y,z,axis);
}

function fasteners(k,root,points,radius,axis='y') {
  const geometry=new T.CylinderGeometry(radius*.88,radius,radius*.7,6,1);
  const bolts=new T.InstancedMesh(geometry,k.m.steel,points.length);
  const pose=new T.Object3D();
  if(axis==='z')pose.rotation.x=Math.PI/2;
  if(axis==='x')pose.rotation.z=Math.PI/2;
  for(const [index,point] of points.entries()){
    pose.position.fromArray(point);
    pose.updateMatrix();
    bolts.setMatrixAt(index,pose.matrix);
  }
  root.add(bolts);
}

function finishes(k) {
  const grain=paintedTexture(192,192,(ctx,w,h)=>{
    const data=ctx.createImageData(w,h);
    let seed=6597143;
    for(let i=0;i<data.data.length;i+=4){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const value=117+(seed>>>26);
      data.data.set([value,value,value,255],i);
    }
    ctx.putImageData(data,0,0);
  });
  grain.colorSpace=T.NoColorSpace;
  grain.wrapS=grain.wrapT=T.RepeatWrapping;
  grain.repeat.set(3,3);
  const cast=k.std(0x9fa6a9,.38,.66,{bumpMap:grain,bumpScale:.0048});
  const polished=k.std(0xbfc9d1,.22,.84);
  const anodized=k.std(0xba561e,.32,.64);
  const black=k.std(0x232628,.42,.37,{bumpMap:grain,bumpScale:.0023});
  return {cast,polished,anodized,black};
}

function deck(k,root,material,width,length,depth,bores) {
  const x=width/2,z=length/2,t=.037;
  const mesh=plate(k,root,material,[
    [-x+t,-z],[x-t,-z],[x,-z+t],[x,z-t],[x-t,z],[-x+t,z],[-x,z-t],[-x,-z+t],
  ],depth,bores,.006);
  mesh.rotation.x=-Math.PI/2;
  return mesh;
}

function cylinderBanks(k,root,f) {
  const {m}=k;
  const crankProfile=[[-.32,-.12],[-.258,-.262],[-.170,-.302],[.17,-.302],[.26,-.25],
    [.32,-.12],[.284,.101],[.153,.143],[0,.027],[-.153,.143],[-.284,.101]];
  const caseMesh=plate(k,root,f.cast,crankProfile,1.035,[],.019);
  caseMesh.position.y=-.023;
  roundedPlate(k,root,f.black,.55,.119,1.04,.065,0,-.302,0);
  for(const x of [-.20,-.105,0,.105,.20])k.box(root,m.darkMetal,x,-.366,0,.026,.016,.83);
  for(const side of [-1,1]){
    const bank=group(root,side*.256,.115,0);
    bank.rotation.z=side*-.7854;
    const holeLayout=stations.flatMap(z=>[[0,z,.077],[-.092,z-.041,.009],[.092,z-.041,.009]]);
    const surface=deck(k,bank,f.cast,.235,1.035,.043,holeLayout);
    surface.position.y=.113;
    for(const [i,z] of stations.entries()){
      collar(k,bank,f.polished,.074,.085,.185,0,.022,z);
      const piston=k.cyl(bank,i%2===0?f.polished:m.darkMetal,0,-.051+(i%3)*.018,z,.071,.039);
      k.cyl(bank,m.darkMetal,0,piston.position.y+.021,z,.066,.006);
      for(const x of [-.092,.092]){
        const rib=k.box(bank,f.cast,x,-.022,z,.019,.22,.049);
        rib.rotation.z=x*.62;
      }
    }
    fasteners(k,bank,stations.flatMap(z=>[-.098,.098].map(x=>[x,.144,z+.05])),.013);
    const rail=lathe(k,root,f.cast,[[.039,-.49],[.061,-.49],[.071,-.43],[.071,.43],[.061,.49],[.039,.49]],side*.23,-.159,0,'z');
    rail.position.y=-.167;
  }
  for(const z of [-.541,.541]){
    collar(k,root,f.cast,.079,.165,.064,0,-.15,z,'z');
    collar(k,root,f.polished,.057,.089,.079,0,-.15,z,'z');
    fasteners(k,root,Array.from({length:8},(_,i)=>{
      const a=i*TAU/8;
      return [Math.cos(a)*.132,Math.sin(a)*.132-.15,z+Math.sign(z)*.043];
    }),.013,'z');
  }
}

function camHead(k,root,side,f) {
  const head=group(root,side*.28,.025,0);
  head.rotation.z=side*-.7854;
  const mounts=stations.flatMap(z=>[-.064,.064].map(x=>[x,z,.027]));
  deck(k,head,f.cast,.273,1.039,.075,mounts);
  for(const x of [-.071,.071]){
    k.rod(head,f.polished,[x,.118,-.524],[x,.118,.524],.022);
    for(const z of stations){
      const bearing=roundedPlate(k,head,f.cast,.09,.066,.062,.017,x,.071,z);
      bearing.rotation.y=Math.PI/2;
      for(const end of [-1,1]){
        const lobe=k.cyl(head,f.polished,x,.122+(end*.007),z+end*.048,.036,.027);
        lobe.rotation.x=Math.PI/2;
        lobe.scale.x*=.78;
        collar(k,head,f.black,.012,.023,.023,x,.047,z+end*.043);
      }
    }
  }
  for(const z of stations){
    collar(k,head,f.polished,.032,.052,.034,side*.132,.006,z,'x');
    collar(k,head,f.black,.021,.034,.036,-side*.133,.028,z,'x');
  }
  const timing=collar(k,head,f.polished,.026,.063,.024,.07,.119,.544,'z');
  timing.scale.setScalar(1.01);
  fasteners(k,head,stations.flatMap(z=>[-.121,.121].map(x=>[x,.048,z+.047])),.011);
}

function induction(k,root,f){
  const {m}=k;
  for(const side of [-1,1]){
    const plenum=group(root,side*.18,.032,-.041);
    const ribs=[[-.43,.001],[-.406,.085],[-.365,.144],[-.22,.173],[.22,.16],[.395,.124],[.443,.06],[.459,.008]];
    loft(k,plenum,f.black,ribs.map(([z,h])=>[
      [-.146,.015,z],[-.134,h*.66,z],[-.084,h,z],[.081,h*.97,z],[.136,h*.64,z],[.144,.013,z],
    ]));
    for(const z of stations){
      k.tube(root,f.black,[[side*.211,.081,z],[side*.292,.115,z],[side*.403,.034,z],
        [side*.433,-.159,z],[side*.386,-.254,z]],.041,23);
      collar(k,root,f.cast,.029,.049,.028,side*.387,-.246,z);
      k.box(root,f.cast,side*.229,.178,z,.089,.012,.068).rotation.y=side*.09;
    }
    const pipe=lathe(k,root,f.cast,[[.044,-.085],[.065,-.078],[.071,-.05],[.071,.05],[.066,.072],[.044,.072]],side*.179,.085,.464,'z');
    pipe.rotation.y=side*.13;
    const valve=k.cyl(root,f.anodized,side*.171,.085,.518,.043,.005);
    valve.rotation.set(Math.PI/2,.28,side*.11);
    k.tube(root,m.rubber,[[side*.318,.082,-.451],[side*.359,.117,-.34],
      [side*.348,.076,.233],[side*.368,.04,.414]],.009,24);
    fasteners(k,root,stations.map(z=>[side*.232,.192,z]),.010);
  }
}

function cog(k,root,material,x,y,z,radius,toothCount) {
  const outline=[];
  for(let i=0;i<toothCount;i++){
    for(const [fraction,ratio] of [[0,.86],[.22,.99],[.56,1],[.78,.88]]){
      const angle=(i+fraction)*TAU/toothCount;
      outline.push([Math.cos(angle)*radius*ratio,Math.sin(angle)*radius*ratio]);
    }
  }
  const wheel=plate(k,root,material,outline,.051,[[0,0,radius*.36]],.0026);
  wheel.position.set(x,y,z);
  return wheel;
}

function gearbox(k,root,f) {
  const {m}=k;
  const shell=lathe(k,root,f.cast,[
    [.158,-.333],[.207,-.344],[.253,-.30],[.271,-.20],[.252,.037],[.195,.208],
    [.157,.35],[.205,.36],[.22,.245],[.286,.074],[.302,-.20],[.289,-.30],[.232,-.372],[.158,-.372],[.158,-.333],
  ],0,-.023,.050,'z',TAU*.69);
  shell.rotation.z=.54;
  for(const z of [-.23,.205,.346]){
    const reinforcement=lathe(k,root,f.cast,[[.194,-.01],[.219,-.011],[.225,.010],[.194,.018]],0,-.024,z,'z',TAU*.69);
    reinforcement.rotation.z=.54;
  }
  for(const side of [-1,1]){
    const x=side*.096;
    k.rod(root,f.polished,[x,.018,-.34],[x,.018,.474],.030);
    for(let i=0;i<5;i++){
      const z=-.13+i*.093;
      const r=.069+i*.009+(side>0?.009:0);
      cog(k,root,i%2===0?f.polished:m.darkMetal,x,.019,z,r,16+i*2).rotation.z=i*.21+side*.1;
      collar(k,root,f.anodized,.032,.058,.016,x,.019,z+.035,'z');
    }
    roundedPlate(k,root,f.cast,.09,.083,.37,.026,side*.223,-.185,-.022);
  }
  for(let i=0;i<7;i++){
    collar(k,root,i%2===0?f.polished:f.black,.066,.154,.014,0,-.024,-.303+i*.014,'z');
  }
  fasteners(k,root,Array.from({length:9},(_,i)=>{
    const a=i*TAU/9;
    return [Math.cos(a)*.173,Math.sin(a)*.173-.023,.423];
  }),.014,'z');
}

function exhaust(k,root,f) {
  const tint=paintedTexture(256,4,(ctx,w,h)=>{
    const color=ctx.createLinearGradient(0,0,w,0);
    color.addColorStop(0,'#6c6461');
    color.addColorStop(.15,'#a8a39b');
    color.addColorStop(.38,'#baa98e');
    color.addColorStop(.76,'#a7937d');
    color.addColorStop(.87,'#8295a1');
    color.addColorStop(1,'#b1aa9c');
    ctx.fillStyle=color;ctx.fillRect(0,0,w,h);
  });
  const tube=k.std(0xf4eddf,.32,.78,{map:tint});
  for(const side of [-1,1]){
    const flange=deck(k,root,f.cast,.139,1.06,.028,stations.map(z=>[0,z,.037]));
    flange.rotation.z=side*Math.PI/2;
    flange.position.set(side*.358,.044,0);
    for(const [i,z] of stations.entries()){
      k.tube(root,tube,[[side*.367,.044,z],[side*.499,.033,z+.015],
        [side*(.583+i*.023),-.105-i*.017,z-.037],[side*(.601+i*.011),-.239-i*.031,z*.67-.38],
        [side*.668,-.382-i*.006,-.655]],.033,38);
      collar(k,root,f.polished,.028,.043,.015,side*.379,.044,z,'x');
    }
    lathe(k,root,tube,[[.060,-.15],[.086,-.15],[.093,-.14],[.104,-.04],[.103,.026],[.092,.113],[.050,.12],[.060,-.15]],side*.667,-.389,-.702,'z');
    collar(k,root,f.polished,.057,.096,.021,side*.667,-.389,-.849,'z');
    fasteners(k,root,[[-.054,.031],[.054,.031],[-.054,-.031],[.054,-.031]].map(([x,y])=>[side*.669+x,-.391+y,-.858]),.008,'z');
  }
}

function spring(k,root,f){
  const coil=k.std(0xbb4f21,.34,.54);
  const points=Array.from({length:193},(_,i)=>{
    const u=i/192,a=u*TAU*7.25;
    const travel=(.12*u+.88*(u-Math.sin(u*TAU)/TAU)-.5)*.611;
    return [Math.cos(a)*.154,travel,Math.sin(a)*.154];
  });
  k.tube(root,coil,points,.025,224);
  for(const y of [-.316,.315])collar(k,root,f.black,.087,.172,.027,0,y,0);
}

function damper(k,root,f) {
  const {m}=k;
  const body=lathe(k,root,f.black,[
    [.040,-.306],[.092,-.306],[.099,-.27],[.099,.15],[.081,.19],[.089,.252],
    [.045,.254],[.045,-.16],[.040,-.306],
  ],0,0,0,'y',TAU*.77);
  body.rotation.y=.63;
  k.cyl(root,f.polished,0,.161,0,.032,.501);
  for(const [i,y] of [-.227,-.214,-.2,-.169,.194,.208,.233].entries()){
    collar(k,root,i<4?f.polished:f.anodized,.035,.052,.008,0,y,0);
  }
  const thread=Array.from({length:183},(_,i)=>{
    const t=i/182,a=t*TAU*13;
    return [Math.cos(a)*.1,-.209+t*.244,Math.sin(a)*.1];
  });
  k.tube(root,f.cast,thread,.0044,191);
  for(const y of [-.263,.122])collar(k,root,f.anodized,.097,.132,.027,0,y,0);
  collar(k,root,f.polished,.037,.081,.046,0,.391,0);
  collar(k,root,m.rubber,.030,.061,.053,0,-.331,0,'z');
  for(const y of [-.234,.125])fasteners(k,root,[[.126,y,0]],.011,'x');
}

function controlArms(k,root,f) {
  for(const [y,shrink] of [[0,1],[.34,.82]]){
    const arm=group(root,-.018,y,0);
    arm.scale.setScalar(shrink);
    const cast=plate(k,arm,f.cast,[
      [-.356,-.392],[-.224,-.382],[.354,-.081],[.409,-.043],[.409,.044],[.346,.083],
      [-.23,.387],[-.354,.393],[-.394,.343],[-.03,.088],[.005,0],[-.03,-.082],[-.396,-.34],
    ],.057,[[-.302,-.33,.033],[-.302,.33,.033],[.346,0,.041]],.011);
    cast.rotation.x=-Math.PI/2;
    for(const d of [-1,1]){
      collar(k,arm,k.m.rubber,.025,.062,.064,-.306,0,d*.331);
      collar(k,arm,f.polished,.018,.031,.075,-.306,0,d*.331);
      k.rod(arm,f.cast,[-.258,.035,d*.298],[.261,.049,d*.074],.016);
    }
    collar(k,arm,f.black,.035,.064,.067,.346,.002,0);
    collar(k,arm,f.polished,.023,.039,.088,.346,.016,0);
  }
}

function carrier(k,root,f) {
  const body=plate(k,root,f.cast,[
    [-.091,-.292],[-.147,-.204],[-.189,-.083],[-.182,.066],[-.118,.171],[-.107,.289],
    [-.045,.334],[.045,.325],[.092,.223],[.167,.125],[.202,.029],[.202,-.192],[.088,-.292],
  ],.138,[[0,-.088,.103],[.136,.052,.031],[-.045,.229,.029]],.017);
  body.rotation.z=-.19;
  collar(k,root,f.cast,.086,.131,.084,-.018,-.087,.103,'z');
  collar(k,root,f.polished,.046,.097,.109,-.018,-.087,.117,'z');
  collar(k,root,f.black,.043,.062,.086,-.018,-.087,.184,'z');
  for(const [x,y] of [[-.066,.261],[.15,.146],[-.123,.134]])collar(k,root,f.cast,.018,.04,.044,x,y,.107,'z');
  fasteners(k,root,Array.from({length:7},(_,i)=>{
    const a=i*TAU/7;
    return [Math.cos(a)*.115-.018,Math.sin(a)*.115-.087,.166];
  }),.010,'z');
}

function link(k,root,f){
  const {m}=k;
  k.rod(root,f.polished,[-.071,-.21,0],[.077,.205,0],.032);
  k.rod(root,f.black,[-.041,-.112,0],[.042,.115,0],.043);
  for(const i of [-1,1]){
    const x=i*.073,y=i*.194;
    const mount=group(root,x,y,0);
    collar(k,mount,f.cast,.030,.058,.048,0,0,0,'z');
    collar(k,mount,m.rubber,.014,.042,.058,0,0,0,'z');
    k.ball(mount,f.polished,0,0,.024,.030,.030,.034);
    k.rod(mount,f.polished,[0,0,.028],[0,0,.094],.017);
    fasteners(k,mount,[[0,0,.089]],.023,'z');
  }
}

export function mechanicalParts(id,k,add) {
  const f=finishes(k);
  if(id==='engine'){
    add('intake',[0,.51,0],[-.27,.83,-.15],root=>induction(k,root,f));
    add('heads',[0,.29,0],[.96,.46,-.11],root=>{
      for(const side of [-1,1])camHead(k,root,side,f);
    });
    add('block',[0,-.068,0],[.0,-.18,.0],root=>cylinderBanks(k,root,f));
    add('transmission',[0,-.143,.81],[.57,-.08,.66],root=>gearbox(k,root,f));
    add('headers',[0,.012,0],[-1.16,-.22,-.33],root=>exhaust(k,root,f));
    return;
  }
  add('spring',[0,.13,0],[-.63,.63,-.10],root=>spring(k,root,f));
  add('damper',[0,.045,0],[.36,.65,.32],root=>damper(k,root,f));
  add('arms',[.00,-.325,0],[-.49,-.19,-.44],root=>controlArms(k,root,f));
  add('upright',[.348,-.153,0],[.63,-.36,.22],root=>carrier(k,root,f));
  add('link',[-.315,-.10,.16],[-.37,-.03,.6],root=>link(k,root,f));
}
