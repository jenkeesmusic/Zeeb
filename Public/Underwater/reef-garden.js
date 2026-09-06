import * as THREE from 'three';
import { inWreckFootprint } from './wreck-layout.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { COURSE, START, COURSE_SCALE } from './reef-course.js';
import { coralForms, archForm } from './coral-forms.js';
import { reefDetail } from './reef-performance.js';
import { mergeSceneryCells } from './reef-chunks.js';

// Sculpted forms and a restrained mineral palette from the generated reef concepts.
const STONE = [0xb1a5be, 0xa3a6bf, 0xb4b1c2, 0xa39bb9];
const CORAL = [0xffab84, 0xf5afb0, 0xc49ddd, 0xf0c36b, 0x80cbb8];
const SHELF = [0x77cdb2, 0xab84c9, 0x80b8c5, 0xbb9ad2];
export const causticGLSL = `
  uniform float reefDetail;
  vec2 reefHash(vec2 p) { return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
  float reefCaustic(vec2 p, float t) {
    if (reefDetail < .5) return 0.;
    if (reefDetail < 1.5) {
      // Two crossing ripples keep the moving sunlight at a fraction of the
      // nine-cell pattern's per-pixel work on older GPUs.
      vec2 q=p*.42+vec2(t*.09,-t*.07);
      float a=sin(q.x+sin(q.y*1.3+t*.12)*1.1);
      float b=sin(q.y+sin(q.x*1.2-t*.1)*1.1);
      return pow(max(0.,1.-abs(a+b)*2.8),3.)*.65;
    }
    p *= .28; p += vec2(sin(p.y*1.6+t*.18),cos(p.x*1.4-t*.15))*.72;
    vec2 cell=floor(p), uv=fract(p); float a=9., b=9.;
    for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) {
      vec2 offset=vec2(float(x),float(y)); vec2 seed=reefHash(cell+offset);
      vec2 point=offset+.5+.3*sin(t*.22+6.2831*seed)-uv;
      float d=dot(point,point); if(d<a){b=a;a=d;}else{b=min(b,d);}
    }
    return pow(1.-smoothstep(.015,.24,b-a),2.) * (.65+.35*sin(p.x*1.6+p.y*.7)*sin(p.y*.8));
  }
`;

let clayBump;
function bumpTexture() {
  if(clayBump)return clayBump;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'),data=ctx.createImageData(128,128);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++) {
    const u=x/128*Math.PI*2,v=y/128*Math.PI*2;
    const n=128+Math.sin(u*5+Math.sin(v*3))*9+Math.sin(v*7+Math.sin(u*4))*7+Math.sin(u*23)*Math.sin(v*21)*4;
    const i=(y*128+x)*4;data.data[i]=data.data[i+1]=data.data[i+2]=n;data.data[i+3]=255;
  }
  ctx.putImageData(data,0,0);clayBump=new THREE.CanvasTexture(canvas);
  clayBump.wrapS=clayBump.wrapT=THREE.RepeatWrapping;clayBump.repeat.set(3,3);return clayBump;
}

