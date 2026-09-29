// src/pages/VisionPage.js
import React, { useEffect } from "react";
import { Helmet } from "react-helmet";
import Navbar from "../components/Navbar";
import Vision from "../components/Vision";
import Footer from "../components/Footer";
import { useDispatch, useSelector } from "react-redux";
import axios from "../api/axiosInstance";
import { SetSkillNaavData, HideLoading } from "../redux/rootSlice";

const VisionPage = () => {
  const dispatch = useDispatch();
  const { skillnaavData } = useSelector((state) => state.root);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("/api/skillnaav/get-skillnaav-data");
        dispatch(SetSkillNaavData(response.data));
      } catch (err) {
        console.error("Failed to load skillnaav data on VisionPage:", err);
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
    <div className="font-inter">
      <Helmet>
        <title>Our Vision - Skill Naav</title>

        <meta
          name="description"
          content="Discover the vision and mission of Skill Naav — empowering students, institutions, partners, and admins through internships, learning opportunities, and AI-driven solutions."
        />

        <link rel="canonical" href="https://www.skillnaav.com/vision" />
      </Helmet>

      <Navbar />

      <div className="pt-20 px-[20px] lg:px-20 mx-auto">
        <p className="text-gray-600 mb-6">
          Learn about the Skill Naav vision to transform career growth,
          internships, and skill development through technology.
        </p>

        <Vision />
      </div>

      <Footer />
    </div>
  );
};

export default VisionPage;