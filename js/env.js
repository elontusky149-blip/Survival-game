// Sky, sun, day/night, weather, ocean surface.
import * as THREE from 'three';
import { G, clamp, lerp, smoothstep, damp, rand, pick, emit } from './util.js';
import { tex } from './textures.js';

export const WAVES = [
  { dx: 0.96, dz: 0.28, len: 71, amp: 0.5 },
  { dx: -0.42, dz: 0.91, len: 43, amp: 0.3 },
  { dx: 0.7, dz: -0.71, len: 23, amp: 0.16 },
  { dx: -0.86, dz: -0.5, len: 11, amp: 0.07 },
];
for (const w of WAVES) { w.k = (Math.PI * 2) / w.len; w.om = Math.sqrt(9.8 * w.k) * 0.8; }

export function waveHeight(x, z) {
  const e = G.env; let h = 0;
  for (const w of WAVES) h += w.amp * Math.sin(w.k * (w.dx * x + w.dz * z) + w.om * e.wtime);
  const w = G.world;
  return h * e.waveScale * (w && w.depth ? clamp(-w.depthAt(x, z) / 5, 0.12, 1) : 1);
}

export const WEATHER = {
  clear: { label: 'Clear', icon: '☀️', cloud: 0.15, rain: 0, fog: 0.00032, wave: 0.7, wind: 3, dark: 0 },
  breezy: { label: 'Strong Wind', icon: '🌬️', cloud: 0.35, rain: 0, fog: 0.00035, wave: 1.15, wind: 10, dark: 0 },
  overcast: { label: 'Overcast', icon: '☁️', cloud: 0.85, rain: 0, fog: 0.0006, wave: 0.9, wind: 5, dark: 0.15 },
  drizzle: { label: 'Light Rain', icon: '🌦️', cloud: 0.9, rain: 0.3, fog: 0.0009, wave: 1.0, wind: 6, dark: 0.2 },
  rain: { label: 'Heavy Rain', icon: '🌧️', cloud: 1, rain: 0.75, fog: 0.0016, wave: 1.4, wind: 9, dark: 0.35 },
  storm: { label: 'Thunderstorm', icon: '⛈️', cloud: 1, rain: 1, fog: 0.002, wave: 2.1, wind: 14, dark: 0.5, lightning: 1 },
  fog: { label: 'Fog', icon: '🌫️', cloud: 0.6, rain: 0, fog: 0.011, wave: 0.5, wind: 1.5, dark: 0.1 },
  tropical: { label: 'Tropical Storm', icon: '🌀', cloud: 1, rain: 1, fog: 0.0026, wave: 2.8, wind: 19, dark: 0.6, lightning: 1.5 },
  hurricane: { label: 'Hurricane', icon: '🌪️', cloud: 1, rain: 1, fog: 0.0034, wave: 3.7, wind: 26, dark: 0.7, lightning: 2.5 },
  swell: { label: 'Great Swell', icon: '🌊', cloud: 0.3, rain: 0, fog: 0.0004, wave: 2.9, wind: 6, dark: 0 },
};

