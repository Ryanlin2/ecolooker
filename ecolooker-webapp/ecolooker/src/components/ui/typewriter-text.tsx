"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function TypewriterText({
  text,
  className,
  speed = 28,
  startDelay = 300,
}: {
  text: string;
  className?: string;
  speed?: number;
  startDelay?: number;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(text.length);
      return;
    }

    let i = 0;
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= text.length) clearInterval(interval);
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [text, speed, startDelay]);

  return (
    <span role="text" aria-label={text} className={cn("inline", className)}>
      <span aria-hidden="true">
        {text.slice(0, count)}
        <span className="typewriter-cursor ml-0.5 inline-block w-[2px] translate-y-[0.15em] bg-signal align-middle" />
      </span>
    </span>
  );
}
