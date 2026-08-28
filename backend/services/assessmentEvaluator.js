const crypto = require("crypto");

const ASSESSMENT_SALT = process.env.ASSESSMENT_SALT || "CHANGE-THIS-SECRET-SALT";

/**
 * Secure hash with salt (must match generator)
 */
function sha256WithSalt(input) {
  return crypto
    .createHash("sha256")
    .update(ASSESSMENT_SALT + String(input))
    .digest("hex");
}

/**
 * Analyze answer timing patterns for suspicious activity
 */
function analyzeTimingPatterns(timingPattern) {
  if (!Array.isArray(timingPattern) || timingPattern.length === 0) {
    return { suspicious: false, reason: null };
  }

  const times = timingPattern.map(t => t.timeSpentSeconds).filter(t => t > 0);
  
  if (times.length === 0) {
    return { suspicious: false, reason: null };
  }

  // Check for impossibly fast answers (< 3 seconds on average)
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  if (avgTime < 3) {
    return { suspicious: true, reason: `Abnormally fast (avg ${avgTime.toFixed(1)}s)` };
  }

  // Check for uniform timing (bot-like behavior)
  const variance = times.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev < 1 && times.length > 5) {
    return { suspicious: true, reason: "Suspiciously uniform timing pattern" };
  }

  return { suspicious: false, reason: null };
}

/**
 * ✨ NEW: Calculate violation severity for pass/fail decision
 * This determines if violations are serious enough to affect the assessment outcome
 */
function calculateViolationSeverity(activities = []) {
  let severity = 0;
  
  if (!Array.isArray(activities)) {
    return 0;
  }
  
  // Tab switches = +1 each (capped at 3)
  const tabSwitches = activities.filter(a => a.type === 'tab_switch').length || 0;
  severity += Math.min(tabSwitches, 3);
  
  // Copy/Paste = +2 (serious cheating)
  const copyPaste = activities.filter(a => a.type === 'copy_paste').length || 0;
  severity += copyPaste * 2;
  
  // DevTools = +0.5 (minor concern, capped at 1)
  const devtools = activities.filter(a => a.type === 'devtools_open').length || 0;
  severity += Math.min(devtools * 0.5, 1);
  
  // Window blur = +0.5 (minor concern, capped at 1)
  const windowBlur = activities.filter(a => a.type === 'window_blur').length || 0;
  severity += Math.min(windowBlur * 0.5, 1);
  
  return severity;
}

/**
 * ✨ NEW: Build human-readable violation summary
 * Creates a friendly description of what violations were detected
 */
function buildViolationSummary(activities = []) {
  if (!activities || !Array.isArray(activities) || activities.length === 0) {
    return "No violations detected";
  }
  
  const summary = [];
  const types = new Set(activities.map(a => a.type));
  
  if (types.has('tab_switch')) {
    const count = activities.filter(a => a.type === 'tab_switch').length;
    summary.push(`${count} tab switch${count > 1 ? 'es' : ''}`);
  }
  
  if (types.has('copy_paste')) {
    const count = activities.filter(a => a.type === 'copy_paste').length;
    summary.push(`copy/paste attempt${count > 1 ? 's' : ''}`);
  }
  
  if (types.has('devtools_open')) {
    const count = activities.filter(a => a.type === 'devtools_open').length;
    summary.push(`dev tools detected`);
  }

  if (types.has('window_blur')) {
    const count = activities.filter(a => a.type === 'window_blur').length;
    summary.push(`${count} window blur${count > 1 ? 's' : ''}`);
  }

  if (types.has('right_click') || types.has('context_menu')) {
    summary.push('right-click attempts');
  }

  if (types.has('fullscreen_exit')) {
    summary.push('fullscreen exit');
  }
  
  return summary.length > 0 ? summary.join(", ") : "No violations detected";
}

/**
 * Enhanced MCQ grading with detailed feedback and violation impact
 */
