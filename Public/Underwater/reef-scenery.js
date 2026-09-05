import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COURSE, START } from './reef-course.js';
import { makeReefMaterial } from './reef-garden.js';

const route=[START,...COURSE];
function pathDistance(x,z) {
  let best=Infinity;
  for(let j=1;j<route.length;j++) {
    const a=route[j-1],b=route[j],dx=b[0]-a[0],dz=b[2]-a[2];
    const t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz),0,1);
    best=Math.min(best,Math.hypot(x-a[0]-dx*t,z-a[2]-dz*t));
  }
  return best;
}

export function createReefScenery({scene,floorY,timeUniform,forms}) {
  const parts={clay:[],wood:[],metal:[]},placements=[];
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),scale=new THREE.Vector3();
  function place(name,segment,t,side,offset,size,{yaw=0,lean=0,rise=0,roll=0}={}) {
    const a=route[segment],b=route[segment+1],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz),heading=Math.atan2(dx,dz);
    const x=a[0]+dx*t-dz/len*offset*side,z=a[2]+dz*t+dx/len*offset*side;
    // Reserve the whole sandy corridor; also protect the turn at nearby segments.
    const radius={shell:1.2,anemone:.9,jar:.95,barrel:1.05,anchor:1.5,wheel:1.23,rope:1.55,ribs:2.4}[name]*size;
    const clearance=pathDistance(x,z)-radius;
    if(clearance<7.5)return;
    const y=floorY(x,z)+rise;
    e.set(lean,heading+Math.PI+yaw,roll);q.setFromEuler(e);scale.setScalar(size);matrix.compose(new THREE.Vector3(x,y,z),q,scale);
    const transformed=Object.entries(forms[name]).filter(([,g])=>g).map(([material,g])=>[material,g.clone().applyMatrix4(matrix)]);
    let bottom=Infinity;
    for(const [,g] of transformed){g.computeBoundingBox();bottom=Math.min(bottom,g.boundingBox.min.y);}
    for(const [material,g] of transformed) {
      if(name!=='wheel')g.translate(0,floorY(x,z)+.035-bottom,0);
      parts[material].push(g);
    }
    placements.push({name,segment,x,y,z,size,clearance});
  }
  // Local colonies with uneven spacing, rather than the same pair every few feet.
  const colonies=[
    [0,.70,-1,12,1.1],
    [1,.79,1,10.6,1.8],[1,.85,1,13.9,1.05],[1,.98,1,11.4,.8],[1,.96,-1,11.7,1.3],
    [3,.75,-1,11.8,1.05],[4,.15,1,11.3,1.4],
    [6,.55,-1,13,1.7],[6,.63,-1,11.8,.95],[6,.70,-1,14.2,1.3],
    [7,.17,1,12.4,1.2],[8,.80,-1,12,1.4],
    [9,1.04,1,12.2,1.0],[11,.35,-1,12,1.0]
  ];
  colonies.forEach(([segment,t,side,offset,size],j)=>place('anemone',segment,t,side,offset,size,{yaw:j*1.73}));
  // The shell garden has a family of three shells, each with a different pose.
  place('shell',1,.93,1,11.0,1.9,{yaw:.4,roll:-.10});
  place('shell',1,1.04,1,13.0,.95,{yaw:2.25,lean:.38,roll:.62});
  place('shell',1,.80,-1,12.3,1.2,{yaw:-1.15,roll:.20});

  // A lone old jar foreshadows one concentrated cargo site late in the course.
  place('jar',4,.48,1,11.5,1.7,{yaw:.3,roll:-.1});
  // Cargo, anchor, wheel and ribs now belong to the actual explorable ship.

  const meshes=[];
  for(const [kind,list] of Object.entries(parts)) {
    if(!list.length)continue;
    const geometry=mergeGeometries(list);list.forEach(g=>g.dispose());
    const material=makeReefMaterial(timeUniform,{roughness:kind==='metal'?.53:.68,caustics:kind==='wood'?.065:.11});
    if(kind==='metal') {
      material.metalness=.32;
      const compile=material.onBeforeCompile;
      material.onBeforeCompile=shader=>{compile(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float patina=smoothstep(-.3,.55,sin(reefWorld.x*2.3+sin(reefWorld.y*.8))*sin(reefWorld.z*2.1+reefWorld.y*1.3));
        diffuseColor.rgb *= mix(vec3(.85,.94,.95),vec3(1.4,1.28,.96),patina*.6);
      `);};
      material.customProgramCacheKey=()=> 'reef-scenery-patina';
    }
    if(kind==='wood') {
      const compile=material.onBeforeCompile;
      material.onBeforeCompile=shader=>{compile(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float woodGrain=sin(reefWorld.y*21. + sin(reefWorld.x*3.+reefWorld.z*1.8)*3.);
        float wear=sin(reefWorld.y*1.9+reefWorld.x*2.4)*sin(reefWorld.z*2.3);
        diffuseColor.rgb *= .96 + woodGrain*.045 + wear*.025;
      `);};
      material.customProgramCacheKey=()=> 'reef-scenery-wood';
    }
    const mesh=new THREE.Mesh(geometry,material);mesh.name=`Scenery ${kind}`;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);meshes.push(mesh);
  }
  return {placements,meshes};
}
