/* ─── src/shaders/composite.wgsl ─── */
/* 비디오 텍스처 합성 셰이더 — importExternalTexture 또는 일반 텍스처 지원 */

/* ════ 바인딩 ════ */

/* Group 0: 비디오 외부 텍스처 경로 */
@group(0) @binding(0) var videoSampler: sampler;
@group(0) @binding(1) var videoTexture: texture_external;

/* ════ Vertex ════ */

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) texCoord: vec2f,
};

/* 풀스크린 쿼드 — 3개 정점으로 화면 전체 커버 */
@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f( 3.0, -1.0),
    vec2f(-1.0,  3.0),
  );

  var uv = array<vec2f, 3>(
    vec2f(0.0, 1.0),
    vec2f(2.0, 1.0),
    vec2f(0.0, -1.0),
  );

  var output: VertexOutput;
  output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
  output.texCoord = uv[vertexIndex];
  return output;
}

/* ════ Fragment ════ */

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let color = textureSampleBaseClampToEdge(videoTexture, videoSampler, input.texCoord);
  return color;
}