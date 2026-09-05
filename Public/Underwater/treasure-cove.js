import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COURSE } from './reef-course.js';
import { coralForms } from './coral-forms.js';
import { makeKelpGeometry } from './reef-garden.js';

// A real hollow chest, with a hinged barrel lid, coins and a little wreck.
// The same completion event that scores the last hoop opens the treasure.
export function createTreasureCove({ scene, floorY, spawnBubble, reducedMotion = false }) {
  let seed=7049;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
  const range=(a,b)=>a+(b-a)*random();
  const finish=new THREE.Vector3(...COURSE.at(-1));
  const forward=finish.clone().sub(new THREE.Vector3(...COURSE.at(-2))).setY(0).normalize();
  const right=new THREE.Vector3(-forward.z,0,forward.x),back=forward.clone().negate();
  const chest=new THREE.Group();chest.name='Lost treasure';
  chest.position.copy(finish).addScaledVector(forward,11).addScaledVector(right,4);chest.position.y-=6.8;
  chest.rotation.y=Math.atan2(back.x,back.z);scene.add(chest);
  const ground=floorY(chest.position.x,chest.position.z),shelfHeight=chest.position.y-ground;
  const shelfY=(x,z)=>Math.max(-shelfHeight*.6+shelfHeight*.5*Math.sqrt(Math.max(0,1-(x/7.7)**2-((z-1)/5.4)**2)),
    -shelfHeight*.17+shelfHeight*.18*Math.sqrt(Math.max(0,1-((x-.3)/7.2)**2-((z-1)/5.2)**2)));
  const wood=new THREE.MeshStandardMaterial({color:0x98532b,roughness:.58});
  wood.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 woodPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nwoodPosition=position;');
    shader.fragmentShader='varying vec3 woodPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float grain=sin(woodPosition.y*23.+sin(woodPosition.x*.8+woodPosition.z*.4)*1.8);
      float fine=sin(woodPosition.y*97.+sin(woodPosition.x*1.7)*2.);
      diffuseColor.rgb *= .91+grain*.09+fine*.025;
    `);
  };
  const brass=new THREE.MeshStandardMaterial({color:0xd7a341,metalness:.65,roughness:.32});
  const dark=new THREE.MeshStandardMaterial({color:0x352921,roughness:.9});
  const wreckWood=new THREE.MeshStandardMaterial({color:0x85806a,roughness:.85});
  wreckWood.onBeforeCompile=wood.onBeforeCompile;
  const stone=new THREE.MeshStandardMaterial({color:0xa89cbd,roughness:.7});
  const gold=new THREE.MeshStandardMaterial({color:0xffc947,metalness:.64,roughness:.27,emissive:0xf8a821,emissiveIntensity:.1});
  const bodyParts=new Map(),lidParts=new Map(),wreckParts=[];
  function roundedBox(w,h,d,r=.09) {
    r=Math.min(r,w*.2,h*.2,d*.42);
    const shape=new THREE.Shape();
    shape.moveTo(r,0);shape.lineTo(w-r,0);shape.quadraticCurveTo(w,0,w,r);shape.lineTo(w,h-r);
    shape.quadraticCurveTo(w,h,w-r,h);shape.lineTo(r,h);shape.quadraticCurveTo(0,h,0,h-r);
    shape.lineTo(0,r);shape.quadraticCurveTo(0,0,r,0);
    const g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.01,d-r*2),bevelEnabled:true,bevelSegments:2,bevelSize:r*.45,bevelThickness:r,steps:1,curveSegments:3});
    g.translate(-w/2,-h/2,-d/2+r);return g;
  }
  function part(parts,mat,g,p=[0,0,0],rotation=[0,0,0]) {
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));g.translate(...p);
    if(!parts.has(mat))parts.set(mat,[]);parts.get(mat).push(g.index?g.toNonIndexed():g);
  }
  function box(parts,mat,size,p,rotation=[0,0,0],r=.09){part(parts,mat,roundedBox(...size,r),p,rotation);}
  function rivet(parts,p){part(parts,brass,new THREE.SphereGeometry(.125,10,6),p);}
  function batch(parts,parent) {
    for(const [material,geometries] of parts){const mesh=new THREE.Mesh(mergeGeometries(geometries),material);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);geometries.forEach(g=>g.dispose());}
  }
  box(bodyParts,dark,[8.1,.35,5.25],[0,.48,0]);
  for(let row=0;row<3;row++) {
    const y=1.03+row*.97;
    for(const z of [-2.68,2.68])box(bodyParts,wood,[8.15,.92,.3],[0,y,z]);
    for(const x of [-4.08,4.08])box(bodyParts,wood,[.3,.92,5.15],[x,y,0]);
  }
  for(const y of [.5,3.5]) {
    for(const z of [-2.8,2.8])box(bodyParts,brass,[8.75,.3,.42],[0,y,z]);
    for(const x of [-4.22,4.22])box(bodyParts,brass,[.32,.3,5.6],[x,y,0]);
  }
  for(const x of [-3,3])for(const z of [-2.89,2.89]) {
    box(bodyParts,brass,[.42,3.1,.19],[x,2,z],undefined,.05);
    for(const y of [.57,3.47])rivet(bodyParts,[x,y,z+Math.sign(z)*.14]);
  }
  for(const x of [-4.4,4.4]) {
    const handle=new THREE.TorusGeometry(.52,.105,8,20,Math.PI*1.3);
    part(bodyParts,brass,handle,[x,2,0],[0,Math.PI/2,.2]);
    for(const z of [-.55,.55])box(bodyParts,brass,[.15,.45,.32],[x,2.1,z]);
  }
  // Barrel lid: individual rounded planks and curved metal straps.
  const hinge=new THREE.Group();hinge.name='Treasure lid hinge';hinge.position.set(0,3.58,-2.7);chest.add(hinge);
  for(let k=0;k<11;k++) {
    const a=(k+.5)/11*Math.PI,rotation=Math.atan2(1.65*Math.cos(a),2.7*Math.sin(a));
    box(lidParts,wood,[8.25,.26,.83],[0,1.65*Math.sin(a),2.7+2.7*Math.cos(a)],[rotation,0,0],.06);
  }
  const end=new THREE.Shape();end.moveTo(-2.7,0);end.lineTo(2.7,0);end.absellipse(0,0,2.7,1.65,0,Math.PI,false);end.closePath();
  for(const x of [-4.16,4.16]) {
    const g=new THREE.ExtrudeGeometry(end,{depth:.22,bevelEnabled:true,bevelSize:.06,bevelThickness:.05,bevelSegments:2,curveSegments:20});
    part(lidParts,wood,g,[x,0,2.7],[0,Math.PI/2,0]);
  }
  for(const x of [-3,3]) {
    const points=[];for(let k=0;k<=32;k++){const a=k/32*Math.PI;points.push(new THREE.Vector3(x,1.75*Math.sin(a),2.7+2.8*Math.cos(a)));}
    part(lidParts,brass,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.18,8,false));
    for(const a of [.12,.7,1.4,2.3,3.02])rivet(lidParts,[x,1.88*Math.sin(a),2.7+2.88*Math.cos(a)]);
  }
  for(const z of [0,5.4])box(lidParts,brass,[8.65,.22,.28],[0,0,z]);
  batch(bodyParts,chest);batch(lidParts,hinge);
  const latch=new THREE.Mesh(roundedBox(.95,1.05,.24,.18),brass);latch.position.set(0,2.98,3.02);chest.add(latch);
  const hole=new THREE.Mesh(new THREE.CircleGeometry(.16,16),new THREE.MeshBasicMaterial({color:0x292219}));hole.position.set(0,.05,.13);latch.add(hole);
  const slot=new THREE.Mesh(new THREE.PlaneGeometry(.12,.27),hole.material);slot.position.set(0,-.12,.135);latch.add(slot);

  // Batched coins keep the reward inexpensive even while the reef is visible.
  const coinGeo=new THREE.CylinderGeometry(.29,.29,.075,18),coins=new THREE.InstancedMesh(coinGeo,gold,224);
  coins.name='Treasure coins';chest.add(coins);coins.receiveShadow=true;
  const dummy=new THREE.Object3D();
  for(let i=0;i<224;i++) {
    const inside=i<196;
    if(inside){const x=range(-3.6,3.6),z=range(-2.1,2.1);dummy.position.set(x,3.08+.5*Math.max(0,1-Math.hypot(x*.22,z*.32))+range(0,.2),z);}
    else {const a=range(-1.2,1.2),x=Math.sin(a)*range(4.4,6),z=3.2+Math.cos(a)*range(.5,2.8);dummy.position.set(x,shelfY(x,z)+.08,z);}
    dummy.rotation.set(range(-.15,.15),range(0,6.28),range(-.15,.15));dummy.scale.setScalar(range(.8,1.25));dummy.updateMatrix();coins.setMatrixAt(i,dummy.matrix);
  }
  const gems=[];
  for(const [x,z,color,size] of [[-2.4,.6,0x2eddb9,.65],[1.4,1.1,0xa17ce3,.62],[2.9,-.8,0x35c9ce,.45],[-.5,-1.2,0x51d895,.44],[.1,1.8,0x9663db,.45]]) {
    const gem=new THREE.Mesh(new THREE.IcosahedronGeometry(size,0),new THREE.MeshStandardMaterial({color,metalness:.2,roughness:.2,emissive:color,emissiveIntensity:.08}));
    gem.position.set(x,3.64,z);gem.rotation.set(.2,range(0,6),.4);chest.add(gem);gems.push(gem);
  }
  const compass=new THREE.Group();compass.name='Golden compass';compass.position.set(.5,3.9,-.6);compass.rotation.x=-.35;chest.add(compass);
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(.74,.74,.17,32),brass);rim.rotation.x=Math.PI/2;compass.add(rim);
  const face=new THREE.Mesh(new THREE.CircleGeometry(.63,32),new THREE.MeshBasicMaterial({color:0xffefc3}));face.position.z=.09;compass.add(face);
  for(let k=0;k<4;k++) {
    const star=new THREE.Shape();star.moveTo(0,.55);star.lineTo(.105,0);star.lineTo(0,-.16);star.lineTo(-.105,0);star.closePath();
    const needle=new THREE.Mesh(new THREE.ShapeGeometry(star),new THREE.MeshBasicMaterial({color:k%2?0xbc8b32:0x286e73}));needle.rotation.z=k*Math.PI/2;needle.position.z=.105;compass.add(needle);
  }
  const lamp=new THREE.PointLight(0xffc568,0,23,1.8);lamp.position.set(0,4.3,1);chest.add(lamp);
  const flareCanvas=document.createElement('canvas');flareCanvas.width=flareCanvas.height=64;const ctx=flareCanvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,215,120,.65)');gradient.addColorStop(.35,'rgba(255,194,70,.24)');gradient.addColorStop(1,'rgba(255,190,80,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const flare=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(flareCanvas),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}));flare.position.set(0,4,0);flare.scale.set(11,7,1);chest.add(flare);
  const burst=new THREE.InstancedMesh(coinGeo,gold,18);burst.name='Celebration coins';burst.count=0;chest.add(burst);burst.frustumCulled=false;
  const flights=Array.from({length:18},()=>({x:range(-2.2,2.2),z:range(-1.6,1.6),vx:range(-1.6,1.6),vz:range(-1,1.8),vy:range(2.5,4.2),phase:range(0,6)}));

  // A low stone shelf roots the treasure at swimming height. Broken boat ribs
  // behind it explain why the chest was lost without blocking its opening.
  for(let i=0;i<2;i++) {
    const rock=new THREE.Mesh(new THREE.SphereGeometry(1,32,16),stone);
    rock.scale.set(7.7-i*.5,shelfHeight*(i?.18:.5),5.4-i*.2);
    rock.position.set(i*.3,-shelfHeight+(i?.83:.4)*shelfHeight,1);rock.castShadow=rock.receiveShadow=true;chest.add(rock);
  }
  for(let i=0;i<4;i++) {
    const x=-6.3+i*4.2,points=[];
    for(let j=0;j<=14;j++){const t=j/14;points.push(new THREE.Vector3(x+Math.sin(t*2)*.7,-.6+(6.5+i*.6)*(1-Math.cos(t*2.04))/1.45,-3.8-Math.sin(t*2.04)*4.1));}
    wreckParts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.38,8,false).toNonIndexed());
  }
  for(let row=0;row<5;row++) {
    const length=17.5-row*1.6,h=.92,outline=new THREE.Shape();
    outline.moveTo(-length/2,-h/2);outline.lineTo(length/2-.6,-h/2);outline.lineTo(length/2-.8,-.06);outline.lineTo(length/2,h*.28);outline.lineTo(length/2-1.1,h/2);
    outline.lineTo(-length/2+.3,h/2);outline.lineTo(-length/2+.7,.02);outline.lineTo(-length/2,-.2);outline.closePath();
    const g=new THREE.ExtrudeGeometry(outline,{depth:.28,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:2,steps:1});
    g.rotateZ(.08+row*.05);g.translate(1+row*.5,.3+row*1.3,-5.1-row*.55);wreckParts.push(g);
  }
  const wreck=new THREE.Mesh(mergeGeometries(wreckParts),wreckWood);wreck.name='Old boat ribs and planks';wreck.castShadow=wreck.receiveShadow=true;chest.add(wreck);wreckParts.forEach(g=>g.dispose());
  const coralMaterial=new THREE.MeshStandardMaterial({color:0xf1a185,roughness:.48}),mint=new THREE.MeshStandardMaterial({color:0x8dceb6,roughness:.48});
  for(const [x,z,s] of [[-6,1.8,.64],[6.1,2.5,.85],[6.3,-3.1,.65]]) {
    const form=coralForms[0],g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(form.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(form.normals,3));g.setIndex(form.indices);
    const coral=new THREE.Mesh(g,coralMaterial);coral.scale.setScalar(s);coral.position.set(x,shelfY(x,z),z);coral.castShadow=true;chest.add(coral);
    for(let k=0;k<2;k++){const plate=new THREE.Mesh(new THREE.SphereGeometry(1,24,10),mint);plate.scale.set(1.6-k*.3,.22,1.15);plate.position.set(x+Math.sign(x)*.5,shelfY(x,z)+k*.38-.1,z-1.2);chest.add(plate);}
  }
  const kelpMaterial=new THREE.MeshStandardMaterial({color:0x4f9d82,roughness:.65,side:THREE.DoubleSide});
  for(const side of [-1,1])for(let k=0;k<3;k++) {
    const leaf=new THREE.Mesh(makeKelpGeometry(),kelpMaterial);leaf.scale.set(1.6,4.5+k*1.1,1);leaf.rotation.y=k*2.4;
    leaf.position.set(side*(8+k*.3),-shelfHeight,-2.5+k*.8);chest.add(leaf);
  }
  const state={opened:false,time:0,amount:0};
  function reset(){state.opened=false;state.time=state.amount=0;hinge.rotation.x=0;latch.rotation.z=0;lamp.intensity=0;flare.material.opacity=0;burst.count=0;gold.emissiveIntensity=.1;}
  function reveal(){if(!state.opened){state.opened=true;state.time=0;}}
  scene.addEventListener('rallystart',reset);scene.addEventListener('rallycomplete',reveal);
  const temp=new THREE.Vector3(),look=new THREE.Vector3(),eye=new THREE.Vector3();let bubbles=0;
  return {
    chest,hinge,coins,gems,compass,burst,state,reveal,reset,
    frame(player,portrait) {
      look.copy(chest.position).add(new THREE.Vector3(0,3.8,0)).lerp(temp.copy(player).add(new THREE.Vector3(0,1,0)),.4);
      eye.copy(look).addScaledVector(back,portrait?31:18).addScaledVector(right,portrait?7:12);eye.y+=portrait?13:9;
      look.y-=portrait?4:1;
      return {eye,look};
    },
    update(dt,t) {
      if(!state.opened)return;
      state.time+=dt;
      const unlocked=state.time>.35;
      state.amount+=((unlocked?1:0)-state.amount)*(1-Math.exp(-dt*2.8));
      hinge.rotation.x=-1.28*state.amount;latch.rotation.z=Math.min(1,state.time*3)*.28;
      lamp.intensity=24*state.amount;flare.material.opacity=.09*state.amount;gold.emissiveIntensity=.1+state.amount*.17;
      const age=state.time-.65,celebrating=!reducedMotion&&age>0&&age<3.8;
      burst.count=celebrating?flights.length:0;
      if(celebrating){flights.forEach((f,i)=>{dummy.position.set(f.x+f.vx*age,3.5+f.vy*age-1.1*age*age,f.z+f.vz*age);dummy.rotation.set(age*2+f.phase,age*1.7,age);dummy.scale.setScalar(.9*Math.min(1,Math.max(0,(3.8-age)/1.3)));dummy.updateMatrix();burst.setMatrixAt(i,dummy.matrix);});burst.instanceMatrix.needsUpdate=true;}
      bubbles+=dt;if(bubbles>.3&&state.time<5){bubbles=0;chest.localToWorld(temp.set(range(-3,3),4,range(-2,2)));spawnBubble(temp,.2);}
    }
  };
}
