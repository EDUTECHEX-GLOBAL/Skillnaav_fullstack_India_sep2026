import axios from "../../api/axiosInstance";

export const getStudentToken = () =>
  localStorage.getItem("userToken") ||
  localStorage.getItem("token") ||
  sessionStorage.getItem("userToken") ||
  sessionStorage.getItem("token") ||
  "";

/**
 * Push a live activity / draft sync packet to the backend so Partners
 * can inspect what the student is actively working on in near real-time.
 * Safely no-ops in Free Practice Sandbox mode (!assignmentId).
 */
export async function syncStudentActivity(assignmentId, payload = {}) {
  if (!assignmentId) return null;
  const token = getStudentToken();
  if (!token) return null;
  try {
    const res = await axios.post(
      `/api/daily-work/submissions/${assignmentId}/activity`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  } catch {
    // Non-blocking background telemetry: never interrupt student workflow
    return null;
  }
}

export function formatDurationSeconds(sec = 0) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

