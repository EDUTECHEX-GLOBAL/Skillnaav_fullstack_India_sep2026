// src/pages/Home/Home.js
import React, { Suspense, lazy, useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import { useSelector, useDispatch } from "react-redux";
import { Skeleton } from "antd";
import { Helmet } from "react-helmet";
import axios from "../../api/axiosInstance";
import { SetSkillNaavData, HideLoading } from "../../redux/rootSlice";

const Discover = lazy(() => import("../../components/Discover"));
const Vision = lazy(() => import("../../components/Vision"));
const Features = lazy(() => import("../../components/Features"));
const Team = lazy(() => import("../../components/Team/Team"));
const Pricing = lazy(() => import("../../components/Pricing"));
const Faq = lazy(() => import("../../components/Faq"));
const Contact = lazy(() => import("../../components/Contact"));
const Footer = lazy(() => import("../../components/Footer"));

function Home() {
  const { skillnaavData } = useSelector((state) => state.root);
  const dispatch = useDispatch();
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // ✅ FIXED: removed console.log statements not suitable for production
        const response = await axios.get("/api/skillnaav/get-skillnaav-data");
        dispatch(SetSkillNaavData(response.data));
      } catch (error) {
        console.error("Error fetching SkillNaav data:", error);
      } finally {
        setPageLoading(false);
        dispatch(HideLoading());
      }
    };

    if (!skillnaavData || Object.keys(skillnaavData).length === 0) {
      fetchData();
    } else {
      setPageLoading(false);
      dispatch(HideLoading());
    }
  }, [skillnaavData, dispatch]);

  return (
    <div className="font-inter">

      {/* ✅ ADDED: Helmet for homepage SEO — was completely missing before */}
      <Helmet>
  <title>Skill Naav - Navigate Your Skills</title>
  <meta
    name="description"
    content="Skill Naav (also known as SkillNaav) helps you discover internships, assign instructors, and manage your learning journey through an AI-powered platform."
  />
  <link rel="canonical" href="https://www.skillnaav.com/" />

  {/* Open Graph */}
  <meta property="og:title" content="Skill Naav - Navigate Your Skills" />
  <meta
    property="og:description"
    content="Discover internships, assign instructors, and manage schedules — all in one place."
  />
  <meta property="og:url" content="https://www.skillnaav.com/" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://www.skillnaav.com/skillnaav-og.png" />

  {/* Twitter */}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Skill Naav - Navigate Your Skills" />
  <meta
    name="twitter:description"
    content="Discover internships, assign instructors, and manage schedules — all in one place."
  />
  <meta name="twitter:image" content="https://www.skillnaav.com/skillnaav-og.png" />
</Helmet>

      <Navbar />

      <div className="pt-20">
        {pageLoading ? (
          <div className="px-[20px] lg:px-20 mx-auto">
            <Skeleton active />
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="px-[20px] lg:px-20 mx-auto">
                <Skeleton active />
              </div>
            }
          >
            <Discover />

            <div className="px-[20px] lg:px-20 mx-auto">
              <Vision className="mt-16" />
              <Features className="mt-16" />
              <Team className="mt-16" />
              <Pricing className="mt-16" />
              <Faq className="mt-16" />
              <Contact className="mt-16" />
              <Footer className="mt-16" />
            </div>
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default Home;