import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Traced from Grace's original Public/Islands/img/coin.png (192 x 334).
// Keep her tall, slightly asymmetric silhouette and off-center orange stroke.
const OUTLINE = [[95,12],[81,17],[64,32],[45,66],[32,116],[29,178],[38,236],[55,278],[64,291],[81,306],[95,311],[105,311],[119,306],[136,291],[154,260],[168,208],[171,180],[171,143],[168,115],[161,83],[145,45],[136,32],[119,17],[110,13]];
const STROKE = [[111,49],[106,49],[102,52],[100,58],[100,159],[98,249],[102,254],[109,254],[113,249],[115,159],[115,60],[116,54],[115,52]];
export const GRACE_COIN_COLORS = { gold: 0xf5ce45, orange: 0xffab01 };

function shape(points, scale) {
  const s = new THREE.Shape();
  points.forEach(([x,y],i) => s[i ? 'lineTo' : 'moveTo']((x-100)*scale,(161.5-y)*scale));
  s.closePath(); return s;
}
function colorGeometry(g, color) {
  const c = new THREE.Color(color), colors = new Float32Array(g.attributes.position.count*3);
  for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));
  // One material and one draw call even when body and relief are merged.
  g.clearGroups(); return g;
}
export function createGraceCoinGeometry(height=1.5, { simple=false }={}) {
  const scale=height/299, thickness=height*.115, bevel=height*.014;
  const body=new THREE.ExtrudeGeometry(shape(simple ? OUTLINE.filter((_,i)=>i%2===0) : OUTLINE,scale), {
    depth:thickness-2*bevel, bevelEnabled:true, bevelSize:bevel,
    bevelThickness:bevel, bevelSegments:1, curveSegments:1, steps:1
  });
  body.translate(0,0,-thickness/2+bevel);
  colorGeometry(body,GRACE_COIN_COLORS.gold);
  const stroke=simple ? [[111,49],[104,50],[100,58],[98,249],[102,254],[109,254],[113,249],[116,54]] : STROKE;
  const front=new THREE.ExtrudeGeometry(shape(stroke,scale), {
    depth:height*.008, bevelEnabled:!simple, bevelSize:height*.0025,
    bevelThickness:height*.0025, bevelSegments:1, curveSegments:1, steps:1
  });
  front.translate(0,0,thickness/2);
  const back=front.clone().rotateY(Math.PI);
  const relief=mergeGeometries([front,back]);front.dispose();back.dispose();
  // Compensate for the warm ocean lights so her orange mark stays distinct.
  colorGeometry(relief,0xf58b00);
  body.computeBoundingSphere();relief.computeBoundingSphere();
  return {body,relief};
}
export function createGraceCoinMaterial() {
  // Satin gold keeps the original yellow/orange readable in the blue ocean.
  return new THREE.MeshStandardMaterial({vertexColors:true,metalness:.22,
    roughness:.48,emissive:0xffca66,emissiveIntensity:.16});
}
export function mergeGraceCoinGeometry(parts) {
  const geometry=mergeGeometries([parts.body,parts.relief]);
  parts.body.dispose();parts.relief.dispose();return geometry;
}