export function makeReefMaterial(timeUniform, { roughness = .58, caustics = .13 } = {}) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0, side: THREE.DoubleSide,
    bumpMap:bumpTexture(), bumpScale:.12 });
  material.onBeforeCompile = shader => {
    shader.uniforms.reefTime = timeUniform;
    shader.uniforms.reefDetail = reefDetail;
    shader.vertexShader = 'varying vec3 reefWorld;\nvarying vec3 reefNormal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n reefWorld = (modelMatrix * vec4(transformed,1.)).xyz; reefNormal=normalize(mat3(modelMatrix)*normal);');
    shader.fragmentShader = 'varying vec3 reefWorld;\nvarying vec3 reefNormal;\nuniform float reefTime;\n' + causticGLSL + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float grain = sin(reefWorld.x*6.1+sin(reefWorld.z*8.7))*sin(reefWorld.y*7.3)*.018;
      diffuseColor.rgb *= 1. + grain;
      diffuseColor.rgb += reefCaustic(reefWorld.xz+reefWorld.y*.15,reefTime) * ${caustics.toFixed(3)} * max(.12,reefNormal.y);
    `);
  };
  material.customProgramCacheKey = () => `sculpted-reef-${caustics}`;
  return material;
}

export function makeKelpGeometry() {
  const p=[], uv=[], indices=[];
  for(let j=0;j<=16;j++) {
    const t=j/16, width=Math.pow(Math.sin(Math.PI*t),.62)*.5, twist=t*1.9-.4;
    for(let k=0;k<5;k++) {
      const across=k/2-1;
      p.push(across*width*Math.cos(twist)+Math.sin(t*3.5)*.65+t*t*.5,t+.05*Math.sin(t*5),Math.sin(t*4.5)*.32+across*width*Math.sin(twist)+across*across*.22*Math.sin(Math.PI*t));
      uv.push(k/4,t);
    }
  }
  for(let j=0;j<16;j++)for(let k=0;k<4;k++) {const a=j*5+k;indices.push(a,a+5,a+1,a+1,a+5,a+6);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function createSculptedGarden({ scene, floorY, timeUniform, sceneryForms }) {
  let seed=83117;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
  const range=(a,b)=>a+random()*(b-a), choose=a=>a[Math.floor(random()*a.length)];
  const rocks=[], corals=[], leaves=[], distant=[];
  const prototypes=coralForms.map(form=>{
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(form.positions,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(form.normals,3));
    g.setIndex(form.indices);return g;
  });
  function tint(geometry, hex, topHex = hex, underside = .78) {
    const p=geometry.attributes.position, n=geometry.attributes.normal, colors=new Float32Array(p.count*3);
    const base=new THREE.Color(hex), top=new THREE.Color(topHex), c=new THREE.Color();
    for(let i=0;i<p.count;i++) {
      const up=THREE.MathUtils.smoothstep(n.getY(i),-.05,.85);
      c.copy(base).lerp(top,up*.35).multiplyScalar(underside+(1-underside)*THREE.MathUtils.smoothstep(n.getY(i),-.8,.75));
      colors.set([c.r,c.g,c.b],i*3);
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    if(!geometry.attributes.uv)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(p.count*2),2));
    return geometry.index?geometry.toNonIndexed():geometry;
  }
  function blob(parts,x,y,z,sx,sy,sz,color,top=color,phase=0) {
    const small=Math.max(sx,sy,sz)<1.1;
    const g=new THREE.SphereGeometry(1,small?10:24,small?6:16),p=g.attributes.position;
    for(let i=0;i<p.count;i++) {
      const px=p.getX(i),py=p.getY(i),pz=p.getZ(i);
      const w=1+.065*Math.sin(px*5+phase)*Math.sin(pz*4-py*3)+.025*Math.cos(py*7+phase);
      p.setXYZ(i,px*w,py*w,pz*w);
    }
    g.scale(sx,sy,sz);g.computeVertexNormals();g.translate(x,y,z);parts.push(tint(g,color,top));
  }
  function stone(x,y,z,sx,sy,sz,color=choose(STONE)) {blob(rocks,x,y,z,sx,sy,sz,color,0xc6d0c9,range(0,6));}
  function foundation(x,y,z,sx,sy,sz,color) {
    stone(x,y,z,sx,sy,sz,color);
    const g=rocks.at(-1),p=g.attributes.position;
    // Broad low rocks follow sloping sand along their underside.
    for(let i=0;i<p.count;i++) {
      const vy=p.getY(i),weight=THREE.MathUtils.smoothstep(y-vy,0,sy*.35);
      if(weight>0)p.setY(i,Math.min(vy,THREE.MathUtils.lerp(vy,floorY(p.getX(i),p.getZ(i))-.4,weight)));
    }
    // Rejoin shared vertices before recalculating, preserving the smooth clay finish.
    g.deleteAttribute('normal');
    const smooth=mergeVertices(g);smooth.computeVertexNormals();
    rocks[rocks.length-1]=smooth.toNonIndexed();smooth.dispose();g.dispose();
  }
  function antler(x,y,z,s,color=choose(CORAL)) {
    const g=choose(prototypes).clone();g.scale(s*1.15,s*.88,s*1.15);g.rotateY(range(0,Math.PI*2));g.translate(x,y,z);
    const tip=new THREE.Color(color).lerp(new THREE.Color(0xffe2bc),.3).getHex();
    corals.push(tint(g,color,tip,.86));
  }
  let fans=0;
  function seaFan(x,y,z,s,yaw) {
    const g=sceneryForms.fan.clay.clone();
    if(fans%3===0){const c=g.attributes.color;for(let i=0;i<c.count;i++)c.setXYZ(i,Math.min(1,c.getX(i)*1.04),c.getY(i)*1.04,c.getZ(i)*.78);}
    g.scale(s,s,s);g.rotateY(yaw);g.translate(x,y,z);corals.push(g);fans++;
  }
  function plate(x,y,z,s,color=choose(SHELF),layers=3) {
    if(layers>1)blob(corals,x,y+(layers-1)*s*.23,z,s*.8,s*.65,s*.7,color,color);
    for(let k=0;k<layers;k++) {
      const radius=s*(1.8-k*.32),g=new THREE.SphereGeometry(1,32,10),p=g.attributes.position,phase=random()*6;
      for(let i=0;i<p.count;i++) {
        const px=p.getX(i),py=p.getY(i),pz=p.getZ(i),angle=Math.atan2(pz,px);
        const scallop=1+.055*Math.sin(angle*7+phase)+.018*Math.cos(angle*11);
        p.setXYZ(i,px*radius*scallop,py*s*.30+Math.sin(angle*5+phase)*s*.08*Math.hypot(px,pz),pz*radius*.86*scallop);
      }
      g.computeVertexNormals();g.translate(x+Math.sin(k*2)*s*.3,y+k*s*.55,z);corals.push(tint(g,color,0xd4edcd,.88));
    }
  }
  function sponges(x,y,z,s,color=choose([0xf0cb7d,0xc5a1d5,0xeda7ad])) {
    for(let k=0;k<4;k++) {
      const h=range(1.35,2.8)*s,r=range(.32,.53)*s;
      const profile=new THREE.SplineCurve([new THREE.Vector2(0,0),new THREE.Vector2(r*.9,.08*h),new THREE.Vector2(r*1.1,h*.4),new THREE.Vector2(r*.94,h*.77),new THREE.Vector2(r,h*.96),new THREE.Vector2(r*.8,h),new THREE.Vector2(r*.58,h*.9),new THREE.Vector2(r*.55,h*.48),new THREE.Vector2(0,h*.45)]);
      const g=new THREE.LatheGeometry(profile.getPoints(24),12);g.rotateZ(range(-.16,.16));
      const tx=x+Math.cos(k*2.4)*s*.8,tz=z+Math.sin(k*2.4)*s*.8;
      const colored=tint(g,color,0xffe7b2,.75),p=colored.attributes.position,c=colored.attributes.color;
      for(let i=0;i<p.count;i++)if(p.getY(i)>h*.42&&Math.hypot(p.getX(i),p.getZ(i))<r*.64)c.setXYZ(i,c.getX(i)*.42,c.getY(i)*.38,c.getZ(i)*.4);
      colored.translate(tx,y,tz);corals.push(colored);
    }
  }
  function kelp(x,y,z,s) {
    for(let k=0;k<4;k++) {
      const g=makeKelpGeometry();g.scale(range(2,3)*s,range(4.5,7)*s,s);g.rotateY(k*2.4);g.rotateZ(range(-.35,.35));g.translate(x+range(-.5,.5),y,z+range(-.5,.5));
      const colored=tint(g,0x398f88,0xa4c982,.85),p=colored.attributes.position,c=colored.attributes.color;
      const low=new THREE.Color(0x287c79),high=new THREE.Color(0x9bc67d),col=new THREE.Color();
      for(let i=0;i<p.count;i++){col.copy(low).lerp(high,THREE.MathUtils.clamp((p.getY(i)-y)/(s*6),0,1));c.setXYZ(i,col.r,col.g,col.b);}
      leaves.push(colored);
    }
  }
  // The lane stays broad; planting comes in distinct, uneven pockets.
  const route=[START,...COURSE];
  function pathDistance(x,z) {
    let best=Infinity;
    for(let i=1;i<route.length;i++) {
      const a=route[i-1],b=route[i],dx=b[0]-a[0],dz=b[2]-a[2];
      const t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz),0,1);
      best=Math.min(best,Math.hypot(x-a[0]-dx*t,z-a[2]-dz*t));
    }
    return best;
  }
  // [progress, side, silhouette, distance from lane, width]. These deliberately
  // leave gaps and favor one bank; there is no repeated left/right plant recipe.
  const pockets=[
    [[.24,-1,'garden',22,7],[.78,1,'shoal',25,9],[.94,-1,'shelf',28,8]],
    [[.17,1,'shelf',24,9],[.47,-1,'garden',22,7],[1.07,-1,'fan',19.5,8],[.82,1,'shoal',25,11]],
    [[.30,1,'garden',23,8],[.56,-1,'shelf',29,9],[.82,-1,'kelp',25,8]],
    [[.21,-1,'shoal',26,10],[.54,1,'shelf',25,8],[.72,1,'garden',34,7],[.93,-1,'garden',31,6]],
    [[.16,1,'shelf',24,10],[.43,-1,'shelf',30,12],[.68,-1,'shoal',24,9],[.83,1,'spire',28,6]],
    [[.20,-1,'bare',29,9],[.47,1,'kelp',24,8],[.64,1,'spire',34,6],[.81,-1,'shelf',27,11]],
    [[.18,1,'kelp',27,7],[.74,-1,'shoal',32,12]],
    [[.16,-1,'kelp',25,8],[.44,1,'kelp',31,11],[.91,-1,'spire',28,7]],
    [[.22,1,'shoal',27,10],[.61,-1,'garden',26,8],[.78,-1,'shelf',34,10],[.94,1,'bare',34,12]],
    [[.14,-1,'bare',28,10],[.53,1,'shoal',29,9],[.98,-1,'shelf',25,9],[.92,1,'garden',25,10]],
    [[.30,1,'kelp',31,7],[.69,-1,'bare',30,11],[.93,1,'shelf',27,9]],
    [[.14,-1,'shoal',29,10],[.49,1,'kelp',28,8],[.66,-1,'shelf',30,9],[.89,-1,'garden',29,6]]
  ];
  const patches=[];
  for(let segment=0;segment<pockets.length;segment++)for(const [t,side,kind,offset,width] of pockets[segment]) {
    const a=route[segment],b=route[segment+1],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz),heading=Math.atan2(dx,dz);
    const x=a[0]+dx*t-dz/len*offset*side,z=a[2]+dz*t+dx/len*offset*side;
    if(pathDistance(x,z)-width<9||inWreckFootprint(x,z,width+5))continue;
    const y=floorY(x,z),height=THREE.MathUtils.clamp(THREE.MathUtils.lerp(a[1],b[1],t)-y,7,15),color=choose(STONE);
    if(kind==='garden'||kind==='fan') {
      // One rounded crown and an offset shoulder, instead of a stack of three discs.
      foundation(x,y+height*.44,z,width,height*.48,width*.72,color);
      stone(x+width*.53,y+height*.29,z+width*.22,width*.58,height*.31,width*.57,color);
      plate(x-.5,y+height*.86,z,width*.32,0x88cbb2,1);
      if(kind==='fan'&&sceneryForms)seaFan(x-width*.35,y+height*.89,z,6.7,heading-.23);
      if(kind==='garden'&&segment===8&&sceneryForms)seaFan(x+1,y+height*.84,z,4.5,heading+.62);
      for(let n=0;n<(kind==='fan'?3:5);n++) {
        const angle=range(0,6.28),r=range(.3,width*.55),cx=x+Math.cos(angle)*r,cz=z+Math.sin(angle)*r;
        const cy=y+height*(n<3?.86:.54);
        if(n===1)sponges(cx,cy,cz,range(.9,1.5),segment<3?0xe9bd7d:0xb49bcf);
        else antler(cx,cy,cz,range(1.2,2.5),choose(segment<3?[0xffab84,0xf5afb0]:[0xc49ddd,0x80cbb8]));
      }
    } else if(kind==='shelf') {
      // Broad stepped ledges, with shelf coral growing from the rock face.
      for(let n=0;n<3;n++) {
        const cx=x+(n-1)*width*.28,cz=z+Math.sin(n*2.1)*width*.2,cy=y+2.1+n*1.9;
        if(n===0)foundation(cx,cy,cz,width,1.6,width*.57,color);
        else stone(cx,cy,cz,width*(1-n*.16),1.6,width*.57,color);
        plate(cx,cy+1.3,cz,width*(.38-n*.04),choose([0x77cdb2,0x80b8c5,0xbb9ad2]),1);
      }
      sponges(x-width*.3,y+6.8,z,1.2,0xc5a1d5);
    } else if(kind==='spire') {
      foundation(x,y+height*.66,z,width*.61,height*.75,width*.53,color);
      stone(x+width*.24,y+height*1.07,z+.8,width*.45,height*.32,width*.42,color);
      plate(x-width*.4,y+height*.55,z+1,width*.28,0x80b8c5,2);
      antler(x+1,y+height*1.33,z,1.8,0xf5afb0);
    } else if(kind==='shoal') {
      foundation(x,y+1.7,z,width,2.2,width*.65,color);
      for(let n=0;n<5;n++) {
        const cx=x+range(-width*.65,width*.65),cz=z+range(-width*.35,width*.35);
        if(n<2)plate(cx,y+3.4,cz,range(1.4,2.5),choose(SHELF),1);
        else sponges(cx,y+3.1,cz,range(.7,1.2),choose([0xf0cb7d,0xeda7ad]));
      }
    } else {
      foundation(x,y+width*.25,z,width,width*.34,width*.65,color);
      if(kind==='kelp') {
        for(let n=0;n<5;n++) {
          const cx=x+range(-width*.65,width*.65),cz=z+range(-width*.4,width*.4);
          kelp(cx,y+width*.32,cz,range(1.0,1.9));
        }
      } else {
        plate(x-width*.48,y+width*.32,z+width*.2,1.8,0x80b8c5,1);
        sponges(x+width*.6,y+1,z,1,0xc5a1d5);
      }
    }
    // Small satellite rocks and a few matching sprouts keep the edges natural.
    for(let n=0;n<(kind==='garden'||kind==='fan'?5:3);n++) {
      const angle=range(0,6.28),r=width+range(.8,3.2),cx=x+Math.cos(angle)*r,cz=z+Math.sin(angle)*r;
      if(pathDistance(cx,cz)<10)continue;
      const cy=floorY(cx,cz);stone(cx,cy+.5,cz,range(.7,1.6),range(.5,1.2),range(.7,1.4),color);
      if(kind==='kelp'&&n===0)kelp(cx,cy+.4,cz,.8);
      else if(kind==='garden'||kind==='fan')antler(cx,cy+.4,cz,range(.45,.8),choose(CORAL));
      else if(kind==='shelf'&&n===1)plate(cx,cy+.4,cz,1.1,0x77cdb2,1);
    }
    patches.push({segment,kind,x,z,width});
  }
  const islands=patches.length;
  // Blender joins the stone arch into a continuous sculpted surface.
  // The opening clears the golden rim; its number renders above scenery.
  const center=new THREE.Vector3(...COURSE[3]);center.y-=3;
  const yaw=Math.atan2(COURSE[4][0]-COURSE[2][0],COURSE[4][2]-COURSE[2][2]);
  const local=(x,y,z)=>new THREE.Vector3(x,y,z).applyAxisAngle(new THREE.Vector3(0,1,0),yaw).add(center);
  const arch=new THREE.BufferGeometry();
  arch.setAttribute('position',new THREE.Float32BufferAttribute(archForm.positions,3));
  arch.setAttribute('normal',new THREE.Float32BufferAttribute(archForm.normals,3));arch.setIndex(archForm.indices);
  arch.rotateY(yaw);arch.translate(...center.toArray());rocks.push(tint(arch,0xaca0b9,0xbdcdb9));
  const rimPoints=[];
  for(let k=0;k<=32;k++) {const a=.32+k/32*(Math.PI-.64),r=13+.1*Math.sin(a*7);rimPoints.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,0));}
  const cap=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPoints),64,.48,10,false);
  cap.scale(1,1,3.5);cap.rotateY(yaw);cap.translate(...center.toArray());corals.push(tint(cap,0x8fd3b0,0xc9e8bf));
  for(const side of [-1,1]) {
    const foot=local(side*11.5,0,0),floor=floorY(foot.x,foot.z);
    const ledge=local(side*13.4,-1,-1.7);
    plate(ledge.x,ledge.y,ledge.z,2.1,0x8dceb6,2);
    antler(ledge.x,ledge.y+1.2,ledge.z,1.65,0xffab84);
    sponges(foot.x+3*side,floor+.2,foot.z,1.2,0xf0cb7d);
    kelp(foot.x+side*4,floor,foot.z-3,1.6);
  }
  // Large, quiet silhouettes beyond the gardens create layered water depth.
  for(const [baseX,baseZ] of [[-58,87],[-48,157],[7,216],[95,226],[190,174],[220,82],[190,-36],[99,-94],[0,-103],[-103,-48]]) {
    const x=baseX*COURSE_SCALE,z=baseZ*COURSE_SCALE;
    const y=floorY(x,z),h=range(15,23);
    for(let k=0;k<3;k++)blob(distant,x+range(-8,8),y+h*(k+.5)/3,z+range(-5,5),range(9,15),h/4,range(9,14),0x74acb5,0x9ac4c4,k);
    for(let k=0;k<4;k++){const cx=x+range(-6,6),cz=z+range(-4,4);antler(cx,y+h*.84,cz,range(1.1,1.6),0x7badac);}
  }
  // Pebbles and small coral sprouts soften the transition to the open sand.
  for(let i=0;i<170;i++) {
    const c=COURSE[i%COURSE.length],x=c[0]+range(-35,35),z=c[2]+range(-35,35),distance=pathDistance(x,z);
    if(distance<8||distance>36||inWreckFootprint(x,z,6))continue;
    const y=floorY(x,z),s=range(.3,.9);stone(x,y+s*.2,z,s,s*.45,s*.7);
    if(i%3===0)plate(x,y+.2,z,s,choose(SHELF),1);
  }
  // Small discoveries on the sand: rounded starfish, ribbed shells, and
  // clustered turquoise coral. Their height stays below the swimming lane.
  for(let i=0;i<44;i++) {
    const a=route[i%12],b=route[i%12+1],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);
    const t=range(.2,.8),side=i%2?1:-1,offset=range(7,12);
    const x=a[0]+dx*t-dz/len*offset*side,z=a[2]+dz*t+dx/len*offset*side,y=floorY(x,z);
    if(i%3===0) {
      const shape=new THREE.Shape(),size=range(.5,.85);
      for(let k=0;k<10;k++) {const a=k*Math.PI/5,r=k%2?size*.43:size;const px=Math.cos(a)*r,py=Math.sin(a)*r;if(!k)shape.moveTo(px,py);else shape.lineTo(px,py);}
      shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelThickness:.1,bevelSize:.08,bevelSegments:3,steps:1});
      g.rotateX(-Math.PI/2);g.rotateY(range(0,6));g.translate(x,y+.12,z);corals.push(tint(g,0xffb095,0xffd3ae));
    } else if(i%3===1) {
      const g=new THREE.SphereGeometry(1,24,12),p=g.attributes.position;
      for(let j=0;j<p.count;j++){const px=p.getX(j),py=p.getY(j),pz=p.getZ(j);const ridge=1+.09*Math.cos(Math.atan2(px,pz)*12);p.setXYZ(j,px*.65*ridge,py*.23,pz*.8*ridge);}
      g.computeVertexNormals();g.rotateY(range(0,6));g.translate(x,y+.15,z);corals.push(tint(g,0xffd3b2,0xffe8c7));
    } else {
      for(let k=0;k<8;k++){const a=k*2.4,r=k/10;blob(corals,x+Math.cos(a)*r,y+.35+Math.sin(k)*.12,z+Math.sin(a)*r,.35,.4,.36,0x61bdbb,0xb9e0c3);}
    }
  }
  function merged(parts,material,name) {
    const group=mergeSceneryCells(parts,material,name,{padding:name.includes('kelp')?1:0});
    scene.add(group);return group;
  }
  const stoneMesh=merged(rocks,makeReefMaterial(timeUniform,{roughness:.56,caustics:.13}),'Sculpted reef stone');
  const coralMesh=merged(corals,makeReefMaterial(timeUniform,{roughness:.4,caustics:.16}),'Sculpted reef coral');
  const leafMat=makeReefMaterial(timeUniform,{roughness:.65,caustics:.06});
  const compile=leafMat.onBeforeCompile;
  leafMat.onBeforeCompile=shader=>{compile(shader);shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.x += sin(reefTime*1.1+position.x*.3+position.z*.25)*uv.y*uv.y*.35;');shader.vertexShader='uniform float reefTime;\n'+shader.vertexShader;};
  leafMat.customProgramCacheKey=()=> 'reef-leaf-sway';
  const leafMesh=merged(leaves,leafMat,'Sculpted reef kelp');
  leafMesh.traverse(mesh=>{mesh.castShadow=false;});
  const distantMesh=merged(distant,makeReefMaterial(timeUniform,{roughness:1,caustics:0}),'Distant reef');
  distantMesh.traverse(mesh=>{mesh.castShadow=false;});
  prototypes.forEach(g=>g.dispose());
  return {stoneMesh,coralMesh,leafMesh,distantMesh,islands,fans,patches};
}
