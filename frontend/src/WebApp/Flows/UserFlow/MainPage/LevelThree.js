import React, { useState, useEffect } from "react";
import axios from "../../../../api/axiosInstance";
import PropTypes from "prop-types";

// Standard RIASEC questions fallback in case backend questions are temporarily unavailable
const FALLBACK_QUESTIONS = [
  { _id: "q_r_1", question: "Assemble electronic or mechanical products in a workshop", riasecTrait: "R" },
  { _id: "q_r_2", question: "Fix broken equipment, appliances, or hardware systems", riasecTrait: "R" },
  { _id: "q_i_1", question: "Conduct scientific experiments or technology research", riasecTrait: "I" },
  { _id: "q_i_2", question: "Analyze complex data sets to solve technical problems", riasecTrait: "I" },
  { _id: "q_a_1", question: "Design creative visual graphics, user interfaces, or artwork", riasecTrait: "A" },
  { _id: "q_a_2", question: "Write creative articles, stories, scripts, or media content", riasecTrait: "A" },
  { _id: "q_s_1", question: "Teach, mentor, or guide others to develop new skills", riasecTrait: "S" },
  { _id: "q_s_2", question: "Collaborate with people to resolve personal or career challenges", riasecTrait: "S" },
  { _id: "q_e_1", question: "Lead a high-impact team project or start a business venture", riasecTrait: "E" },
  { _id: "q_e_2", question: "Pitch new project ideas, negotiate deals, or persuade clients", riasecTrait: "E" },
  { _id: "q_c_1", question: "Organize detailed project schedules, budgets, and records", riasecTrait: "C" },
  { _id: "q_c_2", question: "Audit reports to ensure precision, structure, and quality standards", riasecTrait: "C" },
];

