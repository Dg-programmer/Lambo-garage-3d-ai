import * as T from './vendor/three.module.min.js';
export { T };

export function paintedTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

export function kitForScene() {
  const cube = new T.BoxGeometry(1, 1, 1);
  const cylinderGeometry = new T.CylinderGeometry(1, 1, 1, 40);
  const sphereGeometry = new T.SphereGeometry(1, 28, 16);
  const ringGeometry = new T.TorusGeometry(1, .065, 10, 64);
  const axis = new T.Vector3(0,1,0);
  const end = new T.Vector3();
  const start = new T.Vector3();
  const delta = new T.Vector3();
  const std = (color, roughness=.51, metalness=.20, other={}) => new T.MeshStandardMaterial({ color,roughness,metalness,...other });
  const carbonMap = paintedTexture(256,256,(ctx,w,h)=>{
    ctx.fillStyle='#242a2e';ctx.fillRect(0,0,w,h);
    for(let x=0;x<w;x+=16)for(let y=0;y<h;y+=16){
      const warp=((x-y)/16+128)%4<2;
      const fibre=warp?ctx.createLinearGradient(x,y,x+16,y):ctx.createLinearGradient(x,y,x,y+16);
      fibre.addColorStop(0,'#161a1f');fibre.addColorStop(.36,warp?'#6d767f':'#444e58');
      fibre.addColorStop(.69,warp?'#4d5861':'#545e66');fibre.addColorStop(1,'#1d2327');
      ctx.fillStyle=fibre;ctx.fillRect(x,y,16,16);
      ctx.fillStyle='#73818a29';
      for(let line=2;line<16;line+=4)ctx.fillRect(x+(warp?line:0),y+(warp?0:line),warp?1:16,warp?16:1);
    }
  });
  carbonMap.wrapS=carbonMap.wrapT=T.RepeatWrapping;
  carbonMap.repeat.set(9,9);
  carbonMap.anisotropy=4;
  const brushed=paintedTexture(256,256,(ctx,w,h)=>{
    let seed=257193;
    for(let y=0;y<h;y++){
      seed=(Math.imul(seed,1664525)+1013904223)|0;
      const s=158+(seed>>>27)+Math.round(Math.sin(y*.55)*15);
      ctx.fillStyle='rgb('+s+','+s+','+(s+2)+')';
      ctx.fillRect(0,y,w,1);
    }
  });
  const fibre=paintedTexture(256,256,(ctx,w,h)=>{
    let seed=571391;
    const pixels=ctx.createImageData(w,h);
    for(let i=0;i<pixels.data.length;i+=4){
      seed=(Math.imul(seed,1103515245)+12345)|0;
      const tone=127+(seed>>>25);
      pixels.data.set([tone,tone,tone,255],i);
    }
    ctx.putImageData(pixels,0,0);
  });
  for(const texture of [brushed,fibre]){
    texture.wrapS=texture.wrapT=T.RepeatWrapping;
    texture.repeat.set(4,4);
    texture.anisotropy=4;
  }
  fibre.colorSpace=T.NoColorSpace;
  const m={
    orange: new T.MeshPhysicalMaterial({color:0xf95a24,metalness:.25,roughness:.24,clearcoat:.75}),
    rubber: std(0x121518,.86,.02,{bumpMap:fibre,bumpScale:.006}),
    carbon: new T.MeshPhysicalMaterial({color:0x7e8893,roughness:.37,metalness:.43,map:carbonMap,clearcoat:.43,bumpMap:carbonMap,bumpScale:.0068}),
    steel: std(0xb5bfc6,.29,.70,{map:brushed}),
    darkMetal: std(0x474d55,.32,.58,{map:brushed}),
  };
  function put(parent,geometry,material,x,y,z,sx=1,sy=1,sz=1) {
    const object=new T.Mesh(geometry,material);
    object.position.set(x,y,z);
    object.scale.set(sx,sy,sz);
    parent.add(object);
    return object;
  }
  const box=(parent,mat,x,y,z,w,h,d)=>put(parent,cube,mat,x,y,z,w,h,d);
  const cyl=(parent,mat,x,y,z,r,h)=>put(parent,cylinderGeometry,mat,x,y,z,r,h,r);
  const ball=(parent,mat,x,y,z,w,h,d)=>put(parent,sphereGeometry,mat,x,y,z,w,h,d);
  const ring=(parent,mat,x,y,z,r)=>put(parent,ringGeometry,mat,x,y,z,r,r,r);
  function rod(parent,mat,a,b,r){
    start.fromArray(a);
    end.fromArray(b);
    delta.subVectors(end,start);
    const part=cyl(parent,mat,0,0,0,r,delta.length());
    part.position.copy(start).addScaledVector(delta,.5);
    part.quaternion.setFromUnitVectors(axis,delta.normalize());
    return part;
  }
  function tube(parent,mat,points,r,segments=32) {
    const path=new T.CatmullRomCurve3(points.map(point=>new T.Vector3(...point)));
    return put(parent,new T.TubeGeometry(path,segments,r,8,false),mat,0,0,0);
  }
  return { m,std,put,box,cyl,ball,ring,rod,tube };
}

export function loft(kit,parent,material,rings,{caps=true}={}) {
  const points=rings.flat(2);
  const size=rings[0].length;
  const index=[];
  const uv=[];
  for(let a=0;a<rings.length;a++){
    for(let b=0;b<size;b++){
      uv.push(b/(size-1),a/(rings.length-1));
      if(a===rings.length-1)continue;
      const v=a*size+b;
      const next=a*size+(b+1)%size;
      index.push(v,v+size,next,next,v+size,next+size);
    }
  }
  const last=(rings.length-1)*size;
  if(caps)for(let a=1;a<size-1;a++)index.push(0,a,a+1,last,last+a+1,last+a);
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return kit.put(parent,geometry,material,0,0,0);
}

export function roundedPlate(kit,parent,mat,w,h,depth,radius,x,y,z) {
  const shape=new T.Shape();
  const a=-w/2,b=-h/2,c=w/2,d=h/2;
  const r=Math.min(radius,w*.28,h*.28);
  shape.moveTo(a+r,b);shape.lineTo(c-r,b);shape.quadraticCurveTo(c,b,c,b+r);
  shape.lineTo(c,d-r);shape.quadraticCurveTo(c,d,c-r,d);
  shape.lineTo(a+r,d);shape.quadraticCurveTo(a,d,a,d-r);
  shape.lineTo(a,b+r);shape.quadraticCurveTo(a,b,a+r,b);
  const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:r*.26,bevelThickness:r*.26,curveSegments:5});
  geo.translate(0,0,-depth/2);
  return kit.put(parent,geo,mat,x,y,z);
}

export function graphResources(root) {
  const resources=new Set();
  if(root.environment)resources.add(root.environment);
  root.traverse(node=>{
    if(node.geometry)resources.add(node.geometry);
    if(!node.material)return;
    for(const mat of [node.material].flat()){
      resources.add(mat);
      for(const item of Object.values(mat))if(item?.isTexture)resources.add(item);
    }
  });
  return resources;
}

export function disposeGraph(root,retained) {
  for(const item of graphResources(root))if(!retained?.has(item))item.dispose();
}
