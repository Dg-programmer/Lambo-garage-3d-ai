import { GLTFLoader } from './vendor/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/meshopt_decoder.mjs';
import { T, disposeGraph, graphResources } from './mesh-kit.mjs';
import { buildAssembly } from './assemblies.mjs';

const agedBrakes={
  Sport_brake_disk_1:{roughness:.55,metalness:.34,normalScale:.29},
  Sport_brake_hub_1:{color:0x43474b,roughness:.31,metalness:.73},
  Sport_brake_caliper:{color:0xe7541c,roughness:.28,metalness:.40,clearcoat:.6},
  Brake_pads:{color:0x333538,roughness:.49,metalness:.51},
  Brake_pads_compounds:{roughness:.9,metalness:0,normalScale:.25},
};

function finish(material){
  const presets={
    mat_alcantara:{roughness:.91,metalness:0,normalScale:.43},
    mat_carbonio:{color:0x59636a,roughness:.43,metalness:.21,clearcoat:.17,specularIntensity:.36,normalScale:.36,emissiveIntensity:.22},
    mat_splitter_carbon:{color:0x303b45,roughness:.48,metalness:.13,clearcoat:.08,specularIntensity:.19,normalScale:.28,emissiveIntensity:.10},
    mat_carrozzeria:{roughness:.275,metalness:.24,clearcoat:.52,clearcoatRoughness:.157,specularIntensity:.43,normalScale:.26},
    mat_black_interior:{roughness:.56,metalness:.32,normalScale:.38},
    mat_dettagli_interni:{roughness:.42,metalness:.18,emissiveIntensity:.31,normalScale:.38},
    mat_fanali:{roughness:.29,metalness:.44,emissiveIntensity:1.08,normalScale:.42},
    mat_wheels:{color:0x969ba3,roughness:.32,metalness:.54,normalScale:.36},
    mat_tires:{roughness:.91,metalness:0,normalScale:.31},
    mat_car_brakes:{roughness:.43,metalness:.40,normalScale:.39},
    ...agedBrakes,
  };
  if(material.name==='mat_tinted_glass'||material.name==='mat_lamp_cover'){
    const lamp=material.name==='mat_lamp_cover';
    return new T.MeshPhysicalMaterial({
      name:material.name,color:lamp?0xb0c0c9:0x10151d,
      roughness:lamp?.093:.115,metalness:.27,clearcoat:1,clearcoatRoughness:.07,
      transparent:true,opacity:lamp?.20:.875,depthWrite:false,forceSinglePass:true,side:T.DoubleSide,
    });
  }
  const settings=presets[material.name];
  if(!settings)return material;
  const output=settings.clearcoat
    ? new T.MeshPhysicalMaterial({
        name:material.name,map:material.map,color:material.color,
        normalMap:material.normalMap,normalMapType:material.normalMapType,
        emissive:material.emissive,emissiveMap:material.emissiveMap,side:material.side,
      })
    : material;
  for(const [key,value] of Object.entries(settings)){
    if(key==='normalScale')output.normalScale.setScalar(value);
    else if(key==='color')output.color.setHex(value);
    else output[key]=value;
  }
  return output;
}

export async function loadParts(filename,signal){
  const url=new URL('./assets/'+filename,import.meta.url);
  const reply=await fetch(url,{signal});
  if(!reply.ok)throw new Error('Could not load '+filename);
  const bytes=await reply.arrayBuffer();
  signal.throwIfAborted();
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const {scene}=await loader.parseAsync(bytes,new URL('.',url).href);
  if(signal.aborted){disposeGraph(scene);signal.throwIfAborted();}
  const original=graphResources(scene);
  const materials=new Map();
  scene.traverse(node=>{
    if(!node.isMesh)return;
    const source=node.material;
    if(!materials.has(source))materials.set(source,finish(source));
    node.material=materials.get(source);
    for(const item of [node.material.map,node.material.normalMap])if(item)item.anisotropy=4;
  });
  const resources=graphResources(scene);
  for(const item of original)if(!resources.has(item))item.dispose();
  const parts=new Map(scene.children.map(node=>[node.userData.part,node]));
  return {scene,parts,resources};
}

export function buildCar(k,asset){
  const root=asset.scene;
  const parts=new Map([...asset.parts].map(([key,group])=>[key,group.clone(true)]));
  const glass=new T.MeshBasicMaterial({
    color:0x85a9c1,opacity:.079,transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,
  });
  const amber=new T.MeshStandardMaterial({
    color:0xf2884d,emissive:0x623311,emissiveIntensity:.66,roughness:.39,metalness:.39,
  });
  const shells=[];
  const internals=new Map();
  for(const [name,group] of asset.parts){
    const id=name.split('_')[0];
    const internal=['cockpit_trim','cockpit_steering','cockpit_cluster','cockpit_seat','cockpit_harness',
      'cockpit_paddles','front_duct'].includes(name);
    group.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const material=mesh.material;
      mesh.castShadow=!internal&&!material.transparent;
      mesh.receiveShadow=false;
      if(material.transparent)mesh.renderOrder=material.name==='mat_lamp_cover'?2:1;
      shells.push({mesh,id,material,internal,order:mesh.renderOrder});
    });
  }

  function revealInternal(id){
    if(internals.has(id))return;
    const {root:piece}=buildAssembly(id,k);
    const engine=id==='engine';
    piece.position.set(...(engine?[0,.53,-1.04]:[-.71,.41,-1.43]));
    piece.rotation.y=engine?Math.PI:Math.PI*.39;
    piece.scale.setScalar(engine?.68:.54);
    piece.visible=false;
    internals.set(id,piece);
    root.add(piece);
  }

  function setXray(enabled,selected){
    if(enabled&&['engine','suspension'].includes(selected))revealInternal(selected);
    for(const [id,piece] of internals)piece.visible=enabled&&selected===id;
    for(const {mesh,id,material,internal,order} of shells){
      const highlight=enabled&&id===selected;
      mesh.material=enabled?(highlight?amber:glass):material;
      mesh.visible=!enabled||!internal||highlight;
      mesh.renderOrder=enabled?(highlight?1:3):order;
    }
  }

  root.userData.triangles=shells.reduce((total,{mesh})=>total+(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3,0);
  return {
    root,parts,resources:asset.resources,setXray,
    dispose(){setXray(false);glass.dispose();amber.dispose();},
  };
}
