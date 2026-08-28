const FACE_API_SCRIPT_ID = "vladmandic-face-api-script";
const FACE_API_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js";

let faceApiPromise;

export const loadFaceApi = () => {
  if (window.faceapi) {
    return Promise.resolve(window.faceapi);
  }

  if (faceApiPromise) {
    return faceApiPromise;
  }

  faceApiPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(FACE_API_SCRIPT_ID);

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.faceapi), {
        once: true,
      });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = FACE_API_SCRIPT_ID;
    script.src = FACE_API_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(window.faceapi);
    script.onerror = () => {
      faceApiPromise = null;
      reject(new Error("Failed to load face-api script"));
    };

    document.body.appendChild(script);
  });

  return faceApiPromise;
};
