"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
  if (process.env.NODE_ENV !== "production") {
    (window as unknown as { __gsap: unknown }).__gsap = { gsap, ScrollTrigger };
  }
}

export { gsap, ScrollTrigger, useGSAP };
