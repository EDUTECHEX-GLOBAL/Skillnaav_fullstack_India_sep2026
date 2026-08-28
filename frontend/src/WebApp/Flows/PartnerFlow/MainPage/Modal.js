import React from "react";
import PropTypes from "prop-types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faTimes } from "@fortawesome/free-solid-svg-icons";

const Modal = ({ isOpen, onClose, title, children, isLoading, preventBackdropClose = false }) => {
  if (!isOpen) return null;

  const handleBackdropClick = () => {
    // ✅ Never close during loading or active API call
    if (isLoading || preventBackdropClose) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Backdrop — swallows click but respects lock */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleBackdropClick}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-5xl w-full mx-4 max-h-[95vh] flex flex-col overflow-hidden">
        {/* Sticky header */}
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100 z-10 rounded-t-2xl">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-xs" /> Back
          </button>
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <FontAwesomeIcon icon={faTimes} className="text-xs" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto rounded-b-2xl">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500" />
              <p className="text-sm text-gray-400">Loading...</p>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
  isLoading: PropTypes.bool,
  preventBackdropClose: PropTypes.bool,
};

export default Modal;