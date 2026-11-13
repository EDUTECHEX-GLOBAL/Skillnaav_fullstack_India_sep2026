import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadCadFileIntoGroup } from "./threeDGeometryEngine";

function applyGroupVisualStyle(group, renderMode, sectionEnabled, clipPlane) {
  if (!group) return;
  group.traverse((obj) => {
    if (obj.userData?.isEdgeHelper) {
      obj.visible = renderMode === "shaded-edges";
      return;
    }
    if (obj.isMesh && obj.material) {
      obj.material.wireframe = renderMode === "wireframe";
      obj.material.transparent = renderMode === "xray";
      obj.material.opacity = renderMode === "xray" ? 0.45 : 1;
      obj.material.clippingPlanes = sectionEnabled ? [clipPlane] : [];
      obj.material.needsUpdate = true;
    }
  });
}

/**
 * Interactive Three.js CAD Viewport supporting:
 * - Direct parametric BufferGeometry OR external .STL / .STEP / .IGES URLs
 * - Standard CAD views (Iso, Front, Top, Right)
 * - Shaded / Edges / Wireframe / X-Ray display modes
 * - Section clipping plane slider
 * - Click-to-measure 3D point-to-point distance (mm)
 */
const ThreeDViewport = ({
  geometry = null,
  fileUrl = "",
  fileName = "",
  ghostFeatures = [],
  className = "h-[460px]",
  showControls = true,
}) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const modelGroupRef = useRef(null);
  const ghostGroupRef = useRef(null);
  const measureGroupRef = useRef(null);
  const clipPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), 1000));

  const [renderMode, setRenderMode] = useState("shaded-edges"); // shaded-edges | shaded | wireframe | xray
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [measuredDistance, setMeasuredDistance] = useState(null);
  const [sectionEnabled, setSectionEnabled] = useState(false);
  const [sectionHeight, setSectionHeight] = useState(50);
  const [sectionMax, setSectionMax] = useState(60);
  const [loadingFile, setLoadingFile] = useState(false);
  const [loadError, setLoadError] = useState("");

  const measureModeRef = useRef(measureMode);
  useEffect(() => {
    measureModeRef.current = measureMode;
  }, [measureMode]);

  const styleRef = useRef({ renderMode, sectionEnabled });
  useEffect(() => {
    styleRef.current = { renderMode, sectionEnabled };
  }, [renderMode, sectionEnabled]);

  // Initialize Three.js scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 460;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0f172a");
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    camera.position.set(110, 85, 110);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.localClippingEnabled = true;
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controlsRef.current = controls;

    // CAD studio lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(120, 180, 100);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.5);
    fillLight.position.set(-100, 60, -120);
    scene.add(fillLight);

    // Reference grid (200mm x 200mm, 10mm grid) & origin axes
    const grid = new THREE.GridHelper(200, 20, 0x334155, 0x1e293b);
    scene.add(grid);
    const axes = new THREE.AxesHelper(35);
    scene.add(axes);

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    const ghostGroup = new THREE.Group();
    scene.add(ghostGroup);
    ghostGroupRef.current = ghostGroup;

    const measureGroup = new THREE.Group();
    scene.add(measureGroup);
    measureGroupRef.current = measureGroup;

    // Click handler for 3D point measurement
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onPointerDown = (event) => {
      if (!measureModeRef.current || !modelGroupRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(modelGroupRef.current.children, true);
      if (hits.length > 0) {
        const pt = hits[0].point.clone();
        setMeasurePoints((prev) => {
          const next = prev.length >= 2 ? [pt] : [...prev, pt];
          if (next.length === 2) {
            setMeasuredDistance(Number(next[0].distanceTo(next[1]).toFixed(2)));
          } else {
            setMeasuredDistance(null);
          }
          return next;
        });
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 460;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // Update measurement markers
  useEffect(() => {
    const mg = measureGroupRef.current;
    if (!mg) return;
    while (mg.children.length) mg.remove(mg.children[0]);

    for (const pt of measurePoints) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(1.4, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
      );
      dot.position.copy(pt);
      mg.add(dot);
    }

    if (measurePoints.length === 2) {
      const lineGeo = new THREE.BufferGeometry().setFromPoints(measurePoints);
      const line = new THREE.Line(
        lineGeo,
        new THREE.LineBasicMaterial({ color: 0xfacc15 })
      );
      mg.add(line);
    }
  }, [measurePoints]);

  // Apply renderMode and section clipping to modelGroup
  useEffect(() => {
    clipPlaneRef.current.constant = sectionHeight;
    applyGroupVisualStyle(modelGroupRef.current, renderMode, sectionEnabled, clipPlaneRef.current);
  }, [renderMode, sectionEnabled, sectionHeight]);

  const frameCameraToGroup = (group) => {
    if (!group || !cameraRef.current || !controlsRef.current) return;
    const box = new THREE.Box3().setFromObject(group);
    if (box.isEmpty()) return;
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 20);
    setSectionMax(Math.ceil(box.max.y + 10));
    setSectionHeight(Math.ceil(box.max.y + 5));

    controlsRef.current.target.copy(center);
    cameraRef.current.position.set(
      center.x + maxDim * 1.45,
      center.y + maxDim * 1.1,
      center.z + maxDim * 1.45
    );
    controlsRef.current.update();
  };

  // Load geometry prop
  useEffect(() => {
    if (fileUrl) return;
    const group = modelGroupRef.current;
    if (!group) return;

    while (group.children.length) {
      const child = group.children[0];
      group.remove(child);
    }

    if (!geometry) return;

    const mat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      metalness: 0.25,
      roughness: 0.42,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, mat);
    group.add(mesh);

    const edges = new THREE.EdgesGeometry(geometry, 25);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.45 })
    );
    line.userData.isEdgeHelper = true;
    group.add(line);

    geometry.computeBoundingBox();
    if (geometry.boundingBox) {
      setSectionMax(Math.ceil(geometry.boundingBox.max.y + 10));
      setSectionHeight(Math.ceil(geometry.boundingBox.max.y + 5));
    }
    applyGroupVisualStyle(
      group,
      styleRef.current.renderMode,
      styleRef.current.sectionEnabled,
      clipPlaneRef.current
    );
  }, [geometry, fileUrl]);

  // Load external fileUrl (.stl / .step / .iges)
  useEffect(() => {
    if (!fileUrl) return;
    let cancelled = false;
    setLoadingFile(true);
    setLoadError("");

    loadCadFileIntoGroup(fileUrl, fileName)
      .then((loadedGroup) => {
        if (cancelled || !modelGroupRef.current) return;
        const target = modelGroupRef.current;
        while (target.children.length) target.remove(target.children[0]);

        loadedGroup.children.forEach((child) => {
          target.add(child);
          if (child.isMesh && child.geometry) {
            const edges = new THREE.EdgesGeometry(child.geometry, 25);
            const line = new THREE.LineSegments(
              edges,
              new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.35 })
            );
            line.userData.isEdgeHelper = true;
            target.add(line);
          }
        });

        applyGroupVisualStyle(
          target,
          styleRef.current.renderMode,
          styleRef.current.sectionEnabled,
          clipPlaneRef.current
        );
        frameCameraToGroup(target);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || "Unable to preview 3D file");
      })
      .finally(() => {
        if (!cancelled) setLoadingFile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fileUrl, fileName]);

  // Render subtle ghost outlines for subtracted/cut features so student sees where cuts sit
  useEffect(() => {
    const gg = ghostGroupRef.current;
    if (!gg) return;
    while (gg.children.length) gg.remove(gg.children[0]);

    for (const gf of ghostFeatures) {
      if (!gf?.geometry) continue;
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(gf.geometry),
        new THREE.LineBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.35 })
      );
      wire.position.set(gf.position?.x || 0, gf.position?.y || 0, gf.position?.z || 0);
      wire.rotation.set(
        THREE.MathUtils.degToRad(gf.rotation?.x || 0),
        THREE.MathUtils.degToRad(gf.rotation?.y || 0),
        THREE.MathUtils.degToRad(gf.rotation?.z || 0)
      );
      gg.add(wire);
    }
  }, [ghostFeatures]);

  const setStandardView = (preset) => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    const target = ctrl.target.clone();
    const dist = Math.max(cam.position.distanceTo(target), 120);
    if (preset === "iso") cam.position.set(target.x + dist * 0.65, target.y + dist * 0.55, target.z + dist * 0.65);
    if (preset === "front") cam.position.set(target.x, target.y, target.z + dist);
    if (preset === "top") cam.position.set(target.x, target.y + dist, target.z + 0.01);
    if (preset === "right") cam.position.set(target.x + dist, target.y, target.z);
    ctrl.update();
  };

  return (
    <div className={`relative w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900 ${className}`}>
      <div ref={mountRef} className="h-full w-full" />

      {loadingFile && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/75 text-sm font-medium text-blue-300">
          Loading 3D CAD geometry...
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/85 p-4 text-center text-sm text-rose-300">
          {loadError}
        </div>
      )}

      {showControls && (
        <>
          {/* Top-left CAD View Presets */}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {["iso", "front", "top", "right"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setStandardView(v)}
                className="rounded-md bg-slate-800/90 px-2.5 py-1 text-xs font-medium uppercase text-slate-200 border border-slate-700 hover:bg-slate-700"
              >
                {v}
              </button>
            ))}
          </div>

          {/* Top-right Display & Measure Controls */}
          <div className="absolute right-3 top-3 flex flex-wrap items-center gap-1.5">
            <select
              value={renderMode}
              onChange={(e) => setRenderMode(e.target.value)}
              className="rounded-md bg-slate-800/90 px-2 py-1 text-xs text-slate-200 border border-slate-700 focus:outline-none"
            >
              <option value="shaded-edges">Shaded + Edges</option>
              <option value="shaded">Shaded</option>
              <option value="wireframe">Wireframe</option>
              <option value="xray">X-Ray</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setMeasureMode((m) => !m);
                setMeasurePoints([]);
                setMeasuredDistance(null);
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium border ${
                measureMode
                  ? "bg-amber-500 text-slate-950 border-amber-400"
                  : "bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-700"
              }`}
            >
              {measureMode ? "Measuring (Click 2 pts)" : "Measure mm"}
            </button>

            <button
              type="button"
              onClick={() => setSectionEnabled((s) => !s)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium border ${
                sectionEnabled
                  ? "bg-cyan-500 text-slate-950 border-cyan-400"
                  : "bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-700"
              }`}
            >
              Section Cut
            </button>
          </div>

          {/* Bottom-left Measurement / Section Readout */}
          {(measureMode || sectionEnabled) && (
            <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-3 rounded-lg bg-slate-900/90 px-3 py-2 text-xs text-slate-200 border border-slate-700">
              {measureMode && (
                <span>
                  {measuredDistance !== null
                    ? `Distance: ${measuredDistance} mm`
                    : `Select ${2 - measurePoints.length} point(s) on part`}
                </span>
              )}
              {sectionEnabled && (
                <label className="flex items-center gap-2">
                  <span>Y-Cut: {sectionHeight} mm</span>
                  <input
                    type="range"
                    min={-10}
                    max={Math.max(sectionMax, 20)}
                    value={sectionHeight}
                    onChange={(e) => setSectionHeight(Number(e.target.value))}
                    className="w-28 accent-cyan-400"
                  />
                </label>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ThreeDViewport;

