"use client";
import React, { useState } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import Plus from "../assets/Plus.svg";
import { useSelector } from "react-redux";

const Faq = ({ className = "" }) => {
  const { edutechexData } = useSelector((state) => state.root);
  const [openItem, setOpenItem] = useState("item-1");

  if (!edutechexData || !edutechexData.faq || edutechexData.faq.length === 0) {
    return null;
  }

  const { faqheading, faqsubheading } = edutechexData.faq[0];
  const { faqcard } = edutechexData;

  return (
    <div
      id="faqs"
      className={`flex flex-col w-full py-8 lg:py-[60px] lg:flex-row lg:gap-x-6 ${className}`}
    >
      <div className="lg:w-1/3 lg:py-[32px] lg:pr-[56px]">
        <h3 className="font-medium text-[#EB2891] text-[14px] lg:text-base">
          {faqheading}
        </h3>
        <h1 className="font-medium text-2xl py-4 text-[#172026] text-[24px] lg:text-[42px] lg:leading-[58px]">
          {faqsubheading}
        </h1>
      </div>
      <div className="lg:w-2/3">
        <Accordion.Root
          type="single"
          value={openItem}
          onValueChange={setOpenItem}
          collapsible
          className="flex flex-col gap-y-4"
        >
          {faqcard.map((item, index) => {
            const itemValue = `item-${index + 1}`;
            const isOpen = openItem === itemValue;

            return (
              <div key={index}>
                <Accordion.Item
                  value={itemValue}
                  className="bg-[#E3F1FF] p-[16px] rounded-[8px]"
                >
                  <Accordion.Header>
                    <Accordion.Trigger className="flex w-full items-center justify-between">
                      <p className="text-left text-[#172026] text-[16px] font-medium leading-[24px] lg:text-[18px]">
                        {item.faq}
                      </p>
                      <span className="text-left text-[#172026] text-[16px] font-medium leading-[24px] flex items-center justify-center">
                        {isOpen ? (
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-5 h-5 lg:w-6 lg:h-6"
                            aria-label="Collapse answer"
                          >
                            <path
                              d="M18 6L6 18"
                              stroke="#172026"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M6 6L18 18"
                              stroke="#172026"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          <img
                            src={Plus}
                            alt="Expand answer"
                            className="w-5 h-5 lg:w-6 lg:h-6"
                          />
                        )}
                      </span>
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content>
                    <p className="pt-2 text-[#36485C]">{item.answer}</p>
                  </Accordion.Content>
                </Accordion.Item>
              </div>
            );
          })}
        </Accordion.Root>
      </div>
    </div>
  );
};

export default Faq;
