import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Reusable geometry, built once and baked into the reef batches. Grace's models
// are loaded separately; these forms are only the surrounding scenery.
const V = (x,y,z=0) => new THREE.Vector3(x,y,z);
const TAU = Math.PI*2;
function colorize(g, hex, tip=hex) {
  const p=g.attributes.position,n=g.attributes.normal,c=new Float32Array(p.count*3);
  g.computeBoundingBox();const lo=g.boundingBox.min.y,span=Math.max(.01,g.boundingBox.max.y-lo);
  const base=new THREE.Color(hex),high=new THREE.Color(tip),col=new THREE.Color();
  for(let i=0;i<p.count;i++) {
    const t=(p.getY(i)-lo)/span,shade=.86+.14*THREE.MathUtils.smoothstep(n.getY(i),-.8,.8);
    col.copy(base).lerp(high,t*t*.7).multiplyScalar(shade);c.set([col.r,col.g,col.b],i*3);
  }
  g.setAttribute('color',new THREE.BufferAttribute(c,3));
  if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(p.count*2),2));
  const result=g.index?g.toNonIndexed():g;if(result!==g)g.dispose();return result;
}
function tube(points,r,segments=12,sides=7) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),segments,r,sides,false);
}
function ball(x,y,z,sx,sy,sz) {const tiny=Math.max(sx,sy,sz)<.13;return new THREE.SphereGeometry(1,tiny?8:16,tiny?6:10).scale(sx,sy,sz).translate(x,y,z);}
function roundedBox(x,y,z,sx,sy,sz) {
  // A bevelled rectangle extruded around its depth keeps the wooden edges soft.
  const s=new THREE.Shape(),r=Math.min(sx,sy,sz)*.1;
  s.moveTo(-sx/2+r,-sy/2);s.lineTo(sx/2-r,-sy/2);s.quadraticCurveTo(sx/2,-sy/2,sx/2,-sy/2+r);
  s.lineTo(sx/2,sy/2-r);s.quadraticCurveTo(sx/2,sy/2,sx/2-r,sy/2);
  s.lineTo(-sx/2+r,sy/2);s.quadraticCurveTo(-sx/2,sy/2,-sx/2,sy/2-r);
  s.lineTo(-sx/2,-sy/2+r);s.quadraticCurveTo(-sx/2,-sy/2,-sx/2+r,-sy/2);
  return new THREE.ExtrudeGeometry(s,{depth:sz-2*r,steps:1,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:2,curveSegments:3}).translate(x,y,z-sz/2+r);
}
function combine(parts) {const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());g.computeBoundingSphere();return g;}
function torus(r,t,x,y,z,rx=0,ry=0) {return new THREE.TorusGeometry(r,t,8,40).rotateX(rx).rotateY(ry).translate(x,y,z);}

function seaFan() {
  const p=[],nodes=[];
  const point=(angle,r)=>V(Math.sin(angle)*r,.12+Math.cos(angle)*r*1.46+.018*Math.sin(angle*22+r*6),.10*Math.sin(angle*3+r*5));
  p.push(colorize(tube([V(0,0),V(-.02,.12),V(0,.27)],.032),0xcb6480,0xfdb394));
  // A branching network with small irregular cross veins, rather than a solid plane.
  for(let layer=0;layer<6;layer++) {
    const count=2**(layer+1)+1,r=.23+layer*.17,ring=[];
    for(let j=0;j<count;j++) {
      const angle=-1.07+2.14*j/(count-1)+Math.sin(j*4.7+layer)*.029;
      const end=point(angle,r),start=layer?nodes[layer-1][Math.round(j/2)]:V(0,.15);
      const mid=start.clone().lerp(end,.52);mid.z+=.028*Math.sin(j*3.2);mid.x+=Math.sin(j*8.1+layer)*.016;
      p.push(colorize(tube([start,mid,end],.026-layer*.0034,6,6),0xed959e,0xffc9b0));
      ring.push(end);
      if(j&&layer>0&&j%4!==2) {
        const a=ring[j-1].clone().lerp(start,.28),b=mid.clone(),m=a.clone().lerp(b,.5);m.y+=.018*Math.sin(j*3.1);
        p.push(colorize(tube([a,m,b],.007,5,5),0xe9a0a7,0xffcbb5));
      }
      if(j&&layer>2&&j%3!==1) {
        const a=ring[j-1],b=end,m=a.clone().lerp(b,.5);m.y-=.04;m.z+=.025;
        p.push(colorize(tube([a,m,b],.0065,4,5),0xf0a7ac,0xffd2ba));
      }
      if(layer===5) {
        for(const s of [-1,1]) {
          const tip=end.clone().add(V(s*.018,.030+.018*Math.sin(j),.012));
          p.push(colorize(tube([end,end.clone().lerp(tip,.6),tip],.007,3,5),0xeea4a1,0xffd0b6));
        }
      }
    }
    nodes.push(ring);
  }
  return combine(p);
}

