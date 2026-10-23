import React from "react";
import { useSelector } from "react-redux";
import Check from "../assets/check.svg";
import Aerospace from "../assets/aerospace.jpg";
import BlueButton from "../assets/blue-button.svg";
import PinkButton from "../assets/pink-button.svg";
import GreenButton from "../assets/green-button.svg";
import PersonalizedCareerImg from "../assets/wmremove-transformed (14).jpeg";
import InternshipMatchingImg from "../assets/WhatsApp Image 2026-10-16 at 10.22.55 AM.jpeg";
import { staticFeaturesData } from "../data/websiteContentData";

const buttonImages = {
  blue: BlueButton,
  pink: PinkButton,
  green: GreenButton,
};

const Features = () => {
  const { edutechexData } = useSelector((state) => state.root);

  const rawFeatures =
    edutechexData?.features?.length > 0
      ? edutechexData.features
      : staticFeaturesData;

  const featuresData = rawFeatures.map((feature, index) => {
    const buttonColor =
      index === 0
        ? "text-blue-600"
        : index === 1
        ? "text-pink-600"
        : "text-green-600";
    const buttonImg =
      index === 0
        ? buttonImages.blue
        : index === 1
        ? buttonImages.pink
        : buttonImages.green;
    let featureImg;
    if (index === 0 || feature.feature === "Personalized Career Pathways") {
      featureImg = PersonalizedCareerImg;
    } else if (index === 1 || feature.feature === "Internship Matching System") {
      featureImg = InternshipMatchingImg;
    } else {
      featureImg = feature.featureImg || Aerospace;
    }

    return {
      ...feature,
      buttonColor,
      buttonImg,
      featureImg,
    };
  });

  return (
    <div
      id="features"
      className="flex flex-col gap-y-8 py-8 lg:py-16 lg:gap-y-12"
    >
      {featuresData.map((feature, index) => (
        <div
          key={index}
          className={`flex flex-col gap-x-6 ${
            index % 2 === 0 ? "sm:flex-row" : "sm:flex-row-reverse"
          }`}
        >
          <div className="relative w-full sm:w-1/2 lg:px-12">
            <img
              src={feature.featureImg}
              alt={`Feature ${index + 1}`}
              className="w-full object-cover rounded-xl shadow-md"
            />
          </div>
          <div className="sm:w-1/2 lg:py-8 lg:px-12">
            <h3 className={`font-medium ${feature.buttonColor} lg:text-lg`}>
              {feature.feature}
            </h3>
            <h1 className="pt-4 text-2xl font-medium text-gray-900 lg:text-4xl lg:leading-none">
              {feature.featuredesc}
            </h1>
            <p className="pt-6 text-gray-700 lg:text-lg lg:leading-7">
              {feature.subfeature}
            </p>
            <ul className="flex flex-col gap-3 pt-4">
              {[
                feature.point1,
                feature.point2,
                feature.point3,
                feature.point4,
              ]
                .filter(Boolean)
                .map((point, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 text-gray-700 lg:text-lg"
                  >
                    <span>
                      <img src={Check} alt="Check" />
                    </span>
                    {point}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Features;
