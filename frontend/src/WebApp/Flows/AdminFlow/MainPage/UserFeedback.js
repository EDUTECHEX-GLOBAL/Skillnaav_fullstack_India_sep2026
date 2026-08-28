import React, { useEffect } from "react";
import AdminFeedbackList from "./AdminFeedbackList";

export default function UserFeedback() {
  useEffect(() => {
    document.title = "Admin — User Feedback";
  }, []);

  return <AdminFeedbackList flow="user" />;
}
