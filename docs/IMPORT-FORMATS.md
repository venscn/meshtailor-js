[**English**](IMPORT-FORMATS.md) | [简体中文](IMPORT-FORMATS.zh-CN.md)

# Import formats and geometry reconstruction

Since v0.4.20, production import ignores original UVs and generation uses geometry only.

| Entry point | Input formats | Companion files |
| --- | --- | --- |
| Studio | OBJ, ASCII / Binary FBX, GLB, glTF | Select matching `.bin` files with glTF |
| Offline workbench | OBJ and built-in geometry | MTL / textures are not loaded |
| CLI | OBJ | MTL / textures are not loaded |

Choose one main model per import. A glTF file and its geometry buffers can be selected together. Materials and textures are not displayed; Draco / Meshopt decoders are not configured. Prefer uncompressed GLB or FBX 7.4 / 7.5 Binary.

## Parsers

OBJ uses the project parser, followed by whitelist construction of geometry-only data. FBX uses Three.js FBXLoader; GLB / glTF use Three.js GLTFLoader. The glTF decode path removes materials, textures, and original UV attributes before decoding.

The official FBXLoader scope is ASCII 7.0+ / Binary 6400+. This does not mean every exporter combination has been tested here. See [Three.js documentation](https://threejs.org/docs/pages/FBXLoader.html).

## Geometry and connectivity

The scene adapter extracts visible meshes with world/instance transforms and samples skinning and morph geometry at the loaded initial pose. Negative scale corrects triangle winding. Imported animation is not played, and the scene hierarchy is not retained as an editable structure.

Welding is scoped to a source object/instance; overlapping objects are not merged. Boundary welding is the default, with exact, tolerance, and off modes also available. Coordinate welding can connect intentionally coincident surfaces, so choose an appropriate policy. Degenerate faces after welding are dropped and reported; this is not general mesh repair.

The scene adapter never requests UV attributes; its report has `uvFaces: 0`. Material/object identities may remain as geometry metadata, but original UV coordinates, indices, seams, and island assignments do not enter generation.

Default guards limit input to 300,000 triangles, no more than three times that budget in source vertices, and 256 MiB for the main file. These guards do not bound parser memory for every compressed input.

## Resources and cancellation

FBX texture requests use a placeholder so missing local images do not block geometry import. The glTF path removes material/image references before decode. Imported scene resources are disposed after extraction.

FBXLoader parses synchronously on the main thread and cannot yet be interrupted mid-parse. Worker computation and optional downloads support cancellation; operation IDs reject stale results.

## Regression scope

`apps/studio/public/assets/fixtures/garment-ascii.fbx` and `garment-binary.fbx` are project-generated low-density pleated fixtures. Their identities are in the [manifest](../examples/manifest.json). The writer is a regression helper, not a general FBX exporter.

```bash
npm run test:imports
```

The 2026-10-08 maintenance run executed the real Three.js integration suite: both FBX fixtures, world transforms, mirrored winding, object isolation, skin / morph geometry, instances, GLB / glTF companion buffers, and original-UV isolation passed. This is not a guarantee for arbitrary FBX files. See the [maintenance record (Chinese)](OPEN_SOURCE_PREPARATION.md) for the actual scope and environment limits.
