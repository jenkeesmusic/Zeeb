import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Grace's Rocket1.png from Astroid Dodger: gray capsule, red fins,
// purple antenna and two black portholes. The real Zeeb occupies the lower one.
export function createGraceRocket() {
  const group=new THREE.Group();group.name="Grace's asteroid rocket in 3D";
  const metal=new THREE.MeshStandardMaterial({color:0x73777d,roughness:.48,metalness:.28});
  const red=new THREE.MeshStandardMaterial({color:0xff453b,roughness:.65});
  const purple=new THREE.MeshStandardMaterial({color:0xbc35f0,roughness:.48});
  const black=new THREE.MeshStandardMaterial({color:0x111822,roughness:.6});
  const s=new THREE.Shape();s.moveTo(-1.2,-1.9);s.bezierCurveTo(-1.6,-.8,-1.5,1.9,-1.22,2.8);
  s.bezierCurveTo(-.95,4.2,.9,4.35,1.25,2.9);s.bezierCurveTo(1.55,1.6,1.4,-1.1,1.05,-2.0);s.bezierCurveTo(.55,-3.1,-.7,-3.05,-1.2,-1.9);
  const port=new THREE.Path();port.absellipse(0,.52,1.02,1.12,0,Math.PI*2,true);s.holes.push(port);
  const shell=new THREE.ExtrudeGeometry(s,{depth:1.5,bevelEnabled:true,bevelSize:.14,bevelThickness:.18,bevelSegments:2,steps:1,curveSegments:10});shell.translate(0,0,-.9);
  group.add(new THREE.Mesh(shell,metal));
  const back=new THREE.Mesh(new THREE.CircleGeometry(1.07,24),black);back.scale.y=1.1;back.position.set(0,.52,-.94);group.add(back);
  const porthole=new THREE.Mesh(new THREE.CircleGeometry(.36,18),black);porthole.position.set(.04,2.25,.79);group.add(porthole);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(1,.075,5,28),black);rim.scale.y=1.12;rim.position.set(0,.52,.78);group.add(rim);
  const fin=new THREE.Shape();fin.moveTo(1.1,-.75);fin.bezierCurveTo(2.3,-.55,3.15,-1.8,3.03,-3.15);fin.bezierCurveTo(2.98,-3.6,2.45,-3.7,2.3,-3.05);fin.bezierCurveTo(2.15,-2.3,1.7,-2.05,1.05,-2.1);fin.closePath();
  const fg=new THREE.ExtrudeGeometry(fin,{depth:.36,bevelEnabled:true,bevelSize:.08,bevelThickness:.08,bevelSegments:1,curveSegments:8,steps:1});fg.translate(0,0,-.18);
  const left=fg.clone().rotateY(Math.PI);const fins=new THREE.Mesh(mergeGeometries([fg,left]),red);fg.dispose();left.dispose();group.add(fins);
  const antenna=new THREE.Mesh(new THREE.CapsuleGeometry(.17,1.5,4,10),purple);antenna.position.set(-.1,4.6,0);group.add(antenna);
  const base=new THREE.Mesh(new THREE.SphereGeometry(.42,12,8),purple);base.scale.y=.38;base.position.set(-.1,3.82,0);group.add(base);
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.48,2.1,12),new THREE.MeshBasicMaterial({color:0xffd87d,transparent:true,opacity:.85,depthWrite:false}));flame.rotation.z=Math.PI;flame.position.y=-3.5;group.add(flame);
  group.userData.flame=flame;return group;
}
export function createParachute() {
  const group=new THREE.Group();group.name='Zeeb rainbow parachute';
  const g=new THREE.SphereGeometry(4.2,32,10,0,Math.PI*2,0,Math.PI/2);g.scale(1,.55,1);g.translate(0,6.2,0);
  const palette=[0xffab92,0xffd982,0x7edbd8,0xa6b5ec],colors=[];
  const p=g.attributes.position,c=new THREE.Color();
  for(let i=0;i<p.count;i++){const a=Math.atan2(p.getZ(i),p.getX(i))+Math.PI;c.setHex(palette[Math.floor(a/(Math.PI/4))%4]);colors.push(c.r,c.g,c.b);}
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  group.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,side:THREE.DoubleSide})));
  const cords=[];for(let i=0;i<8;i++){const a=i*Math.PI/4;cords.push(Math.cos(a)*4.1,6.2,Math.sin(a)*4.1,Math.cos(a)*.62,.45,Math.sin(a)*.62);}
  const ropes=new THREE.BufferGeometry();ropes.setAttribute('position',new THREE.Float32BufferAttribute(cords,3));
  group.add(new THREE.LineSegments(ropes,new THREE.LineBasicMaterial({color:0xfff3d1})));
  return group;
}
