import React from "react";
import { useSelector } from "react-redux";
import VisionImage from "../assets/vesion.jpeg";
import { staticVisionData } from "../data/websiteContentData";

const Vision = () => {
  const { edutechexData } = useSelector((state) => state.root);

  const head = edutechexData?.visionhead?.[0] || staticVisionData;
  const points = edutechexData?.visionpoint?.length
    ? edutechexData.visionpoint
    : staticVisionData.visionpoints;

  return (
    <section
      id="vision"
      className="py-8 lg:py-16 bg-gray-100 my-16 text-gray-800 rounded-none overflow-hidden"
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Full image display: completely visible on all screen sizes, never sliced or cut off */}
          <div className="lg:col-span-6 xl:col-span-6 w-full min-w-0 flex justify-center items-center">
            <img
              src={VisionImage}
              alt="Our Vision"
              className="rounded-xl shadow-lg object-contain sm:object-cover w-full h-auto max-w-full block"
            />
          </div>

          <div className="lg:col-span-6 xl:col-span-6 w-full min-w-0 text-left">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 lg:mb-6 text-center">
              {head.visionheading || staticVisionData.visionheading}
            </h2>
            <p className="text-base sm:text-lg lg:text-xl font-medium mb-6 text-left leading-relaxed text-gray-800">
              {head.visionsub || staticVisionData.visionsub}
            </p>
            <ul className="list-disc text-base lg:text-lg pl-5 text-left space-y-3 text-gray-800">
              {points.map((point, index) => {
                const text = point.visionpoint;
                const colonIndex = text.indexOf(":");
                const hasLabel = colonIndex !== -1 && colonIndex < 35;
                return (
                  <li key={index} className="mb-3 font-normal text-left leading-relaxed">
                    {hasLabel ? (
                      <>
                        <span className="font-semibold text-gray-900">
                          {text.slice(0, colonIndex + 1)}
                        </span>
                        {text.slice(colonIndex + 1)}
                      </>
                    ) : (
                      text
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Vision;