import React from "react";
import { Outlet } from "react-router-dom";
import useSkillnaavTabBranding from "../hooks/useSkillnaavTabBranding";

const SkillnaavTabBrandingLayout = () => {
  useSkillnaavTabBranding();

  return <Outlet />;
};

export default SkillnaavTabBrandingLayout;
