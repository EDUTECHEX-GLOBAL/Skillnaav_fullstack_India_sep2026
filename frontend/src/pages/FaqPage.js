import React, { useEffect } from "react";
import Navbar from "../components/Navbar";
import Faqs from "../components/Faq";
import Footer from "../components/Footer";
import { Helmet } from "react-helmet";
import { useDispatch, useSelector } from "react-redux";
import axios from "../api/axiosInstance";
import { SetSkillNaavData, HideLoading } from "../redux/rootSlice";

function FaqPage() {
  const dispatch = useDispatch();
  const { skillnaavData } = useSelector((state) => state.root);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("/api/skillnaav/get-skillnaav-data");
        dispatch(SetSkillNaavData(response.data));
      } catch (err) {
        console.error("Failed to load skillnaav data on FaqPage:", err);
      } finally {
        dispatch(HideLoading());
      }
    };

    if (!skillnaavData || Object.keys(skillnaavData).length === 0) {
      fetchData();
    } else {
      dispatch(HideLoading());
    }
  }, [skillnaavData, dispatch]);

  const faqSchema =
    skillnaavData?.faqcard?.map((item) => ({
      "@type": "Question",
      name: item.faq,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })) || [];

  return (
    <>
      <Helmet>
        <title>FAQs - Skill Naav</title>

        <meta
          name="description"
          content="Find answers to frequently asked questions about Skill Naav including internships, pricing, onboarding, support, and platform usage."
        />

        <link rel="canonical" href="https://www.skillnaav.com/faqs" />

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqSchema,
          })}
        </script>
      </Helmet>

      <Navbar />

      <div className="pt-20 px-[20px] lg:px-20 mx-auto">
        <p className="text-gray-600 mb-6">
          Find answers about Skill Naav internships, platform usage,
          pricing, onboarding, partnerships, and support.
        </p>

        <Faqs />
      </div>

      <Footer />
    </>
  );
}

export default FaqPage;