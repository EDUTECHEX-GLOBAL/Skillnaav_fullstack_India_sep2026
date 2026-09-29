// src/pages/ContactPage.js
import React, { useEffect } from "react";
import Navbar from "../components/Navbar";
import Contact from "../components/Contact";
import Footer from "../components/Footer";
import { Helmet } from "react-helmet";
import { useDispatch, useSelector } from "react-redux";
import axios from "../api/axiosInstance";
import { SetSkillNaavData, HideLoading } from "../redux/rootSlice";

function ContactPage() {
  const dispatch = useDispatch();
  const { skillnaavData } = useSelector((state) => state.root);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("/api/skillnaav/get-skillnaav-data");
        dispatch(SetSkillNaavData(response.data));
        dispatch(HideLoading());
      } catch (err) {
        console.error("Failed to load skillnaav data on ContactPage:", err);
        dispatch(HideLoading());
      }
    };

    if (!skillnaavData) fetchData();
  }, [skillnaavData, dispatch]);

  return (
    <>
  <Helmet>
  <title>Contact Us</title>

  <meta
    name="description"
    content="Contact Skill Naav for support, internships, partnerships, business inquiries, and platform assistance."
  />

  <link rel="canonical" href="https://www.skillnaav.com/contact" />
</Helmet>
      <Navbar />
    <div className="pt-20 px-[20px] lg:px-20 mx-auto">
  <p className="text-gray-600 mb-6">
    Contact Skill Naav for support, internship inquiries,
    partnerships, and platform assistance.
  </p>

  <Contact />
</div>
      <Footer />
    </>
  );
}

export default ContactPage;