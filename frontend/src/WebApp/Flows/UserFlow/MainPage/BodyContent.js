import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useTabContext } from "./UserHomePageContext/HomePageContext";
import Message from "./Message";
import SearchBar from "./SearchBar";
import Home from "./Home";
import Filter from "./Filter";
import SavedJobs from "./SavedJobs";
import Applications from "./Applications";
import ProfilePage from "./ProfilePage";
import PremiumPage from "./PremiumPage";
import Notifications from "./Notifications";
import OfferLetter from "./OfferLetter";
import AdvancedAi from "./Sectors/AdvancedAi";
import MaterialScience from "./Sectors/MaterialScience";
import QuantumComputing from "./Sectors/QuantumComputing";
import ClimateTech from "./Sectors/ClimateTech";
import BioTech from "./Sectors/BioTech";
import SpaceExploration from "./Sectors/SpaceExploration";
import Neurotechnology from "./Sectors/Neurotechnology";
import PrecisionAgriculture from "./Sectors/PrecisionAgriculture";
import AdvancedRobotics from "./Sectors/AdvancedRobotics";
import RenewableEnergy from "./Sectors/RenewableEnergy";
import ArchitectureBuiltEnvironment from "./Sectors/ArchitectureBuiltEnvironment";
import Recommendations from "./Recommendations";
import StudentAssessment from "./StudentAssessment";
import UserAttendance from "./UserAttendance";


const BodyContent = () => {
  const { selectedTab = "home", handleSelectTab } = useTabContext();

  useEffect(() => {
    const handler = (e) => {
      const tab = e?.detail?.tab;
      if (!tab || typeof handleSelectTab !== "function") return;
      handleSelectTab(tab);
    };

    window.addEventListener("openTab", handler);
    return () => window.removeEventListener("openTab", handler);
  }, [handleSelectTab]);

  let content;
  switch (selectedTab) {
    case "home":
      content = <Home />;
      break;
    case "searchbar":
      content = <SearchBar />;
      break;
    case "recommendations":
      content = <Recommendations />;
      break;
    case "messages":
      content = <Message />;
      break;
    case "applications":
      content = <Applications />;
      break;
    case "saved-jobs":
      content = <SavedJobs />;
      break;
    case "assessment":
      content = <StudentAssessment />;
      break;
    case "attendance":
      content = <UserAttendance />;
      break;
    case "profile":
      content = <ProfilePage />;
      break;
    case "support":
      content = <Navigate to="/user-support" replace />;
      break;
    case "logout":
      content = <div>Logout Content</div>;
      break;
    case "filter":
      content = <Filter />;
      break;
    case "notifications":
      content = <Notifications />;
      break;
    case "premium":
      content = <PremiumPage />;
      break;
    case "offer-letter":
      content = <OfferLetter />;
      break;
    case "advanced-ai":
      content = <AdvancedAi />;
      break;
    case "quantum-computing":
      content = <QuantumComputing />;
      break;
    case "climate-tech":
      content = <ClimateTech />;
      break;
    case "biotech":
      content = <BioTech />;
      break;
    case "materials-science":
      content = <MaterialScience />;
      break;
    case "space-exploration":
      content = <SpaceExploration />;
      break;
    case "neurotechnology":
      content = <Neurotechnology />;
      break;
    case "precision-agriculture":
      content = <PrecisionAgriculture />;
      break;
    case "advanced-robotics":
      content = <AdvancedRobotics />;
      break;
    case "renewable-energy":
      content = <RenewableEnergy />;
      break;
    case "architecture-built-environment":
      content = <ArchitectureBuiltEnvironment />;
      break;
    default:
      content = <div>Select a tab</div>;
  }

  return (
    <div className="flex flex-col lg:flex-row p-4 flex-1">
      {/* Desktop View */}
      <div className="lg:flex-1 hidden lg:block">{content}</div>

      {/* Mobile View */}
      <div className="lg:hidden flex-1">{content}</div>
    </div>
  );
};

export default BodyContent;
