// src/context/FeedbackContext.js
import React, { createContext, useContext, useState } from "react";

const FeedbackContext = createContext(null);

export default function FeedbackProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [flow, setFlow] = useState("user");
  const [questions, setQuestions] = useState([]);
  const [triggerInfo, setTriggerInfo] = useState({});
  const [userObj, setUserObj] = useState(null);

  // explicit snapshot fields
  const [externalUserId, setExternalUserId] = useState(null);
  const [externalUserName, setExternalUserName] = useState(null);
  const [externalUserEmail, setExternalUserEmail] = useState(null);

  // callback after submit/cancel
  const [postSubmitCallback, setPostSubmitCallback] = useState(null);

  const openFeedback = ({
    flow = "user",
    questions = [],
    triggerInfo = {},
    user = null,
    userId = null,
    userName = null,
    userEmail = null,
    postSubmitCallback = null
  } = {}) => {
    setFlow(flow);
    setQuestions(questions);
    setTriggerInfo(triggerInfo);
    setUserObj(user || null);

    setExternalUserId(
      userId || (user && (user._id || user.id || user.userId)) || null
    );
    setExternalUserName(
      userName || (user && (user.name || user.schoolName || user.displayName)) || null
    );
    setExternalUserEmail(
      userEmail || (user && (user.email || user.schoolEmail || user.contactEmail)) || null
    );

    setPostSubmitCallback(() => postSubmitCallback);
    setOpen(true);
  };

  const closeFeedback = () => {
    setOpen(false);
    setQuestions([]);
    setTriggerInfo({});
    setUserObj(null);
    setExternalUserId(null);
    setExternalUserName(null);
    setExternalUserEmail(null);
    setPostSubmitCallback(null);
  };

  return (
    <FeedbackContext.Provider
      value={{
        open,
        openFeedback,
        closeFeedback,
        flow,
        questions,
        triggerInfo,
        userObj,
        postSubmitCallback,
        externalUserId,
        externalUserName,
        externalUserEmail
      }}
    >
      {children}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error("useFeedback must be used inside FeedbackProvider");
  }
  return ctx;
}