function anemone() {
  const p=[colorize(ball(0,.08,0,.83,.25,.70),0x9696ad,0xbeb8cf),colorize(ball(0,.22,0,.61,.18,.55),0xc379af,0xe5a8c4)];
  for(let j=0;j<42;j++) {
    const a=j*2.39996,r=.15+Math.sqrt(j/42)*.42,h=.45+(.5+.5*Math.sin(j*5.7))*.44;
    const x=Math.cos(a)*r,z=Math.sin(a)*r,lean=.12+.16*r;
    const tip=V(x+Math.cos(a)*lean+.06*Math.sin(j),.23+h,z+Math.sin(a)*lean);
    p.push(colorize(tube([V(x,.2,z),V(x*.98,.2+h*.5,z*.97),tip],.044+(j%3)*.006,8,6),j%3?0xb979bb:0xdc8cba,0xf4c2da));
    p.push(colorize(ball(tip.x,tip.y,tip.z,.064,.081,.064),0xffd8bb,0xffefce));
  }
  return combine(p);
}

function conch() {
  const parts=[],cream=0xf3d5b0;
  // A closed whorled body with a continuous turned-in lip and a deep pink cavity.
  const profile=[[0,-.93],[.35,-.85],[.73,-.58],[.86,-.19],[.80,.17],[.63,.5],[.65,.72],[.76,.85],[.74,.91],[.66,.88],[.58,.72],[.55,.49],[.65,.14],[.63,-.22],[.40,-.48],[0,-.57]].map(([x,y])=>new THREE.Vector2(x,y));
  const g=new THREE.LatheGeometry(new THREE.SplineCurve(profile).getPoints(100),64),p=g.attributes.position;
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x);
    const fold=1+.026*Math.sin(a*17+y*5)+.006*Math.sin(y*62+a*.3);
    p.setXYZ(i,x*fold,y,z*fold*1.12);
  }
  g.computeVertexNormals();const body=colorize(g,cream,0xffe2c0),pos=body.attributes.position,n=body.attributes.normal,c=body.attributes.color;
  const pink=new THREE.Color(0xc9877c),ivory=new THREE.Color(0xf2d5b3),col=new THREE.Color();
  for(let i=0;i<pos.count;i++) {
    if(n.getX(i)*pos.getX(i)+n.getZ(i)*pos.getZ(i)<-.04) {
      const t=THREE.MathUtils.clamp((pos.getY(i)+.55)/1.5,0,1);
      col.copy(pink).lerp(ivory,Math.pow(t,6)).multiplyScalar(.53+.47*t);
      c.setXYZ(i,col.r,col.g,col.b);
    }
  }
  body.rotateX(Math.PI/2).translate(0,1.0,0);parts.push(body);
  const spireProfile=[[.49,1.45],[.52,1.59],[.38,1.73],[.30,1.78],[.32,1.90],[.20,2.03],[.14,2.06],[.15,2.16],[.065,2.30],[0,2.41]].map(([x,y])=>new THREE.Vector2(x,y));
  parts.push(colorize(new THREE.LatheGeometry(new THREE.SplineCurve(spireProfile).getPoints(56),40).translate(0,0,-.38),cream,0xffe8c8));
  for(let j=0;j<7;j++) {
    const a=-1.15+j*.38;
    const x=Math.sin(a)*.75,y=1+Math.cos(a)*.88,z=-.13;
    parts.push(colorize(ball(0,0,0,.095,.20,.12).rotateZ(-a*.4).translate(x,y,z),cream,0xffe4c4));
  }
  return combine(parts);
}

