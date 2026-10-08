[**English**](README.md) | [简体中文](README.zh-CN.md)

# Pinned real-model regression fixtures

These files are byte-for-byte fixtures from the confirmed `meshtailor-test-models(1).zip` archive. They are not the older archive without `(1)` or new online downloads. They contain glTF and geometry/UV buffers, without textures.

Archive SHA256: `284decae81fda986f3c291bf4bebee473221b4eabe7078c65ed44adaf9ffb563`.

`scripts/lib/verified-model-fixtures.mjs` verifies all four file hashes. Tests do not fall back to different files or substitute same-name assets. Their upstream origin is the Khronos glTF sample Corset / FlightHelmet collection; model assets retain CC0-1.0 rather than becoming project MIT assets. See [asset provenance](../../THIRD_PARTY_ASSETS.md).

For the current geometry-only generator, run:

```bash
npm run test:geometry:real
```

This uses both models with original, absent, and randomized UVs, comparing actual seams and face-corner coordinates.

The exact fixture decoder supports only these four static, uncompressed layouts and then uses production topology assembly. It does not replace Studio's general GLTFLoader. A general textured renderer would need the omitted textures; these fixtures and audits do not certify textured rendering. Original UVs are varied by QA for isolation checks, not passed as generator hints.
