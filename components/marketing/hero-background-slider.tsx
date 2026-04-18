"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function HeroBackgroundSlider({
  slides,
  className,
  intervalMs = 3000,
}: {
  slides: readonly string[];
  className?: string;
  intervalMs?: number;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [slides.length, intervalMs]);

  return (
    <div className={`relative ${className ?? ""}`}>
      {slides.map((src, index) => (
        <Image
          key={`${src}-${index}`}
          src={src}
          alt=""
          fill
          sizes="100vw"
          priority={index === 0}
          className={`object-cover transition-opacity duration-700 ${
            index === activeIndex ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </div>
  );
}

