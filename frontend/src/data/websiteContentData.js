// Static, production-grade website content and images directly in code
// Guaranteed to load immediately from code without S3/network dependency
import HeroImage from "../assets/app_mockup_edutechex.png";
import VisionImage from "../assets/vesion.jpeg";
import PersonalizedCareerImg from "../assets/wmremove-transformed (14).jpeg";
import InternshipMatchingImg from "../assets/WhatsApp Image 2026-10-16 at 10.22.55 AM.jpeg";

export const staticDiscoverData = {
  discoverheading: "Explore Tailored Global Internships with us",
  discoversubheading: "Bridging Skill Gaps with Personalized Internships and Professional Support.",
  tryforfreebtn: "Try for free",
  viewpricebtn: "View Pricing",
  imgUrl: HeroImage,
};

export const staticVisionData = {
  visionheading: "Our Vision",
  visionsub:
    "Empowering Indian youth with early career pathways, industry-aligned skill development, and top-tier internships under NEP 2020 and Skill India.",
  visionImg: VisionImage,
  visionpoints: [
    {
      visionpoint:
        "Multidisciplinary Pathways: Early guidance aligned with NEP 2020 helping students make informed academic and career choices.",
    },
    {
      visionpoint:
        "High-Impact Internships: Practical industry experience in emerging technologies, AI, and aerospace.",
    },
    {
      visionpoint:
        "Industry Mentorship: Bridging academia and industry through dedicated skill-building and continuous learning.",
    },
    {
      visionpoint:
        "Lifelong Upskilling: Continuous learning resources and industry-aligned skill development throughout every student's career journey.",
    },
  ],
};

export const staticFeaturesData = [
  {
    feature: "Personalized Career Pathways",
    featuredesc: "Tailored learning plans and goal setting to guide students.",
    subfeature: "Interest and Strength Assessment",
    point1: "Personalized Assessments",
    point2: "Tailored Feedback",
    point3: "Career Recommendations",
    point4: "Continuous Updates",
    featureImg: PersonalizedCareerImg,
  },
  {
    feature: "Internship Matching System",
    featuredesc: "Connect students with relevant internship opportunities.",
    subfeature: "Advanced Matching Algorithm",
    point1: "Profile Analysis",
    point2: "Custom Recommendations",
    point3: "Real-time Matching",
    point4: "Feedback Loop",
    featureImg: InternshipMatchingImg,
  },
];

export const staticPricingData = {
  priceheading: "Choose the Perfect Plan for You",
  pricingcard: [
    {
      plantype: "Free Trial",
      plantypesubhead: "Basic Free Access",
      price: "₹0",
      pricepoint1: "Access to basic internships",
      pricepoint2: "Limited Support",
      pricepoint3: "No commitment required",
      pricebtn: "Get Started",
      bgcolor: "purple",
      color: "purple",
    },
    {
      plantype: "Student (B2C)",
      plantypesubhead: "Premium Student Access",
      price: "₹2400",
      pricepoint1: "Full Access to Platform",
      pricepoint2: "Discounted Pricing",
      pricepoint3: "Personalized Support",
      pricebtn: "Get Student Plan",
      bgcolor: "teal",
      color: "teal",
    },
    {
      plantype: "Institutional (B2B)",
      plantypesubhead: "Institutional and Student Plan",
      price: "Contact Us",
      pricepoint1: "Enterprise-level Access",
      pricepoint2: "Customized Solutions",
      pricepoint3: "Dedicated Account Manager",
      pricebtn: "Contact Us",
      bgcolor: "orange",
      color: "orange",
    },
  ],
};

export const staticFaqData = {
  faqheading: "Frequently Asked Question",
  faqsubheading: "Answers to the Frequently asked questions",
  faqcard: [
    {
      faq: "What types of internships are available on the platform",
      answer:
        "Our platform offers a wide range of internships across various industries, including technology, healthcare, business, and more.",
    },
    {
      faq: "How does the platform match students with internships",
      answer:
        "Our AI-powered matching system analyzes your skills, interests, and profile to recommend the best suited internships with verified partners.",
    },
    {
      faq: "Is there a fee to use the platform?",
      answer:
        "No, our platform is free for students to explore. There are no hidden fees or charges for basic accounts.",
    },
    {
      faq: "Can students receive academic credit for their internships?",
      answer:
        "Yes, students have the option to receive academic credit for their internships. Our platform facilitates the process and works with educational institutions to ensure compliance.",
    },
    {
      faq: "How do i apply for internship through platform?",
      answer:
        "To apply for an internship, simply create an account on our platform and our manager will get in touch with you.",
    },
  ],
};
