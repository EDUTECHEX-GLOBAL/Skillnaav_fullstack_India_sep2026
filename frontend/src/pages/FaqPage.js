import React, { useEffect } from "react";
import Navbar from "../components/Navbar";
import Faqs from "../components/Faq";
import Footer from "../components/Footer";
import { Helmet } from "react-helmet";
import { useDispatch, useSelector } from "react-redux";
import axios from "../api/axiosInstance";
import { SetEdutechexData, HideLoading } from "../redux/rootSlice";

function FaqPage() {
  const dispatch = useDispatch();
  const { edutechexData } = useSelector((state) => state.root);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("/api/edutechex/get-edutechex-data");
        dispatch(SetEdutechexData(response.data));
      } catch (err) {
        console.error("Failed to load edutechex data on FaqPage:", err);
      } finally {
        dispatch(HideLoading());
      }
    };

    if (!edutechexData || Object.keys(edutechexData).length === 0) {
      fetchData();
    } else {
      dispatch(HideLoading());
    }
  }, [edutechexData, dispatch]);

  const faqSchema =
    edutechexData?.faqcard?.map((item) => ({
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
        <title>FAQs - Edutechex</title>

        <meta
          name="description"
          content="Find answers to frequently asked questions about Edutechex including internships, pricing, onboarding, support, and platform usage."
        />

        <link rel="canonical" href="https://www.edutechex.com/faqs" />

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
          Find answers about Edutechex internships, platform usage,
          pricing, onboarding, partnerships, and support.
        </p>

        <Faqs />
      </div>

      <Footer />
    </>
  );
}

export default FaqPage;