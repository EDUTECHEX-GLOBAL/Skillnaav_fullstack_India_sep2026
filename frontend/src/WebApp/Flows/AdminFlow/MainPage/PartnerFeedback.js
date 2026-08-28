import React, { useEffect } from "react";
import AdminFeedbackList from "./AdminFeedbackList";

export default function PartnerFeedback() {
  useEffect(() => {
    document.title = "Admin — Partner Feedback";
  }, []);

  return <AdminFeedbackList flow="partner" />;
}
