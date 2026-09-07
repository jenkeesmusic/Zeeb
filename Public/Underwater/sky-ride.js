import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createGraceRocket, createParachute } from './grace-rocket.js';
import { WHIRLPOOL, SKY_LANDING, FLIGHT_DURATION, sampleFlight, flightEase } from './sky-flight.js';

export function createSkyRide({scene,camera,duck,swim,camPos,camLook,rally,clearInput,spawnBubble}) {
  const w=WHIRLPOOL, reduced=rally.reducedMotion;
  const state={active:false,time:0,phase:'idle',cooldown:0,entry:{...w},heading:0,entryYaw:0,pose:sampleFlight(0),splash:false};
  const whirlpool=new THREE.Group();whirlpool.name='Underwater sky whirlpool';whirlpool.position.set(w.x,0,w.z);scene.add(whirlpool);
  const funnelMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{time:{value:0}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float time;void main(){
      float wave=.5+.5*sin(vUv.x*31.416-vUv.y*26.+time);
      float edges=smoothstep(0.,.04,vUv.y)*(1.-smoothstep(.96,1.,vUv.y));
      vec3 water=mix(vec3(.07,.52,.59),vec3(.6,.98,.9),vUv.y);
      gl_FragColor=vec4(water,(.045+.18*pow(wave,5.))*edges);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const funnel=new THREE.Mesh(new THREE.CylinderGeometry(10.5,2.5,53,28,16,true),funnelMat);funnel.position.y=-26.5;whirlpool.add(funnel);
  const ribbons=[];
  for(let strand=0;strand<3;strand++){
    const points=[];for(let i=0;i<=70;i++){const u=i/70,a=u*Math.PI*5+strand*Math.PI*2/3,r=2.5+u*u*8;points.push(new THREE.Vector3(Math.cos(a)*r,-53+u*53,Math.sin(a)*r));}
    ribbons.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),70,.23,4,false));
  }
  const swirl=new THREE.Mesh(mergeGeometries(ribbons),new THREE.MeshStandardMaterial({color:0xa3f5ed,emissive:0x49caba,emissiveIntensity:.4,transparent:true,opacity:.5,depthWrite:false}));ribbons.forEach(g=>g.dispose());whirlpool.add(swirl);
  const entryHalo=new THREE.Mesh(new THREE.TorusGeometry(6,.1,4,36),new THREE.MeshBasicMaterial({color:0xffdf9d,transparent:true,opacity:.6,depthWrite:false}));entryHalo.rotation.x=Math.PI/2;entryHalo.position.y=w.y;whirlpool.add(entryHalo);
  let seed=417;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
  const dotCanvas=document.createElement('canvas');dotCanvas.width=dotCanvas.height=32;
  const dotContext=dotCanvas.getContext('2d'),gradient=dotContext.createRadialGradient(16,16,2,16,16,15);
  gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.65,'rgba(255,255,255,.8)');gradient.addColorStop(1,'rgba(255,255,255,0)');
  dotContext.fillStyle=gradient;dotContext.fillRect(0,0,32,32);const dotMap=new THREE.CanvasTexture(dotCanvas);
  const bubbles=[];for(let i=0;i<96;i++){const u=random(),a=random()*Math.PI*2,r=3+u*u*7;bubbles.push(Math.cos(a)*r,-53+u*53,Math.sin(a)*r);}
  const bubbleSeeds=new Float32Array(bubbles);
  const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(bubbles,3));
  bg.attributes.position.setUsage(THREE.DynamicDrawUsage);
  bg.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,-26.5,0),29);
  whirlpool.add(new THREE.Points(bg,new THREE.PointsMaterial({map:dotMap,color:0xe6ffff,size:.28,transparent:true,opacity:.75,depthWrite:false})));

  const journey=new THREE.Group();journey.name='Whirlpool sky adventure';journey.visible=false;scene.add(journey);
  const rocket=createGraceRocket(),chute=createParachute();journey.add(rocket,chute);
  const sky=new THREE.Group();sky.name='Sky and stars for the whirlpool ride';sky.visible=false;scene.add(sky);
  const positions=[],colors=[],color=new THREE.Color();
  for(let i=0;i<900;i++){const y=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-y*y);positions.push(Math.cos(a)*r*1900,y*1900,Math.sin(a)*r*1900);color.setHex([0xffffff,0xc4d9ff,0xffe5ad][i%3]);colors.push(color.r,color.g,color.b);}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));starGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({map:dotMap,vertexColors:true,size:2.6,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,fog:false}));stars.name='Quiet space stars';stars.frustumCulled=false;sky.add(stars);
  const planet=new THREE.Mesh(new THREE.SphereGeometry(2100,40,20),new THREE.MeshBasicMaterial({color:0x306e98,fog:false}));planet.name='Ocean world below';planet.position.y=-2107;sky.add(planet);
  const cloudGeo=new THREE.SphereGeometry(1,10,6),clouds=new THREE.InstancedMesh(cloudGeo,new THREE.MeshStandardMaterial({color:0xe4d6e0,roughness:1,fog:false}),40),dummy=new THREE.Object3D();
  for(let bank=0;bank<10;bank++){const a=bank*Math.PI/5,r=180+random()*420,x=w.x+Math.cos(a)*r,z=w.z+Math.sin(a)*r,y=80+random()*70;for(let puff=0;puff<4;puff++){dummy.position.set(x+(puff-1.5)*22,y+Math.sin(puff)*5,z+(random()-.5)*14);dummy.scale.set(25+random()*20,6+random()*7,16+random()*15);dummy.updateMatrix();clouds.setMatrixAt(bank*4+puff,dummy.matrix);}}clouds.name='Soft cloud banks';sky.add(clouds);
  const sun=new THREE.Mesh(new THREE.SphereGeometry(44,16,10),new THREE.MeshBasicMaterial({color:0xffd9b3,fog:false}));sun.position.set(-320,165,650);sky.add(sun);
  const rippleMat=new THREE.MeshBasicMaterial({color:0xf0fffa,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  const ripple=new THREE.Mesh(new THREE.RingGeometry(.9,1,48),rippleMat);ripple.rotation.x=-Math.PI/2;ripple.position.set(SKY_LANDING.x,.3,SKY_LANDING.z);ripple.visible=false;scene.add(ripple);
  const splashGeo=new THREE.BufferGeometry(),splashPositions=new Float32Array(36*3);splashGeo.setAttribute('position',new THREE.BufferAttribute(splashPositions,3));
  const splash=new THREE.Points(splashGeo,new THREE.PointsMaterial({map:dotMap,color:0xecfffa,size:.32,transparent:true,opacity:0,depthWrite:false}));splash.visible=false;splash.frustumCulled=false;scene.add(splash);
  let visualTime=0,splashAt=0,nearNotice=false,normalFar=camera.far,lastUI='';
  const eye=new THREE.Vector3(),look=new THREE.Vector3(),temp=new THREE.Vector3();
  const aqua=new THREE.Color(0x8ae0e2),peach=new THREE.Color(0xe5b1b0),dusk=new THREE.Color(0x565a8a),space=new THREE.Color(0x05091b);
  const $=id=>document.getElementById(id);
  $('menuTrips').insertAdjacentHTML('beforeend','<button id="findWhirlpool" type="button">Find the sky whirlpool</button><button id="leaveSkyRide" type="button" hidden>Return to the ocean</button>');
  const landing=()=>new THREE.Vector3(SKY_LANDING.x,SKY_LANDING.y,SKY_LANDING.z);
  function restorePosition(){duck.position.copy(landing());swim.vel.set(0,0,0);swim.yaw=0;swim.yawRate=swim.pitch=swim.bank=swim.speed=0;camPos.copy(duck.position).add(temp.set(0,2.6,-7.8));camLook.copy(duck.position).add(temp.set(0,.5,2.2));}
  function cleanup(){state.active=false;state.phase='idle';state.cooldown=16;journey.visible=sky.visible=ripple.visible=splash.visible=false;camera.far=normalFar;camera.updateProjectionMatrix();clearInput();document.body.classList.remove('sky-riding');}
  function finish(message='A lovely splashdown. The ocean is yours again.'){cleanup();rally.explore({position:landing(),direction:new THREE.Vector3(0,0,1),message});}
  function begin(){
    if(state.active||state.cooldown>0||rally.state.mode!=='explore')return false;
    clearInput();state.entry={x:duck.position.x,y:duck.position.y,z:duck.position.z};state.entryYaw=swim.yaw;
    state.heading=Math.atan2(camPos.x-duck.position.x,camPos.z-duck.position.z);
    state.active=true;state.time=0;state.phase='whirlpool';state.splash=false;state.pose=sampleFlight(0,state.entry,reduced);
    normalFar=camera.far;camera.far=5000;camera.updateProjectionMatrix();rally.state.mode='ride';rally.state.boost=0;
    swim.vel.set(0,0,0);journey.visible=true;document.body.classList.add('sky-riding');
    rally.announce('Up we go. Just enjoy the ride.',3);rally.chime([392,523,659]);return true;
  }
  $('findWhirlpool').addEventListener('click',()=>{rally.explore({position:new THREE.Vector3(w.x,w.y,w.z-24),direction:new THREE.Vector3(0,0,1),message:'Swim into the swirling water for a sky ride.'});state.cooldown=0;});
  $('leaveSkyRide').addEventListener('click',()=>finish('Back in the peaceful ocean.'));
  scene.addEventListener('rallystart',()=>{if(state.active)cleanup();});
  scene.addEventListener('explorestart',()=>{if(state.active){cleanup();restorePosition();}});
  function step(dt,input){
    if(rally.state.mode==='paused'||dt<=0)return state.active;
    state.cooldown=Math.max(0,state.cooldown-dt);
    if(!state.active){
      const distance=Math.hypot(duck.position.x-w.x,duck.position.z-w.z);
      if(rally.state.mode==='explore'&&distance<20&&!nearNotice){nearNotice=true;rally.announce('This whirlpool leads to the stars. Swim into its center.',4);}
      if(distance>30)nearNotice=false;
      if(rally.state.mode==='explore'&&distance<7&&duck.position.y>-48&&duck.position.y<-6&&input.thrust>.1)begin();
      if(!state.active)return false;
    }
    state.time=Math.min(FLIGHT_DURATION,state.time+dt);const p=sampleFlight(state.time,state.entry,reduced);state.pose=p;
    const oldY=duck.position.y;duck.position.set(p.x,p.y,p.z);swim.vel.set(0,0,0);swim.yawRate=swim.speed=0;
    const shortest=Math.atan2(Math.sin(state.heading-state.entryYaw),Math.cos(state.heading-state.entryYaw));
    // Align in the same direction as the spin, avoiding an initial counter-turn.
    const angle=(shortest+Math.PI*2)%(Math.PI*2);swim.yaw=state.entryYaw+angle*flightEase(state.time/5)+p.spin;
    const endTurn=Math.atan2(Math.sin(-swim.yaw),Math.cos(-swim.yaw));swim.yaw+=endTurn*flightEase((state.time-40)/3);
    if(p.phase!==state.phase){state.phase=p.phase;if(p.phase==='stars'){rally.announce('Hello, stars.',3);rally.chime([659,784,988]);}if(p.phase==='glide')rally.announce('Floating home.',3);}
    if(!state.splash&&oldY>0&&p.y<=0){state.splash=true;splashAt=state.time;ripple.visible=splash.visible=true;rally.chime([523,392]);for(let i=0;i<24;i++)spawnBubble(duck.position,.12+i*.004);}
    if(p.done)finish();return true;
  }
  function update(dt){
    visualTime+=dt;
    // The funnel itself turns; individual foam dots also rise through its spiral.
    whirlpool.rotation.y=visualTime*(reduced?.18:1.1);
    funnelMat.uniforms.time.value=visualTime*(reduced?.2:2.2);
    if(dt>0&&camera.position.distanceToSquared(whirlpool.position)<160*160){const positions=bg.attributes.position.array;for(let i=0;i<96;i++){
      const u=((bubbleSeeds[i*3+1]+53)/53+visualTime*(reduced?.015:.075))%1;
      const angle=Math.atan2(bubbleSeeds[i*3+2],bubbleSeeds[i*3])+u*Math.PI*2,r=3+u*u*7;
      positions[i*3]=Math.cos(angle)*r;positions[i*3+1]=-53+u*53;positions[i*3+2]=Math.sin(angle)*r;
    }bg.attributes.position.needsUpdate=true;}
    const ui=state.active+'|'+rally.state.mode;
    if(ui!==lastUI){lastUI=ui;$('findWhirlpool').hidden=state.active;$('leaveSkyRide').hidden=!state.active;document.body.classList.toggle('sky-riding',state.active);}
    if(!state.active)return;
    const p=state.pose;
    const desiredFar=THREE.MathUtils.lerp(normalFar,5000,flightEase(Math.max(0,p.y)/300));
    if(Math.abs(camera.far-desiredFar)>.1){camera.far=desiredFar;camera.updateProjectionMatrix();}
    journey.position.copy(duck.position);journey.rotation.y=state.heading;
    // A separate passing rocket crosses behind Zeeb. He never boards it.
    rocket.visible=p.rocket>.002;rocket.scale.setScalar(Math.max(.001,p.rocket*.6));
    rocket.position.set(THREE.MathUtils.lerp(-14,14,p.rocketPass),4+Math.sin(p.rocketPass*Math.PI)*1.5,-7);
    rocket.rotation.set(0,.2,-.65);rocket.userData.flame.scale.y=reduced?1:1+Math.sin(visualTime*8)*.06;
    chute.visible=p.canopy>.002;chute.scale.setScalar(Math.max(.001,p.canopy));chute.rotation.z=reduced?0:Math.sin(state.time*.65)*.055*p.canopy;
    sky.visible=p.y>1;stars.material.opacity=p.space;stars.visible=p.space>.005;sun.visible=p.space<.98;
    if(state.splash){const a=state.time-splashAt;ripple.scale.setScalar(1+a*5);rippleMat.opacity=Math.max(0,.7-a*.22);
      splash.material.opacity=Math.max(0,1-a*.7);for(let i=0;i<36;i++){const angle=i*Math.PI*2/36,r=1+a*(2+i%4*.45);splashPositions[i*3]=SKY_LANDING.x+Math.cos(angle)*r;splashPositions[i*3+1]=Math.max(-.2,.2+a*(3+i%3)-4*a*a);splashPositions[i*3+2]=SKY_LANDING.z+Math.sin(angle)*r;}splashGeo.attributes.position.needsUpdate=true;}
  }
  function applyEnvironment(hemi,sunLight){if(!state.active||state.pose.y<=0)return;const y=state.pose.y;
    scene.background.copy(aqua).lerp(peach,flightEase(y/160)).lerp(dusk,flightEase((y-120)/270)).lerp(space,state.pose.space);scene.fog.color.copy(scene.background);scene.fog.density=.0035*(1-flightEase(y/90));
    hemi.intensity=.8+state.pose.space*.4;sunLight.intensity=3.1-state.pose.space*.9;
  }
  function frame(portrait){
    const t=state.time,p=state.pose,begin=flightEase(t/5),end=flightEase((t-40)/3);
    const parachuteFrame=flightEase((t-18.4)/1.2);
    const closeDistance=portrait?12:10;
    const distance=THREE.MathUtils.lerp(7.8,THREE.MathUtils.lerp(closeDistance,portrait?21:17,parachuteFrame),begin);
    const homeAngle=Math.atan2(Math.sin(Math.PI-state.heading),Math.cos(Math.PI-state.heading));
    const a=state.heading+homeAngle*end,radius=THREE.MathUtils.lerp(distance,7.8,end);eye.copy(duck.position).add(temp.set(Math.sin(a)*radius,THREE.MathUtils.lerp(2.6,THREE.MathUtils.lerp(1.8,4.3,parachuteFrame),begin*(1-end)),Math.cos(a)*radius));look.copy(duck.position).add(temp.set(0,THREE.MathUtils.lerp(.5,THREE.MathUtils.lerp(.6,2.4,parachuteFrame),begin),0));
    // Finish on the normal chase side; the swimmer will face away again after landing.
    if(end>0){temp.copy(duck.position);temp.y+=.5;temp.z+=2.2;look.lerp(temp,end);}
    return {eye,look,fov:portrait?58:54};
  }
  function afterCamera(){if(state.active)stars.position.copy(camera.position);}
  return {state,whirlpool,journey,rocket,chute,sky,stars,begin,finish,step,update,applyEnvironment,frame,afterCamera};
}
