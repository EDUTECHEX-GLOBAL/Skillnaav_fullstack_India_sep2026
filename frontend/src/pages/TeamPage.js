// src/pages/TeamPage.js
import React, { useEffect } from "react";
import Navbar from "../components/Navbar";
import Team from "../components/Team/Team";
import Footer from "../components/Footer";
import { Helmet } from "react-helmet";
import { useDispatch, useSelector } from "react-redux";
import axios from "../api/axiosInstance";
import { SetEdutechexData, HideLoading } from "../redux/rootSlice";

function TeamPage() {
  const dispatch = useDispatch();
  const { edutechexData } = useSelector((state) => state.root);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("/api/edutechex/get-edutechex-data");
        dispatch(SetEdutechexData(response.data));
      } catch (err) {
        console.error("Failed to load edutechex data on TeamPage:", err);
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
  <title>Our Team - Edutechex</title>

  <meta
    name="description"
    content="Meet the Edutechex team — innovators, researchers, developers, and creators building the future of internship discovery, career guidance, and skill development."
  />

  <link rel="canonical" href="https://www.edutechex.com/team" />
</Helmet>
      <Navbar />
      <div className="pt-20 px-[20px] lg:px-20 mx-auto">
        <Team />
      </div>
      <Footer />
    </>
  );
}

export default TeamPage;