export const userFlowQuestions = [
  { id: "overall", type: "rating", label: "1) Overall, how would you rate your experience today?", required: true },
  { id: "findEase", type: "scale", min: 1, max: 5, label: "2) How easy was it to find relevant internships/jobs? (1-5)", default: 4 },
  { id: "issueEncountered", type: "yesno", label: "3) Did you face any issues while applying or saving a job?" },
  { id: "issueDesc", type: "textarea", label: "If yes, briefly describe", rows: 2 },
  { id: "descriptionClarity", type: "rating", label: "4) How clear was the job description (1-5)?" },
  { id: "performance", type: "rating", label: "5) How responsive/fast did the site feel (1-5)?" },
  { id: "featureUsed", type: "select", label: "6) Feature used most today", options: ["Search","Save","Apply","Profile","Other"] },
  { id: "confusing", type: "text", label: "7) Anything confusing or broken? (short)" },
  { id: "nps", type: "scale", min: 0, max: 10, label: "8) How likely are you to recommend Skillnaav? (0-10)", default: 8 },
  { id: "suggestions", type: "textarea", label: "9) Suggestions to improve internship discovery", rows: 3 },
  { id: "followUp", type: "yesno", label: "10) Would you like follow-up from Skillnaav?" },
  { id: "contactEmail", type: "text", label: "If yes, email:", placeholder: "you@example.com" }
];

export const partnerFlowQuestions = [
  { id: "overall_partner", type: "rating", label: "1) Overall, how would you rate your partner dashboard experience?", required: true },
  { id: "postEase", type: "scale", min: 1, max: 5, label: "2) How easy was it to post an internship/job?" },
  { id: "approvalClarity", type: "rating", label: "3) How clear was the approval/status process?" },
  { id: "toolsUsed", type: "select", label: "4) Which tool did you use most?", options: ["Post Job","Edit Job","Analytics","Profile"] },
  { id: "issues_partner", type: "yesno", label: "5) Did you face any issues while posting?" },
  { id: "issueDesc_partner", type: "textarea", label: "If yes, describe", rows: 2 },
  { id: "timeToPost", type: "text", label: "6) Approx time taken to post (minutes)" },
  { id: "improvements_partner", type: "textarea", label: "7) What would improve partner experience?", rows: 3 },
  { id: "followUp_partner", type: "yesno", label: "8) Want a partner manager follow-up?" },
  { id: "contactEmail_partner", type: "text", label: "If yes, email" }
];

export const schoolAdminFlowQuestions = [
  { id: "overall_school", type: "rating", label: "1) Overall, how was the school admin experience?", required: true },
  { id: "reviewFlow", type: "rating", label: "2) How easy is it to review partner postings (1-5)?" },
  { id: "tools_school", type: "select", label: "3) Which action did you perform?", options: ["Approve","Reject","Edit","Communicate"] },
  { id: "issue_school", type: "yesno", label: "4) Did you face issues with the moderation tools?" },
  { id: "issueDesc_school", type: "textarea", label: "If yes, describe", rows: 2 },
  { id: "suggestions_school", type: "textarea", label: "5) Suggestions to improve the admin tools", rows: 3 },
  { id: "followUp_school", type: "yesno", label: "6) Would you like support contact?" },
  { id: "contactEmail_school", type: "text", label: "If yes, email" }
];
