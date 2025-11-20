precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
varying vec2 vTexCoord;

// simple vignette and subtle moving glow to simulate star lighting
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 pos = uv - 0.5;
  pos.x *= u_resolution.x / u_resolution.y;

  // vignette
  float len = length(pos);
  float vignette = smoothstep(0.8, 0.45, len);

  // moving noise-like glow (cheap) to mimic star twinkle
  float t = u_time * 0.5;
  float glow = 0.02 * (0.5 + 0.5 * sin(10.0 * (uv.x + uv.y) + t));

  // radial light centered and some soft spots
  float centerLight = 0.18 * (1.0 - len);

  vec3 color = vec3(centerLight + glow);

  // apply vignette by darkening edges
  color *= (1.0 - vignette * 0.6);

  gl_FragColor = vec4(color, 1.0);
}
