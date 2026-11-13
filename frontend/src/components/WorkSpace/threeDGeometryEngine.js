import * as THREE from "three";
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from "three-bvh-csg";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

const evaluator = new Evaluator();
evaluator.useGroups = false;

export const DEFAULT_FEATURE_PRESETS = {
  box: (idx = 1) => ({
    id: `feat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: `Boss-Box ${idx}`,
    type: "box",
    operation: "union",
    visible: true,
    color: "#3b82f6",
    params: { width: 60, height: 12, depth: 40 },
    position: { x: 0, y: 6, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  }),
  cylinder: (idx = 1) => ({
    id: `feat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: `Boss-Cylinder ${idx}`,
    type: "cylinder",
    operation: "union",
    visible: true,
    color: "#0ea5e9",
    params: { radiusTop: 12, radiusBottom: 12, height: 24, radialSegments: 36 },
    position: { x: 0, y: 12, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  }),
  hole: (idx = 1) => ({
    id: `feat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: `Cut-Hole ${idx}`,
    type: "cylinder",
    operation: "subtract",
    visible: true,
    color: "#ef4444",
    params: { radiusTop: 6, radiusBottom: 6, height: 30, radialSegments: 32 },
    position: { x: 0, y: 6, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  }),
  cutBox: (idx = 1) => ({
    id: `feat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: `Cut-Pocket ${idx}`,
    type: "box",
    operation: "subtract",
    visible: true,
    color: "#ef4444",
    params: { width: 20, height: 16, depth: 20 },
    position: { x: 0, y: 8, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  }),
  cone: (idx = 1) => ({
    id: `feat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: `Cone-Frustum ${idx}`,
    type: "cone",
    operation: "union",
    visible: true,
    color: "#6366f1",
    params: { radiusTop: 6, radiusBottom: 15, height: 22, radialSegments: 36 },
    position: { x: 0, y: 11, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  }),
  sphere: (idx = 1) => ({
    id: `feat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: `Sphere ${idx}`,
    type: "sphere",
    operation: "union",
    visible: true,
    color: "#8b5cf6",
    params: { radius: 14, widthSegments: 32, heightSegments: 24 },
    position: { x: 0, y: 14, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  }),
  extrude: (idx = 1) => ({
    id: `feat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: `Sketch-Extrude ${idx}`,
    type: "extrude",
    operation: "union",
    visible: true,
    color: "#14b8a6",
    params: {
      depth: 10,
      bevelEnabled: false,
      bevelSize: 1,
      sketchPoints: [
        [-25, -15],
        [25, -15],
        [25, 0],
        [5, 0],
        [5, 20],
        [-25, 20],
      ],
    },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: -90, y: 0, z: 0 },
  }),
};

export const SAMPLE_TEMPLATES = {
  bracket: {
    name: "L-Bracket with Mounting Holes",
    features: [
      {
        id: "tpl_base",
        name: "Base Flange",
        type: "box",
        operation: "union",
        visible: true,
        color: "#3b82f6",
        params: { width: 80, height: 10, depth: 50 },
        position: { x: 0, y: 5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
      },
      {
        id: "tpl_wall",
        name: "Vertical Wall",
        type: "box",
        operation: "union",
        visible: true,
        color: "#3b82f6",
        params: { width: 80, height: 45, depth: 10 },
        position: { x: 0, y: 27.5, z: -20 },
        rotation: { x: 0, y: 0, z: 0 },
      },
      {
        id: "tpl_hole1",
        name: "Mounting Hole Left",
        type: "cylinder",
        operation: "subtract",
        visible: true,
        color: "#ef4444",
        params: { radiusTop: 5, radiusBottom: 5, height: 20, radialSegments: 32 },
        position: { x: -24, y: 5, z: 8 },
        rotation: { x: 0, y: 0, z: 0 },
      },
      {
        id: "tpl_hole2",
        name: "Mounting Hole Right",
        type: "cylinder",
        operation: "subtract",
        visible: true,
        color: "#ef4444",
        params: { radiusTop: 5, radiusBottom: 5, height: 20, radialSegments: 32 },
        position: { x: 24, y: 5, z: 8 },
        rotation: { x: 0, y: 0, z: 0 },
      },
    ],
  },
  flange: {
    name: "Bearing Flange Hub",
    features: [
      {
        id: "fl_disk",
        name: "Flange Plate",
        type: "cylinder",
        operation: "union",
        visible: true,
        color: "#0ea5e9",
        params: { radiusTop: 35, radiusBottom: 35, height: 10, radialSegments: 48 },
        position: { x: 0, y: 5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
      },
      {
        id: "fl_boss",
        name: "Center Hub",
        type: "cylinder",
        operation: "union",
        visible: true,
        color: "#0ea5e9",
        params: { radiusTop: 18, radiusBottom: 18, height: 28, radialSegments: 48 },
        position: { x: 0, y: 14, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
      },
      {
        id: "fl_bore",
        name: "Center Shaft Bore",
        type: "cylinder",
        operation: "subtract",
        visible: true,
        color: "#ef4444",
        params: { radiusTop: 9, radiusBottom: 9, height: 40, radialSegments: 36 },
        position: { x: 0, y: 14, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
      },
    ],
  },
};

export function createFeatureGeometry(feature) {
  const p = feature.params || {};
  switch (feature.type) {
    case "box": {
      return new THREE.BoxGeometry(
        Math.max(0.5, Number(p.width) || 20),
        Math.max(0.5, Number(p.height) || 20),
        Math.max(0.5, Number(p.depth) || 20)
      );
    }
    case "cylinder": {
      const rTop = Math.max(0.2, Number(p.radiusTop ?? p.radius ?? 10));
      const rBot = Math.max(0.2, Number(p.radiusBottom ?? p.radius ?? 10));
      const h = Math.max(0.5, Number(p.height) || 20);
      const segs = Math.max(12, Math.min(96, Number(p.radialSegments) || 36));
      return new THREE.CylinderGeometry(rTop, rBot, h, segs);
    }
    case "cone": {
      const rTop = Math.max(0, Number(p.radiusTop ?? 0));
      const rBot = Math.max(0.5, Number(p.radiusBottom ?? 15));
      const h = Math.max(0.5, Number(p.height) || 20);
      const segs = Math.max(12, Math.min(96, Number(p.radialSegments) || 36));
      return new THREE.CylinderGeometry(rTop, rBot, h, segs);
    }
    case "sphere": {
      const r = Math.max(0.5, Number(p.radius) || 12);
      return new THREE.SphereGeometry(r, 32, 24);
    }
    case "torus": {
      const r = Math.max(1, Number(p.radius) || 16);
      const tube = Math.max(0.4, Number(p.tube) || 4);
      return new THREE.TorusGeometry(r, tube, 20, 48);
    }
    case "extrude": {
      const pts = Array.isArray(p.sketchPoints) && p.sketchPoints.length >= 3
        ? p.sketchPoints
        : [
            [-20, -20],
            [20, -20],
            [20, 20],
            [-20, 20],
          ];
      const shape = new THREE.Shape();
      shape.moveTo(Number(pts[0][0]) || 0, Number(pts[0][1]) || 0);
      for (let i = 1; i < pts.length; i++) {
        shape.lineTo(Number(pts[i][0]) || 0, Number(pts[i][1]) || 0);
      }
      shape.closePath();
      const depth = Math.max(0.5, Number(p.depth) || 10);
      const bevelEnabled = Boolean(p.bevelEnabled);
      const bevelSize = bevelEnabled ? Math.max(0.1, Number(p.bevelSize) || 1) : 0;
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled,
        bevelSegments: bevelEnabled ? 2 : 0,
        steps: 1,
        bevelSize,
        bevelThickness: bevelSize,
      });
      return geo;
    }
    default:
      return new THREE.BoxGeometry(20, 20, 20);
  }
}

export function evaluateFeatureTree(features = []) {
  const active = features.filter((f) => f && f.visible !== false);
  if (active.length === 0) {
    return {
      geometry: null,
      metrics: {
        volumeMm3: 0,
        surfaceAreaMm2: 0,
        boundingBoxMm: { x: 0, y: 0, z: 0 },
        centerOfMass: { x: 0, y: 0, z: 0 },
        triangleCount: 0,
        featureCount: 0,
        isWatertight: false,
      },
    };
  }

  let resultBrush = null;
  const material = new THREE.MeshStandardMaterial({
    color: "#3b82f6",
    metalness: 0.25,
    roughness: 0.45,
  });

  for (const feat of active) {
    const geom = createFeatureGeometry(feat);
    // Ensure non-indexed or clean attributes for three-bvh-csg
    const brush = new Brush(geom, material);
    const pos = feat.position || { x: 0, y: 0, z: 0 };
    const rot = feat.rotation || { x: 0, y: 0, z: 0 };
    brush.position.set(Number(pos.x) || 0, Number(pos.y) || 0, Number(pos.z) || 0);
    brush.rotation.set(
      THREE.MathUtils.degToRad(Number(rot.x) || 0),
      THREE.MathUtils.degToRad(Number(rot.y) || 0),
      THREE.MathUtils.degToRad(Number(rot.z) || 0)
    );
    brush.updateMatrixWorld(true);

    if (!resultBrush) {
      if (feat.operation === "subtract") {
        geom.dispose();
        continue;
      }
      // Apply transform into geometry for uniform CSG base
      const baked = geom.clone();
      baked.applyMatrix4(brush.matrixWorld);
      resultBrush = new Brush(baked, material);
      resultBrush.updateMatrixWorld(true);
      geom.dispose();
      continue;
    }

    const op =
      feat.operation === "subtract"
        ? SUBTRACTION
        : feat.operation === "intersect"
          ? INTERSECTION
          : ADDITION;

    const nextBrush = evaluator.evaluate(resultBrush, brush, op);
    resultBrush.geometry.dispose();
    geom.dispose();
    resultBrush = nextBrush;
  }

  if (!resultBrush || !resultBrush.geometry) {
    return {
      geometry: null,
      metrics: {
        volumeMm3: 0,
        surfaceAreaMm2: 0,
        boundingBoxMm: { x: 0, y: 0, z: 0 },
        centerOfMass: { x: 0, y: 0, z: 0 },
        triangleCount: 0,
        featureCount: active.length,
        isWatertight: false,
      },
    };
  }

  const finalGeo = resultBrush.geometry;
  finalGeo.computeBoundingBox();
  finalGeo.computeVertexNormals();

  const metrics = computeGeometryMetrics(finalGeo, active.length);
  return { geometry: finalGeo, metrics };
}

export function computeGeometryMetrics(geometry, featureCount = 0) {
  if (!geometry || !geometry.attributes?.position) {
    return {
      volumeMm3: 0,
      surfaceAreaMm2: 0,
      boundingBoxMm: { x: 0, y: 0, z: 0 },
      centerOfMass: { x: 0, y: 0, z: 0 },
      triangleCount: 0,
      featureCount,
      isWatertight: false,
    };
  }

  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const size = new THREE.Vector3();
  bb.getSize(size);

  const pos = geometry.attributes.position;
  const index = geometry.index;
  const triCount = index ? Math.floor(index.count / 3) : Math.floor(pos.count / 3);

  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const v3 = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const cross = new THREE.Vector3();

  let signedVol6 = 0;
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  let cz = 0;

  for (let i = 0; i < triCount; i++) {
    const i0 = index ? index.getX(i * 3) : i * 3;
    const i1 = index ? index.getX(i * 3 + 1) : i * 3 + 1;
    const i2 = index ? index.getX(i * 3 + 2) : i * 3 + 2;

    v1.fromBufferAttribute(pos, i0);
    v2.fromBufferAttribute(pos, i1);
    v3.fromBufferAttribute(pos, i2);

    const v6 = v1.dot(cross.crossVectors(v2, v3));
    signedVol6 += v6;
    cx += (v6 * (v1.x + v2.x + v3.x)) / 4;
    cy += (v6 * (v1.y + v2.y + v3.y)) / 4;
    cz += (v6 * (v1.z + v2.z + v3.z)) / 4;

    e1.subVectors(v2, v1);
    e2.subVectors(v3, v1);
    area2 += cross.crossVectors(e1, e2).length();
  }

  const volumeMm3 = Math.abs(signedVol6 / 6);
  const surfaceAreaMm2 = area2 / 2;

  return {
    volumeMm3: Number(volumeMm3.toFixed(2)),
    surfaceAreaMm2: Number(surfaceAreaMm2.toFixed(2)),
    boundingBoxMm: {
      x: Number(size.x.toFixed(2)),
      y: Number(size.y.toFixed(2)),
      z: Number(size.z.toFixed(2)),
    },
    centerOfMass:
      Math.abs(signedVol6) > 1e-6
        ? {
            x: Number((cx / signedVol6).toFixed(2)),
            y: Number((cy / signedVol6).toFixed(2)),
            z: Number((cz / signedVol6).toFixed(2)),
          }
        : { x: 0, y: 0, z: 0 },
    triangleCount: triCount,
    featureCount,
    isWatertight: triCount > 0,
  };
}

export function exportGeometryToStlBlob(geometry) {
  if (!geometry) return null;
  const exporter = new STLExporter();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  const buffer = exporter.parse(mesh, { binary: true });
  return new Blob([buffer], { type: "model/stl" });
}

let occtInstancePromise = null;

async function getOcctInstance() {
  if (occtInstancePromise) return occtInstancePromise;
  occtInstancePromise = new Promise((resolve, reject) => {
    const startInit = () => {
      if (typeof window.occtimportjs !== "function") {
        reject(new Error("occtimportjs failed to load"));
        return;
      }
      window
        .occtimportjs({
          locateFile: (name) => `/occt/${name}`,
        })
        .then(resolve)
        .catch(reject);
    };

    if (typeof window.occtimportjs === "function") {
      startInit();
      return;
    }

    const script = document.createElement("script");
    script.src = "/occt/occt-import-js.js";
    script.async = true;
    script.onload = startInit;
    script.onerror = () => reject(new Error("Failed to load /occt/occt-import-js.js"));
    document.body.appendChild(script);
  });
  return occtInstancePromise;
}

/**
 * Loads an STL, STEP (.stp/.step), IGES (.igs/.iges), or BREP file URL/Buffer
 * into a THREE.Group for interactive inspection.
 */
export async function loadCadFileIntoGroup(fileUrl, fileNameHint = "") {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch CAD file (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const ext = (fileNameHint || fileUrl).split("?")[0].split(".").pop().toLowerCase();

  const group = new THREE.Group();

  if (ext === "stl") {
    const loader = new STLLoader();
    const geom = loader.parse(arrayBuffer);
    geom.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      metalness: 0.25,
      roughness: 0.45,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    group.add(mesh);
    return group;
  }

  if (["step", "stp", "iges", "igs", "brep"].includes(ext)) {
    const occt = await getOcctInstance();
    const fileBytes = new Uint8Array(arrayBuffer);
    let result;
    if (ext === "iges" || ext === "igs") {
      result = occt.ReadIgesFile(fileBytes, { linearUnit: "millimeter" });
    } else if (ext === "brep") {
      result = occt.ReadBrepFile(fileBytes, { linearUnit: "millimeter" });
    } else {
      result = occt.ReadStepFile(fileBytes, { linearUnit: "millimeter" });
    }

    if (!result || !result.success) {
      throw new Error(`Could not parse ${ext.toUpperCase()} CAD file`);
    }

    for (const meshData of result.meshes || []) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(meshData.attributes.position.array, 3)
      );
      if (meshData.attributes.normal) {
        geometry.setAttribute(
          "normal",
          new THREE.Float32BufferAttribute(meshData.attributes.normal.array, 3)
        );
      } else {
        geometry.computeVertexNormals();
      }
      if (meshData.index) {
        geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from(meshData.index.array), 1));
      }
      const color = meshData.color
        ? new THREE.Color(meshData.color[0], meshData.color[1], meshData.color[2])
        : new THREE.Color(0x3b82f6);

      const material = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.25,
        roughness: 0.45,
        side: THREE.DoubleSide,
      });
      group.add(new THREE.Mesh(geometry, material));
    }
    return group;
  }

  throw new Error(`Unsupported 3D preview format: .${ext}`);
}

/**
 * Safe parametric JS CAD evaluator built on Three.js + three-bvh-csg.
 * Exposes: box(w,h,d), cylinder(r,h), cone(rTop,rBot,h), sphere(r), torus(r,tube),
 *          union(a,b), subtract(a,b), intersect(a,b), translate(m,x,y,z), rotate(m,rx,ry,rz), scale(m,sx,sy,sz).
 */
export function evaluateJscadScript(scriptText = "") {
  const defaultMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
  const toBrush = (geo) => {
    const b = new Brush(geo, defaultMat);
    b.updateMatrixWorld(true);
    return b;
  };
  const bake = (brush) => {
    brush.updateMatrixWorld(true);
    const cloned = brush.geometry.clone();
    cloned.applyMatrix4(brush.matrixWorld);
    return new Brush(cloned, defaultMat);
  };

  const api = {
    box: (w = 20, h = 20, d = 20) =>
      toBrush(new THREE.BoxGeometry(Math.max(0.2, +w || 20), Math.max(0.2, +h || 20), Math.max(0.2, +d || 20))),
    cylinder: (r = 10, h = 20, segs = 36) =>
      toBrush(new THREE.CylinderGeometry(Math.max(0.2, +r || 10), Math.max(0.2, +r || 10), Math.max(0.2, +h || 20), Math.max(12, Math.min(96, +segs || 36)))),
    cone: (rTop = 0, rBot = 12, h = 20, segs = 36) =>
      toBrush(new THREE.CylinderGeometry(Math.max(0, +rTop || 0), Math.max(0.2, +rBot || 12), Math.max(0.2, +h || 20), Math.max(12, Math.min(96, +segs || 36)))),
    sphere: (r = 12) => toBrush(new THREE.SphereGeometry(Math.max(0.2, +r || 12), 32, 24)),
    torus: (r = 16, tube = 4) => toBrush(new THREE.TorusGeometry(Math.max(0.5, +r || 16), Math.max(0.2, +tube || 4), 20, 48)),
    translate: (brush, x = 0, y = 0, z = 0) => {
      const b = bake(brush);
      b.geometry.translate(+x || 0, +y || 0, +z || 0);
      return b;
    },
    rotate: (brush, rx = 0, ry = 0, rz = 0) => {
      const b = bake(brush);
      b.geometry.rotateX(THREE.MathUtils.degToRad(+rx || 0));
      b.geometry.rotateY(THREE.MathUtils.degToRad(+ry || 0));
      b.geometry.rotateZ(THREE.MathUtils.degToRad(+rz || 0));
      return b;
    },
    scale: (brush, sx = 1, sy = 1, sz = 1) => {
      const b = bake(brush);
      b.geometry.scale(+sx || 1, +sy || sx || 1, +sz || sx || 1);
      return b;
    },
    union: (...brushes) =>
      brushes.slice(1).reduce((acc, next) => evaluator.evaluate(bake(acc), bake(next), ADDITION), brushes[0]),
    subtract: (base, ...cuts) =>
      cuts.reduce((acc, cut) => evaluator.evaluate(bake(acc), bake(cut), SUBTRACTION), base),
    intersect: (...brushes) =>
      brushes.slice(1).reduce((acc, next) => evaluator.evaluate(bake(acc), bake(next), INTERSECTION), brushes[0]),
  };

  const argNames = Object.keys(api);
  const argValues = Object.values(api);
  // eslint-disable-next-line no-new-func
  const fn = new Function(...argNames, `"use strict";\n${String(scriptText || "")}`);
  const resultBrush = fn(...argValues);
  if (!resultBrush || !resultBrush.geometry) {
    throw new Error("Script must return a 3D solid (e.g. return subtract(base, hole);)");
  }
  const finalGeo = resultBrush.geometry.clone();
  finalGeo.computeBoundingBox();
  finalGeo.computeVertexNormals();
  const metrics = computeGeometryMetrics(finalGeo, 1);
  return { geometry: finalGeo, metrics };
}


