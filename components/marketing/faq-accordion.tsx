"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <Accordion.Root
      type="single"
      collapsible
      defaultValue={items[0]?.id}
      className="space-y-2.5"
    >
      {items.map((item) => (
        <Accordion.Item
          key={item.id}
          value={item.id}
          className="overflow-hidden rounded-xl border border-[#d0d5dc] bg-white"
        >
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-[#14294b] sm:text-base">
              {item.question}
              <ChevronDown className="h-5 w-5 shrink-0 text-[#4e5f77] transition group-data-[state=open]:rotate-180" />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <div className="border-t border-[#e4e8ee] px-4 py-3 text-sm leading-7 text-[#32425a] sm:text-base">
              {item.answer}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
