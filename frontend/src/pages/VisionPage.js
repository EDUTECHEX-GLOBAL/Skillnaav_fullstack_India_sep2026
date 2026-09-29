// src/pages/VisionPage.js
import React, { useEffect } from "react";
import { Helmet } from "react-helmet";
import Navbar from "../components/Navbar";
import Vision from "../components/Vision";
import Footer from "../components/Footer";
import { useDispatch, useSelector } from "react-redux";
import axios from "../api/axiosInstance";
import { SetEdutechexData, HideLoading } from "../redux/rootSlice";

const VisionPage = () => {
  const dispatch = useDispatch();
  const { edutechexData } = useSelector((state) => state.root);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("/api/edutechex/get-edutechex-data");
        dispatch(SetEdutechexData(response.data));
      } catch (err) {
        console.error("Failed to load edutechex data on VisionPage:", err);
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

  return (
    <div className="font-inter">
      <Helmet>
        <title>Our Vision - Edutechex</title>

        <meta
          name="description"
          content="Discover the vision and mission of Edutechex — empowering students, institutions, partners, and admins through internships, learning opportunities, and AI-driven solutions."
        />

        <link rel="canonical" href="https://www.edutechex.com/vision" />
      </Helmet>

      <Navbar />

      <div className="pt-20 px-[20px] lg:px-20 mx-auto">
        <p className="text-gray-600 mb-6">
          Learn about the Edutechex vision to transform career growth,
          internships, and skill development through technology.
        </p>

        <Vision />
      </div>

      <Footer />
    </div>
  );
};

export default VisionPage;