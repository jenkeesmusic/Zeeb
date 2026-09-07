// Feet and seconds; pure choreography shared by the ride and tests.
export const WHIRLPOOL = {x:-55, y:-28, z:50};
export const SKY_LANDING = {x:-27, y:-22, z:28};
export const FLIGHT_DURATION = 43;
const clamp=v=>Math.max(0,Math.min(1,v));
export const flightEase=v=>{const t=clamp(v);return t*t*t*(t*(t*6-15)+10);};
const mix=(a,b,t)=>a+(b-a)*t;
export function sampleFlight(time,entry=WHIRLPOOL,reducedMotion=false) {
  const t=Math.max(0,time),w=WHIRLPOOL;
  let x=w.x,y=5,z=w.z,phase='whirlpool';
  if(t<5){const p=t/5,e=flightEase(p),r=reducedMotion?0:2.8*Math.sin(Math.PI*p)**2;
    x=mix(entry.x,w.x,e)+Math.sin(p*Math.PI*2)*r;z=mix(entry.z,w.z,e)+Math.cos(p*Math.PI*2)*r;y=mix(entry.y,5,e);
  }else if(t<13){const e=flightEase((t-5)/8);x+=14*e;z+=6*e;y=mix(5,1000,e);phase='launch';
  }else if(t<18){x+=14;z+=6;y=1000+(reducedMotion?0:5*Math.sin((t-13)/5*Math.PI)**2);phase='stars';
  }else if(t<21){const e=flightEase((t-18)/3);x+=mix(14,18,e);z+=mix(6,10,e);y=mix(1000,950,e);phase='parachute';
  }else if(t<39){const e=flightEase((t-21)/18);x+=mix(18,28,e);z+=mix(10,-22,e);y=mix(950,8,e);phase='glide';
  }else{const e=flightEase((t-39)/4);x=SKY_LANDING.x;z=SKY_LANDING.z;y=mix(8,SKY_LANDING.y,e);phase=t<43?'splashdown':'complete';}
  return {x,y,z,phase,done:t>=FLIGHT_DURATION,
    rocket:flightEase((t-2)/3)*(1-flightEase((t-18)/2)),
    canopy:flightEase((t-18)/3)*(1-flightEase((t-39.2)/1.2)),
    space:flightEase((y-180)/480)};
}