const LevelThree = ({
  profileData,
  setCreateLevelThree,
  handleProfileData,
}) => {
  // State initialization
  const [loading, setLoading] = useState(true);
  const [allQuestions, setAllQuestions] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [, setSubmitted] = useState(false);
  const [personalityResults, setPersonalityResults] = useState(null);
  const [error, setError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Constants
  const answerOptions = [1, 2, 3, 4, 5];
  const answerMapping = {
    1: "Dislike",
    2: "Slightly Dislike",
    3: "Neutral",
    4: "Slightly Enjoy",
    5: "Enjoy",
  };

  // Data fetching
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch questions from backend
        let validQuestions = [];
        try {
          const questionsResponse = await axios.get("/api/personality/questions");
          if (Array.isArray(questionsResponse?.data) && questionsResponse.data.length > 0) {
            validQuestions = questionsResponse.data;
          }
        } catch (fetchErr) {
          console.warn("Could not fetch backend questions, using standard RIASEC questions:", fetchErr.message);
        }

        // If backend returned no questions, use standard fallback questions
        if (validQuestions.length === 0) {
          validQuestions = FALLBACK_QUESTIONS;
        }

        if (!isMounted) return;

        setAllQuestions(
          validQuestions.sort(
            (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
          ),
        );

        // Resolve userId from prop or localStorage
        let storedUid = null;
        try {
          const stored = JSON.parse(localStorage.getItem("studentInfo") || localStorage.getItem("userInfo") || "{}");
          storedUid = stored._id;
        } catch (_) {}

        const activeUserId = profileData?._id || storedUid;

        // Fetch responses if user exists
        if (activeUserId) {
          try {
            const responsesResponse = await axios.get(
              `/api/personality/responses?userId=${activeUserId}`,
            );

            const validResponses = Array.isArray(responsesResponse?.data)
              ? responsesResponse.data
              : [];

            const answersMap = {};
            validResponses.forEach((item) => {
              const qId = item?.questionId?._id || item?.questionId;
              if (qId) {
                answersMap[qId] = {
                  response: item.response,
                  question: item.questionId?.question || "",
                };
              }
            });

            if (isMounted) {
              setSelectedAnswers(answersMap);
              setSubmitted(validResponses.length > 0);
            }

            // Fetch personality results if responses exist
            if (validResponses.length > 0) {
              try {
                const personalityRes = await axios.get(
                  `/api/personality/calculate?userId=${activeUserId}`,
                );

                const backendData = personalityRes?.data || {};
                const transformedResults = {
                  hollandCode:
                    backendData.personality || backendData.hollandCode || "",
                  dominantTraits:
                    backendData.personality?.split("") ||
                    backendData.dominantTraits ||
                    [],
                  scores: backendData.scores || {},
                };

                if (isMounted) {
                  setPersonalityResults(transformedResults);
                }
              } catch (calcError) {
                console.warn("Calculation fetch notice:", calcError.message);
              }
            }
          } catch (responseError) {
            console.warn("Responses fetch notice:", responseError.message);
          }
        }
      } catch (err) {
        console.error("Data fetch error:", err);
        if (isMounted) {
          // Even on error, show the standard RIASEC questions so the user is never blocked
          setAllQuestions(FALLBACK_QUESTIONS);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [profileData]);

  // Helper functions
  const getPointsFromResponse = (response) => {
    const map = {
      Dislike: 1,
      "Slightly Dislike": 2,
      Neutral: 3,
      "Slightly Enjoy": 4,
      Enjoy: 5,
    };
    return map[response] || 3;
  };

  const getTraitFullName = (trait) => {
    const traitNames = {
      R: "Realistic",
      I: "Investigative",
      A: "Artistic",
      S: "Social",
      E: "Enterprising",
      C: "Conventional",
    };
    return traitNames[trait] || trait;
  };

  const getTraitDescription = (trait) => {
    const descriptions = {
      R: "Practical, hands-on, tool-oriented",
      I: "Analytical, intellectual, scientific",
      A: "Creative, original, independent",
      S: "Cooperative, supporting, helping",
      E: "Competitive, leading, persuading",
      C: "Detail-oriented, organizing",
    };
    return descriptions[trait] || "No description available.";
  };

  // Event handlers
  const handleAnswerChange = (questionId, answerIndex) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        response: answerMapping[answerIndex],
      },
    }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitLoading(true);
      setError(null);

      let storedUid = null;
      try {
        const stored = JSON.parse(localStorage.getItem("studentInfo") || localStorage.getItem("userInfo") || "{}");
        storedUid = stored._id;
      } catch (_) {}
      const activeUserId = profileData?._id || storedUid;

      // Prepare responses
      const responses = allQuestions.map((question) => ({
        questionId: question._id,
        userId: activeUserId,
        response: selectedAnswers[question._id]?.response || "Neutral",
        points: getPointsFromResponse(selectedAnswers[question._id]?.response),
        riasecTrait: question.riasecTrait,
      }));

      // Calculate scores
      const traitScores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
      responses.forEach(({ riasecTrait, points }) => {
        if (riasecTrait && traitScores.hasOwnProperty(riasecTrait)) {
          traitScores[riasecTrait] += points;
        }
      });

      // Determine Holland Code
      const sortedTraits = Object.entries(traitScores)
        .sort((a, b) => b[1] - a[1])
        .map(([trait]) => trait);
      const hollandCode = sortedTraits.slice(0, 3).join("");

      // Save to backend
      if (activeUserId) {
        try {
          await axios.post("/api/personality/responses/bulk", {
            responses,
            userId: activeUserId,
          });
        } catch (saveErr) {
          console.warn("Could not save to backend bulk endpoint:", saveErr.message);
        }
      }

      // Set results
      setPersonalityResults({
        hollandCode,
        scores: traitScores,
        dominantTraits: sortedTraits.slice(0, 3),
      });
      setSubmitted(true);
    } catch (error) {
      console.error("Submission error:", error);
      setError("Submission failed. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Derived values
  const totalAnswered = Object.values(selectedAnswers).filter(
    (answer) => answer?.response,
  ).length;

  // Render
  if (loading) {
    return (
      <div className="flex justify-center items-center h-48 sm:h-64">
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-6 max-w-4xl mx-auto w-full box-border">
      <h1 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-6 text-blue-700">
        Personality Assessment
      </h1>

      {error && (
        <div className="mb-4 sm:mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs sm:text-sm text-center">
          {error}
        </div>
      )}

      {personalityResults ? (
        <ResultsView
          results={personalityResults}
          getTraitFullName={getTraitFullName}
          getTraitDescription={getTraitDescription}
        />
      ) : (
        <TestView
          allQuestions={allQuestions}
          selectedAnswers={selectedAnswers}
          answerOptions={answerOptions}
          answerMapping={answerMapping}
          totalAnswered={totalAnswered}
          handleAnswerChange={handleAnswerChange}
          handleSubmit={handleSubmit}
          submitLoading={submitLoading}
          setCreateLevelThree={setCreateLevelThree}
        />
      )}
    </div>
  );
};

// Sub-components
const ResultsView = ({ results, getTraitFullName, getTraitDescription }) => {
  const dominantTraits = results?.dominantTraits || [];
  const scores = results?.scores || {};

  return (
    <div className="mt-4 sm:mt-8 p-4 sm:p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-xl sm:text-2xl font-bold text-center mb-4 sm:mb-6 text-gray-800">
        Your Holland Code:
        <span className="ml-2 px-2.5 py-1 bg-blue-600 text-white rounded-lg text-lg sm:text-2xl font-mono tracking-wider">
          {results?.hollandCode || "Unknown"}
        </span>
      </h3>

      {dominantTraits.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {dominantTraits.map((trait, index) => (
            <div
              key={`${trait}-${index}`}
              className={`p-3.5 sm:p-4 rounded-lg border-l-4 ${
                index === 0
                  ? "border-blue-500 bg-blue-50/70"
                  : index === 1
                    ? "border-purple-500 bg-purple-50/70"
                    : "border-green-500 bg-green-50/70"
              }`}
            >
              <h4 className="font-bold text-sm sm:text-base text-gray-900">
                {getTraitFullName(trait)} ({trait})
              </h4>
              <p className="text-xs text-gray-600 mt-1">
                {getTraitDescription(trait)}
              </p>
              <p className="mt-2 text-xs sm:text-sm font-semibold text-gray-800">
                Score: {scores[trait] || 0}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500 mb-6 text-sm">
          No dominant traits identified
        </div>
      )}

      <h4 className="font-bold text-sm sm:text-base text-gray-800 mb-2">Full Breakdown:</h4>
      <div className="flex flex-wrap gap-2">
        {Object.entries(scores).map(([trait, score]) => (
          <div key={trait} className="px-2.5 py-1.5 bg-gray-100 text-gray-700 text-xs sm:text-sm rounded-md font-medium">
            {getTraitFullName(trait)}: <span className="font-bold text-blue-600">{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const TestView = ({
  allQuestions,
  selectedAnswers,
  answerOptions,
  answerMapping,
  totalAnswered,
  handleAnswerChange,
  handleSubmit,
  submitLoading,
  setCreateLevelThree,
}) => (
  <>
    {/* How to Answer Card with full responsive 5-column grid */}
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-5 mb-5 w-full box-border">
      <h3 className="text-base sm:text-lg font-bold mb-1.5 text-center text-gray-900">
        How to Answer:
      </h3>
      <p className="text-xs sm:text-sm text-gray-600 mb-4 text-center">
        For each activity, select how much you would enjoy doing it:
      </p>

      {/* Responsive 5-column grid ensuring zero clipping on any mobile screen */}
      <div className="grid grid-cols-5 gap-1 sm:gap-3 max-w-lg mx-auto w-full">
        {answerOptions.map((option) => (
          <div key={option} className="flex flex-col items-center text-center min-w-0">
            <div className="w-8 h-8 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs sm:text-base shadow-sm shrink-0">
              {option}
            </div>
            <span className="text-[10px] sm:text-xs mt-1.5 font-medium text-gray-700 leading-tight block w-full break-words hyphens-auto px-0.5">
              {answerMapping[option]}
            </span>
          </div>
        ))}
      </div>
    </div>

    {/* Progress Bar */}
    <div className="bg-white rounded-lg p-3 shadow-xs border border-gray-100 mb-4">
      <div className="flex justify-between items-center text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
        <span>Assessment Progress</span>
        <span className="text-blue-600 font-bold">{totalAnswered} / {allQuestions.length}</span>
      </div>
      <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${allQuestions.length ? (totalAnswered / allQuestions.length) * 100 : 0}%` }}
        />
      </div>
    </div>

    {/* Question List */}
    <div className="space-y-3 sm:space-y-4">
      {allQuestions.map((question, idx) => (
        <div
          key={question._id || idx}
          className="bg-white rounded-xl shadow-xs p-3.5 sm:p-5 border border-gray-200 border-l-4 border-l-blue-500"
        >
          <div className="flex items-start gap-2 mb-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
              {idx + 1}
            </span>
            <h4 className="text-sm sm:text-base font-semibold text-gray-900 leading-snug">
              {question.question}
            </h4>
          </div>

          {/* 5-option selection grid */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-3 max-w-xs sm:max-w-md mx-auto sm:mx-0 mt-2">
            {answerOptions.map((option) => {
              const isSelected = selectedAnswers[question._id]?.response === answerMapping[option];
              return (
                <button
                  type="button"
                  key={option}
                  onClick={() => handleAnswerChange(question._id, option)}
                  className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full mx-auto flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-300 scale-105"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700 active:scale-95"
                  }`}
                  aria-label={`${option} - ${answerMapping[option]}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>

    {/* Action Buttons */}
    <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4 mt-6 sm:mt-8 pb-4">
      <button
        type="button"
        onClick={() => setCreateLevelThree(false)}
        className="w-full sm:w-auto px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium text-sm"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={totalAnswered !== allQuestions.length || submitLoading}
        className={`w-full sm:w-auto px-6 py-2.5 rounded-lg font-semibold min-w-[180px] transition text-sm shadow-sm ${
          totalAnswered !== allQuestions.length || submitLoading
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md cursor-pointer"
        }`}
      >
        {submitLoading ? (
          <div className="flex justify-center items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            <span>Submitting...</span>
          </div>
        ) : (
          `Submit Assessment (${totalAnswered}/${allQuestions.length})`
        )}
      </button>
    </div>
  </>
);

LevelThree.propTypes = {
  profileData: PropTypes.shape({
    _id: PropTypes.string,
  }),
  setCreateLevelThree: PropTypes.func.isRequired,
  handleProfileData: PropTypes.func,
};

export default LevelThree;