function amphora() {
  const points=[[0,0],[.27,0],[.37,.12],[.64,.38],[.72,.78],[.62,1.13],[.33,1.48],[.31,1.68],[.41,1.75],[.43,1.84],[.35,1.88],[.28,1.80],[.25,1.62],[.28,1.46],[.52,1.03],[.53,.65],[.26,.38],[0,.37]].map(([x,y])=>new THREE.Vector2(x,y));
  const p=[colorize(new THREE.LatheGeometry(new THREE.SplineCurve(points).getPoints(70),32),0xb57659,0xe8ad7d)];
  const g=p[0],pos=g.attributes.position,c=g.attributes.color,n=g.attributes.normal;
  for(let i=0;i<pos.count;i++)if(n.getX(i)*pos.getX(i)+n.getZ(i)*pos.getZ(i)<-.03)c.setXYZ(i,c.getX(i)*.49,c.getY(i)*.44,c.getZ(i)*.42);
  for(const s of [-1,1])p.push(colorize(tube([V(s*.30,1.55),V(s*.75,1.52),V(s*.91,1.22),V(s*.64,.97)],.078,18,8),0xc8906b,0xeabd8b));
  for(const y of [.2,1.73])p.push(colorize(torus(y<1?.4:.34,.028,0,y,0,Math.PI/2),0xefc58f));
  p.push(barnacles([[.27,.40,.57,.10],[.38,.51,.58,.075],[.20,.58,.65,.065],[-.36,1.12,.42,.07]]));
  return combine(p);
}

function barnacles(spots) {
  const p=[];
  for(const [x,y,z,r] of spots) {
    const lip=torus(r,r*.33,x,y,z);p.push(colorize(lip,0x91b9ad,0xd8dbc2));
    p.push(colorize(new THREE.CircleGeometry(r*.73,12).translate(x,y,z-.012),0x567f7b));
  }
  return combine(p);
}

function barrel() {
  const wood=[],metal=[];
  for(let j=0;j<16;j++) {
    const a=j/16*TAU;
    const profile=[[.73,0],[.86,.18],[.98,.7],[1,1.15],[.94,1.7],[.79,2.1],[.73,2.16],[.64,2.13],[.70,1.90],[.75,.32],[.63,.16]].map(([x,y])=>new THREE.Vector2(x,y));
    const g=new THREE.LatheGeometry(profile,3,a+.007,TAU/16-.014);
    wood.push(colorize(g,[0x9b7954,0xb18a5e,0xa78059,0xc2996b][j%4],0xc9aa7e));
    const end=roundedBox(0,.12,0,1.4,.13,.13).rotateY(a).translate(0,0,0);wood.push(colorize(end,0x8f7152));
  }
  for(const [y,r] of [[.23,.88],[.72,1],[1.64,.97],[2.0,.83]]) {
    const profile=[new THREE.Vector2(r-.045,y-.075),new THREE.Vector2(r+.028,y-.075),new THREE.Vector2(r+.028,y+.075),new THREE.Vector2(r-.045,y+.075)];
    metal.push(colorize(new THREE.LatheGeometry(profile,48),0x416e6c,0x769589));
    for(let j=0;j<12;j++){const a=j/12*TAU;metal.push(colorize(ball(Math.sin(a)*(r+.033),y,Math.cos(a)*(r+.033),.031,.031,.031),0xafb291));}
  }
  wood.push(colorize(new THREE.CylinderGeometry(.7,.7,.09,32).translate(0,.13,0),0x77543b));
  return {wood:combine(wood),metal:combine(metal)};
}

function anchor() {
  const m=[];
  m.push(colorize(roundedBox(0,1.80,0,.23,2.76,.22),0x407b77,0x93b4a0));
  m.push(colorize(roundedBox(0,2.5,0,1.44,.19,.3),0x588b81,0x9bb09a));
  m.push(colorize(torus(.31,.092,0,3.45,0),0x5e9487,0xa1b69a));
  for(const s of [-1,1]) {
    m.push(colorize(tube([V(0,.43),V(s*.45,.38),V(s*.94,.67),V(s*1.12,1.17)],.12,18,9),0x49827b,0x95b19b));
    const shape=new THREE.Shape();shape.moveTo(s*.78,.99);shape.lineTo(s*1.25,1.58);shape.lineTo(s*1.43,.96);shape.lineTo(s*.78,.99);
    m.push(colorize(new THREE.ExtrudeGeometry(shape,{depth:.15,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:2,steps:1}).translate(0,0,-.075),0x528a80,0x9ab99f));
    m.push(colorize(ball(s*.71,2.5,0,.14,.14,.18),0x739685,0xafb69a));
  }
  return combine(m);
}

