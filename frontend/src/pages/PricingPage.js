// src/pages/PricingPage.js
import React, { useEffect } from "react";
import Navbar from "../components/Navbar";
import Pricing from "../components/Pricing";
import Footer from "../components/Footer";
import { Helmet } from "react-helmet";
import { useDispatch, useSelector } from "react-redux";
import axios from "../api/axiosInstance";
import { SetSkillNaavData, HideLoading } from "../redux/rootSlice";

function PricingPage() {
  const dispatch = useDispatch();
  const { skillnaavData } = useSelector((state) => state.root);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("/api/skillnaav/get-skillnaav-data");
        dispatch(SetSkillNaavData(response.data));
      } catch (err) {
        console.error("Failed to load skillnaav data on PricingPage:", err);
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
  <title>Pricing - Skill Naav</title>

  <meta
    name="description"
    content="Explore Skill Naav pricing plans for students, institutions, and partners. Compare affordable plans for internship discovery, career growth, and skill management."
  />

  <link rel="canonical" href="https://www.skillnaav.com/pricing" />
</Helmet>
      <Navbar />
      <div className="pt-20 px-[20px] lg:px-20 mx-auto">
  <p className="text-gray-600 mb-6">
    Compare Skill Naav pricing plans for students, institutions,
    and partners with flexible options for career growth,
    internship access, and platform tools.
  </p>

  <Pricing />
</div>
      <Footer />
    </>
  );
}

export default PricingPage;