function gradeMcq({ questions, answers, passScore = 70, timingPattern = null, violations = [] }) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("Questions array is required and cannot be empty");
  }

  const byQid = new Map();
  for (const q of questions) {
    byQid.set(q.questionId, q);
  }

  let correct = 0;
  const total = questions.length;
  const detailed = [];
  const seen = new Set();

  // Grade each answer
  for (const a of answers || []) {
    if (!a || !a.questionId || (typeof a.selectedIndex !== "number" && !a.voiceAnswer)) {
      continue;
    }

    // Prevent duplicate submissions for same question
    if (seen.has(a.questionId)) {
      continue;
    }
    seen.add(a.questionId);

    const q = byQid.get(a.questionId);
    if (!q) {
      // Question not found - possible tampering
      detailed.push({
        questionId: a.questionId,
        isCorrect: false,
        reason: "Question not found"
      });
      continue;
    }

    // Validate selected index range
    if (typeof a.selectedIndex === "number" && (a.selectedIndex < 0 || a.selectedIndex >= q.options.length)) {
      detailed.push({
        questionId: a.questionId,
        isCorrect: false,
        reason: "Invalid option index"
      });
      continue;
    }

    // Check if answer is correct using secure hash (or if it's a voice answer, mark for manual review)
    let isCorrect = false;
    if (a.voiceAnswer) {
      // Find the correct option text
      let correctOptionText = "";
      if (Array.isArray(q.options)) {
        for (let i = 0; i < q.options.length; i++) {
          if (sha256WithSalt(i) === q.correctIndexHash) {
            correctOptionText = q.options[i];
            break;
          }
        }
      }

      // Basic semantic keyword overlap check for voice answers
      const cleanAnswer = a.voiceAnswer.toLowerCase().replace(/[^\w\s]/g, "");
      const cleanCorrect = correctOptionText.toLowerCase().replace(/[^\w\s]/g, "");
      const answerWords = new Set(cleanAnswer.split(/\s+/).filter(w => w.length > 2));
      const correctWords = new Set(cleanCorrect.split(/\s+/).filter(w => w.length > 2));
      
      let matchCount = 0;
      for (const word of answerWords) {
        if (correctWords.has(word)) matchCount++;
      }
      
      const threshold = Math.max(1, Math.floor(correctWords.size * 0.2));
      isCorrect = answerWords.size > 0 && matchCount >= threshold;
    } else {
      isCorrect = sha256WithSalt(Number(a.selectedIndex)) === q.correctIndexHash;
    }

    if (isCorrect) {
      correct += 1;
    }

    detailed.push({
      questionId: a.questionId,
      selectedIndex: a.selectedIndex,
      isCorrect,
      domain: q.metadata?.domain,
      difficulty: q.metadata?.difficulty,
      bloomLevel: q.metadata?.bloomLevel
    });
  }

  // Calculate unanswered questions
  const answeredCount = seen.size;
  const unansweredCount = total - answeredCount;

  // Calculate score
  const mcqScore = total > 0 ? Math.round((correct / total) * 100) : 0;
  const pass = mcqScore >= passScore;

  // Analyze timing if provided
  let timingAnalysis = null;
  if (timingPattern) {
    timingAnalysis = analyzeTimingPatterns(timingPattern);
  }

  // Generate domain-specific breakdown
  const domainStats = {};
  detailed.forEach(d => {
    const domain = d.domain || "general";
    if (!domainStats[domain]) {
      domainStats[domain] = { correct: 0, total: 0 };
    }
    domainStats[domain].total += 1;
    if (d.isCorrect) {
      domainStats[domain].correct += 1;
    }
  });

  // ✨ NEW: Calculate violation severity
  const violationSeverity = calculateViolationSeverity(violations);
  const timingSuspicious = timingAnalysis?.suspicious || false;
  
  // ✨ NEW: Final pass decision includes violations and timing
  // Pass only if: score is high enough AND violations aren't too serious AND timing isn't suspicious
  const finalPass = pass && (violationSeverity < 2) && !timingSuspicious;

  // ✨ NEW: Generate recommendations based on performance
  const recommendations = generateRecommendations(mcqScore, passScore, domainStats, violations.length);

  return {
    mcqScore,
    correctCount: correct,
    incorrectCount: answeredCount - correct,
    unansweredCount,
    total,
    pass,
    finalPass, // ✨ NEW: Pass decision that includes violations and timing
    detailed,
    domainStats,
    timingAnalysis,
    completionRate: Math.round((answeredCount / total) * 100),
    answeredCount,
    // ✨ NEW: Violation analysis
    violationAnalysis: {
      severity: violationSeverity,
      count: violations?.length || 0,
      summary: buildViolationSummary(violations)
    },
    // ✨ NEW: Flag for manual review if suspicious
    requiresManualReview: timingSuspicious || violationSeverity >= 1,
    recommendations
  };
}

/**
 * ✨ NEW: Generate recommendations based on performance and violations
 */
function generateRecommendations(mcqScore, passScore, domainStats, violationCount) {
  const recommendations = [];

  // If failed
  if (mcqScore < passScore) {
    recommendations.push(`You need ${passScore - mcqScore}% more to pass. Review weak areas below.`);
    
    // Find weak domains
    const weakDomains = Object.entries(domainStats)
      .filter(([_, stats]) => (stats.correct / stats.total) < 0.6)
      .map(([domain, stats]) => {
        const percentage = Math.round((stats.correct / stats.total) * 100);
        return `${domain} (${percentage}%)`;
      });
    
    if (weakDomains.length > 0) {
      recommendations.push(`Focus on: ${weakDomains.join(", ")}`);
    }
  }

  // If passed but had violations
  if (mcqScore >= passScore && violationCount > 0) {
    recommendations.push("You passed, but violations were detected. Minimize distractions on your next attempt.");
  }

  // If passed cleanly
  if (mcqScore >= passScore && violationCount === 0) {
    recommendations.push("Excellent work! You passed the assessment without violations.");
  }

  return recommendations;
}

/**
 * Generate human-readable feedback
 */
function generateFeedback({ mcqScore, correctCount, total, domainStats, pass, passScore }) {
  const feedback = [];

  // Overall result
  if (pass) {
    feedback.push(`✅ Congratulations! You passed with ${mcqScore}% (${correctCount}/${total} correct).`);
  } else {
    feedback.push(`You scored ${mcqScore}% (${correctCount}/${total} correct). Pass score is ${passScore}%.`);
  }

  // Domain breakdown
  if (Object.keys(domainStats).length > 1) {
    feedback.push("\n**Performance by domain:**");
    Object.entries(domainStats).forEach(([domain, stats]) => {
      const domainScore = Math.round((stats.correct / stats.total) * 100);
      const status = domainScore >= 70 ? "✅" : "⚠️";
      feedback.push(`${status} ${domain}: ${stats.correct}/${stats.total} (${domainScore}%)`);
    });
  }

  // Suggestions
  if (!pass) {
    const weakDomains = Object.entries(domainStats)
      .filter(([_, stats]) => stats.correct / stats.total < 0.6)
      .map(([domain]) => domain);

    if (weakDomains.length > 0) {
      feedback.push(`\n**Areas to improve:** ${weakDomains.join(", ")}`);
    }
  }

  return feedback.join("\n");
}

module.exports = { 
  gradeMcq, 
  sha256WithSalt,
  generateFeedback,
  analyzeTimingPatterns,
  calculateViolationSeverity, // ✨ NEW
  buildViolationSummary,       // ✨ NEW
  generateRecommendations      // ✨ NEW
};