function wheel() {
  const wood=[],metal=[];
  wood.push(colorize(torus(.83,.10,0,0,0),0xb99462,0xd0b180));
  metal.push(colorize(torus(.84,.035,0,0,.095),0x5a887c,0xa5b597));
  for(let j=0;j<8;j++) {
    const a=j/8*TAU;
    wood.push(colorize(tube([V(Math.sin(a)*.17,Math.cos(a)*.17),V(Math.sin(a)*.78,Math.cos(a)*.78),V(Math.sin(a)*1.18,Math.cos(a)*1.18)],.056,5,8),0x957049,0xd1af7b));
    wood.push(colorize(ball(Math.sin(a)*1.15,Math.cos(a)*1.15,0,.087,.087,.087),0xa98556,0xd9b887));
    metal.push(colorize(ball(Math.sin(a)*.84,Math.cos(a)*.84,.108,.038,.038,.025),0xe3c686));
  }
  wood.push(colorize(new THREE.CylinderGeometry(.22,.22,.18,24).rotateX(Math.PI/2),0xa9845c));
  metal.push(colorize(torus(.15,.035,0,0,.115),0x849a7f));
  return {wood:combine(wood),metal:combine(metal)};
}

function rope() {
  const p=[],points=[];
  for(let j=0;j<=180;j++){const t=j/180,a=t*TAU*3.4,r=.25+t*.68;points.push(V(Math.cos(a)*r,.08+.018*Math.sin(a*2),Math.sin(a)*r*.73));}
  const curve=new THREE.CatmullRomCurve3(points),frames=curve.computeFrenetFrames(250,false);
  for(let strand=0;strand<3;strand++) {
    const pts=[];
    for(let j=0;j<=250;j++){const t=j/250,a=t*TAU*54+strand*TAU/3;pts.push(curve.getPointAt(t).addScaledVector(frames.normals[j],Math.cos(a)*.028).addScaledVector(frames.binormals[j],Math.sin(a)*.028));}
    p.push(colorize(tube(pts,.021,500,5),strand?0xbdaa7e:0xd1bd8c,0xe7d3a5));
  }
  p.push(colorize(tube([points.at(-1),V(.9,.09,.5),V(1.35,.08,.56),V(1.5,.07,.86)],.053,30,8),0xbba77d,0xdfc99a));
  return combine(p);
}

function hullRibs() {
  const wood=[],metal=[];
  for(let j=0;j<5;j++) {
    const z=(j-2)*.73,h=2.5+.5*Math.sin(j*2.7);
    const rib=tube([V(-1.2,.08,z),V(-.2,.24,z),V(.9,1.8,z),V(1.4,h*1.6,z)],.16,15,6);
    wood.push(colorize(rib,0x78694f,0xb1a687));
  }
  for(let k=0;k<4;k++) {
    const g=roundedBox(0,0,0,.14,.28,3.2-(k%2)*.5).rotateZ(-.7).translate(.52+k*.22,.67+k*.32,-.06*(k%2));
    wood.push(colorize(g,k%2?0x9b906f:0x82785c,0xc1b392));
  }
  return {wood:combine(wood),metal:null};
}

export function createSceneryForms() {
  const forms={fan:{clay:seaFan()},anemone:{clay:anemone()},shell:{clay:conch()},jar:{clay:amphora()},barrel:barrel(),anchor:{metal:anchor(),clay:barnacles([[.06,1.1,.14,.075],[-.07,1.25,.13,.065],[.62,.49,.12,.08],[.78,.62,.12,.055],[-.45,2.54,.16,.07]])},wheel:wheel(),rope:{wood:rope()},ribs:hullRibs()};
  return {forms,dispose(){for(const parts of Object.values(forms))for(const g of Object.values(parts))g?.dispose();}};
}
