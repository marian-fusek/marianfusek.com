const CONFIG = {
  // Replace with the live App Store URL after approval.
  appStoreURL: ""
};

document.querySelectorAll('[data-app-store]').forEach(link => {
  if (CONFIG.appStoreURL) {
    link.href = CONFIG.appStoreURL;
    link.target = '_blank';
    link.rel = 'noopener';
  } else {
    link.addEventListener('click', event => {
      if (link.getAttribute('href') === '#download') return;
      event.preventDefault();
    });
  }
});

document.getElementById('year').textContent = new Date().getFullYear();

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hero = document.querySelector('.hero');
const stage = document.querySelector('[data-void-stage]');
const items = [...document.querySelectorAll('.gravity-item')];
const randomAngle = () => Math.random() * Math.PI * 2;

const states = items.map((el, index) => ({
  el,
  angle: randomAngle(),
  radiusFactor: Number(el.dataset.radius || .85),
  speed: Number(el.dataset.speed || .2),
  drift: 0.03 + (index % 4) * 0.007,
  phase: Math.random() * Math.PI * 2,
  cycle: null
}));

function placeGravityItems(time = 0) {
  if (!hero || !stage) return;
  const rect = hero.getBoundingClientRect();
  const base = Math.min(rect.width, rect.height) * 0.46;
  const t = time * 0.001;

  states.forEach(state => {
    const travel = t * state.speed + state.phase;
    const cycleIndex = Math.floor(travel);
    const inward = reduceMotion ? 0 : travel - cycleIndex;
    if (!reduceMotion && cycleIndex !== state.cycle) {
      state.cycle = cycleIndex;
      state.angle = randomAngle();
    }
    const cycle = inward < .92 ? inward / .92 : 1;
    const radius = base * (1.38 - cycle * .63) * state.radiusFactor;
    const wobble = reduceMotion ? 0 : Math.sin(t * .25 + state.phase) * 12;
    const angle = state.angle + (reduceMotion ? 0 : t * state.drift);
    // The items already start at the field's 50% / 50% anchor. Keep these
    // values relative to that anchor so the center is not added twice.
    const x = Math.cos(angle) * (radius + wobble);
    const y = Math.sin(angle) * (radius * .73 + wobble * .5);
    const proximity = Math.min(1, Math.max(0, (1.15 - radius / base)) * 2.4);
    const fadeIn = reduceMotion ? 1 : Math.min(1, inward / .08);
    const fadeOut = inward > .92 ? Math.max(0, 1 - (inward - .92) / .08) : 1;
    const visibility = Math.min(fadeIn, fadeOut);
    const scale = .88 + proximity * .08;
    state.el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%) scale(${scale})`;
    state.el.style.opacity = String((.4 + proximity * .48) * visibility);
    state.el.style.filter = `blur(${Math.max(0, proximity * .4 - .12)}px)`;
  });

  if (!reduceMotion) requestAnimationFrame(placeGravityItems);
}
placeGravityItems();
window.addEventListener('resize', () => reduceMotion && placeGravityItems());

function setupVoidOrb(canvas) {
  const orbStage = canvas.closest('[data-void-stage], .final-cta');
  if (!canvas || !orbStage) return;

  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false
  });

  if (!gl) {
    orbStage.classList.add('void-orb-fallback');
    return;
  }

  const vertexSource = `
    attribute vec2 position;
    varying vec2 vUv;
    void main() {
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;

    uniform float iTime;
    uniform vec3 iResolution;
    uniform float hue;
    uniform float hover;
    uniform float rot;
    uniform float hoverIntensity;
    uniform vec3 backgroundColor;
    varying vec2 vUv;

    vec3 rgb2yiq(vec3 c) {
      float y = dot(c, vec3(0.299, 0.587, 0.114));
      float i = dot(c, vec3(0.596, -0.274, -0.322));
      float q = dot(c, vec3(0.211, -0.523, 0.312));
      return vec3(y, i, q);
    }

    vec3 yiq2rgb(vec3 c) {
      float r = c.x + 0.956 * c.y + 0.621 * c.z;
      float g = c.x - 0.272 * c.y - 0.647 * c.z;
      float b = c.x - 1.106 * c.y + 1.703 * c.z;
      return vec3(r, g, b);
    }

    vec3 adjustHue(vec3 color, float hueDeg) {
      float hueRad = hueDeg * 3.14159265 / 180.0;
      vec3 yiq = rgb2yiq(color);
      float cosA = cos(hueRad);
      float sinA = sin(hueRad);
      float i = yiq.y * cosA - yiq.z * sinA;
      float q = yiq.y * sinA + yiq.z * cosA;
      yiq.y = i;
      yiq.z = q;
      return yiq2rgb(yiq);
    }

    vec3 hash33(vec3 p3) {
      p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
      p3 += dot(p3, p3.yxz + 19.19);
      return -1.0 + 2.0 * fract(vec3(
        p3.x + p3.y,
        p3.x + p3.z,
        p3.y + p3.z
      ) * p3.zyx);
    }

    float snoise3(vec3 p) {
      const float K1 = 0.333333333;
      const float K2 = 0.166666667;
      vec3 i = floor(p + (p.x + p.y + p.z) * K1);
      vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
      vec3 e = step(vec3(0.0), d0 - d0.yzx);
      vec3 i1 = e * (1.0 - e.zxy);
      vec3 i2 = 1.0 - e.zxy * (1.0 - e);
      vec3 d1 = d0 - (i1 - K2);
      vec3 d2 = d0 - (i2 - K1);
      vec3 d3 = d0 - 0.5;
      vec4 h = max(0.6 - vec4(
        dot(d0, d0),
        dot(d1, d1),
        dot(d2, d2),
        dot(d3, d3)
      ), 0.0);
      vec4 n = h * h * h * h * vec4(
        dot(d0, hash33(i)),
        dot(d1, hash33(i + i1)),
        dot(d2, hash33(i + i2)),
        dot(d3, hash33(i + 1.0))
      );
      return dot(vec4(31.316), n);
    }

    vec4 extractAlpha(vec3 colorIn) {
      float a = max(max(colorIn.r, colorIn.g), colorIn.b);
      return vec4(colorIn.rgb / (a + 1e-5), a);
    }

    const vec3 baseColor1 = vec3(0.611765, 0.262745, 0.996078);
    const vec3 baseColor2 = vec3(0.298039, 0.760784, 0.913725);
    const vec3 baseColor3 = vec3(0.062745, 0.078431, 0.600000);
    const float innerRadius = 0.6;
    const float noiseScale = 0.65;

    float light1(float intensity, float attenuation, float dist) {
      return intensity / (1.0 + dist * attenuation);
    }

    float light2(float intensity, float attenuation, float dist) {
      return intensity / (1.0 + dist * dist * attenuation);
    }

    vec4 draw(vec2 uv) {
      vec3 color1 = adjustHue(baseColor1, hue);
      vec3 color2 = adjustHue(baseColor2, hue);
      vec3 color3 = adjustHue(baseColor3, hue);
      float ang = atan(uv.y, uv.x);
      float len = length(uv);
      float invLen = len > 0.0 ? 1.0 / len : 0.0;
      float bgLuminance = dot(backgroundColor, vec3(0.299, 0.587, 0.114));

      float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
      float r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
      float d0 = distance(uv, (r0 * invLen) * uv);
      float v0 = light1(1.0, 10.0, d0);
      v0 *= smoothstep(r0 * 1.05, r0, len);
      float innerFade = smoothstep(r0 * 0.8, r0 * 0.95, len);
      v0 *= mix(innerFade, 1.0, bgLuminance * 0.7);

      float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;
      float a = iTime * -1.0;
      vec2 pos = vec2(cos(a), sin(a)) * r0;
      float d = distance(uv, pos);
      float v1 = light2(1.5, 5.0, d);
      v1 *= light1(1.0, 50.0, d0);
      float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
      float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);
      vec3 colBase = mix(color1, color2, cl);
      float fadeAmount = mix(1.0, 0.1, bgLuminance);
      vec3 darkCol = mix(color3, colBase, v0);
      darkCol = (darkCol + v1) * v2 * v3;
      darkCol = clamp(darkCol, 0.0, 1.0);
      vec3 lightCol = (colBase + v1) * mix(1.0, v2 * v3, fadeAmount);
      lightCol = mix(backgroundColor, lightCol, v0);
      lightCol = clamp(lightCol, 0.0, 1.0);
      vec3 finalCol = mix(darkCol, lightCol, bgLuminance);
      return extractAlpha(finalCol);
    }

    vec4 mainImage(vec2 fragCoord) {
      vec2 center = iResolution.xy * 0.5;
      float size = min(iResolution.x, iResolution.y);
      vec2 uv = (fragCoord - center) / size * 2.0;
      float angle = rot;
      float s = sin(angle);
      float c = cos(angle);
      uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
      uv.x += hover * hoverIntensity * 0.1 * sin(uv.y * 10.0 + iTime);
      uv.y += hover * hoverIntensity * 0.1 * sin(uv.x * 10.0 + iTime);
      return draw(uv);
    }

    void main() {
      vec2 fragCoord = vUv * iResolution.xy;
      vec4 col = mainImage(fragCoord);
      gl_FragColor = vec4(col.rgb * col.a, col.a);
    }
  `;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('A‑Void orb shader error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertexShader = compile(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) {
    orbStage.classList.add('void-orb-fallback');
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('A‑Void orb program error:', gl.getProgramInfoLog(program));
    orbStage.classList.add('void-orb-fallback');
    return;
  }

  const positionLocation = gl.getAttribLocation(program, 'position');
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
    3, -1,
    -1, 3
  ]), gl.STATIC_DRAW);

  const uniforms = {
    time: gl.getUniformLocation(program, 'iTime'),
    resolution: gl.getUniformLocation(program, 'iResolution'),
    hue: gl.getUniformLocation(program, 'hue'),
    hover: gl.getUniformLocation(program, 'hover'),
    rot: gl.getUniformLocation(program, 'rot'),
    hoverIntensity: gl.getUniformLocation(program, 'hoverIntensity'),
    backgroundColor: gl.getUniformLocation(program, 'backgroundColor')
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  };

  const render = time => {
    resize();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(uniforms.time, reduceMotion ? 0 : time * 0.001);
    gl.uniform3f(uniforms.resolution, canvas.width, canvas.height, canvas.width / canvas.height);
    gl.uniform1f(uniforms.hue, 0);
    gl.uniform1f(uniforms.hover, 0);
    gl.uniform1f(uniforms.rot, 0);
    gl.uniform1f(uniforms.hoverIntensity, 0);
    gl.uniform3f(uniforms.backgroundColor, 0, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduceMotion) requestAnimationFrame(render);
  };

  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(canvas);
  window.addEventListener('resize', resize);
  render(0);
}

document.querySelectorAll('[data-void-orb]').forEach(setupVoidOrb);

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

if (!reduceMotion) {
  window.addEventListener('scroll', () => {
    const heroRect = hero.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, -heroRect.top / heroRect.height));
    const scale = 1 + progress * .22;
    const fade = 1 - progress * .56;
    stage.style.transform = `scale(${scale})`;
    stage.style.opacity = String(fade);
  }, { passive: true });
}
