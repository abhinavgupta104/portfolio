// The molten colour field behind the hero name: one full-screen fragment
// shader (domain-warped noise). Drawn small and scaled up — it is a soft field,
// so a low-resolution buffer costs nothing in quality and keeps laptops cool.
const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uT; uniform vec2 uMouse; uniform float uKick;
uniform float uPaintA; uniform float uPaintB; uniform float uSplit;
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<5;i++){ v+=a*noise(p); p=m*p; a*=.5; } return v; }
vec3 pal(float t){
  vec3 a=vec3(1.,.70,.10), b=vec3(1.,.25,.56), c=vec3(.18,.33,1.), d=vec3(.56,.36,1.);
  t=fract(t)*4.;
  if(t<1.) return mix(a,b,smoothstep(0.,1.,t));
  if(t<2.) return mix(b,c,smoothstep(0.,1.,t-1.));
  if(t<3.) return mix(c,d,smoothstep(0.,1.,t-2.));
  return mix(d,a,smoothstep(0.,1.,t-3.));
}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec2 m=(uMouse-.5)*vec2(uRes.x/uRes.y,1.);
  float t=uT*.07;
  vec2 q=vec2(fbm(p*1.15+vec2(0.,t)), fbm(p*1.15+vec2(5.2,-t)));
  vec2 r=vec2(fbm(p*1.5+3.*q+vec2(1.7,9.2)+t*1.4), fbm(p*1.5+3.*q+vec2(8.3,2.8)-t));
  float d=length(p-m);
  r+=(.5+uKick)*exp(-d*d*5.)*vec2(cos(uT*.9),sin(uT*.9));
  float f=fbm(p*1.25+3.3*r);
  vec3 col=pal(f*1.25+q.x*.45+t*.5);
  col=mix(col,vec3(1.,.97,.9),pow(smoothstep(.56,1.,f),3.)*.6);
  col*=.78+.5*r.y;
  col+=uKick*.35;
  // "Unpainted" letters: during the opening the field is plain paper until a
  // cursor rolls colour across it — the top line left to right, the bottom
  // line back again, each with a bright wet edge where the paint is arriving.
  float px=gl_FragCoord.x/uRes.x;
  float py=gl_FragCoord.y/uRes.y;
  float bareA=smoothstep(uPaintA-.07,uPaintA,px);
  float bareB=1.-smoothstep(uPaintB,uPaintB+.07,px);
  float bare=mix(bareB,bareA,smoothstep(uSplit-.02,uSplit+.02,py));
  col=mix(col,vec3(.953,.937,.902),bare);
  col+=vec3(1.,.85,.5)*bare*(1.-bare)*1.6;
  gl_FragColor=vec4(col,1.);
}`;

const NOOP = { start() {}, stop() {}, kick() {}, paint() {}, split() {} };

export function initFlow(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return NOOP;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return NOOP;
  gl.useProgram(prog);

  // One oversized triangle covers the screen: cheaper than two.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = {
    res: gl.getUniformLocation(prog, 'uRes'),
    t: gl.getUniformLocation(prog, 'uT'),
    mouse: gl.getUniformLocation(prog, 'uMouse'),
    kick: gl.getUniformLocation(prog, 'uKick'),
    paintA: gl.getUniformLocation(prog, 'uPaintA'),
    paintB: gl.getUniformLocation(prog, 'uPaintB'),
    split: gl.getUniformLocation(prog, 'uSplit'),
  };
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  // how much of each line is painted, 0 (bare paper) to 1 (full colour)
  const paint = { a: 1, b: 1, split: 0.5 };
  let kick = 0;
  let raf = 0;
  let running = false;
  const t0 = performance.now();

  function resize() {
    const scale = 0.4; // of CSS pixels
    const w = Math.max(2, Math.round(canvas.clientWidth * scale));
    const hgt = Math.max(2, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== hgt) {
      canvas.width = w;
      canvas.height = hgt;
      gl.viewport(0, 0, w, hgt);
    }
  }

  function frame() {
    if (!running) return;
    resize();
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;
    kick *= 0.94;
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform1f(u.t, (performance.now() - t0) / 1000);
    gl.uniform2f(u.mouse, mouse.x, 1 - mouse.y);
    gl.uniform1f(u.kick, kick);
    gl.uniform1f(u.paintA, -0.02 + paint.a * 1.1);
    gl.uniform1f(u.paintB, 1.02 - paint.b * 1.1);
    gl.uniform1f(u.split, paint.split);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener('pointermove', (e) => {
    mouse.tx = e.clientX / innerWidth;
    mouse.ty = e.clientY / innerHeight;
  }, { passive: true });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); running = false; });

  return {
    start() { if (running) return; running = true; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    kick(v = 1) { kick = v; },
    /** Paint progress for the top and bottom line of the name, each 0 to 1. */
    paint(a, b = a) { paint.a = Math.min(1, Math.max(0, a)); paint.b = Math.min(1, Math.max(0, b)); },
    /** Where the two lines meet, as a fraction of the height measured from the bottom. */
    split(v) { paint.split = v; },
  };
}
