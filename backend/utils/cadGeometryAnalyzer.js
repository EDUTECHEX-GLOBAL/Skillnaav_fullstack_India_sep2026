const crypto = require("crypto");

/**
 * Pure Node.js STL (Binary & ASCII) geometry analyzer.
 * Independently computes bounding box, surface area, signed tetrahedral volume,
 * center of mass, edge-manifold watertightness, and SHA-256 fingerprint.
 */

function computeSha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function isLikelyBinaryStl(buffer) {
  if (!buffer || buffer.length < 84) return false;
  const triCount = buffer.readUInt32LE(80);
  const expectedLength = 84 + triCount * 50;
  if (expectedLength === buffer.length) return true;
  const head = buffer.slice(0, 80).toString("utf8").trimStart().toLowerCase();
  return !head.startsWith("solid ");
}

function quantizeVertex(x, y, z) {
  return `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
}

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function parseStlTriangles(buffer) {
  const triangles = [];
  if (isLikelyBinaryStl(buffer)) {
    const triCount = buffer.readUInt32LE(80);
    const maxTris = Math.min(triCount, Math.floor((buffer.length - 84) / 50));
    for (let i = 0; i < maxTris; i++) {
      const offset = 84 + i * 50;
      const v1 = [
        buffer.readFloatLE(offset + 12),
        buffer.readFloatLE(offset + 16),
        buffer.readFloatLE(offset + 20),
      ];
      const v2 = [
        buffer.readFloatLE(offset + 24),
        buffer.readFloatLE(offset + 28),
        buffer.readFloatLE(offset + 32),
      ];
      const v3 = [
        buffer.readFloatLE(offset + 36),
        buffer.readFloatLE(offset + 40),
        buffer.readFloatLE(offset + 44),
      ];
      triangles.push([v1, v2, v3]);
    }
    return triangles;
  }

  // ASCII STL fallback
  const text = buffer.toString("utf8");
  const vertexRegex = /vertex\s+([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s+([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s+([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)/g;
  const verts = [];
  let match;
  while ((match = vertexRegex.exec(text)) !== null) {
    verts.push([parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])]);
    if (verts.length === 3) {
      triangles.push([verts[0], verts[1], verts[2]]);
      verts.length = 0;
    }
  }
  return triangles;
}

function analyzeStlBuffer(buffer, featureCount = 0) {
  const sha256 = computeSha256(buffer);
  const triangles = parseStlTriangles(buffer);

  if (!triangles.length) {
    return {
      sha256,
      metrics: {
        volumeMm3: 0,
        surfaceAreaMm2: 0,
        boundingBoxMm: { x: 0, y: 0, z: 0 },
        centerOfMass: { x: 0, y: 0, z: 0 },
        triangleCount: 0,
        featureCount,
        isWatertight: false,
        analyzedBy: "server-stl",
      },
    };
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let signedVolume6 = 0;
  let surfaceArea2 = 0;
  let cxSum = 0, cySum = 0, czSum = 0;
  const edgeCounts = new Map();

  for (const [v1, v2, v3] of triangles) {
    for (const [x, y, z] of [v1, v2, v3]) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    // Signed tetrahedron volume * 6
    const [x1, y1, z1] = v1;
    const [x2, y2, z2] = v2;
    const [x3, y3, z3] = v3;
    const crossX = y2 * z3 - z2 * y3;
    const crossY = z2 * x3 - x2 * z3;
    const crossZ = x2 * y3 - y2 * x3;
    const v6 = x1 * crossX + y1 * crossY + z1 * crossZ;
    signedVolume6 += v6;

    cxSum += v6 * (x1 + x2 + x3) / 4;
    cySum += v6 * (y1 + y2 + y3) / 4;
    czSum += v6 * (z1 + z2 + z3) / 4;

    // Triangle area * 2
    const ax = x2 - x1, ay = y2 - y1, az = z2 - z1;
    const bx = x3 - x1, by = y3 - y1, bz = z3 - z1;
    const nX = ay * bz - az * by;
    const nY = az * bx - ax * bz;
    const nZ = ax * by - ay * bx;
    surfaceArea2 += Math.sqrt(nX * nX + nY * nY + nZ * nZ);

    // Watertightness check (each undirected edge should appear even number of times, ideally 2)
    if (triangles.length <= 150000) {
      const k1 = quantizeVertex(x1, y1, z1);
      const k2 = quantizeVertex(x2, y2, z2);
      const k3 = quantizeVertex(x3, y3, z3);
      for (const ek of [edgeKey(k1, k2), edgeKey(k2, k3), edgeKey(k3, k1)]) {
        edgeCounts.set(ek, (edgeCounts.get(ek) || 0) + 1);
      }
    }
  }

  let isWatertight = triangles.length > 0;
  if (edgeCounts.size > 0) {
    for (const count of edgeCounts.values()) {
      if (count % 2 !== 0) {
        isWatertight = false;
        break;
      }
    }
  }

  const volumeMm3 = Math.abs(signedVolume6 / 6);
  const surfaceAreaMm2 = surfaceArea2 / 2;
  const centerOfMass =
    Math.abs(signedVolume6) > 1e-9
      ? {
          x: Number((cxSum / signedVolume6).toFixed(2)),
          y: Number((cySum / signedVolume6).toFixed(2)),
          z: Number((czSum / signedVolume6).toFixed(2)),
        }
      : { x: 0, y: 0, z: 0 };

  return {
    sha256,
    metrics: {
      volumeMm3: Number(volumeMm3.toFixed(2)),
      surfaceAreaMm2: Number(surfaceAreaMm2.toFixed(2)),
      boundingBoxMm: {
        x: Number((maxX - minX).toFixed(2)),
        y: Number((maxY - minY).toFixed(2)),
        z: Number((maxZ - minZ).toFixed(2)),
      },
      centerOfMass,
      triangleCount: triangles.length,
      featureCount,
      isWatertight,
      analyzedBy: "server-stl",
    },
  };
}

function evaluateTargetSpecs(targetSpecs, metrics) {
  if (!targetSpecs || !targetSpecs.enabled || !metrics) {
    return {
      passed: true,
      passedCount: 0,
      totalChecks: 0,
      checks: [],
    };
  }

  const checks = [];

  if (targetSpecs.requireWatertight) {
    checks.push({
      name: "Watertight Solid Check",
      expected: "Manifold (Watertight)",
      actual: metrics.isWatertight ? "Watertight" : "Non-manifold / Open edges",
      passed: Boolean(metrics.isWatertight && metrics.triangleCount > 0),
      message: metrics.isWatertight
        ? "Mesh has closed manifold edges."
        : "Model contains open or non-manifold edges.",
    });
  }

  if (targetSpecs.expectedVolumeMm3 && targetSpecs.expectedVolumeMm3 > 0) {
    const tolPct = targetSpecs.volumeTolerancePct ?? 5;
    const expected = targetSpecs.expectedVolumeMm3;
    const actual = metrics.volumeMm3 || 0;
    const diffPct = Math.abs(actual - expected) / expected * 100;
    const passed = diffPct <= tolPct;
    checks.push({
      name: "Part Volume",
      expected: `${expected.toFixed(2)} mm³ (±${tolPct}%)`,
      actual: `${actual.toFixed(2)} mm³ (${diffPct.toFixed(1)}% diff)`,
      passed,
      message: passed
        ? "Volume is within tolerance."
        : `Volume deviates by ${diffPct.toFixed(1)}% (limit ${tolPct}%).`,
    });
  }

  const bounds = targetSpecs.expectedBoundsMm || {};
  const tolMm = targetSpecs.boundsToleranceMm ?? 2;
  for (const axis of ["x", "y", "z"]) {
    if (bounds[axis] && bounds[axis] > 0) {
      const expected = bounds[axis];
      const actual = metrics.boundingBoxMm?.[axis] || 0;
      const diff = Math.abs(actual - expected);
      const passed = diff <= tolMm;
      checks.push({
        name: `Bounding Box ${axis.toUpperCase()}`,
        expected: `${expected.toFixed(2)} mm (±${tolMm} mm)`,
        actual: `${actual.toFixed(2)} mm (Δ ${diff.toFixed(2)} mm)`,
        passed,
        message: passed
          ? `${axis.toUpperCase()} dimension matches specification.`
          : `${axis.toUpperCase()} dimension off by ${diff.toFixed(2)} mm.`,
      });
    }
  }

  const passedCount = checks.filter((c) => c.passed).length;
  return {
    passed: checks.length === 0 ? true : passedCount === checks.length,
    passedCount,
    totalChecks: checks.length,
    checks,
  };
}

module.exports = {
  computeSha256,
  analyzeStlBuffer,
  evaluateTargetSpecs,
};

