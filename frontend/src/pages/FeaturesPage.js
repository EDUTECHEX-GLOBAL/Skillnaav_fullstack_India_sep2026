// src/pages/FeaturesPage.js
import React, { useEffect } from "react";
import Navbar from "../components/Navbar";
import Features from "../components/Features";
import Footer from "../components/Footer";
import { Helmet } from "react-helmet";
import { useDispatch, useSelector } from "react-redux";
import axios from "../api/axiosInstance";
import { SetEdutechexData, HideLoading } from "../redux/rootSlice";

function FeaturesPage() {
  const dispatch = useDispatch();
  const { edutechexData } = useSelector((state) => state.root);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("/api/edutechex/get-edutechex-data");
        dispatch(SetEdutechexData(response.data));
      } catch (err) {
        console.error("Failed to load edutechex data on FeaturesPage:", err);
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
    <>
     <Helmet>
  <title>Features - Edutechex</title>

  <meta
    name="description"
    content="Explore Edutechex features including smart internship discovery, AI-powered matching, instructor assignment, analytics, and schedule management."
  />

  <link rel="canonical" href="https://www.edutechex.com/features" />
</Helmet>
      <Navbar />
      <div className="pt-20 px-[20px] lg:px-20 mx-auto">
  <p className="text-gray-600 mb-6">
    Explore Edutechex features including personalized career pathways,
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
