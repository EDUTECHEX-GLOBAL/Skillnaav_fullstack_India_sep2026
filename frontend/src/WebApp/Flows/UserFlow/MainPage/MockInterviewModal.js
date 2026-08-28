import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "../../../../api/axiosInstance";

const MockInterviewModal = ({ show, onClose, session, job, userInfo }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [finalSummary, setFinalSummary] = useState(null);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");

  const recognitionRef = useRef(null);

  const speakText = (text) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. Please type your answer.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      const speechToText = event.results[0][0].transcript;
      setCurrentAnswer((prev) => (prev ? prev + " " + speechToText : speechToText));
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        setError(`Voice Input Error: ${event.error}. Please try typing.`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  // Extract questions
  const questions = useMemo(() => session?.mockInterview?.questions || [], [session?.mockInterview?.questions]);

  // Play Text-to-Speech when a new question loads
  useEffect(() => {
    if (show && questions.length > 0 && currentQuestionIndex < questions.length && !completed) {
      const timer = setTimeout(() => {
        speakText(questions[currentQuestionIndex]);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [show, currentQuestionIndex, completed, questions]);

  // Clean up speech synthesis on close
  useEffect(() => {
    if (!show) {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      stopSpeechRecognition();
      // Reset state for next launch
      setCurrentQuestionIndex(0);
      setAnswers([]);
      setCurrentAnswer("");
      setCompleted(false);
      setFinalSummary(null);
    }
  }, [show]);

  if (!show || !session?.mockInterview?.enabled || !job) return null;

  const submitInterview = async (finalAnswers) => {
    // Fill in any skipped questions to prevent null values in the array
    const sanitizedAnswers = questions.map((q, idx) => {
      const existing = finalAnswers[idx];
      if (existing) return existing;
      return {
        questionText: q,
        answerText: "Skipped",
        status: "Incorrect",
        aiFeedback: "Student skipped this question.",
      };
    });

    setSubmitting(true);
    try {
      const { data: submitData } = await axios.post(
        "/api/mock-interviews/submit",
        {
          studentId: userInfo?._id,
          mockInterviewId: session._id,
          internshipId: job._id,
          partnerId: job.partnerId,
          answers: sanitizedAnswers,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("userToken")}` } }
      );
      setFinalSummary(submitData.data || submitData);
      setCompleted(true);
    } catch (err) {
      console.error("Failed to submit mock interview:", err);
      setError("Failed to complete mock interview. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (!currentAnswer.trim()) {
      setError("Please write or speak your answer first.");
      return;
    }

    const existingAnswer = answers[currentQuestionIndex];
    let newAnswers = [...answers];

    // If answer is unchanged and already evaluated, skip evaluation
    if (existingAnswer && existingAnswer.answerText === currentAnswer.trim() && existingAnswer.aiFeedback) {
      // Do nothing to newAnswers
    } else {
      setIsEvaluating(true);
      setError(null);
      try {
        const { data } = await axios.post(
          "/api/mock-interviews/evaluate-answer",
          {
            questionText: questions[currentQuestionIndex],
            answerText: currentAnswer.trim(),
          },
          { headers: { Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("userToken")}` } }
        );

        newAnswers[currentQuestionIndex] = {
          questionText: questions[currentQuestionIndex],
          answerText: currentAnswer.trim(),
          status: data.status || "Incorrect",
          aiFeedback: data.feedback || "",
        };
        setAnswers(newAnswers);
      } catch (err) {
        console.error("Failed to evaluate answer:", err);
        setError("Failed to save answer. Please try again.");
        setIsEvaluating(false);
        return;
      }
      setIsEvaluating(false);
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentAnswer(newAnswers[currentQuestionIndex + 1]?.answerText || "");
      setError(null);
    } else {
      submitInterview(newAnswers);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setCurrentAnswer(answers[currentQuestionIndex - 1]?.answerText || "");
      setError(null);
    }
  };

  const handleSkip = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setCurrentAnswer(answers[currentQuestionIndex + 1]?.answerText || "");
      setError(null);
    } else {
      submitInterview(answers);
    }
  };

  const handleSaveDraft = () => {
    if (!currentAnswer.trim()) return;
    const newAnswers = [...answers];
    const existingAnswer = newAnswers[currentQuestionIndex];
    if (!existingAnswer || existingAnswer.answerText !== currentAnswer.trim()) {
      newAnswers[currentQuestionIndex] = {
        questionText: questions[currentQuestionIndex],
        answerText: currentAnswer.trim(),
        status: "Draft",
        aiFeedback: "",
      };
      setAnswers(newAnswers);
    }
    setSaveStatus("Draft Saved");
    setTimeout(() => setSaveStatus(""), 3000);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[#F4F6FB] flex flex-col transition-all duration-300 font-poppins text-slate-800">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse-glow {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
        }
        @keyframes bounce-visualizer {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
        .mic-glow {
          animation: pulse-glow 2s infinite ease-in-out;
        }
        .v-bar-1 { animation: bounce-visualizer 0.8s infinite ease-in-out; }
        .v-bar-2 { animation: bounce-visualizer 0.5s infinite ease-in-out 0.15s; }
        .v-bar-3 { animation: bounce-visualizer 0.7s infinite ease-in-out 0.3s; }
        .v-bar-4 { animation: bounce-visualizer 0.6s infinite ease-in-out 0.45s; }
      `}} />

      {/* Top Header */}
      <div className="px-8 py-3.5 flex items-center justify-between bg-white border-b border-slate-200 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-slate-50 rounded-lg transition cursor-pointer">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          <h2 className="text-[15px] font-extrabold tracking-tight text-slate-900">AI Mock Interview</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 p-1.5 rounded-full pr-3 transition">
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[10px] uppercase">
              {userInfo?.name?.[0] || userInfo?.firstName?.[0] || 'U'}
            </div>
            <span className="text-xs font-bold text-slate-700">{userInfo?.name || userInfo?.firstName || 'User'}</span>
          </div>
          <button onClick={onClose} className="ml-2 text-slate-400 hover:text-rose-500 transition cursor-pointer p-1">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-[1400px] mx-auto flex gap-6 pt-8 pb-4 px-8 overflow-hidden h-full relative">
        
        {completed ? (
          <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col py-8 overflow-y-auto">
            {/* ... Old completed view ... */}
            <div className="w-full flex flex-col gap-6 py-2">
              <div className="text-center bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col items-center gap-4">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-slate-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="text-indigo-600 transition-all duration-1000" strokeDasharray={`${((finalSummary?.score ?? 0) / 5) * 100}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <div className="absolute text-center flex flex-col">
                    <span className="text-3xl font-black text-slate-800 tracking-tighter leading-none">{finalSummary?.score ?? 0}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Score</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-850">Evaluation Submitted</h3>
                  <p className="text-xs text-indigo-600 font-bold tracking-wide mt-0.5 uppercase">Completed successfully</p>
                </div>
              </div>
              <button onClick={onClose} className="w-full mt-2 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition shadow-md flex items-center justify-center gap-2 text-sm tracking-wide">
                Return to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* MAIN COLUMN */}
            <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col gap-5 overflow-y-auto pr-2 pb-24 no-scrollbar h-full">
              
              {/* Progress Card */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex items-center justify-between">
                <div className="flex-1 pr-12">
                  <h3 className="text-sm font-extrabold text-slate-900 mb-4">Question {currentQuestionIndex + 1} of {questions.length}</h3>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                      style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Question Card */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[9px] text-indigo-600 font-extrabold uppercase tracking-widest">Interviewer Question</span>
                  <button onClick={() => speakText(questions[currentQuestionIndex])} className="w-8 h-8 flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M12 18.75V5.25L7.75 9.5H4.5v5h3.25L12 18.75z"></path></svg>
                  </button>
                </div>
                <h2 className="text-[17px] font-extrabold text-slate-800 leading-snug mb-6">{questions[currentQuestionIndex]}</h2>
                <div className="flex items-center justify-end">
                  <button onClick={() => speakText(questions[currentQuestionIndex])} className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-extrabold rounded-lg flex items-center gap-1.5 transition">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    Replay
                  </button>
                </div>
              </div>

              {/* Answer Card */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex-1 flex flex-col relative min-h-[350px]">
                <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest block mb-4">Your Answer</span>
                
                <div className="flex-1 overflow-hidden flex flex-col relative transition-all">
                  <textarea
                    className="w-full flex-1 p-0 resize-none outline-none text-[14px] text-slate-700 font-medium bg-transparent leading-relaxed"
                    placeholder="Type your answer here..."
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    disabled={isEvaluating || submitting}
                  />
                  
                  {/* Toolbar */}
                  <div className="pt-3 mt-3 flex items-center justify-between bg-white">
                    <div className="flex gap-2 items-center">
                      {isListening ? (
                        <button onClick={stopSpeechRecognition} className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 text-rose-500 flex flex-col items-center justify-center gap-0.5 relative overflow-hidden transition shadow-sm pulse-mic cursor-pointer">
                           <div className="flex items-end gap-[2px] h-3">
                             <span className="w-1 bg-rose-500 rounded-full v-bar-1" style={{ height: '40%' }}></span>
                             <span className="w-1 bg-rose-500 rounded-full v-bar-2" style={{ height: '80%' }}></span>
                             <span className="w-1 bg-rose-500 rounded-full v-bar-3" style={{ height: '60%' }}></span>
                           </div>
                        </button>
                      ) : (
                        <button onClick={startSpeechRecognition} disabled={isEvaluating || submitting} className="w-10 h-10 rounded-full border border-slate-200 text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition shadow-sm cursor-pointer hover:border-indigo-200">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                        </button>
                      )}
                    </div>
                    
                    <span className="text-[10px] font-bold text-slate-400 mr-2">
                      {currentAnswer.trim().split(/\s+/).filter(w=>w).length} / 2000 words
                    </span>
                  </div>
                </div>
              </div>

              {error && <p className="text-rose-500 text-xs font-bold bg-rose-50 p-3 rounded-xl border border-rose-100">{error}</p>}
            </div>

            {/* Bottom Floating Bar */}
            <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="flex items-center gap-16 pointer-events-auto bg-white/80 backdrop-blur-md px-6 py-4 rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.04)] border border-white">
                <div className="flex gap-3">
                  <button 
                    onClick={handlePrevious} 
                    disabled={currentQuestionIndex === 0}
                    className="px-5 py-2.5 border border-slate-200 rounded-xl text-[11px] font-extrabold text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
                    Previous
                  </button>
                  <button 
                    onClick={handleSkip}
                    disabled={currentQuestionIndex === questions.length - 1}
                    className="px-5 py-2.5 border border-slate-200 rounded-xl text-[11px] font-extrabold text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
                    Skip
                  </button>
                </div>
                
                <div className="flex items-center gap-6">
                  {saveStatus && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                      {saveStatus}
                    </div>
                  )}
                  <button onClick={handleSaveDraft} className="flex items-center gap-1.5 text-[11px] font-extrabold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
                    Save Draft
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!currentAnswer.trim() || isEvaluating || submitting}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md hover:shadow-indigo-500/20 transition disabled:opacity-50 flex items-center gap-2 text-[11px] tracking-wide cursor-pointer active:scale-95"
                  >
                    {isEvaluating ? "Evaluating..." : submitting ? "Submitting..." : currentQuestionIndex === questions.length - 1 ? "Finish Interview" : "Next Question"}
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"></path></svg>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MockInterviewModal;
