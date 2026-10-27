import React from "react";
import edutechexlogo from "../assets/Edutech-logo.png";
import { useNavigate } from "react-router-dom";

const TryforFree = () => {
  const navigate = useNavigate();
  const handleOptionClick = (path) => {
    navigate(path);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        textAlign: "center",
        padding: "20px 16px",
        fontFamily: "'Poppins', sans-serif",
        backgroundColor: "#ffffff",
        color: "#333",
        boxSizing: "border-box",
      }}
    >
      {/* Revamp Edutechex Logo */}
      <img
        src={edutechexlogo}
        style={{
          width: "155px",
          maxWidth: "80%",
          height: "auto",
          marginBottom: "16px",
          objectFit: "contain",
        }}
        alt="Edutechex Logo"
      />

      <h1
        style={{
          marginBottom: "8px",
          fontWeight: "800",
          color: "#014438",
          fontSize: "2.1rem",
          letterSpacing: "-0.5px",
          lineHeight: 1.2,
        }}
      >
        Try for Free
      </h1>

      <h2
        style={{
          marginBottom: "22px",
          color: "#00796b",
          fontSize: "1.05rem",
          fontWeight: "500",
          lineHeight: 1.3,
        }}
      >
        Choose how you'd like to continue:
      </h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          maxWidth: "380px",
          width: "100%",
          margin: "0 auto",
        }}
      >
        <button
          style={buttonStyle("#744bd8")}
          onClick={() => handleOptionClick("/user")}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          Continue as Student
        </button>

        <button
          style={buttonStyle("#008e7b")}
          onClick={() => handleOptionClick("/partner")}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          Continue as Partner
        </button>

        <button
          style={buttonStyle("#70caf6")}
          onClick={() => handleOptionClick("/admin/login")}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          Continue as Admin
        </button>

        <button
          style={buttonStyle("#fa6738")}
          onClick={() => handleOptionClick("/schooladmin/login")}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          Continue as School Admin
        </button>
      </div>
    </div>
  );
};

// Common button style generator matching revamp choose-role exactly
const buttonStyle = (bgColor) => ({
  backgroundColor: bgColor,
  color: "#ffffff",
  border: "none",
  padding: "12px 20px",
  fontWeight: "600",
  borderRadius: "10px",
  cursor: "pointer",
  fontSize: "0.95rem",
  transition: "transform 0.15s ease, box-shadow 0.15s ease",
  boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
  outline: "none",
  width: "100%",
  letterSpacing: "0.2px",
});

export default TryforFree;
