"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

interface MemberIdSearchFormProps {
  service?: "FLIGHT" | "CALL_TIME" | "SHOPPING" | "MWR";
}

export function MemberIdSearchForm({ service }: MemberIdSearchFormProps) {
  const router = useRouter();
  const [memberId, setMemberId] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const params = new URLSearchParams();
    if (service) {
      params.set("service", service);
    }
    if (memberId.trim()) {
      params.set("memberId", memberId.trim());
    }

    const query = params.toString();
    router.push(query ? `/dossier?${query}` : "/dossier");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto mt-8 flex w-full max-w-3xl flex-col overflow-hidden rounded-[1.4rem] border border-[#f4d747] bg-white shadow-lg shadow-black/10 sm:flex-row"
    >
      <input
        type="text"
        value={memberId}
        onChange={(event) => setMemberId(event.target.value)}
        placeholder="Enter issued service number"
        className="min-h-14 w-full min-w-0 px-4 py-3.5 text-base text-[#1c2f51] outline-none sm:px-5 sm:py-4 sm:text-lg"
      />
      <button
        type="submit"
        className="inline-flex min-h-14 w-full items-center justify-center bg-[#f4d747] px-6 text-[#1d2a15] transition hover:bg-[#ffe173] sm:min-w-18 sm:w-auto"
        aria-label="Search member ID"
      >
        <Search className="h-7 w-7" />
      </button>
    </form>
  );
}
