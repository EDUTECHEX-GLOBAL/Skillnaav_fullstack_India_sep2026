import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { Carousel } from "antd";
import HeroImage from "../assets/app_mockup.png";
import BlueArrow from "../assets/blue-button.svg";
import Google from "../assets/Google.svg";
import Slack from "../assets/Slack.svg";
import Trustpilot from "../assets/Trustpilot.svg";
import Cnn from "../assets/CNN.svg";
import Clutch from "../assets/Clutch.svg";
import { useSelector } from "react-redux";


const Gradient = "/Gradient.webp";

const Discover = () => {
  const { skillnaavData } = useSelector((state) => state.root);

  const handleButtonClick = () => {
    window.open("/choose-role", "_blank");
  };

  // Add this useEffect at the top of the Discover component
useEffect(() => {
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = "/Gradient.webp";
  link.type = "image/webp";
  link.setAttribute("fetchpriority", "high");
  document.head.appendChild(link);
  return () => document.head.removeChild(link);
}, []);
  // ✅ Extract data — will be null/undefined until API loads
  const discover = skillnaavData?.discover?.[0];
  const discovercompimg = skillnaavData?.discovercompimg || [];
  const {
    discoverheading,
    discoversubheading,
    tryforfreebtn,
    viewpricebtn,
    imgUrl,
  } = discover || {};

  const renderCompanyImages = () => {
    const companies = discovercompimg.length
      ? discovercompimg.slice(0, 5)
      : [
          { src: Google, alt: "Google" },
          { src: Slack, alt: "Slack" },
          { src: Trustpilot, alt: "Trustpilot" },
          { src: Cnn, alt: "CNN" },
          { src: Clutch, alt: "Clutch" },
        ];

    return (
      <Carousel autoplay dots={false}>
        {companies.map((company, index) => (
          <div key={index}>
            <img
              src={company.imageUrl || company.src}
              alt={company.alt || `company ${index + 1}`}
              className="w-24 h-24 object-contain mx-auto"
            />
          </div>
        ))}
      </Carousel>
    );
  };

  return (
    <div id="discover" className="pt-20 lg:pt-24">
      <div className="px-6 sm:px-10 lg:px-20 xl:px-32 text-center">

        {/* ✅ Skeleton shown while API loads, real content after */}
        {!discover ? (
          <div className="animate-pulse">
            <div className="h-10 bg-gray-200 rounded w-3/4 mx-auto mb-4" />
            <div className="h-5 bg-gray-200 rounded w-1/2 mx-auto mb-6" />
            <div className="flex justify-center gap-4">
              <div className="h-12 bg-blue-200 rounded w-32" />
              <div className="h-12 bg-gray-200 rounded w-32 border" />
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="text-3xl sm:text-4xl font-medium text-gray-900 lg:text-5xl xl:text-6xl lg:leading-snug">
              {discoverheading}
            </h1>
            <p className="pt-4 sm:pt-6 text-base sm:text-lg text-gray-700 lg:text-lg xl:text-xl lg:leading-7">
              {discoversubheading}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-6 sm:pt-8">
              <button
                className="bg-blue-600 text-white w-full sm:w-auto px-4 sm:px-8 py-2 sm:py-4 rounded-md hover:bg-blue-700 transition duration-200 cursor-pointer"
                onClick={handleButtonClick}
              >
                {tryforfreebtn}
              </button>
              <button className="text-blue-600 font-medium flex items-center justify-center gap-2 w-full sm:w-auto px-4 sm:px-8 py-2 sm:py-4 rounded-md border border-blue-600 hover:bg-blue-100 transition duration-200">
                <a href="#pricing">{viewpricebtn}</a>
                <span>
                  <img src={BlueArrow} alt="Learn More" />
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ✅ Gradient renders IMMEDIATELY — no longer blocked by API */}
      <div className="relative flex flex-col items-center w-full mt-6 sm:mt-8">
        <div className="w-full relative h-[400px] sm:h-[500px] lg:h-[600px] xl:h-[700px] overflow-hidden">

          {/* Gradient loads instantly — not waiting for API */}
          <img
            src={Gradient}
            alt=""
            fetchpriority="high"
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Hero Image — shows placeholder until imgUrl loads */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={imgUrl || HeroImage}
              alt="Hero"
              className="max-h-[200px] sm:max-h-[300px] lg:max-h-[400px] xl:max-h-[500px] object-contain"
            />
          </div>

         {/* Companies */}
<div className="absolute bottom-2 sm:bottom-4 lg:bottom-6 w-full flex flex-col items-center">
  <div className="w-full px-4 sm:px-0 lg:px-20 xl:px-32 text-center text-white">
    <p className="text-base sm:text-lg lg:text-lg xl:text-xl mb-2 hidden sm:block">
      Navigate to the Best Companies
    </p>
    {renderCompanyImages()}
  </div>
</div>

        </div>
      </div>
    </div>
  );
};

export default Discover;