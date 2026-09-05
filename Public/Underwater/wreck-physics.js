const axes=['x','y','z'];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function segmentBoxFraction(a,b,box,pad=0) {
  let near=0,far=1;
  for(const k of axes) {
    const d=b[k]-a[k],lo=box.min[k]-pad,hi=box.max[k]+pad;
    if(Math.abs(d)<1e-9){if(a[k]<lo||a[k]>hi)return Infinity;continue;}
    let t0=(lo-a[k])/d,t1=(hi-a[k])/d;if(t0>t1)[t0,t1]=[t1,t0];
    near=Math.max(near,t0);far=Math.min(far,t1);if(near>far)return Infinity;
  }
  return near;
}
export function sphereOverlaps(p,box,radius) {
  let d=0;for(const k of axes)d+=(p[k]-clamp(p[k],box.min[k],box.max[k]))**2;
  return d<radius*radius;
}
export function resolveShipMovement(from,to,velocity,boxes,radius=1.25) {
  const delta={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z};
  const steps=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.y,delta.z)/.55));
  const p={...from};let hits=0;
  // Small substeps retain sliding while preventing a boosted scooter tunnelling.
  for(let s=0;s<steps;s++) {
    for(const k of axes)p[k]+=delta[k]/steps;
    for(let iteration=0;iteration<3;iteration++) {
      let hit=false;
      for(const box of boxes) {
        if(axes.some(k=>p[k]<box.min[k]-radius||p[k]>box.max[k]+radius))continue;
        const n={};let d2=0;
        for(const k of axes){n[k]=p[k]-clamp(p[k],box.min[k],box.max[k]);d2+=n[k]*n[k];}
        if(d2>=radius*radius)continue;
        let push;
        if(d2>1e-10) {const d=Math.sqrt(d2);for(const k of axes)n[k]/=d;push=radius-d+.001;}
        else {
          push=Infinity;let axis='x',sign=1;
          for(const k of axes)for(const side of [-1,1]) {
            const distance=side<0?p[k]-box.min[k]+radius:box.max[k]-p[k]+radius;
            if(distance<push){push=distance;axis=k;sign=side;}
          }
          for(const k of axes)n[k]=k===axis?sign:0;push+=.001;
        }
        const into=axes.reduce((d,k)=>d+velocity[k]*n[k],0);
        for(const k of axes){p[k]+=n[k]*push;if(into<0)velocity[k]-=n[k]*into;}
        hit=true;hits++;
      }
      if(!hit)break;
    }
  }
  for(const k of axes)to[k]=p[k];return hits;
}
export function segmentDistanceSq(point,a,b) {
  let dot=0,len=0;for(const k of axes){dot+=(point[k]-a[k])*(b[k]-a[k]);len+=(b[k]-a[k])**2;}
  const t=len?clamp(dot/len,0,1):0;
  return axes.reduce((d,k)=>d+(point[k]-a[k]-(b[k]-a[k])*t)**2,0);
}
export function createCoinProgress(coins,storage,key='zeeb-wreck-coins-v1') {
  const valid=new Set(coins.map(c=>c.id));let found=new Set(),canSave=!!storage;
  try {const data=JSON.parse(storage?.getItem(key)||'[]');if(Array.isArray(data))found=new Set(data.filter(id=>valid.has(id)));}catch{}
  function save(){try{storage?.setItem(key,JSON.stringify([...found]));}catch{canSave=false;}}
  return {found,get canSave(){return canSave;},
    collect(a,b,active,boxes=[]) {
      if(!active)return [];
      // Teleports are not coin sweeps.
      if(axes.reduce((d,k)=>d+(b[k]-a[k])**2,0)>100)a=b;
      const picked=[];
      for(const coin of coins)if(!found.has(coin.id)&&segmentDistanceSq(coin,a,b)<3.6**2) {
        if(boxes.some(box=>segmentBoxFraction(b,coin,box)<.98))continue;
        found.add(coin.id);picked.push(coin);
      }
      if(picked.length)save();return picked;
    },
    reset(){found.clear();save();}
  };
}
