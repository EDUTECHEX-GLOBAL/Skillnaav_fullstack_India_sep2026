import React from "react";
import { Outlet } from "react-router-dom";
import useEdutechexTabBranding from "../hooks/useEdutechexTabBranding";

const EdutechexTabBrandingLayout = () => {
  useEdutechexTabBranding();

  return <Outlet />;
};

export default EdutechexTabBrandingLayout;
