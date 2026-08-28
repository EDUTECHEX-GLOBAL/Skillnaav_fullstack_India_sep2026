// OfferLetterCardpaid.js
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCalendarAlt,
    faMapMarkerAlt,
    faClock,
} from "@fortawesome/free-solid-svg-icons";

const OfferLetterCardpaid = ({
    show,
    onClose,
    renderSchedule,
    selectedLocation,
    setSelectedLocation,
    selectedSummary,
    setSelectedSummary,
    normalizeUrl,
}) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 sm:p-6">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl relative p-6 max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl"
                >
                    &times;
                </button>

                <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center">
                    <FontAwesomeIcon icon={faCalendarAlt} className="mr-2 text-indigo-500" />
                    Internship Schedule
                </h2>

                {/* Schedule Table */}
                {renderSchedule()}

                {/* LOCATION MODAL */}
                {selectedLocation && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                        <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md relative">
                            <button
                                onClick={() => setSelectedLocation(null)}
                                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl"
                            >
                                &times;
                            </button>

                            <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
                                <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-2 text-indigo-600" />
                                Location Details
                            </h3>

                            <div className="text-sm text-gray-700 space-y-6">
                                <p>
                                    <strong className="text-gray-700">Location Name:</strong>{" "}
                                    {selectedLocation.name || "—"}
                                </p>
                                <p>
                                    <strong className="text-gray-700">Address:</strong>{" "}
                                    {selectedLocation.address || "—"}
                                </p>
                                <p>
                                    <strong className="text-gray-700">Map Link:</strong>{" "}
                                    {selectedLocation.mapLink ? (
                                        <a
                                            href={normalizeUrl(selectedLocation.mapLink)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-indigo-600 hover:underline"
                                        >
                                            View on Map
                                        </a>
                                    ) : (
                                        "—"
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUMMARY MODAL */}
                {selectedSummary && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                        <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md relative">
                            <button
                                onClick={() => setSelectedSummary(null)}
                                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl"
                            >
                                &times;
                            </button>

                            <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
                                <FontAwesomeIcon icon={faClock} className="mr-2 text-indigo-600" />
                                Summary
                            </h3>

                            <div className="text-sm text-gray-700 space-y-6">
                                <p>
                                    <strong className="text-gray-700">Section Summary:</strong>{" "}
                                    {selectedSummary.sectionSummary || "—"}
                                </p>
                                <p>
                                    <strong className="text-gray-700">Instructor Name:</strong>{" "}
                                    {selectedSummary.instructor || "—"}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OfferLetterCardpaid;