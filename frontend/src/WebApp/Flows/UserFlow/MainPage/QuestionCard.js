import React from "react";

const QuestionCard = ({
  question,
  index,
  selectedAnswer,
  onSelect,
}) => {
  const difficultyMap = {
    1: "Easy",
    2: "Medium",
    3: "Hard",
  };

  return (
    <div className="mb-8 p-6 border rounded-xl bg-gray-50 shadow">

      {/* HEADER */}
      <div className="flex justify-between mb-3">
        <p className="font-bold">
          Q{index + 1}. {question.questionText}
        </p>

        {question.metadata && (
          <div className="flex gap-2 text-xs">
            <span className="bg-blue-100 px-2 rounded">
              🎯 {question.metadata.domain}
            </span>
            <span className="bg-yellow-100 px-2 rounded">
              ⚡ {difficultyMap[question.metadata.difficulty]}
            </span>
            <span className="bg-purple-100 px-2 rounded">
              📚 {question.metadata.bloomLevel}
            </span>
          </div>
        )}
      </div>

      {/* OPTIONS */}
      {question.options.map((opt, i) => (
        <label key={i} className="block p-2">
          <input
            type="radio"
            checked={selectedAnswer === i}
            onChange={() => onSelect(index, i)}
          />
          {opt}
        </label>
      ))}
    </div>
  );
};

export default QuestionCard;