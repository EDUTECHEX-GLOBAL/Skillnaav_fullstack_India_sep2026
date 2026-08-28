// src/pages/FeaturesPage.js
import React, { useEffect } from "react";
import Navbar from "../components/Navbar";
import Features from "../components/Features";
import Footer from "../components/Footer";
import { Helmet } from "react-helmet";
import { useDispatch, useSelector } from "react-redux";
import axios from "../api/axiosInstance";
import { SetSkillNaavData, HideLoading } from "../redux/rootSlice";

function FeaturesPage() {
  const dispatch = useDispatch();
  const { skillnaavData } = useSelector((state) => state.root);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("/api/skillnaav/get-skillnaav-data");
        dispatch(SetSkillNaavData(response.data));
      } catch (err) {
        console.error("Failed to load skillnaav data on FeaturesPage:", err);
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

  return (
    <>
     <Helmet>
  <title>Features - Skill Naav</title>

  <meta
    name="description"
    content="Explore Skill Naav features including smart internship discovery, AI-powered matching, instructor assignment, analytics, and schedule management."
  />

  <link rel="canonical" href="https://www.skillnaav.com/features" />
</Helmet>
      <Navbar />
      <div className="pt-20 px-[20px] lg:px-20 mx-auto">
  <p className="text-gray-600 mb-6">
    Explore Skill Naav features including personalized career pathways,
    internship matching systems, AI recommendations, analytics,
    and schedule management.
  </p>

  <Features />
</div>
      <Footer />
    </>
  );
}

export default FeaturesPage;