const skyVS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w; }`;
const skyFS = `
precision highp float;
varying vec3 vDir;
uniform vec3 uSun, uMoon, uZenith, uHorizon, uSunCol, uCloudCol, uFog;
uniform float uTime, uCloud, uNight, uFlash, uUnder;
float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+vec2(17.,9.); a*=.5; } return v; }
void main(){
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
  float sd = max(dot(d, uSun), 0.0);
  col += uSunCol * (pow(sd, 900.0)*6.0 + pow(sd, 60.0)*0.35 + pow(sd, 6.0)*0.18) * (1.0-uCloud*0.75);
  // stars + moon
  if(uNight > 0.01){
    vec2 sp = d.xz/(abs(d.y)+0.35)*90.0;
    float s = hash(floor(sp));
    float tw = 0.6+0.4*sin(uTime*2.0 + s*90.0);
    col += vec3(1.0,0.95,0.85) * step(0.9965, s) * tw * uNight * smoothstep(0.0,0.2,d.y) * (1.0-uCloud);
    float md = max(dot(d, uMoon), 0.0);
    col += vec3(0.85,0.9,1.0) * (smoothstep(0.9993,0.9996,md) + pow(md,200.0)*0.25) * uNight * (1.0-uCloud*0.8);
  }
  // clouds
  if(d.y > -0.02){
    vec2 cp = d.xz/(d.y+0.18)*1.6 + vec2(uTime*0.006, uTime*0.003);
    float n = fbm(cp*1.3);
    float cov = smoothstep(1.0-uCloud*0.95-0.12, 1.0-uCloud*0.95+0.28, n+0.28);
    float shade = fbm(cp*3.1+4.0);
    vec3 cc = uCloudCol*(0.72+0.42*shade) + uSunCol*pow(sd,8.0)*0.35*(1.0-uCloud);
    col = mix(col, cc, cov*smoothstep(-0.02,0.12,d.y)*0.94);
  }
  col += vec3(0.75,0.8,1.0)*uFlash;
  if(d.y < 0.0) col = mix(col, uHorizon*0.82, smoothstep(0.0,-0.1,d.y));
  col = mix(col, uFog, uUnder);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const waterVS = `
uniform float uTime, uScale;
uniform vec4 uW[4]; // dx, dz, k, om
uniform float uA[4];
uniform sampler2D uDepth; uniform float uWorld;
varying vec3 vW; varying vec3 vN; varying float vH; varying float vFade; varying float vShal;
void main(){
  vec4 wp = modelMatrix*vec4(position,1.0);
  float dist = length(wp.xz - cameraPosition.xz);
  float fade = 1.0 - smoothstep(260.0, 1100.0, dist);
  float dep = texture2D(uDepth, wp.xz/(uWorld*2.0)+0.5).r*32.0-24.0;
  vShal = clamp(-dep/5.0, 0.12, 1.0);
  float h = 0.0; vec2 g = vec2(0.0);
  for(int i=0;i<4;i++){
    float ph = uW[i].z*(uW[i].x*wp.x + uW[i].y*wp.z) + uW[i].w*uTime;
    float a = uA[i]*uScale*fade*vShal;
    h += a*sin(ph);
    g += a*uW[i].z*cos(ph)*uW[i].xy;
  }
  wp.y += h;
  vH = h; vFade = fade;
  vN = normalize(vec3(-g.x, 1.0, -g.y));
  vW = wp.xyz;
  gl_Position = projectionMatrix*viewMatrix*wp;
}`;
const waterFS = `
precision highp float;
uniform sampler2D uNoise;
uniform vec3 uSun, uSunCol, uZenith, uHorizon, uDeep, uShallow, uFogCol;
uniform float uTime, uScale, uFogDen, uLight, uFlash, uRain, uWorld;
uniform sampler2D uDepth;
varying vec3 vW; varying vec3 vN; varying float vH; varying float vFade; varying float vShal;
void main(){
  vec3 Vv = cameraPosition - vW; float dist = length(Vv); Vv /= dist;
  vec2 uv = vW.xz;
  vec2 n1 = texture2D(uNoise, uv*0.045 + vec2(uTime*0.012, uTime*0.007)).rg;
  float e = 0.012;
  float a0 = texture2D(uNoise, uv*0.045 + vec2(uTime*0.012, uTime*0.007)).r + texture2D(uNoise, uv*0.11 - vec2(uTime*0.02, -uTime*0.013)).r*0.6;
  float ax = texture2D(uNoise, (uv+vec2(e*20.,0.))*0.045 + vec2(uTime*0.012, uTime*0.007)).r + texture2D(uNoise, (uv+vec2(e*20.,0.))*0.11 - vec2(uTime*0.02, -uTime*0.013)).r*0.6;
  float az = texture2D(uNoise, (uv+vec2(0.,e*20.))*0.045 + vec2(uTime*0.012, uTime*0.007)).r + texture2D(uNoise, (uv+vec2(0.,e*20.))*0.11 - vec2(uTime*0.02, -uTime*0.013)).r*0.6;
  float dstr = (0.55 + uScale*0.25 + uRain*0.5) / (1.0 + dist*0.006);
  vec3 N = normalize(vN + vec3(-(ax-a0), 0.0, -(az-a0))*dstr*2.2);
  if(!gl_FrontFacing){
    // seen from below
    float up = max(dot(-N, Vv), 0.0);
    vec3 c = mix(vec3(0.02,0.2,0.3), vec3(0.35,0.75,0.85), pow(up, 3.0)) * (0.25 + uLight*0.9);
    c = mix(c, uFogCol, 1.0 - exp(-dist*dist*uFogDen*uFogDen));
    gl_FragColor = vec4(c, 0.9);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    return;
  }
  float ndv = max(dot(N, Vv), 0.0);
  float fres = 0.03 + 0.8*pow(1.0 - ndv, 4.5);
  vec3 R = reflect(-Vv, N); R.y = abs(R.y);
  vec3 refl = mix(uHorizon, uZenith, pow(R.y, 0.3));
  float crest = clamp(vH/(uScale*0.9+0.001)*0.5+0.5, 0.0, 1.0);
  vec3 body = mix(uDeep, uShallow, crest*crest*0.75 + 0.08) * (0.18 + uLight*0.95);
  // sub-surface glow facing the sun on crests
  body += uShallow*uSunCol*pow(max(dot(Vv, -uSun), 0.0), 4.0)*crest*0.25*uLight;
  // shallows: turquoise water you can see the sand through, and surf along the beach
  float dep = texture2D(uDepth, uv/(uWorld*2.0)+0.5).r*32.0-24.0;
  float shal = smoothstep(-11.0, -0.6, dep);
  body = mix(body, vec3(0.06,0.55,0.56)*(0.2+uLight*0.95), shal*0.85);
  vec3 col = mix(body, refl, fres*(1.0-shal*0.45));
  float sp = pow(max(dot(reflect(-uSun, N), Vv), 0.0), 260.0);
  col += uSunCol*sp*2.6*uLight + uSunCol*pow(max(dot(reflect(-uSun, N), Vv), 0.0), 24.0)*0.12*uLight;
  // foam on crests
  float fn = texture2D(uNoise, uv*0.19 + vec2(uTime*0.03, 0.0)).r;
  float foam = smoothstep(0.62, 0.95, crest + (fn-0.5)*0.7) * smoothstep(0.75, 2.4, uScale) ;
  foam += smoothstep(0.78, 0.9, fn*crest + a0*0.18) * 0.35;
  float band = smoothstep(-2.2, -0.5, dep)*(1.0-smoothstep(0.6, 1.6, dep));
  float surf = band*smoothstep(0.35, 0.9, 0.5+0.5*sin(dep*3.2 + uTime*1.3 + a0*5.0) + (fn-0.5)*0.9 + smoothstep(-0.7,0.2,dep)*0.5);
  foam = foam*vShal + surf*0.9;
  col = mix(col, vec3(0.92,0.96,0.98)*(0.3+uLight*0.8), clamp(foam,0.0,1.0)*max(vFade,band)*0.85);
  col += vec3(0.6,0.65,0.8)*uFlash*0.5;
  float fog = 1.0 - exp(-dist*dist*uFogDen*uFogDen);
  col = mix(col, uFogCol, fog);
  gl_FragColor = vec4(col, mix(0.8 - shal*0.32, 1.0, clamp(fres*2.5*(1.0-shal*0.5) + fog + foam, 0.0, 1.0)));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const C = (r, g, b) => new THREE.Color(r, g, b);
const K = {
  dayZ: C(0.13, 0.36, 0.8), dayH: C(0.6, 0.79, 0.95),
  setZ: C(0.2, 0.26, 0.52), setH: C(1.0, 0.52, 0.22),
  nightZ: C(0.012, 0.022, 0.06), nightH: C(0.04, 0.07, 0.13),
  grayZ: C(0.34, 0.38, 0.43), grayH: C(0.55, 0.58, 0.61),
};

export class Env {
  constructor(scene) {
    G.env = this;
    this.scene = scene;
    this.time = 7.5; this.day = 1; this.dayLen = 22 * 60; // seconds per game day
    this.wtime = 0;
    this.weather = 'clear'; this.weatherT = 240; this.forced = null;
    this.cloud = 0.15; this.rain = 0; this.fogDen = 0.0003; this.waveScale = 0.7; this.windSpeed = 3; this.dark = 0;
    this.windDir = 0.6; this.windDirTarget = 0.6;
    this.flash = 0; this.nextBolt = 8; this.light = 1; this.night = 0;
    this.sunDir = new THREE.Vector3(0, 1, 0); this.moonDir = new THREE.Vector3(0, -1, 0);
    this.zenith = new THREE.Color(); this.horizon = new THREE.Color(); this.sunCol = new THREE.Color(); this.fogCol = new THREE.Color();
    this.underwater = false; this.tempAmbient = 24;

    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6b5a40, 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun, this.sun.target);
    scene.fog = new THREE.FogExp2(0x9ec4e0, 0.0003);

    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: skyVS, fragmentShader: skyFS, side: THREE.BackSide, depthWrite: false, depthTest: false,
      uniforms: {
        uSun: { value: this.sunDir }, uMoon: { value: this.moonDir }, uZenith: { value: this.zenith }, uHorizon: { value: this.horizon },
        uSunCol: { value: this.sunCol }, uCloudCol: { value: new THREE.Color() }, uTime: { value: 0 }, uCloud: { value: 0.2 },
        uNight: { value: 0 }, uFlash: { value: 0 }, uUnder: { value: 0 }, uFog: { value: this.fogCol },
      },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 20), this.skyMat);
    this.sky.frustumCulled = false; this.sky.renderOrder = -10;
    scene.add(this.sky);

    this.buildWater(G.settings.quality);
    this.buildRain();
    this.bolt = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3)),
      new THREE.LineBasicMaterial({ color: 0xdde6ff, fog: false }));
    this.bolt.visible = false; this.bolt.frustumCulled = false;
    scene.add(this.bolt);
  }

  buildWater(q) {
    if (this.water) { this.scene.remove(this.water); this.water.geometry.dispose(); }
    const seg = q === 'low' ? 110 : q === 'high' ? 230 : 170;
    const g = new THREE.PlaneGeometry(2, 2, seg, seg); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), m = Math.max(Math.abs(x), Math.abs(z)) || 1e-5;
      const r = m * 70 + Math.pow(m, 4) * 7000, s = r / m;
      p.setXYZ(i, x * s, 0, z * s);
    }
    this.waterMat = this.waterMat || new THREE.ShaderMaterial({
      vertexShader: waterVS, fragmentShader: waterFS, transparent: true, side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 }, uScale: { value: 1 }, uNoise: { value: tex('waternoise') },
        uW: { value: WAVES.map((w) => new THREE.Vector4(w.dx, w.dz, w.k, w.om)) }, uA: { value: WAVES.map((w) => w.amp) },
        uSun: { value: this.sunDir }, uSunCol: { value: this.sunCol }, uZenith: { value: this.zenith }, uHorizon: { value: this.horizon },
        uDeep: { value: new THREE.Color(0.005, 0.065, 0.15) }, uShallow: { value: new THREE.Color(0.03, 0.36, 0.44) },
        uDepth: { value: null }, uWorld: { value: 3800 }, uFogCol: { value: this.fogCol }, uFogDen: { value: 0.0003 }, uLight: { value: 1 }, uFlash: { value: 0 }, uRain: { value: 0 },
      },
    });
    this.water = new THREE.Mesh(g, this.waterMat);
    this.water.frustumCulled = false; this.water.renderOrder = 5;
    this.scene.add(this.water);
  }

  buildRain() {
    const n = 2600, pos = new Float32Array(n * 6), seed = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 50, y = Math.random() * 40, z = Math.random() * 50;
      pos.set([x, y, z, x, y, z], i * 6);
      seed[i * 2] = 0; seed[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('tip', new THREE.BufferAttribute(seed, 1));
    this.rainMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2() }, uAlpha: { value: 0 } },
      vertexShader: `uniform float uTime; uniform vec3 uCam; uniform vec2 uWind; attribute float tip; varying float vA;
        void main(){ vec3 p = position; float sp = 26.0 + fract(p.x*7.13)*10.0;
          p.y -= uTime*sp; p.xz += uWind*uTime*1.0;
          p = mod(p - uCam + vec3(25.,20.,25.), vec3(50.,40.,50.)) - vec3(25.,20.,25.) + uCam;
          p.y += tip*0.9; p.xz += uWind*tip*0.035;
          vA = 1.0 - length(p-uCam)/28.0;
          gl_Position = projectionMatrix*viewMatrix*vec4(p,1.0); }`,
      fragmentShader: `uniform float uAlpha; varying float vA; void main(){ gl_FragColor = vec4(0.75,0.82,0.9, clamp(vA,0.,1.)*uAlpha); }`,
    });
    this.rainMesh = new THREE.LineSegments(g, this.rainMat);
    this.rainMesh.frustumCulled = false; this.rainMesh.visible = false; this.rainMesh.renderOrder = 8;
    this.scene.add(this.rainMesh);
  }

  setWeather(type, dur) {
    if (this.weather !== type) emit('weather', type);
    this.weather = type; this.weatherT = dur || rand(150, 330);
    this.windDirTarget = this.windDir + rand(-1.4, 1.4);
  }
  nextWeather() {
    const d = this.day, w = this.weather;
    let opts;
    if (d <= 1) opts = ['clear', 'clear', 'breezy', 'overcast'];
    else if (d <= 3) opts = ['clear', 'clear', 'clear', 'breezy', 'overcast', 'drizzle', 'fog', 'rain'];
    else opts = ['clear', 'clear', 'clear', 'clear', 'breezy', 'breezy', 'overcast', 'overcast', 'drizzle', 'drizzle', 'rain', 'rain', 'fog', 'storm', 'storm', d > 6 ? 'tropical' : 'rain'];
    if (w === 'drizzle') opts.push('rain', 'rain', 'overcast');
    if (w === 'rain') opts.push('storm', 'drizzle', 'drizzle');
    if (['storm', 'tropical', 'hurricane', 'swell'].includes(w)) opts = ['overcast', 'drizzle', 'clear', 'breezy'];
    let n = pick(opts); if (n === w && Math.random() < 0.6) n = pick(opts);
    this.setWeather(n, ['storm', 'tropical'].includes(n) ? rand(110, 200) : undefined);
  }
  get isStorm() { return ['storm', 'tropical', 'hurricane'].includes(this.weather); }
  windVec(out) { return out.set(Math.sin(this.windDir), 0, Math.cos(this.windDir)).multiplyScalar(this.windSpeed); }

  sleepTo(hour) {
    let adv = (hour - this.time + 24) % 24; if (adv < 0.5) adv += 24;
    this.time += adv; if (this.time >= 24) { this.time -= 24; this.day++; emit('newday', this.day); }
    if (this.isStorm || this.weather === 'rain') this.setWeather('overcast', 120);
    return adv;
  }

  update(dt, cam) {
    this.wtime += dt;
    this.time += (dt / this.dayLen) * 24;
    if (this.time >= 24) { this.time -= 24; this.day++; emit('newday', this.day); }
    this.weatherT -= dt;
    if (this.weatherT <= 0) this.nextWeather();
    const W = WEATHER[this.weather], k = 0.22;
    this.cloud = damp(this.cloud, W.cloud, k, dt); this.rain = damp(this.rain, W.rain, k, dt);
    this.fogDen = damp(this.fogDen, W.fog, k, dt); this.waveScale = damp(this.waveScale, W.wave, 0.12, dt);
    this.windSpeed = damp(this.windSpeed, W.wind, k, dt); this.dark = damp(this.dark, W.dark, k, dt);
    this.windDir = damp(this.windDir, this.windDirTarget, 0.05, dt);

    // sun / moon
    const a = ((this.time - 6) / 24) * Math.PI * 2;
    this.sunDir.set(Math.cos(a), Math.sin(a), 0.38).normalize();
    this.moonDir.set(-Math.cos(a), -Math.sin(a) * 0.9 + 0.1, -0.3).normalize();
    const e = this.sunDir.y;
    const dayF = smoothstep(-0.08, 0.3, e), setF = clamp(1 - Math.abs(e - 0.02) / 0.28, 0, 1) * (1 - this.cloud * 0.7), nightF = smoothstep(0.08, -0.22, e);
    this.night = nightF;
    this.zenith.copy(K.nightZ).lerp(K.dayZ, dayF).lerp(K.setZ, setF * 0.6);
    this.horizon.copy(K.nightH).lerp(K.dayH, dayF).lerp(K.setH, setF * 0.85);
    const gray = this.cloud * this.cloud * 0.9, lum = 0.06 + 0.94 * dayF;
    this.zenith.lerp(_c.copy(K.grayZ).multiplyScalar(lum * (1 - this.dark * 0.6)), gray);
    this.horizon.lerp(_c.copy(K.grayH).multiplyScalar(lum * (1 - this.dark * 0.6)), gray);
    this.sunCol.setRGB(1, 0.96, 0.88).lerp(_c.setRGB(1, 0.5, 0.2), setF);
    const sunI = smoothstep(-0.04, 0.2, e) * (1 - this.cloud * 0.72) * (1 - this.dark * 0.5);
    const moonI = nightF * 0.3 * (1 - this.cloud * 0.6);
    this.light = clamp(0.05 + dayF * (1 - this.dark * 0.55) * (1 - this.cloud * 0.25), 0, 1);

    // lightning
    this.flash = Math.max(0, this.flash - dt * 3.2);
    if (W.lightning) {
      this.nextBolt -= dt * W.lightning;
      if (this.nextBolt <= 0) { this.nextBolt = rand(5, 16); this.strike(cam); }
    }
    if (this.boltT > 0) { this.boltT -= dt; if (this.boltT <= 0) this.bolt.visible = false; }

    // underwater look
    const camH = waveHeight(cam.position.x, cam.position.z);
    this.underwater = cam.position.y < camH - 0.05;
    const depth = Math.max(0, -cam.position.y);
    let fogDen = this.fogDen;
    if (this.underwater) {
      const clear = G.player && G.player.hasGear('mask') ? 0.6 : 1;
      fogDen = (0.03 + depth * 0.00025) * clear;
      const dl = this.light * clamp(1 - depth / 110, 0.04, 1);
      this.fogCol.setRGB(0.02 * dl, 0.3 * dl, 0.42 * dl);
    } else {
      this.fogCol.copy(this.horizon).lerp(_c.setRGB(0.6, 0.63, 0.66).multiplyScalar(lum), clamp(this.fogDen * 120, 0, 0.8));
    }
    this.fogCol.r += this.flash * 0.25; this.fogCol.g += this.flash * 0.27; this.fogCol.b += this.flash * 0.32;
    this.scene.fog.color.copy(this.fogCol); this.scene.fog.density = fogDen;

    // lights
    const useSun = sunI > moonI * 0.5;
    const dir = useSun ? this.sunDir : this.moonDir;
    const tgt = G.player ? G.player.pos : cam.position;
    this.sun.target.position.copy(tgt);
    this.sun.position.copy(tgt).addScaledVector(dir, 160);
    this.sun.color.copy(useSun ? this.sunCol : _c.setRGB(0.55, 0.65, 1));
    const uw = this.underwater ? clamp(1 - depth / 90, 0.08, 1) : 1;
    this.sun.intensity = (useSun ? sunI * 2.6 : moonI * 2.6) * uw + this.flash * 2;
    this.hemi.intensity = (0.3 + this.light * 0.7) * uw + this.flash * 1.5;
    this.hemi.color.copy(this.zenith).lerp(_c.setRGB(1, 1, 1), 0.55);
    this.hemi.groundColor.setRGB(0.42, 0.36, 0.28).lerp(this.horizon, 0.4);

    // sky uniforms
    const su = this.skyMat.uniforms;
    su.uTime.value = this.wtime; su.uCloud.value = this.cloud; su.uNight.value = nightF; su.uFlash.value = this.flash;
    su.uUnder.value = this.underwater ? 1 : 0;
    su.uCloudCol.value.setRGB(1, 1, 1).multiplyScalar((0.08 + 0.92 * dayF) * (1 - this.dark * 0.7) * (1 - this.cloud * 0.35)).lerp(K.setH, setF * 0.35);
    this.sky.position.copy(cam.position); this.sky.scale.setScalar(80);

    // water
    const wu = this.waterMat.uniforms;
    if (!wu.uDepth.value && G.world) { wu.uDepth.value = G.world.depthTex; wu.uWorld.value = G.world.dmW; }
    wu.uTime.value = this.wtime; wu.uScale.value = this.waveScale; wu.uFogDen.value = fogDen;
    wu.uLight.value = this.light; wu.uFlash.value = this.flash; wu.uRain.value = this.rain;
    this.water.position.set(cam.position.x, 0, cam.position.z);

    // rain
    this.rainMesh.visible = this.rain > 0.03 && !this.underwater;
    if (this.rainMesh.visible) {
      const ru = this.rainMat.uniforms; ru.uTime.value = this.wtime; ru.uCam.value.copy(cam.position);
      ru.uWind.value.set(Math.sin(this.windDir) * this.windSpeed, Math.cos(this.windDir) * this.windSpeed);
      ru.uAlpha.value = this.rain * 0.55 * (0.4 + this.light * 0.6);
    }
    // ambient temperature (°C): colder north (-z), at night, in rain
    const pz = G.player ? G.player.pos.z : 0;
    this.tempAmbient = 27 - nightF * 7 - this.rain * 5 - this.dark * 3 + clamp(pz / 900, -2, 3) * 1 - smoothstep(-1400, -2600, pz) * 32;
  }

  strike(cam) {
    this.flash = 1;
    const ang = rand(0, 6.28), d = rand(150, 600);
    const bx = cam.position.x + Math.sin(ang) * d, bz = cam.position.z + Math.cos(ang) * d;
    const p = this.bolt.geometry.attributes.position; let x = bx, z = bz;
    for (let i = 0; i < 16; i++) { p.setXYZ(i, x, 320 - i * (320 / 15), z); x += rand(-14, 14); z += rand(-14, 14); }
    p.needsUpdate = true; this.bolt.visible = true; this.boltT = 0.18;
    if (G.audio) G.audio.thunder(d);
    emit('lightning', d);
  }
}
const _c = new THREE.Color();
