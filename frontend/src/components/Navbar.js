import React, { useState } from "react";
import EdutechexLogo from "../assets/Edutech-logo.png";
import Menu from "../assets/Menu.svg";
import Close from "../assets/close.png";

const navLinks = [
  { name: "Discover", href: "/" }, // homepage
  { name: "Vision", href: "/vision" },   // keep inside home
  { name: "Features", href: "/features" },
  { name: "Team", href: "/team" },
  { name: "Pricing", href: "/pricing" },
  { name: "FAQs", href: "/faqs" },
  { name: "Contact", href: "/contact" },
];


const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <nav className="fixed top-0 left-0 w-full bg-white z-50">
      <div className="flex items-center justify-between px-4 sm:px-5 py-2 sm:py-2.5 lg:container lg:mx-auto lg:px-20">
        <div className="flex items-center gap-x-3 sm:gap-x-5 pl-0 sm:pl-3 min-w-0">
          <a href="/" aria-label="Home" className="flex items-center min-w-0">
            <img
              className="h-[38px] sm:h-[42px] w-auto max-w-[160px] sm:max-w-[180px] object-contain ml-0.5 sm:ml-2 mt-1 sm:mt-1.5"
              src={EdutechexLogo}
              alt="Edutechex Logo"
            />
          </a>
          <div className="hidden lg:flex gap-x-8 ml-8">
            {navLinks.map((item, index) => (
              <a
                key={index}
                href={item.href}
                className="text-[#36485C] font-medium hover:text-[#451E5D] transition duration-300"
              >
                {item.name}
              </a>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-x-5">
          <a
            href="#contacts"
            className="hidden lg:block font-medium text-white bg-[#451E5D] hover:bg-[#2c3b4e] px-4 py-2 rounded-md transition duration-300"
          >
            Request Call Back
          </a>
          <div className="lg:hidden" onClick={toggleMenu}>
            <img
              src={menuOpen ? Close : Menu}
              alt="Menu Button"
              width={30}
              height={30}
              className="cursor-pointer transition-transform duration-300 transform hover:scale-110"
            />
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`${
            menuOpen ? "translate-x-0" : "translate-x-full"
          } fixed top-0 right-0 w-full md:w-80 h-screen bg-white/95 backdrop-blur-lg shadow-2xl flex flex-col pt-24 px-8 gap-6 z-50 transition-transform duration-300 ease-in-out`}
        >
          <div className="absolute top-6 right-6">
            <img
              src={Close}
              alt="Close Menu"
              onClick={toggleMenu}
              width={24}
              height={24}
              className="cursor-pointer transition-transform duration-300 transform hover:scale-110 hover:rotate-90 opacity-70 hover:opacity-100"
            />
          </div>
          
          <div className="flex flex-col gap-6 w-full mt-4">
            {navLinks.map((item, index) => (
              <a
                key={index}
                href={item.href}
                onClick={toggleMenu}
                className="text-[#36485C] font-semibold text-xl border-b border-gray-100 pb-2 transition duration-300 transform hover:text-[#451E5D] hover:translate-x-2"
              >
                {item.name}
              </a>
            ))}
          </div>

          <a href="#contacts" onClick={toggleMenu} className="w-full mt-8">
            <div className="font-semibold text-center text-white bg-[#451E5D] shadow-lg shadow-[#451E5D]/30 hover:bg-[#2c3b4e] hover:shadow-xl hover:-translate-y-1 px-6 py-4 rounded-xl transition-all duration-300 text-lg w-full">
              Request Call Back
            </div>
          </a>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
