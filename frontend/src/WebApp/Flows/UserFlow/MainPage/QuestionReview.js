import React, { useState } from "react";

/**
 * QuestionReview Component
 * 
 * Displays an expandable list of all assessment questions with:
 * - Correct/wrong indicators
 * - Student's answer vs correct answer
 * - Explanations for each question
 * - Question metadata (domain, difficulty, bloom level)
 * - Progress tracking
 */
const QuestionReview = ({ questions, detailed }) => {
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [expandAll, setExpandAll] = useState(false);
  
  if (!detailed || detailed.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">No questions to review</p>
      </div>
    );
  }

  const correctCount = detailed.filter(d => d.isCorrect).length;
  const totalQuestions = detailed.length;

  return (
    <div className="space-y-4">
      {/* Header with expand/collapse all */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-gray-200">
        <div className="flex items-center gap-3">
          <h4 className="font-semibold text-gray-800">
            {correctCount}/{totalQuestions} Correct
          </h4>
          <div className="w-32 bg-gray-300 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${(correctCount / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
        
        <button
          onClick={() => setExpandAll(!expandAll)}
          className="px-4 py-2 text-sm font-semibold bg-gray-100 hover:bg-gray-200 rounded-lg transition"
        >
          {expandAll ? "Collapse All" : "Expand All"}
        </button>
      </div>

      {/* Questions list */}
      <div className="space-y-3">
        {detailed.map((detail, idx) => {
          const question = questions?.find(q => q.questionId === detail.questionId);
          if (!question) return null;
          
          const isCorrect = detail.isCorrect;
          const isExpanded = expandAll || expandedQuestion === idx;
          const questionNumber = idx + 1;
          
          return (
            <div 
              key={idx}
              className={`rounded-lg border-2 overflow-hidden transition-all ${
                isCorrect 
                  ? "border-green-300 bg-green-50"
                  : "border-red-300 bg-red-50"
              }`}
            >
              {/* Question Header - Always Visible */}
              <button
                onClick={() => setExpandedQuestion(
                  isExpanded && !expandAll ? null : idx
                )}
                className="w-full p-4 flex justify-between items-center hover:opacity-85 transition text-left"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl flex-shrink-0">
                    {isCorrect ? "✅" : "❌"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">
                      Question {questionNumber} of {detailed.length}
                    </p>
                    <p className={`text-sm line-clamp-2 font-medium ${
                      isCorrect ? "text-green-700" : "text-red-700"
                    }`}>
                      {question.question}
                    </p>
                  </div>
                </div>
                <span className={`text-xl flex-shrink-0 transition-transform ml-2 ${
                  isExpanded ? "rotate-180" : ""
                }`}>
                  ▼
                </span>
              </button>
              
              {/* Question Details - Expandable */}
              {isExpanded && (
                <div className="p-4 border-t-2 bg-white border-t-gray-200">
                  {/* Full Question Text */}
                  <p className="font-semibold text-gray-900 mb-4 text-base leading-relaxed">
                    {question.question}
                  </p>
                  
                  {/* Options with Correct/Wrong Indicators */}
                  <div className="mb-6 space-y-2">
                    <p className="text-sm font-semibold text-gray-700 mb-3">
                      Answer Options:
                    </p>
                    {question.options && question.options.map((opt, j) => {
                      const isSelected = detail.selectedIndex === j;
                      const isCorrectAnswer = isCorrect && isSelected;
                      const isWrongSelected = !isCorrect && isSelected;
                      
                      return (
                        <div
                          key={j}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            isCorrectAnswer
                              ? "border-green-500 bg-green-100"
                              : isWrongSelected
                              ? "border-red-500 bg-red-100"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="font-bold text-sm text-gray-700 mt-0.5 flex-shrink-0">
                              {String.fromCharCode(65 + j)})
                            </span>
                            <div className="flex-1">
                              <p className="font-medium text-gray-800 text-sm break-words">
                                {opt}
                              </p>
                              
                              {/* Indicators */}
                              <div className="flex gap-2 mt-2 flex-wrap">
                                {isCorrectAnswer && (
                                  <span className="text-xs text-green-700 font-semibold bg-green-200 px-2 py-1 rounded">
                                    ✓ Correct answer (Your answer)
                                  </span>
                                )}
                                {isWrongSelected && (
                                  <span className="text-xs text-red-700 font-semibold bg-red-200 px-2 py-1 rounded">
                                    ✗ Your answer
                                  </span>
                                )}
                                {!isSelected && isCorrect && (
                                  <span className="text-xs text-green-700 font-semibold bg-green-200 px-2 py-1 rounded">
                                    ✓ Correct answer
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Explanation */}
                  {question.explanation && (
                    <div className="p-4 bg-blue-50 rounded-lg mb-4 border border-blue-200">
                      <p className="text-sm font-semibold text-blue-900 mb-2">
                        📖 Explanation
                      </p>
                      <p className="text-sm text-blue-800 leading-relaxed">
                        {question.explanation}
                      </p>
                    </div>
                  )}
                  
                  {/* Metadata */}
                  {question.metadata && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {question.metadata.domain && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                          🎯 {question.metadata.domain}
                        </span>
                      )}
                      {question.metadata.bloomLevel && (
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                          📚 {capitalizeFirst(question.metadata.bloomLevel)}
                        </span>
                      )}
                      {question.metadata.difficulty && (
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          getDifficultyColor(question.metadata.difficulty)
                        }`}>
                          ⚡ {getDifficultyLabel(question.metadata.difficulty)}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Learning tip */}
                  {!isCorrect && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-xs text-yellow-800">
                        <span className="font-semibold">💡 Tip:</span> Review the explanation above to understand this concept better.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Summary Footer */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">Summary:</span> You answered {correctCount} out of {totalQuestions} questions correctly ({Math.round((correctCount / totalQuestions) * 100)}%). 
          {correctCount === totalQuestions 
            ? " Perfect score!" 
            : ` Review the ${totalQuestions - correctCount} incorrect answer${totalQuestions - correctCount > 1 ? 's' : ''} above to improve.`
          }
        </p>
      </div>
    </div>
  );
};

/**
 * Helper to capitalize first letter
 */
function capitalizeFirst(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Helper to get difficulty color and styling
 */
function getDifficultyColor(difficulty) {
  switch (difficulty) {
    case 1:
      return "bg-green-100 text-green-700";
    case 2:
      return "bg-yellow-100 text-yellow-700";
    case 3:
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

/**
 * Helper to get difficulty label
 */
function getDifficultyLabel(difficulty) {
  switch (difficulty) {
    case 1:
      return "Easy";
    case 2:
      return "Medium";
    case 3:
      return "Hard";
    default:
      return "Medium";
  }
}

export default QuestionReview;