import React, { useEffect } from "react";
import AdminFeedbackList from "./AdminFeedbackList";

export default function SchoolFeedback() {
  useEffect(() => {
    document.title = "Admin — School Admin Feedback";
  }, []);

  return <AdminFeedbackList flow="schoolAdmin" />;
}
