// src/components/ConfirmCloseSchedule.jsx
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";

const ConfirmCloseSchedule = ({
    isOpen,
    onConfirm,
    onCancel,
    title = "Close Internship Schedule",
    message = "Are you sure that you want to close the current internship schedule?",
    confirmLabel = "Yes",
    cancelLabel = "No",
    hideConfirm = false,
    hideCancel = false,
    hideTitle = false,
    children = null,
    dialogClassName = "",
    confirmDisabled = false,
    disableCancel = false,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
            <div
                className={`relative flex max-h-[90vh] min-h-[200px] flex-col overflow-hidden rounded-lg bg-white text-center shadow-xl ${dialogClassName || "w-[500px] max-w-[92vw]"}`}
            >

                {/* 🔹 Cross button at top-right */}
                <button
                    onClick={onCancel}
                    disabled={disableCancel}
                    className="absolute right-3 top-3 text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <FontAwesomeIcon icon={faTimes} size="lg" />
                </button>

                <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-12">
                    {/* 🔹 Content (pushed down via pt on card) */}
                    {!hideTitle && (
                        <h2 className="mb-3 text-lg font-semibold leading-relaxed">
                            {title}
                        </h2>
                    )}
                    <p className="mb-6 text-base font-medium leading-relaxed text-gray-700">
                        {message}
                    </p>

                    {children}
                </div>

                {(!hideConfirm || !hideCancel) && (
                    <div className="flex justify-center gap-4 border-t border-gray-100 bg-white px-6 py-4">
                        {!hideConfirm && (
                            <button
                                className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={onConfirm}
                                disabled={confirmDisabled}
                            >
                                {confirmLabel}
                            </button>
                        )}
                        {!hideCancel && (
                            <button
                                className="rounded bg-gray-300 px-4 py-2 hover:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={onCancel}
                                disabled={disableCancel}
                            >
                                {cancelLabel}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConfirmCloseSchedule;
