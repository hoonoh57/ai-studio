/* ─── src/shaders/overlay.wgsl ─── */
/* 오버레이 렌더링 — 안전구역, 가이드, 그리드, Transform 핸들 */

/* ════ Uniforms ════ */

struct OverlayUniforms {
  color: vec4f,
  viewport: vec2f,    /* 캔버스 크기 (px) */
  lineWidth: f32,
  dashLength: f32,    /* 0 = 실선, >0 = 점선 간격 */
};

@group(0) @binding(0) var<uniform> u: OverlayUniforms;

/* ════ Vertex ════ */

struct LineVertex {
  @location(0) position: vec2f,   /* NDC 좌표 (-1~1) */
  @location(1) lineParam: f32,    /* 선 위의 거리 (점선 계산용) */
};

struct LineOutput {
  @builtin(position) position: vec4f,
  @location(0) lineParam: f32,
};

@vertex
fn vertexMain(input: LineVertex) -> LineOutput {
  var output: LineOutput;
  output.position = vec4f(input.position, 0.0, 1.0);
  output.lineParam = input.lineParam;
  return output;
}

/* ════ Fragment ════ */

@fragment
fn fragmentMain(input: LineOutput) -> @location(0) vec4f {
  /* 점선 처리 */
  if (u.dashLength > 0.0) {
    let pattern = input.lineParam % (u.dashLength * 2.0);
    if (pattern > u.dashLength) {
      discard;
    }
  }
  return u.color;
}