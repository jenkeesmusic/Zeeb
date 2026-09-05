// Feet, matching the rest of the ocean. The hoop course stays outside this hull.
export const WRECK = Object.freeze({ x:97, y:-64, z:60, length:190, width:64 });
export const WRECK_ENTRY = Object.freeze([64,-42,7]);
export function hullWidth(z) {
  const profile=[[-96,2],[-82,17],[-60,27],[-30,32],[30,32],[65,28],[95,21]];
  for(let i=1;i<profile.length;i++)if(z<=profile[i][0]) {
    const [a,w]=profile[i-1],[b,v]=profile[i];return w+(v-w)*Math.max(0,(z-a)/(b-a));
  }
  return 21;
}
export function inWreckFootprint(x,z,margin=0) {
  const localZ=z-WRECK.z;
  return localZ>-96-margin&&localZ<96+margin&&Math.abs(x-WRECK.x)<hullWidth(localZ)+margin;
}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function wreckFloor(x,z,original,courseDistance) {
  const localZ=z-WRECK.z;
  const inside=1-smooth(-3,12,Math.max(Math.abs(x-WRECK.x)-hullWidth(localZ),Math.abs(localZ)-94));
  // The bow is embedded in the course shelf; only the interior needs a flat bed.
  const weight=inside*smooth(15,28,courseDistance);
  return original+(WRECK.y-.5-original)*weight;
}
export const WRECK_ROOMS = [
  {name:'Broken bow', center:[0,22,-70], coins:[[-8,22,-73],[0,22,-64],[9,22,-69],[-5,24,-82],[7,27,-54]]},
  {name:'Cargo hold', center:[0,10,-33], coins:[[-12,9,-51],[-5,9,-45],[3,9,-39],[12,9,-33],[-12,10,-25],[0,10,-19],[12,10,-15],[0,10,-9]]},
  {name:'Lantern gallery', center:[-17,23,-25], coins:[[-24,23,-51],[-17,22,-46],[-19,22,-38],[-17,22,-30],[-22,22,-22],[-16,22,-13],[0,22,-10],[14,22,-20]]},
  {name:'The galley', center:[18,23,6], coins:[[14,22,-5],[19,22,2],[22,22,9],[17,22,16],[10,22,10],[12,25,21]]},
  {name:'Hidden cargo', center:[0,10,38], coins:[[-10,10,21],[0,10,27],[10,10,33],[-12,10,41],[0,10,45],[12,10,49],[0,10,59]]},
  {name:'The map room', center:[0,23,57], coins:[[-14,22,39],[-10,22,48],[0,22,50],[11,22,49],[15,22,60],[-14,22,63],[0,25,71]]},
  {name:'Open deck', center:[0,35,-12], coins:[[-13,35,-62],[0,35,-57],[14,35,-50],[20,35,-34],[-18,35,-31],[-23,35,-14],[20,35,0],[0,35,7],[-20,35,27],[21,35,39],[0,35,43],[-15,35,53]]},
  {name:'Captain’s cabin', center:[0,37,74], coins:[[-12,36,63],[0,36,64],[12,36,63],[-14,37,74],[14,37,74],[-8,37,84],[8,37,84],[0,40,79]]},
  {name:'The crow’s nest', center:[-3,55,20], coins:[[-9,40,19],[-6,46,20],[-3,55,20],[4,55,22],[6,50,27]]},
  {name:'Stern balcony', center:[0,37,94], coins:[[-16,36,91],[-9,36,95],[0,36,96],[9,36,95],[16,36,91]]}
];
// Two coins at each stop form little gleaming pairs. Routes and alcoves are authored.
export const WRECK_COINS = WRECK_ROOMS.flatMap((room,r)=>room.coins.flatMap((p,i)=>
  [0,1].map(j=>({id:`${r}-${i}-${j}`,room:r,x:WRECK.x+p[0]+(j?1.6:-1.6),y:WRECK.y+p[1],z:WRECK.z+p[2]+(j?.7:-.7)}))));
