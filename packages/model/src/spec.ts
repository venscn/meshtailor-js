/** Architecture constants transcribed from MeshTailor v2 Appendix B.3 / Sec. 4.1. */
export const MESH_TAILOR_V2_SPEC = {
  inputVertexFeatures: ['x','y','z','nx','ny','nz'],
  pointFeatureDimension: 384,
  graphSageWidths: [64,128,256,512],
  modelDimension: 512,
  crossAttentionLayers: 2,
  decoderLayers: 6,
  positionalEncoding: 'RoPE + chain-local learned embedding',
  candidates: ['[EOC]','[EOS]','vertices(+2 offset)'],
  inferenceTemperature: 0.1,
  maxSequenceLength: 400,
  surfaceSamples: 2048,
  optimizer: 'AdamW',
  learningRate: 1e-4,
  epochs: 30,
  batchSize: 64,
  shapeEncoder: 'pretrained point-cloud encoder (frozen by default)'
} as const;
