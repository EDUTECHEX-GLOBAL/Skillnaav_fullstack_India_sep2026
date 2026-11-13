export const WORK_SPACE_SECTORS = [
  {
    id: "advanced-ai",
    name: "AI & Autonomous",
    tagline: "Python AI, JupyterLite WASM, C++ & Data Analytics",
  },
  {
    id: "quantum-computing",
    name: "Quantum Computing",
    tagline: "Quirk Quantum Circuits, Python, Crypto & Simulation",
  },
  {
    id: "climate-tech",
    name: "Climate Tech",
    tagline: "PhET Climate Sim, uMap GIS, Data & Web Dashboards",
  },
  {
    id: "biotech",
    name: "Biotech",
    tagline: "3Dmol Protein Viewer, VSEPR Molecules, Python & SQL",
  },
  {
    id: "materials-science",
    name: "Materials Science",
    tagline: "Molecular Structure, 3D CAD Modeling & Property Data",
  },
  {
    id: "space-exploration",
    name: "Space Exploration",
    tagline: "Gravity & Orbits Sim, OpenSCAD, Flight C++ & Go/Rust",
  },
  {
    id: "neurotechnology",
    name: "Neurotechnology",
    tagline: "Neuron Action Potential, Biosignal Circuits & Python",
  },
  {
    id: "precision-agriculture",
    name: "Precision Agriculture",
    tagline: "OpenStreetMap Field GIS, Wokwi IoT Sensors & SQL/CSV",
  },
  {
    id: "advanced-robotics",
    name: "Advanced Robotics",
    tagline: "Wokwi Arduino/ESP32, CircuitJS1, 3D CAD & C++",
  },
  {
    id: "renewable-energy",
    name: "Renewable Energy",
    tagline: "Solar/Turbine Energy Lab, DC Circuits & Grid Analytics",
  },
  {
    id: "architecture-built-environment",
    name: "Architecture & Built Env",
    tagline: "3D CAD, OpenSCAD, FreeCAD, Draw.io & Sketchboards",
  },
];

