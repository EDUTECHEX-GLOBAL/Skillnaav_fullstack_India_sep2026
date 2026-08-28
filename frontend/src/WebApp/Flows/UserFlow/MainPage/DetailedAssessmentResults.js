import React, { useState } from "react";
import QuestionReview from "./QuestionReview";

/**
 * DetailedAssessmentResults Component
 * 
 * Displays comprehensive assessment results including:
 * - Pass/Fail status with clear visual indicators
 * - Score breakdown (score, time, completion rate)
 * - Domain-wise performance analysis
 * - Violation detection alerts
 * - Timing analysis warnings
 * - Manual review flags
 * - Recommendations for improvement
 * - Full question review section
 */
const DetailedAssessmentResults = ({ 
  submission, 
  assessment,
  assessmentType 
}) => {
  const [expandedSection, setExpandedSection] = useState(null);
  
  const isShortlist = assessmentType === "MCQ_SINGLE_CORRECT";
  const evaluation = submission.evaluation || {};
  const passThreshold = assessment.configSnapshot?.passScore || 70;
  
  // Check if passed - use finalPass if available, otherwise fall back to pass
  const passed = evaluation.finalPass !== undefined ? evaluation.finalPass : evaluation.pass;
  const percentage = evaluation.mcqScore || 0;
  const needPercentage = Math.max(0, passThreshold - percentage);
  

  return (
    <div className="w-full max-w-4xl font-poppins">
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MAIN STATUS SECTION */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="mb-8">
        {passed ? (
          <div className="bg-green-50 border-2 border-green-400 rounded-xl p-8 shadow-md">
            <div className="flex items-center gap-4">
              <span className="text-6xl flex-shrink-0">✅</span>
              <div className="flex-1">
                <h2 className="text-4xl font-bold text-green-700 mb-2">
                  PASSED!
                </h2>
                <p className="text-green-600 text-lg">
                  You successfully passed the assessment with <span className="font-bold">{percentage}%</span>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-red-50 border-2 border-red-400 rounded-xl p-8 shadow-md">
            <div className="flex items-center gap-4">
              <span className="text-6xl flex-shrink-0">❌</span>
              <div className="flex-1">
                <h2 className="text-4xl font-bold text-red-700 mb-2">
                  NEEDS IMPROVEMENT
                </h2>
                <p className="text-red-600 text-lg">
                  You scored <span className="font-bold">{percentage}%</span>. You need <span className="font-bold">{needPercentage}%</span> more to pass.
                </p>
                <div className="mt-4 bg-white rounded-lg p-4 border border-red-200">
                  <p className="font-semibold text-gray-800">💡 Good news:</p>
                  <p className="text-gray-700">You can retake the assessment. Review the areas below and try again.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SCORE BREAKDOWN GRID */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200 shadow-sm">
          <p className="text-sm text-blue-600 font-semibold uppercase tracking-wide">Score</p>
          <p className="text-5xl font-bold text-blue-700 mt-3">
            {evaluation.mcqScore || 0}%
          </p>
          <p className="text-sm text-blue-600 mt-3 font-medium">
            {evaluation.correctCount || 0} / {evaluation.total || 0} correct
          </p>
        </div>
        
        <div className="bg-purple-50 rounded-xl p-6 border-2 border-purple-200 shadow-sm">
          <p className="text-sm text-purple-600 font-semibold uppercase tracking-wide">Time Taken</p>
          <p className="text-5xl font-bold text-purple-700 mt-3">
            {Math.floor((submission.timing?.totalElapsedMs || 0) / 60000)}m
          </p>
          <p className="text-sm text-purple-600 mt-3 font-medium">
            {Math.floor(((submission.timing?.totalElapsedMs || 0) % 60000) / 1000)}s
          </p>
        </div>
        
        <div className="bg-orange-50 rounded-xl p-6 border-2 border-orange-200 shadow-sm">
          <p className="text-sm text-orange-600 font-semibold uppercase tracking-wide">Completion</p>
          <p className="text-5xl font-bold text-orange-700 mt-3">
            {evaluation.completionRate || 100}%
          </p>
          <p className="text-sm text-orange-600 mt-3 font-medium">
            {evaluation.answeredCount || evaluation.total || 0} answered
          </p>
        </div>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* DOMAIN BREAKDOWN */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {isShortlist && evaluation.domainStats && Object.keys(evaluation.domainStats).length > 0 && (
        <div className="bg-white rounded-xl p-6 border-2 border-gray-200 mb-8 shadow-sm">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">
            📊 Performance by Domain
          </h3>
          <div className="space-y-5">
            {Object.entries(evaluation.domainStats).map(([domain, stats]) => {
              const domainPercentage = Math.round((stats.correct / stats.total) * 100);
              const isStrength = domainPercentage >= 70;
              
              return (
                <div key={domain} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-800 text-lg">
                      <span className="mr-2">{isStrength ? "✅" : "⚠️"}</span>
                      {domain}
                    </span>
                    <span className={`text-lg font-bold px-3 py-1 rounded-lg ${
                      isStrength 
                        ? "bg-green-100 text-green-700" 
                        : "bg-orange-100 text-orange-700"
                    }`}>
                      {stats.correct}/{stats.total}
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-4 rounded-full transition-all duration-500 ${
                          isStrength ? "bg-green-500" : "bg-orange-500"
                        }`}
                        style={{ width: `${Math.min(domainPercentage, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-700 min-w-12 text-right">
                      {domainPercentage}%
                    </span>
                  </div>
                  
                  {/* Status text */}
                  <p className="text-xs text-gray-600 mt-1">
                    {isStrength 
                      ? `Strong performance - Keep it up!`
                      : `Review these concepts - You can improve here`
                    }
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* VIOLATIONS SUMMARY */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {isShortlist && evaluation.violationAnalysis && (
        <div className={`rounded-xl p-6 border-2 mb-8 shadow-sm ${
          evaluation.violationAnalysis.count > 0 
            ? "bg-red-50 border-red-300"
            : "bg-green-50 border-green-300"
        }`}>
          <div className="flex items-start gap-4">
            <span className="text-3xl flex-shrink-0">
              {evaluation.violationAnalysis.count > 0 ? "⚠️" : "✅"}
            </span>
            <div className="flex-1">
              <h3 className={`text-lg font-bold mb-2 ${
                evaluation.violationAnalysis.count > 0 
                  ? "text-red-700"
                  : "text-green-700"
              }`}>
                {evaluation.violationAnalysis.count > 0 
                  ? "Violations Detected" 
                  : "No Violations"}
              </h3>
              <p className={evaluation.violationAnalysis.count > 0 ? "text-red-700" : "text-green-700"}>
                {evaluation.violationAnalysis.summary}
              </p>
              
              {evaluation.violationAnalysis.count > 0 && (
                <div className="mt-3 p-3 bg-white rounded border border-red-200">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Note:</span> This assessment may require manual review by the hiring team. Violations can affect your final status even if your score is high.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TIMING ANALYSIS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {isShortlist && evaluation.timingAnalysis?.suspicious && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 mb-8 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="text-3xl flex-shrink-0">⏱️</span>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-yellow-700 mb-2">
                Timing Alert
              </h3>
              <p className="text-yellow-700">
                {evaluation.timingAnalysis.reason}
              </p>
              <p className="text-sm text-yellow-600 mt-3">
                This may require manual review. Consider taking the assessment again with more time per question.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MANUAL REVIEW FLAG */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {isShortlist && evaluation.requiresManualReview && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6 mb-8 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="text-3xl flex-shrink-0">🔍</span>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-amber-700 mb-2">
                Manual Review Required
              </h3>
              <p className="text-amber-700 text-sm">
                Based on the violations and/or timing patterns detected, this assessment will be reviewed by our team for accuracy verification. You will be notified of the outcome.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* RECOMMENDATIONS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {isShortlist && evaluation.recommendations && evaluation.recommendations.length > 0 && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6 mb-8 shadow-sm">
          <h3 className="text-lg font-bold text-blue-700 mb-4 flex items-center gap-2">
            <span>📚</span> Next Steps
          </h3>
          <ul className="space-y-3">
            {evaluation.recommendations.map((rec, idx) => (
              <li key={idx} className="flex gap-3 text-blue-700 text-sm">
                <span className="font-bold text-blue-600 flex-shrink-0">→</span>
                <span className="pt-0.5">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* QUESTION REVIEW */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {isShortlist && evaluation.detailed && (
        <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-sm">
          <button
            onClick={() => setExpandedSection(
              expandedSection === 'questions' ? null : 'questions'
            )}
            className="w-full flex items-center justify-between mb-6 hover:opacity-80 transition"
          >
            <h3 className="text-2xl font-bold text-gray-800">
              📋 Question Review
            </h3>
            <span className={`text-2xl transition-transform ${
              expandedSection === 'questions' ? 'rotate-180' : ''
            }`}>
              ▼
            </span>
          </button>
          
          {expandedSection === 'questions' && (
            <QuestionReview 
              questions={assessment.questions}
              detailed={evaluation.detailed}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default DetailedAssessmentResults;