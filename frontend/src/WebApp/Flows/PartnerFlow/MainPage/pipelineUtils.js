import axios from "../../../../api/axiosInstance";

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

export const fetchPipelineByStage = async (internshipId, stage) => {
  const res = await axios.get(
    `/api/pipeline/internship/${internshipId}`,
    authHeaders()
  );

  return Array.isArray(res.data?.[stage]) ? res.data[stage] : [];
};



// Assessments routes: /api/assessments
// Assessments routes: /api/l2-assessments   ✅ (match backend)
export const generateL2Assessment = async ({ internshipId, studentId, partnerId, config }) => {
  const res = await axios.post(
    `/api/l2-assessments/generate`,
    { internshipId, studentId, partnerId, config },
    authHeaders()
  );
  return res.data; // must contain { assessmentId }
};

export const sendL2Assessment = async ({ assessmentId, partnerId }) => {
  const res = await axios.post(
    `/api/l2-assessments/${assessmentId}/send`,
    { partnerId },
    authHeaders()
  );
  return res.data;
};

export const fetchL2AssessmentReview = async (assessmentId) => {
  const res = await axios.get(
    `/api/l2-assessments/${assessmentId}/review`,
    authHeaders()
  );
  return res.data;
};

export const fetchL2AssessmentReviewByCandidate = async ({ internshipId, studentId }) => {
  const res = await axios.get(
    `/api/l2-assessments/review/by-candidate`,
    {
      ...authHeaders(),
      params: { internshipId, studentId },
    }
  );
  return res.data;
};

// Interviews routes: /api/interviews
export const createInterview = async ({ internshipId, studentId, partnerId, link, provider }) => {
  const res = await axios.post(
    `/api/interviews/create`,
    { internshipId, studentId, partnerId, link, provider },
    authHeaders()
  );
  return res.data; // expect { interviewId } or { interview: {...} }
};

export const scheduleInterview = async ({
  interviewId,
  scheduledAt,
  durationMinutes,
  studentEmail,
  studentName,
  partnerEmail,
  partnerName,
  internshipTitle,
}) => {
  const res = await axios.post(
    `/api/interviews/${interviewId}/schedule`,
    {
      scheduledAt,
      durationMinutes,
      studentEmail,
      studentName,
      partnerEmail,
      partnerName,
      internshipTitle,
    },
    authHeaders()
  );
  return res.data;
};

export const sendInterviewInvite = async (interviewId) => {
  const res = await axios.post(
    `/api/interviews/${interviewId}/send`,
    {},
    authHeaders()
  );
  return res.data;
};


export async function promoteToStage({ internshipId, partnerId, studentIds, toStage }) {
  const { data } = await axios.post(
    `/api/pipeline/internship/${internshipId}/promote`,
    { partnerId, studentIds, toStage }
  );
  return data;
}

export const completeInterview = async ({ interviewId, result, feedback }) => {
  const res = await axios.post(`/api/interviews/${interviewId}/complete`, {
    result,
    feedback,
  });
  return res.data;
};

// pipelineUtils.js
export const markInterviewCompleted = async (interviewId) => {
  const res = await axios.post(`/api/interviews/${interviewId}/mark-completed`);
  return res.data;
};