export const FREE_TOOL_CATALOG = [
  {
    id: "builtin-cad",
    name: "EduTechEx 3D CAD Studio",
    shortLabel: "3D CAD Studio",
    category: "Mechanical CAD",
    license: "MIT / LGPL-2.1 (Three.js + OCCT)",
    mode: "cad",
    liveMonitored: true,
    description:
      "SolidWorks-style parametric 3D modeling, 2D sketch-extrude, boolean cuts, and STL/STEP export inside EduTechEx.",
    defaultCode: "",
  },
  {
    id: "jscad-studio",
    name: "Scripted 3D CAD Studio (JSCAD / CSG)",
    shortLabel: "Scripted 3D CAD",
    category: "Mechanical CAD",
    license: "MIT (Three.js + CSG)",
    mode: "jscad",
    language: "javascript",
    liveMonitored: true,
    description:
      "Programmatic 3D CAD using JavaScript CSG functions (box, cylinder, sphere, union, subtract) with live 3D preview & STL export.",
    defaultCode: `// Scripted 3D CAD (mm dimensions)
// Helpers: box(w,h,d), cylinder(r,h), sphere(r), union(a,b), subtract(a,b), intersect(a,b), translate(m,x,y,z), rotate(m,rx,ry,rz)
const basePlate = box(60, 10, 40);
const centerBoss = translate(cylinder(12, 18), 0, 14, 0);
const centerHole = translate(cylinder(6, 36), 0, 10, 0);
const bracket = union(basePlate, centerBoss);
return subtract(bracket, centerHole);
`,
  },
  {
    id: "cpp-compiler",
    name: "C / C++ Online Compiler (GCC)",
    shortLabel: "C / C++ Compiler",
    category: "Programming & DSA",
    license: "GPL / Open Source (GCC / Wandbox)",
    mode: "code",
    language: "cpp",
    liveMonitored: true,
    description:
      "Write, compile, and execute C++20 or C17 programs with custom stdin and instant compiler diagnostics inside EduTechEx.",
    defaultCode: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello from EduTechEx C++ Lab!" << endl;
    return 0;
}
`,
  },
  {
    id: "python-lab",
    name: "Python 3 Online Lab",
    shortLabel: "Python 3 Lab",
    category: "Programming & AI",
    license: "PSF Open Source",
    mode: "code",
    language: "python",
    liveMonitored: true,
    description:
      "Run Python 3 scripts for algorithms, engineering math, data structures, and automation directly inside EduTechEx.",
    defaultCode: `# EduTechEx Python 3 Lab
def solve():
    nums = [2, 4, 6, 8, 10]
    print("Sum:", sum(nums), "Avg:", sum(nums) / len(nums))

if __name__ == "__main__":
    solve()
`,
  },
  {
    id: "java-compiler",
    name: "Java OpenJDK Compiler",
    shortLabel: "Java Compiler",
    category: "Programming & DSA",
    license: "GPLv2 (OpenJDK)",
    mode: "code",
    language: "java",
    liveMonitored: true,
    description:
      "Compile and execute Java (OpenJDK) object-oriented programs with stdin support inside EduTechEx.",
    defaultCode: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from EduTechEx Java Lab!");
    }
}
`,
  },
  {
    id: "go-rust-compiler",
    name: "Go / Rust Systems Compiler",
    shortLabel: "Go / Rust Lab",
    category: "Backend & Systems",
    license: "BSD / MIT (Open Source)",
    mode: "code",
    language: "go",
    liveMonitored: true,
    description:
      "Write and run Go or Rust systems programs directly in EduTechEx with full live compiler output.",
    defaultCode: `package main

import "fmt"

func main() {
    fmt.Println("Hello from EduTechEx Go Lab!")
}
`,
  },
  {
    id: "sql-lab",
    name: "SQL / SQLite Database Lab (WASM)",
    shortLabel: "SQL Database Lab",
    category: "Database & SQL",
    license: "MIT (sql.js / SQLite)",
    mode: "sql",
    language: "sql",
    liveMonitored: true,
    description:
      "Run real SQLite relational SQL queries (CREATE, INSERT, JOIN, GROUP BY) 100% locally in-browser with live result tables.",
    defaultCode: `-- Real SQLite Database running inside EduTechEx!
CREATE TABLE interns (id INTEGER PRIMARY KEY, name TEXT, track TEXT, score INTEGER);
INSERT INTO interns (name, track, score) VALUES
  ('Aarav', 'Mechanical CAD', 92),
  ('Diya', 'Backend Engineering', 96),
  ('Kabir', 'Data Analytics', 89);

SELECT track, COUNT(*) AS students, ROUND(AVG(score), 1) AS avg_score
FROM interns
GROUP BY track
ORDER BY avg_score DESC;
`,
  },
  {
    id: "web-sandbox",
    name: "HTML / CSS / JS Live Sandbox",
    shortLabel: "HTML/CSS/JS Compiler",
    category: "Web Development",
    license: "100% Browser-Native",
    mode: "web",
    language: "html",
    liveMonitored: true,
    description:
      "Build interactive HTML5, CSS3, and JavaScript web pages with live sandboxed rendering and console log capture.",
    defaultCode: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; background: #f8fafc; }
    .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
  </style>
</head>
<body>
  <div class="card">
    <h2>EduTechEx HTML / CSS / JS Compiler</h2>
    <p id="msg">Edit the code to see live updates.</p>
  </div>
  <script>
    console.log("Web sandbox ready!");
  </script>
</body>
</html>
`,
  },
  {
    id: "html-css-js-studio",
    name: "HTML5 + CSS3 + JS Split Studio",
    shortLabel: "HTML + CSS + JS Studio",
    category: "Web Development",
    license: "100% Browser-Native (MIT)",
    mode: "web",
    language: "html",
    liveMonitored: true,
    description:
      "CodePen-style 3-pane HTML, CSS, and JavaScript compiler with separate tabs, live console capture, and instant preview inside EduTechEx.",
    defaultCode: JSON.stringify(
      {
        html: `<div class="hero">\n  <h1>EduTechEx Interactive UI</h1>\n  <p id="status">Click the button below to test JavaScript.</p>\n  <button id="btn">Run Action</button>\n</div>`,
        css: `body {\n  font-family: Inter, system-ui, sans-serif;\n  background: #f1f5f9;\n  padding: 24px;\n}\n.hero {\n  background: #ffffff;\n  border-radius: 14px;\n  padding: 24px;\n  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);\n}\nbutton {\n  margin-top: 12px;\n  background: #2563eb;\n  color: #fff;\n  border: none;\n  border-radius: 8px;\n  padding: 8px 16px;\n  cursor: pointer;\n}`,
        js: `document.getElementById("btn").addEventListener("click", () => {\n  document.getElementById("status").textContent = "Button clicked! Live JS executed.";\n  console.log("Button clicked at", new Date().toLocaleTimeString());\n});`,
      },
      null,
      2
    ),
  },
  {
    id: "typescript-compiler",
    name: "TypeScript / Node.js Compiler",
    shortLabel: "TypeScript / Node",
    category: "Web & Backend",
    license: "Apache-2.0 (TypeScript / Wandbox)",
    mode: "code",
    language: "typescript",
    liveMonitored: true,
    description:
      "Write, type-check, and run TypeScript and Node.js server scripts with stdin support and compiler diagnostics.",
    defaultCode: `// EduTechEx TypeScript Compiler
interface TaskMetric {
  moduleName: string;
  passed: number;
  total: number;
}

const metrics: TaskMetric[] = [
  { moduleName: "API Gateway", passed: 18, total: 20 },
  { moduleName: "Auth Service", passed: 12, total: 12 },
];

for (const m of metrics) {
  console.log(\`\${m.moduleName}: \${m.passed}/\${m.total} tests passed\`);
}
`,
  },
  {
    id: "php-compiler",
    name: "PHP 8 Online Compiler",
    shortLabel: "PHP 8 Compiler",
    category: "Web & Backend",
    license: "PHP License 3.01",
    mode: "code",
    language: "php",
    liveMonitored: true,
    description:
      "Execute PHP 8 backend scripts, array transformations, JSON handling, and CLI programs directly inside EduTechEx.",
    defaultCode: `<?php
$students = [
  ["name" => "Aarav", "score" => 91],
  ["name" => "Diya", "score" => 96],
];

foreach ($students as $s) {
  echo $s["name"] . " => " . $s["score"] . "\\n";
}
`,
  },
  {
    id: "ruby-compiler",
    name: "Ruby 3 Online Compiler",
    shortLabel: "Ruby 3 Compiler",
    category: "Programming & DSA",
    license: "BSD / Ruby License",
    mode: "code",
    language: "ruby",
    liveMonitored: true,
    description:
      "Write and execute Ruby scripts for scripting, algorithms, and backend automation inside EduTechEx.",
    defaultCode: `# EduTechEx Ruby Compiler
scores = [84, 91, 95, 88]
avg = scores.sum.to_f / scores.length
puts "Average Score: #{avg.round(2)}"
`,
  },
  {
    id: "csharp-compiler",
    name: "C# (.NET / Mono) Online Compiler",
    shortLabel: "C# Compiler",
    category: "Backend & Systems",
    license: "MIT (Mono / .NET)",
    mode: "code",
    language: "csharp",
    liveMonitored: true,
    description:
      "Compile and execute object-oriented C# programs using the open-source Mono / .NET compiler inside EduTechEx.",
    defaultCode: `using System;

class Program {
  static void Main() {
    Console.WriteLine("Hello from EduTechEx C# Compiler!");
  }
}
`,
  },
  {
    id: "bash-shell-lab",
    name: "Bash / Linux Shell Scripting Lab",
    shortLabel: "Bash / Linux Lab",
    category: "DevOps & Systems",
    license: "GPLv3 (GNU Bash)",
    mode: "code",
    language: "bash",
    liveMonitored: true,
    description:
      "Practice Linux shell commands, pipelines, loops, text processing (awk/sed/grep), and DevOps scripts.",
    defaultCode: `#!/usr/bin/env bash
echo "EduTechEx Linux Shell Lab"
for i in 1 2 3 4; do
  echo "Build step #$i completed"
done
`,
  },
  {
    id: "regex-json-lab",
    name: "Regex & JSON API Inspector Lab",
    shortLabel: "Regex & JSON Lab",
    category: "Web & Backend",
    license: "100% Browser-Native",
    mode: "regex",
    language: "json",
    liveMonitored: true,
    description:
      "Test Regular Expressions with live match highlights and validate/format JSON API payloads 100% client-side with Partner live monitoring.",
    defaultCode: JSON.stringify(
      {
        pattern: "\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b",
        flags: "gi",
        testText: "Contact support@edutechex.com or intern01@skillnaav.org for daily lab help.",
        jsonText: JSON.stringify(
          {
            service: "edutechex-api",
            version: "2.1.0",
            endpoints: ["/api/daily-work/assignments", "/api/daily-work/run-code"],
            active: true,
          },
          null,
          2
        ),
      },
      null,
      2
    ),
  },
  {
    id: "data-lab",
    name: "CSV / Excel Data Analytics & Chart Lab",
    shortLabel: "Data Analytics Lab",
    category: "Data Science",
    license: "MIT (PapaParse + Recharts)",
    mode: "data",
    language: "csv",
    liveMonitored: true,
    description:
      "Analyze CSV/Excel datasets, compute statistics (min, max, mean, sum), filter rows, and generate live charts inside EduTechEx.",
    defaultCode: `Month,Output_Units,Defect_Rate,Efficiency_Pct
Jan,1200,2.4,88
Feb,1450,1.9,91
Mar,1680,1.5,94
Apr,1590,1.7,92
May,1840,1.2,96
`,
  },
  {
    id: "mermaid-studio",
    name: "Mermaid Flowchart & ERD Studio",
    shortLabel: "Flowchart & ERD",
    category: "Architecture & Docs",
    license: "MIT (Mermaid.js)",
    mode: "diagram",
    language: "mermaid",
    liveMonitored: true,
    description:
      "Create Flowcharts, Sequence Diagrams, ERDs, and System Architecture visuals rendered locally inside EduTechEx.",
    defaultCode: `flowchart TD
  A[Student Opens Daily Tool] --> B[Work Saved Live]
  B --> C{Partner Inspects}
  C -->|Live Monitor| D[Review Code / 3D / Diagram]
  C -->|Grade| E[Rubric Feedback]
`,
  },
  {
    id: "diagram-studio",
    name: "Draw.io / Diagrams.net Architect",
    shortLabel: "Draw.io Architect",
    category: "Architecture & Docs",
    license: "Apache-2.0 (jgraph/drawio)",
    mode: "drawio",
    embedUrl: "https://embed.diagrams.net/?embed=1&proto=json&libraries=1&ui=min&spin=1",
    liveMonitored: true,
    description:
      "Full UML, Block Diagram, Network, and Schematic Editor embedded via official Apache-2.0 Draw.io postMessage protocol.",
    defaultCode: "",
  },
  {
    id: "whiteboard-lab",
    name: "Engineering Sketch & Whiteboard",
    shortLabel: "Whiteboard Sketch",
    category: "Design & Ideation",
    license: "100% Browser-Native",
    mode: "whiteboard",
    language: "canvas",
    liveMonitored: true,
    description:
      "Freehand technical drawing board with shapes, arrows, grid snap, and PNG/vector state synced live for Partner review.",
    defaultCode: "",
  },
  {
    id: "markdown-lab",
    name: "Markdown & Technical Report Studio",
    shortLabel: "Report Studio",
    category: "Architecture & Docs",
    license: "MIT (Remark / React-Markdown)",
    mode: "markdown",
    language: "markdown",
    liveMonitored: true,
    description:
      "Write structured daily engineering logs, API docs, and internship reports with live GitHub-Flavored Markdown preview.",
    defaultCode: `# Daily Internship Engineering Log

## 1. Objective
Summarize today's build, calculations, or testing goals.

## 2. Work Completed
- [x] Initialized prototype
- [ ] Verified edge cases & test metrics

| Metric | Target | Measured |
| :--- | :--- | :--- |
| Latency | < 120 ms | 85 ms |
| Accuracy | 99% | 99.4% |
`,
  },
  {
    id: "livecodes-playground",
    name: "LiveCodes Multi-Framework Web Studio",
    shortLabel: "LiveCodes IDE",
    category: "Web Development",
    license: "MIT (live-codes/livecodes)",
    mode: "iframe",
    embedUrl: "https://livecodes.io/?mode=lite",
    liveMonitored: false,
    description:
      "Client-side open-source IDE supporting HTML, CSS, JS, TypeScript, React, Vue, Tailwind & 80+ languages inside EduTechEx.",
  },
  {
    id: "p5js-editor",
    name: "p5.js Creative Coding & Simulation IDE",
    shortLabel: "p5.js Web IDE",
    category: "Web & Graphics",
    license: "LGPL-2.1 / MIT (Processing)",
    mode: "iframe",
    embedUrl: "https://editor.p5js.org/",
    liveMonitored: false,
    description:
      "Interactive HTML5 Canvas visual coding, physics simulations, and UI animation IDE embedded in browser.",
  },
  {
    id: "excalidraw-board",
    name: "Excalidraw System Sketchboard",
    shortLabel: "Excalidraw",
    category: "Design & Ideation",
    license: "MIT (excalidraw/excalidraw)",
    mode: "iframe",
    embedUrl: "https://excalidraw.com/",
    liveMonitored: false,
    description:
      "Open-source virtual whiteboard for system architecture, UI wireframes, and ER sketches.",
  },
  {
    id: "cyberchef-lab",
    name: "CyberChef Security, Crypto & Encoding Lab",
    shortLabel: "CyberChef Lab",
    category: "Cybersecurity & Data",
    license: "Apache-2.0 (GCHQ)",
    mode: "iframe",
    embedUrl: "https://gchq.github.io/CyberChef/",
    liveMonitored: false,
    description:
      "100% client-side cybersecurity Swiss Army Knife for Base64, AES/RSA hashing, JWT inspection, and data parsing.",
  },
  {
    id: "circuit-sim",
    name: "Falstad CircuitJS1 Simulator",
    shortLabel: "CircuitJS1",
    category: "Electronics & Circuits",
    license: "GPL-2.0+",
    mode: "iframe",
    embedUrl: "https://www.falstad.com/circuit/circuitjs.html",
    liveMonitored: false,
    description:
      "Interactive open-source analog & digital electronics simulator embedded directly inside EduTechEx.",
  },
  {
    id: "wokwi-sim",
    name: "Wokwi Arduino / ESP32 Simulator",
    shortLabel: "Wokwi Embedded",
    category: "Electronics & Circuits",
    license: "Free Browser Embedded Lab",
    mode: "iframe",
    embedUrl: "https://wokwi.com/projects/new/arduino-uno",
    liveMonitored: false,
    description:
      "Simulate Arduino, ESP32, STM32, LEDs, and sensors in C++/MicroPython right inside your browser.",
  },
  {
    id: "jupyter-lite",
    name: "JupyterLite Notebook (WASM)",
    shortLabel: "JupyterLite",
    category: "Data Science",
    license: "BSD-3-Clause (Project Jupyter)",
    mode: "iframe",
    embedUrl: "https://jupyterlite.github.io/demo/lab/index.html",
    liveMonitored: false,
    description:
      "Interactive JupyterLab Python notebooks powered completely by WebAssembly inside the browser.",
  },
  {
    id: "freecad-wasm",
    name: "FreeCAD WebAssembly",
    shortLabel: "FreeCAD WASM",
    category: "Mechanical CAD",
    license: "LGPL-2.1+",
    mode: "iframe",
    embedUrl: "https://freecad.virtastic.app",
    liveMonitored: false,
    description:
      "Full desktop-class FreeCAD running in Chrome/Edge 137+ via WebAssembly for advanced assemblies & TechDraw.",
  },
  {
    id: "openscad-wasm",
    name: "OpenSCAD Playground (WASM)",
    shortLabel: "OpenSCAD WASM",
    category: "Scripted 3D CAD",
    license: "GPL-2.0",
    mode: "iframe",
    embedUrl: "https://ochafik.com/openscad2/",
    liveMonitored: false,
    description:
      "Parametric code-driven 3D CAD modeling using OpenSCAD (.scad) directly in the browser.",
  },
  {
    id: "solvespace-web",
    name: "SolveSpace Web CAD",
    shortLabel: "SolveSpace Web",
    category: "Mechanical CAD",
    license: "GPLv3",
    mode: "iframe",
    embedUrl: "https://solvespace.com/webver.pl",
    liveMonitored: false,
    description:
      "Lightweight constraint-based 2D/3D parametric mechanical CAD compiled to WebAssembly.",
  },
  {
    id: "freecad-container",
    name: "Cloud FreeCAD Container (Selkies/KasmVNC)",
    shortLabel: "Cloud FreeCAD",
    category: "Mechanical CAD",
    license: "LGPL-2.1+",
    mode: "iframe",
    embedUrl: "",
    liveMonitored: false,
    description:
      "Self-hosted Docker FreeCAD 1.0+ streamed over HTTPS for all browsers & low-end laptops.",
  },
  {
    id: "quirk-quantum",
    name: "Quirk Quantum Circuit Simulator",
    shortLabel: "Quirk Quantum",
    category: "Quantum Computing",
    license: "Apache-2.0 (Strilanc/Quirk)",
    mode: "iframe",
    embedUrl: "https://algassert.com/quirk",
    liveMonitored: false,
    description:
      "Drag-and-drop up to 16-qubit open-source quantum circuit simulator with real-time Bloch spheres and state-vector amplitudes.",
  },
  {
    id: "3dmol-viewer",
    name: "3Dmol.js Molecular & Protein Viewer",
    shortLabel: "3Dmol Viewer",
    category: "Biotech & Materials",
    license: "BSD-3-Clause (3Dmol.js)",
    mode: "iframe",
    embedUrl: "https://3dmol.csb.pitt.edu/viewer.html?pdb=1YCR&style=cartoon:color~spectrum",
    liveMonitored: false,
    description:
      "Hardware-accelerated WebGL 3D molecular, protein PDB, and crystal structure explorer directly inside EduTechEx.",
  },
  {
    id: "phet-molecule-shapes",
    name: "PhET 3D Molecule Shapes & VSEPR Lab",
    shortLabel: "Molecule Shapes",
    category: "Biotech & Materials",
    license: "CC-BY (PhET HTML5)",
    mode: "iframe",
    embedUrl: "https://phet.colorado.edu/sims/html/molecule-shapes/latest/molecule-shapes_en.html",
    liveMonitored: false,
    description:
      "Interactive 3D molecular bonding geometry, lone-pair repulsion, and chemical structure simulation.",
  },
  {
    id: "phet-greenhouse",
    name: "PhET Greenhouse Effect & Climate Lab",
    shortLabel: "Climate Lab",
    category: "Climate & Earth",
    license: "CC-BY (PhET HTML5)",
    mode: "iframe",
    embedUrl: "https://phet.colorado.edu/sims/html/greenhouse-effect/latest/greenhouse-effect_en.html",
    liveMonitored: false,
    description:
      "Simulate atmospheric greenhouse gas concentrations, infrared photon absorption, and solar radiation balance.",
  },
  {
    id: "phet-gravity-orbits",
    name: "PhET Gravity & Orbital Mechanics Lab",
    shortLabel: "Gravity & Orbits",
    category: "Space & Aerospace",
    license: "CC-BY (PhET HTML5)",
    mode: "iframe",
    embedUrl: "https://phet.colorado.edu/sims/html/gravity-and-orbits/latest/gravity-and-orbits_en.html",
    liveMonitored: false,
    description:
      "Interactive orbital mechanics, gravity vectors, velocity trajectories, and satellite mass-radius experiments.",
  },
  {
    id: "phet-neuron",
    name: "PhET Action Potential & Neuron Simulator",
    shortLabel: "Neuron Simulator",
    category: "Neurotechnology",
    license: "CC-BY (PhET HTML5)",
    mode: "iframe",
    embedUrl: "https://phet.colorado.edu/sims/html/neuron/latest/neuron_en.html",
    liveMonitored: false,
    description:
      "Simulate axonal ion channels (Na+/K+), membrane potential spikes, and action potential propagation in real time.",
  },
  {
    id: "phet-energy-forms",
    name: "PhET Energy Forms, Solar & Turbine Lab",
    shortLabel: "Energy & Solar Lab",
    category: "Renewable Energy",
    license: "CC-BY (PhET HTML5)",
    mode: "iframe",
    embedUrl: "https://phet.colorado.edu/sims/html/energy-forms-and-changes/latest/energy-forms-and-changes_en.html",
    liveMonitored: false,
    description:
      "Model solar panels, hydro/steam turbines, thermal transfer, and electrical energy conversion systems.",
  },
  {
    id: "phet-circuit-dc",
    name: "PhET DC Circuit Construction Kit",
    shortLabel: "DC Circuit Lab",
    category: "Electronics & Energy",
    license: "CC-BY (PhET HTML5)",
    mode: "iframe",
    embedUrl: "https://phet.colorado.edu/sims/html/circuit-construction-kit-dc/latest/circuit-construction-kit-dc_en.html",
    liveMonitored: false,
    description:
      "Build DC circuits with batteries, resistors, switches, ammeters, and voltmeters with electron flow visualization.",
  },
  {
    id: "umap-gis-studio",
    name: "uMap / OpenStreetMap Geospatial Studio",
    shortLabel: "uMap Field GIS",
    category: "GIS & Precision Agri",
    license: "WTFPL / Open Source (OSM)",
    mode: "iframe",
    embedUrl: "https://umap.openstreetmap.fr/en/map/new/",
    liveMonitored: false,
    description:
      "Create interactive OpenStreetMap layers, farm/climate polygons, markers, and GeoJSON geospatial maps in-browser.",
  },
  {
    id: "custom-oss-tool",
    name: "Custom Free / Open-Source Tool URL",
    shortLabel: "Custom OSS Tool",
    category: "Custom Lab",
    license: "Open Source / Self-Hosted",
    mode: "iframe",
    embedUrl: "",
    liveMonitored: false,
    description:
      "Send any self-hosted or free open-source browser tool URL (Octave, LibreCAD, custom app, etc.) to internship applicants.",
  },
];

