import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { MeshData } from '@meshtailor/mesh-core';
import type { GenerationFrame } from '@meshtailor/runtime';
import { fitDistance, prepareViewportMesh, viewportSize, type ViewportMesh } from './viewport-math';

/** Dispose every geometry/material in a subtree, including traversal overlays. */
function disposeGroup(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    const drawable = object as THREE.Mesh;
    if (drawable.geometry) geometries.add(drawable.geometry);
    if (drawable.material) {
      for (const material of Array.isArray(drawable.material) ? drawable.material : [drawable.material]) materials.add(material);
    }
  });
  group.clear();
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

/** One controller / WebGL context per mounted viewport, NOT per decode step. */
export class ViewportScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, .001, 1000);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly meshGroup = new THREE.Group();
  private readonly overlays = new THREE.Group();
  private readonly observer: ResizeObserver;
  private viewMesh: ViewportMesh | null = null;
  private material: THREE.MeshStandardMaterial | null = null;
  private animation = 0;
  private disposed = false;
  private contextLost = false;
  private visible = true;
  private width = 0;
  private height = 0;
  private dpr = 0;

  constructor(private readonly host: HTMLDivElement, private readonly report: (error: string | null) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    const canvas = this.renderer.domElement;
    // The CSS pixels and GPU drawing-buffer pixels MUST remain independent.
    // Also set inline styles so a missing stylesheet cannot restart the feedback loop.
    Object.assign(canvas.style, { position: 'absolute', inset: '0', display: 'block', width: '100%', height: '100%' });
    canvas.setAttribute('aria-label', '3D mesh traversal canvas');
    canvas.dataset.testid = 'mesh-canvas';
    this.host.appendChild(canvas);
    this.scene.background = new THREE.Color(0x0b0d12);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.addEventListener('change', this.recordCamera);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x202431, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 2.2);
    light.position.set(3, 5, 4);
    this.scene.add(light, this.meshGroup, this.overlays);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.report(null);
    this.animation = requestAnimationFrame(this.tick);
  }

  setMesh(mesh: MeshData): void {
    disposeGroup(this.meshGroup);
    disposeGroup(this.overlays);
    this.viewMesh = null;
    this.material = null;
    const view = prepareViewportMesh(mesh);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(view.triangles, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    this.material = new THREE.MeshStandardMaterial({
      color: 0x8590a8, roughness: .78, metalness: .02, side: THREE.DoubleSide,
      // Keep surface edges from fighting with filled triangles in surface-only mode.
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    this.meshGroup.add(new THREE.Mesh(geometry, this.material));
    this.viewMesh = view;
    this.controls.minDistance = view.radius * .15;
    this.controls.maxDistance = view.radius * 80;
    this.fitCamera();
  }

  setWireframe(wireframe: boolean): void {
    if (this.material) this.material.wireframe = wireframe;
  }

  updateTraversal(seams: Set<string>, frame: GenerationFrame | undefined, xray: boolean): void {
    disposeGroup(this.overlays);
    const view = this.viewMesh;
    if (!view) return;
    const positions: number[] = [];
    for (const edge of seams) {
      const parts = edge.split(':');
      if (parts.length !== 2) continue;
      const a = Number(parts[0]), b = Number(parts[1]);
      if (Number.isInteger(a) && Number.isInteger(b) && view.positions[a] && view.positions[b]) {
        positions.push(...view.positions[a]!, ...view.positions[b]!);
      }
    }
    if (positions.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
        color: 0xff5d73, depthTest: !xray, depthWrite: false, toneMapped: false,
      }));
      lines.renderOrder = 10;
      this.overlays.add(lines);
    }
    if (frame) {
      // frame.mask is the candidate set used to CHOOSE this frame's token,
      // not a freshly calculated mask after arriving at currentVertex.
      const candidates: number[] = [];
      for (const vi of frame.mask.vertices) {
        if (view.positions[vi]) candidates.push(...view.positions[vi]!);
      }
      if (candidates.length) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(candidates, 3));
        const points = new THREE.Points(geometry, new THREE.PointsMaterial({
          color: 0xffcf66, size: 7, sizeAttenuation: false, depthTest: !xray, depthWrite: false, toneMapped: false,
        }));
        points.renderOrder = 20;
        this.overlays.add(points);
      }
      this.addMarker(frame.previousVertex, 0x52a8ff, view.radius * .019, xray, 30);
      this.addMarker(frame.currentVertex, 0x64e6a7, view.radius * .027, xray, 31);
      if (frame.token >= 0 && frame.previousVertex !== null && frame.currentVertex !== null) {
        const from = view.positions[frame.previousVertex], to = view.positions[frame.currentVertex];
        if (from && to) {
          const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
          const direction = end.clone().sub(start), length = direction.length();
          if (length > 1e-9) {
            const arrow = new THREE.ArrowHelper(direction.normalize(), start, length, 0x64e6a7,
              Math.min(length * .3, view.radius * .10), Math.min(length * .16, view.radius * .055));
            // ArrowHelper shares its geometries across instances in Three.js.
            // Clone them so subtree disposal doesn't invalidate other arrows.
            arrow.line.geometry = arrow.line.geometry.clone();
            arrow.cone.geometry = arrow.cone.geometry.clone();
            arrow.traverse((object) => {
              object.renderOrder = 25;
              const material = (object as THREE.Mesh).material;
              for (const m of material ? (Array.isArray(material) ? material : [material]) : []) {
                m.depthTest = !xray; m.depthWrite = false; m.toneMapped = false;
              }
            });
            this.overlays.add(arrow);
          }
        }
      }
    }
    const canvas = this.renderer.domElement;
    canvas.dataset.step = String(frame?.step ?? -1);
    canvas.dataset.seamCount = String(positions.length / 6);
    canvas.dataset.candidateCount = String(frame?.mask.vertices.length ?? 0);
  }

  private addMarker(vertex: number | null, color: number, radius: number, xray: boolean, order: number): void {
    if (vertex === null || !this.viewMesh?.positions[vertex]) return;
    const marker = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), new THREE.MeshBasicMaterial({
      color, depthTest: !xray, depthWrite: false, toneMapped: false,
    }));
    marker.position.set(...this.viewMesh.positions[vertex]!);
    marker.renderOrder = order;
    this.overlays.add(marker);
  }

  fitCamera(): void {
    if (!this.viewMesh) return;
    const { radius } = this.viewMesh;
    const distance = fitDistance(radius, this.camera.fov, this.camera.aspect);
    // Flush pending damping deltas before placing a new camera.
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.reset();
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(.75, .5, .85).normalize().multiplyScalar(distance);
    this.camera.near = radius / 1000;
    this.camera.far = Math.max(radius * 200, distance * 4);
    this.camera.updateProjectionMatrix();
    this.controls.maxDistance = Math.max(radius * 80, distance * 2);
    this.controls.update();
    this.controls.enableDamping = damping;
    this.controls.saveState();
    this.recordCamera();
  }

  private readonly recordCamera = (): void => {
    this.renderer.domElement.dataset.cameraPosition = this.camera.position.toArray().map((x) => x.toFixed(6)).join(',');
    this.renderer.domElement.dataset.cameraTarget = this.controls.target.toArray().map((x) => x.toFixed(6)).join(',');
  };

  private readonly resize = (): void => {
    if (this.disposed) return;
    const size = viewportSize(this.host.clientWidth, this.host.clientHeight, window.devicePixelRatio);
    this.visible = size.visible;
    if (!size.visible) return;
    if (this.width === size.width && this.height === size.height && this.dpr === size.dpr) return;
    this.width = size.width; this.height = size.height; this.dpr = size.dpr;
    if (this.renderer.getPixelRatio() !== size.dpr) this.renderer.setPixelRatio(size.dpr);
    this.renderer.setSize(size.width, size.height, false);
    this.camera.aspect = size.width / size.height;
    this.camera.updateProjectionMatrix();
  };

  private readonly tick = (): void => {
    if (this.disposed) return;
    // Also handles moving a window between monitors without a CSS-size change.
    if (this.dpr !== Math.min(window.devicePixelRatio || 1, 2)) this.resize();
    if (!this.contextLost && this.visible) {
      this.controls.update();
      try {
        this.renderer.render(this.scene, this.camera);
        this.renderer.domElement.dataset.drawCalls = String(this.renderer.info.render.calls);
      } catch (error) {
        this.report(`3D rendering failed: ${error instanceof Error ? error.message : String(error)}`);
        return; // Retry in the error panel constructs a fresh, bounded controller.
      }
    }
    this.animation = requestAnimationFrame(this.tick);
  };

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.report('WebGL context lost. Waiting for browser recovery; use Retry 3D if it does not recover.');
  };

  private readonly onContextRestored = (): void => {
    this.contextLost = false;
    this.report(null);
    // Force a size synchronization even when the logical viewport is unchanged.
    this.width = 0;
    this.resize();
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animation);
    this.observer.disconnect();
    window.removeEventListener('resize', this.resize);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.onContextLost);
    canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.controls.removeEventListener('change', this.recordCamera);
    this.controls.dispose();
    disposeGroup(this.meshGroup);
    disposeGroup(this.overlays);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
    this.viewMesh = null;
    this.material = null;
  }
}
