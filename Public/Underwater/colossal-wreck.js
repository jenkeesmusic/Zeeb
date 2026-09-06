import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeSceneryCells } from './reef-chunks.js';
import { makeReefMaterial, makeKelpGeometry } from './reef-garden.js';
import { WRECK, WRECK_ENTRY, WRECK_ROOMS, WRECK_COINS, hullWidth, inWreckFootprint } from './wreck-layout.js';
import { resolveShipMovement, segmentBoxFraction, createCoinProgress } from './wreck-physics.js';

const V=(x,y,z)=>new THREE.Vector3(x,y,z),TAU=Math.PI*2;
const WOOD=[0x886548,0x987452,0xab8862,0x977755,0xac8e68];
const DECK=[0xac916c,0xbda17a,0xa98c69,0xb3966e];
function bevelBox(w,h,d) {
  const r=Math.min(.16,w*.16,h*.16,d*.16),s=new THREE.Shape();
  s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);
  s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);
  s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
  return new THREE.ExtrudeGeometry(s,{depth:d-2*r,steps:1,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:1,curveSegments:2}).translate(0,0,-d/2+r);
}
function tint(geometry,color) {
  const g=geometry.index?geometry.toNonIndexed():geometry;if(g!==geometry)geometry.dispose();
  const c=new THREE.Color(color),p=g.attributes.position,colors=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++)colors.set([c.r,c.g,c.b],i*3);
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));
  if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(p.count*2),2));
  return g;
}