export const SECTOR_TOOL_MAP = {
  "advanced-ai": [
    "python-lab",
    "jupyter-lite",
    "sql-lab",
    "data-lab",
    "cpp-compiler",
    "typescript-compiler",
    "java-compiler",
    "regex-json-lab",
    "mermaid-studio",
  ],
  "quantum-computing": [
    "quirk-quantum",
    "python-lab",
    "jupyter-lite",
    "cpp-compiler",
    "data-lab",
    "cyberchef-lab",
    "bash-shell-lab",
    "markdown-lab",
  ],
  "climate-tech": [
    "phet-greenhouse",
    "umap-gis-studio",
    "data-lab",
    "python-lab",
    "sql-lab",
    "web-sandbox",
    "html-css-js-studio",
    "markdown-lab",
  ],
  biotech: [
    "3dmol-viewer",
    "phet-molecule-shapes",
    "python-lab",
    "jupyter-lite",
    "data-lab",
    "sql-lab",
    "bash-shell-lab",
    "markdown-lab",
  ],
  "materials-science": [
    "phet-molecule-shapes",
    "3dmol-viewer",
    "builtin-cad",
    "jscad-studio",
    "data-lab",
    "python-lab",
    "ruby-compiler",
    "markdown-lab",
  ],
  "space-exploration": [
    "phet-gravity-orbits",
    "builtin-cad",
    "openscad-wasm",
    "cpp-compiler",
    "python-lab",
    "go-rust-compiler",
    "data-lab",
    "p5js-editor",
  ],
  neurotechnology: [
    "phet-neuron",
    "python-lab",
    "jupyter-lite",
    "data-lab",
    "circuit-sim",
    "cpp-compiler",
    "csharp-compiler",
    "mermaid-studio",
  ],
  "precision-agriculture": [
    "umap-gis-studio",
    "wokwi-sim",
    "data-lab",
    "sql-lab",
    "python-lab",
    "php-compiler",
    "web-sandbox",
    "html-css-js-studio",
  ],
  "advanced-robotics": [
    "wokwi-sim",
    "circuit-sim",
    "phet-circuit-dc",
    "builtin-cad",
    "jscad-studio",
    "cpp-compiler",
    "python-lab",
    "freecad-wasm",
  ],
  "renewable-energy": [
    "phet-energy-forms",
    "phet-circuit-dc",
    "circuit-sim",
    "data-lab",
    "builtin-cad",
    "python-lab",
    "sql-lab",
    "markdown-lab",
  ],
  "architecture-built-environment": [
    "builtin-cad",
    "openscad-wasm",
    "freecad-wasm",
    "solvespace-web",
    "diagram-studio",
    "excalidraw-board",
    "whiteboard-lab",
    "html-css-js-studio",
    "livecodes-playground",
  ],
};

export function getToolsForSector(sectorId) {
  const ids = SECTOR_TOOL_MAP[sectorId] || [];
  return ids
    .map((id) => FREE_TOOL_CATALOG.find((t) => t.id === id))
    .filter(Boolean);
}

export function getToolMeta(toolId) {
  return FREE_TOOL_CATALOG.find((t) => t.id === toolId) || FREE_TOOL_CATALOG[0];
}