export function createColossalWreck({scene,timeUniform,forms,duck,rally,spawnBubble,reducedMotion}) {
  const group=new THREE.Group();group.name='The colossal shipwreck';group.position.set(WRECK.x,WRECK.y,WRECK.z);scene.add(group);
  const parts={wood:[],metal:[],clay:[],canvas:[],glow:[]},colliders=[];
  let sequence=0;
  function add(g,kind='wood',color=WOOD[sequence++%WOOD.length]){parts[kind].push(tint(g,color));}
  function collider(x,y,z,w,h,d) {
    colliders.push({min:{x:WRECK.x+x-w/2,y:WRECK.y+y-h/2,z:WRECK.z+z-d/2},max:{x:WRECK.x+x+w/2,y:WRECK.y+y+h/2,z:WRECK.z+z+d/2}});
  }
  function box(x,y,z,w,h,d,color,solid=false,kind='wood',yaw=0) {
    add(bevelBox(w,h,d).rotateY(yaw).translate(x,y,z),kind,color);
    if(solid)collider(x,y,z,Math.abs(Math.cos(yaw))*w+Math.abs(Math.sin(yaw))*d,h,Math.abs(Math.sin(yaw))*w+Math.abs(Math.cos(yaw))*d);
  }
  function tube(points,r,color=0x786354,kind='wood',steps=32) {
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>V(...p))),steps,r,7,false),kind,color);
  }
  function beam(a,b,r=.5,color=0x786354,kind='wood') {tube([a,b],r,color,kind,1);}
  function prop(name,x,y,z,size,yaw=0,roll=0) {
    for(const [kind,g] of Object.entries(forms[name]))if(g) {
      const clone=g.clone().scale(size,size,size).rotateZ(roll).rotateY(yaw).translate(x,y,z);
      parts[kind].push(clone);
    }
  }
  function breach(side,z,y) {
    // Staggered ends create splintered, uneven openings rather than rectangular bays.
    const edge=Math.sin(y*1.8)*3.5+Math.cos(y*3.3)*1.8;
    if(z<-78+edge&&y>7&&y<24)return true;
    if(side<0)return (z>-61+edge&&z<-24-edge&&y>5)||(z>-11+edge&&z<26-edge&&y>7)||(z>52+edge&&z<74-edge&&y>15);
    return (z>-61+edge&&z<-42-edge&&y>13)||(z>32+edge&&z<64-edge&&y>10);
  }
  const hullFactor=y=> y<6?.53+y*.063:y<16?.91+(y-6)*.01:1.01-(y-16)*.006;
  // Individual curved plank courses, interrupted by enormous broken swim-throughs.
  for(let z=-91;z<96;z+=8)for(let y=2;y<29;y+=1.7)for(const side of [-1,1]) {
    if(breach(side,z,y))continue;
    const w=hullWidth(z),x=side*w*hullFactor(y),yaw=Math.atan2(side*(hullWidth(z+4)-hullWidth(z-4))*hullFactor(y),8);
    const leftEnd=breach(side,z-8,y),rightEnd=breach(side,z+8,y);
    const length=leftEnd||rightEnd?6.6+1.3*Math.sin(y*3.8+z):8.1;
    const plankZ=z+(leftEnd&&!rightEnd?(8.1-length)/2:rightEnd&&!leftEnd?-(8.1-length)/2:0);
    box(x,y,plankZ,1.15,1.61,length,WOOD[Math.round(y*1.7)%WOOD.length],true,'wood',yaw);
  }
  // Long rails trace the hull even from a distance; broken sections reveal the rooms.
  for(const side of [-1,1])for(const [lo,hi] of [[-94,-63],[-23,-12],[27,95]])for(const y of [9.5,16.3,28.5]) {
    const points=[];for(let z=lo;z<=hi;z+=2)points.push([side*hullWidth(z)*hullFactor(y),y,z]);
    tube(points,y>20?.7:.5,y>20?0x719e92:0x78604f);
  }
  // The raised bow lip and broken rail posts complete the prow silhouette.
  for(const side of [-1,1]) {
    tube([[0,31,-96],[side*17,30,-82],[side*26,30,-65]],.75,0xa38c64);
    for(const z of [-85,-73,-17,34,45,81,92]) {
      const x=side*hullWidth(z)*.95;
      beam([x,29,z],[x,32.5+Math.sin(z)*.7,z],.32,0x729988);
    }
    tube([[side*27,33,34],[side*27,34,48],[side*25,34,57]],.4,0xab9a74);
  }
  tube([[0,32,-107],[-7,43,-73],[2,61,-37],[-2,46,0],[-4,58,22],[0,43,59]],.18,0xc3b992,'canvas',70);
  // Bent ribs and a visible keel give the cutaway its unmistakable boat shape.
  for(let z=-84;z<94;z+=14) {
    const w=hullWidth(z)-1.0;
    const low=[[-w*.8,7,z],[-w*.53,2,z],[0,1,z],[w*.53,2,z],[w*.8,7,z]];
    tube(low,.65,0x776250);
    for(const side of [-1,1])if(!breach(side,z,20))tube([[side*w*.8,7,z],[side*w*.95,16,z],[side*w,29,z]],.65,0x776250);
  }
  beam([0,1,-96],[0,1,95],.8,0x74604e);
  tube([[0,1,-96],[0,8,-99],[0,22,-97],[0,31,-91]],1.1,0x89715a);
  tube([[0,24,-95],[0,31,-108],[0,35,-114]],.7,0xb79a78);

  const holes=[{x:-8,z:-43,w:20,d:24},{x:7,z:15,w:20,d:22},{x:-8,z:57,w:18,d:20}];
  function deck(y,z0,z1,widthFactor,cutouts=true) {
    // Full-length boards with staggered ends, clipped around the hull and hatches.
    // Batching the continuous spans also removes thousands of tiny deck faces.
    for(let col=-14;col<=14;col++) {
      const x=col*2.2,span=3+(col+15)%3;let start=null,count=0;
      const flush=()=>{if(count){box(x,y,start+(count-1)*2,2.12,.72,count*4-.075,DECK[(col+16)%DECK.length],true);start=null;count=0;}};
      for(let z=z0;z<z1;z+=4) {
        const w=hullWidth(z)*widthFactor-1;
        const missing=Math.abs(x)+1>w || (cutouts&&holes.some(h=>Math.abs(x-h.x)<h.w/2+1.1&&Math.abs(z-h.z)<h.d/2+2)) || (y===30&&z<-49&&x<3+Math.sin(x*4)*1.8);
        if(missing){flush();continue;}
        if(start===null)start=z;count++;
        if(count===span)flush();
      }
      flush();
    }
  }
  deck(4,-59,76,.65,false);deck(17,-75,92,.95);deck(30,-67,96,.98);
  // Hatch rims are low and rounded; their openings remain twenty feet across.
  for(const y of [17.5,30.5])for(const h of holes) {
    for(const side of [-1,1])box(h.x+side*(h.w/2+1.6),y,h.z,.65,.65,h.d+3,0x73978a);
    for(const side of [-1,1])box(h.x,y,h.z+side*(h.d/2+2),h.w+3,.65,.65,0x73978a);
  }
  // Crossbeams sit directly under the deck, leaving a clear central swimming height.
  for(const z of [-68,-24,32,80])for(const y of [15.9,28.9])box(0,y,z,hullWidth(z)*1.84,1.0,1.2,0x806b57);

  function doorway(z,y,width=54,windows=false) {
    const opening=16,side=(width-opening)/2;
    for(const sign of [-1,1]) {
      const cx=sign*(opening+side)/2;
      for(let yy=.75;yy<13;yy+=1.5) {
        if(windows&&yy>3&&yy<10.5) {
          for(const edge of [-1,1])box(cx+edge*(side/2-1.2),y+yy,z,2.4,1.44,1.3,WOOD[Math.floor(yy)%5],true);
        }else box(cx,y+yy,z,side,1.44,1.3,WOOD[Math.floor(yy)%5],true);
      }
      if(windows) {
        const pts=[];for(let i=0;i<=16;i++){const a=Math.PI-i/16*Math.PI;pts.push([cx+Math.cos(a)*(side/2-2.5),y+8.7+Math.sin(a)*2.2,z-.8]);}
        tube(pts,.28,0xbdae7e);box(cx,y+3,z,side-4,.45,2,0x799a85);
      }
    }
    // A genuinely curved opening, with collision following its arched lintel.
    const arch=new THREE.Shape();arch.moveTo(-8,8);arch.absellipse(0,8,8,3.5,Math.PI,0,true);arch.lineTo(8,13);arch.lineTo(-8,13);arch.closePath();
    add(new THREE.ExtrudeGeometry(arch,{depth:1.3,bevelEnabled:true,bevelSize:.1,bevelThickness:.1,bevelSegments:1,steps:1,curveSegments:20}).translate(0,y,z-.65),'wood',0xa18a65);
    for(let x=-7.5;x<8;x++) {const bottom=8+3.5*Math.sqrt(1-(x/8)**2);collider(x,y+(bottom+13)/2,z,1,13-bottom,1.3);}
    const pts=[];for(let i=0;i<=20;i++){const a=Math.PI-i/20*Math.PI;pts.push([Math.cos(a)*8,y+8+Math.sin(a)*3.5,z-.8]);}
    tube(pts,.45,0x6a9589);
    box(0,y+13,z,width+1,.6,1.8,0x806c51);
  }
  doorway(12,4,40);doorway(-10,17);doorway(35,17,54);doorway(59,30,49,true);
  // An off-center storeroom behind the rear cargo, with a generous side entrance.
  for(const z of [32,57])box(-14,9.5,z,12,10,1.1,0x937957,true);
  for(const z of [33,56])box(-7,9.5,z,1.1,10,5,0x937957,true);
  box(-7,14.4,44.5,1.1,1.5,27,0x9b8465,true);
  for(const z of [38,51])beam([-7,4.5,z],[-7,14,z],.4,0x719788);
  // Stern transom: broad arched windows and an open central doorway to the balcony.
  doorway(89,30,44,true);
  for(const side of [-1,1]) {
    // Side windows are 15 ft wide, with sill and lintel but no glass.
    box(side*23,32,73,1.2,4,29,0x9e8569,true);
    box(side*23,43.3,73,1.2,2.4,29,0x9e8569,true);
    for(const z of [59,87])box(side*23,37, z,1.2,10,2,0x977a5f,true);
    tube([[side*23,38,62],[side*23,42,67],[side*23,43,73],[side*23,42,79],[side*23,38,84]],.45,0x77a493);
  }
  // A cambered roof, partly missing on the port side, shades the captain's room.
  for(let x=-20;x<=23;x+=2.4)for(let z=60;z<=90;z+=6) {
    if(x<-6&&z<74)continue;
    const y=48-5*(x/24)**2;box(x,y,z,2.3,.8,5.9,0x759b8c,true);
  }
  for(const z of [59,91])tube([[-23,43.5,z],[-12,47,z],[0,48.5,z],[12,47,z],[23,43.5,z]],.75,0xbbb08b);
  // Stern balcony and weathered balustrade, open at the side entrances.
  for(let x=-20;x<=20;x+=2.2)box(x,30,96,2.12,.8,8,0xb99d7c,true);
  tube([[-22,34,92],[-21,34,99],[0,34,102],[21,34,99],[22,34,92]],.45,0x8ea798);
  for(let x=-18;x<=18;x+=6)beam([x,30,100],[x,34,100],.25,0xac9472);
  // Decorative stern ribs and brass medallion read at ocean scale.
  for(const x of [-17,-9,9,17])tube([[x*.7,4,95],[x,16,97],[x,29,96]],.6,0x7c6959);
  const crest=new THREE.TorusGeometry(2.5,.25,8,36).translate(0,26,97.5);add(crest,'metal',0xcbb885);
  beam([-1.8,24.2,97.6],[1.8,27.8,97.6],.25,0xd2bc80,'metal');beam([1.8,24.2,97.6],[-1.8,27.8,97.6],.25,0xd2bc80,'metal');

  function crate(x,y,z,size=4.5) {
    box(x,y+size/2,z,size,size,size,0xa99070,true);
    for(const side of [-1,1])for(const top of [-1,1])box(x,y+size/2+top*size*.39,z+side*(size/2+.05),size,.35,.23,0x77715f);
    for(const side of [-1,1])beam([x-size*.42,y+.4,z+side*(size/2+.17)],[x+size*.42,y+size-.4,z+side*(size/2+.17)],.18,0x758f7f);
  }
  // One cargo maze: ample aisles, changing stack heights, and an open end at either side.
  for(const [x,z,h] of [[-15,-46,4.5],[14,-48,5],[-14,-34,4.5],[14,-25,5],[-13,29,5],[13,40,4.5],[-14,53,4.5]]) {
    crate(x,4.5,z,h);if(z===-46||z===40)crate(x+.2,4.5+h,z,3.5);
  }
  for(const [x,y,z,s,r] of [[-23,17.5,-37,2,0],[-22,17.5,-32,1.6,.3],[23,17.5,-29,2,0],[21,17.5,-35,1.7,1.5],[-13,4.5,6,2,0],[14,4.5,57,2,0]])prop('barrel',x,y,z,s,.3,r);
  prop('rope',-19,17.7,-19,2.5);prop('jar',15,4.5,19,2.0);prop('jar',19,17.5,25,1.8);
  prop('anchor',-30,2,-68,3.3,.4,-.2);
  tube([[-30,12,-68],[-34,18,-63],[-30,29,-67],[-23,30,-61]],.17,0x68998b,'metal');
  // Galley: a rounded cooking hearth, hanging copper pans, shelves, and a long bench.
  box(24,19.5,7,5,4,20,0xb4afa0,true,'clay');
  for(const z of [1,10,17])prop('jar',24,21.6,z,1.4,z*.3);
  box(24,26,8,5,.6,20,0xb59a78);box(14,19,9,2.3,2.2,12,0xa89171,true);
  for(const z of [2,10,18]) {
    add(new THREE.CylinderGeometry(1.3,1.5,.5,18).rotateX(Math.PI/2).translate(25,24.4,z),'metal',0xc8a877);
    beam([25,25.8,z],[25,27,z],.13,0x907c61,'metal');
  }
  // Map tables have parchment, curled rolls, compass rings, and dotted routes.
  function mapTable(x,y,z,w=9,d=6) {
    box(x,y+2.5,z,w,.75,d,0xb49a74,true);
    for(const side of [-1,1])for(const end of [-1,1])box(x+side*(w/2-1),y+1,z+end*(d/2-1),.6,2.7,.6,0x81705a);
    box(x,y+2.92,z,w*.8,.09,d*.78,0xe3d1a0,false,'canvas');
    for(const side of [-1,1])add(new THREE.CylinderGeometry(.22,.22,d*.9,12).rotateX(Math.PI/2).translate(x+side*w*.42,y+3.1,z),'canvas',0xe5d4a6);
    for(let i=0;i<12;i++)add(new THREE.SphereGeometry(.09,6,4).scale(1,.25,1).translate(x-w*.31+i*w*.053,y+3,z+Math.sin(i*.6)*d*.22),'metal',0x708e7a);
    add(new THREE.TorusGeometry(.75,.06,5,24).rotateX(Math.PI/2).translate(x+2,y+3,z-.7),'metal',0x9a956d);
  }
  mapTable(0,17.4,60,10,7);mapTable(0,30.4,76,11,7);
  prop('wheel',0,32.5,86,2.2);box(0,31.5,86,1.1,3,1.1,0x816c53);
  box(-17,32.6,78,5,3.8,10,0x718f86,true);box(-17,34.7,78,5.2,.45,10.2,0xb8c2a7);
  for(let i=0;i<5;i++)box(17,33+i*.8,80,5,.5,3,0xa28c70);
  prop('shell',-18,35,83,1.2,.7);prop('rope',16,30.5,66,1.7);

  function lantern(x,y,z,light=false) {
    beam([x,y+2,z],[x,y+3,z],.12,0x717f68,'metal');
    box(x,y,z,1.1,1.8,1.1,0xffd78c,false,'glow');
    for(const side of [-1,1])for(const end of [-1,1])beam([x+side*.6,y-1,z+end*.6],[x+side*.6,y+1,z+end*.6],.11,0x768f7e,'metal');
    box(x,y-1.1,z,1.4,.25,1.4,0x789480,false,'metal');box(x,y+1.1,z,1.6,.32,1.6,0x789480,false,'metal');
    if(light){const l=new THREE.PointLight(0xffd69a,35,24,1.1);l.position.set(x,y,z);group.add(l);}
  }
  for(const [x,y,z,lit] of [[-21,26,-54,1],[20,26,-19,0],[-15,13,-17,1],[23,26,22,0],[-15,13,43,1],[-19,26,50,0],[-17,41,63,1],[17,41,85,0]])lantern(x,y,z,!!lit);

  // Broken masts, a little crow's nest and slack rigging instead of a forest of poles.
  for(const [x,z,top] of [[3,-37,61],[-3,20,58]]) {
    tube([[x,4,z],[x,30,z],[x-1,top,z+2]],1.0,0x997d5c);
    collider(x,(top+4)/2,z,1.7,top-4,1.7);
    beam([x-17,top-4,z],[x+17,top-4,z+1],.55,0xbda17a);
    for(const side of [-1,1])tube([[x,top-1,z],[side*10,34,z+10],[side*26,30,z+19]],.12,0xb7b495,'canvas');
  }
  // Curved ragged canvas on the forward mast, kept above the swimming decks.
  const sail=new THREE.PlaneGeometry(28,21,18,12),sp=sail.attributes.position;
  for(let i=0;i<sp.count;i++) {
    const x=sp.getX(i),y=sp.getY(i);sp.setZ(i,Math.cos(x/28*Math.PI)*2.2+Math.sin(y*.2)*.7);
    if(y<-9)sp.setY(i,y+2.6*Math.abs(Math.sin(x*.61))+Math.max(0,x-5)*.17);
  }
  sail.computeVertexNormals();sail.translate(2,46.5,-36);add(sail,'canvas',0xe6dabb);
  add(new THREE.CylinderGeometry(6,5.5,.8,32).translate(-3,51.2,21),'wood',0xac9070);
  collider(-3,51.2,21,10,.7,10);
  for(let i=0;i<12;i++){const a=i/12*TAU;beam([-3+Math.cos(a)*5.7,51.5,21+Math.sin(a)*5.7],[-3+Math.cos(a)*5.7,53,21+Math.sin(a)*5.7],.17,0xb4a181);}
  // An incomplete rim leaves a broad opening above; there is no tiny ladder to negotiate.
  const nestRim=[];for(let i=0;i<=24;i++){const a=i/24*Math.PI*1.4;nestRim.push([-3+Math.cos(a)*5.7,53,21+Math.sin(a)*5.7]);}tube(nestRim,.22,0xc1ac87);
  // Reef growth follows seams and corners, leaving the timber silhouette readable.
  for(const [x,y,z,s] of [[-26,8,-60,1.8],[29,17,34,1.2],[-24,30,27,1.4],[22,44,86,1.2],[-23,17,69,1.2],[-20,30,-61,1.4]])prop('anemone',x,y,z,s,z);
  prop('fan',-24,31,52,3.8,1.1);prop('shell',22,17.5,43,1.8,.7);
  for(const [x,y,z] of [[-26,9,-63],[27,27,67],[-22,30,-65],[-20,43,83],[22,3,-60]])for(let i=0;i<5;i++) {
    add(makeKelpGeometry().scale(1.5,2.5+(i%3),1.5).rotateY(i*2.4+z).translate(x+Math.sin(i*3)*1.2,y,z+Math.cos(i*2)*1.2),'clay',i%2?0x9ebf93:0x77aa91);
  }

  const meshes=[];
  for(const [kind,list] of Object.entries(parts)) {
    if(!list.length)continue;
    let material;
    if(kind==='glow')material=new THREE.MeshBasicMaterial({vertexColors:true});
    else {
      material=makeReefMaterial(timeUniform,{roughness:kind==='metal'?.57:.78,caustics:kind==='wood'?.07:.09});
      material.side=THREE.DoubleSide;material.metalness=kind==='metal'?.23:0;
      if(kind==='wood') {
        const compile=material.onBeforeCompile;material.onBeforeCompile=shader=>{compile(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          float shipGrain=sin(reefWorld.y*27.+sin(reefWorld.z*.8+reefWorld.x*.4)*2.4);
          diffuseColor.rgb *= .97 + shipGrain*.027;
        `);};material.customProgramCacheKey=()=> 'colossal-wreck-wood';
      }
    }
    const cells=mergeSceneryCells(list,material,`Wreck ${kind}`,{castShadow:kind!=='glow'});group.add(cells);meshes.push(...cells.children);
  }

  let storage=null;try{if(!new URLSearchParams(location.search).has('wrecktest'))storage=localStorage;}catch{}
  const progress=createCoinProgress(WRECK_COINS,storage);
  const coinMat=new THREE.MeshStandardMaterial({color:0xffc748,metalness:.55,roughness:.3,emissive:0xdb861a,emissiveIntensity:.28});
  const stampMat=new THREE.MeshStandardMaterial({color:0xffedab,metalness:.4,roughness:.4,emissive:0xffcc61,emissiveIntensity:.2});
  const coinGeo=new THREE.CylinderGeometry(.68,.68,.18,24).rotateX(Math.PI/2);
  const stampParts=[new THREE.TorusGeometry(.51,.045,6,24).translate(0,0,.105),new THREE.TorusGeometry(.51,.045,6,24).translate(0,0,-.105)];
  const star=new THREE.Shape();for(let j=0;j<10;j++){const a=j*Math.PI/5,r=j%2?.16:.34;const x=Math.sin(a)*r,y=Math.cos(a)*r;if(j)star.lineTo(x,y);else star.moveTo(x,y);}star.closePath();
  for(const z of [-.12,.11])stampParts.push(new THREE.ShapeGeometry(star).translate(0,0,z));
  stampMat.side=THREE.DoubleSide;
  const stampsGeo=mergeGeometries(stampParts.map(g=>g.index?g.toNonIndexed():g));stampParts.forEach(g=>g.dispose());
  const coins=new THREE.InstancedMesh(coinGeo,coinMat,WRECK_COINS.length),stamps=new THREE.InstancedMesh(stampsGeo,stampMat,WRECK_COINS.length);
  coins.name='Collectible wreck coins';stamps.name='Coin engravings';coins.frustumCulled=stamps.frustumCulled=false;scene.add(coins,stamps);
  coins.count=stamps.count=0;
  coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);stamps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy=new THREE.Object3D(),previous=duck.position.clone(),temp=new THREE.Vector3();
  const coinBounds=new THREE.Sphere(new THREE.Vector3(),1);
  const $=id=>document.getElementById(id);
  $('rallyHud').insertAdjacentHTML('beforeend','<div id="wreckStats" hidden><div id="wreckRoom">The colossal wreck</div><div class="wreck-score"><i aria-hidden="true"></i><strong id="wreckCount"></strong><span>coins found</span></div><div id="wreckClue"></div></div>');
  $('menu').querySelector('.menu-actions').insertAdjacentHTML('beforeend','<button id="wreckBtn" type="button">Explore the wreck</button>');
  $('rallyControls').insertAdjacentHTML('beforeend','<button id="wreckReturn" type="button" hidden>Back outside</button><button id="wreckAgain" type="button" hidden>Find coins again</button>');
  function enter() {
    rally.explore({position:new THREE.Vector3(...WRECK_ENTRY),direction:V(1,0,1).normalize(),message:'A whole ship to explore. Follow the coins!'});
    previous.copy(duck.position);
  }
  $('wreckBtn').addEventListener('click',enter);$('wreckReturn').addEventListener('click',enter);
  $('wreckAgain').addEventListener('click',()=>{progress.reset();lastMilestone=0;enter();rally.announce('A fresh ship full of coins!');});
  let uiTimer=0,coinClock=0,lastMilestone=Math.floor(progress.found.size/20),lastPicked=-10;
  function near(position){return inWreckFootprint(position.x,position.z,12)&&position.y<WRECK.y+66;}
  function roomAt(position) {
    let best=Infinity,index=0;
    WRECK_ROOMS.forEach((room,i)=>{const [x,y,z]=room.center;const d=(position.x-WRECK.x-x)**2+(position.z-WRECK.z-z)**2+(position.y-WRECK.y-y)**2*10;if(d<best){best=d;index=i;}});return index;
  }
  function resolveMovement(from,to,velocity) {
    if(!near(from)&&!near(to))return;
    const boxes=colliders.filter(b=>['x','y','z'].every(k=>Math.max(from[k],to[k])+2>b.min[k]&&Math.min(from[k],to[k])-2<b.max[k]));
    resolveShipMovement(from,to,velocity,boxes);
  }
  function clipCamera(origin,eye) {
    if(!near(origin)&&!near(eye))return;
    let fraction=1;for(const box of colliders)fraction=Math.min(fraction,segmentBoxFraction(origin,eye,box,.35));
    if(fraction<1)eye.lerpVectors(origin,eye,Math.max(.05,fraction-.025));
  }
  function update(dt) {
    coinClock+=dt;
    const active=dt>0&&['explore','racing'].includes(rally.state.mode);
    const picked=progress.collect(previous,duck.position,active,colliders);previous.copy(duck.position);
    if(picked.length) {
      if(coinClock-lastPicked>.12){rally.chime([880,1175]);lastPicked=coinClock;}
      if(!reducedMotion)for(const c of picked)for(let i=0;i<3;i++)spawnBubble(temp.set(c.x,c.y,c.z),.13+i*.05);
      const milestone=Math.floor(progress.found.size/20);
      if(progress.found.size===WRECK_COINS.length){rally.announce('Every coin found! What an explorer.',5);rally.chime([523,659,784,1047]);}
      else if(milestone>lastMilestone)rally.announce(`${progress.found.size} coins found! Keep exploring.`,2);
      lastMilestone=milestone;
    }
    uiTimer+=dt;
    if(uiTimer>.15||!dt) {
      uiTimer=0;const nearby=near(duck.position),exploring=rally.state.mode==='explore';
      $('wreckStats').hidden=!exploring||(!nearby&&!progress.found.size);
      $('wreckReturn').hidden=!exploring||!nearby;$('playBtn').hidden=!exploring||nearby;
      $('wreckAgain').hidden=!exploring||progress.found.size!==WRECK_COINS.length;
      $('wreckBtn').hidden=rally.state.mode==='paused';
      if(exploring) {
        const r=roomAt(duck.position),room=WRECK_ROOMS[r],remaining=WRECK_COINS.filter(c=>c.room===r&&!progress.found.has(c.id)).length;
        $('wreckRoom').textContent=nearby?room.name:'The colossal wreck';$('wreckCount').textContent=`${progress.found.size} / ${WRECK_COINS.length}`;
        const verticalHint=document.body.classList.contains('touch-mode')?'Up / Down to change decks':'Space up / Shift down';
        $('wreckClue').textContent=nearby?(remaining?`${remaining} coins nearby · ${verticalHint}`:'This nook is explored. Try another deck!'):(progress.canSave?'Your finds are saved.':'Your finds stay for this visit.');
      }
    }
  }
  // Rendering follows the final camera; collection still checks every coin,
  // including offscreen ones. Compact instances so collected/hidden coins do
  // not continue submitting zero-scale geometry to the GPU.
  function updateView(camera,frustum,profile) {
    let coinCount=0,stampCount=0;
    WRECK_COINS.forEach((c,i)=> {
      if(progress.found.has(c.id))return;
      coinBounds.center.set(c.x,c.y,c.z);
      if(!frustum.intersectsSphere(coinBounds))return;
      dummy.position.set(c.x,c.y+(reducedMotion?0:Math.sin(coinClock*1.8+i)*.2),c.z);
      dummy.rotation.set(0,reducedMotion?i*.7:coinClock*.9+i*.7,0);dummy.updateMatrix();
      coins.setMatrixAt(coinCount++,dummy.matrix);
      if(camera.position.distanceToSquared(coinBounds.center)<profile.coinDetail**2)stamps.setMatrixAt(stampCount++,dummy.matrix);
    });
    coins.count=coinCount;stamps.count=stampCount;
    for(const mesh of [coins,stamps])if(mesh.count) {
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0,mesh.count*16);
      mesh.instanceMatrix.needsUpdate=true;
    }
  }
  return {group,meshes,colliders,coins:WRECK_COINS,progress,rooms:WRECK_ROOMS,near,enter,roomAt,resolveMovement,clipCamera,update,updateView};
}
