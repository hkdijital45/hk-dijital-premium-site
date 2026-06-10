"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export function AnimatedSection({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 72, scale: 0.965, filter: "blur(10px)" }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-110px" }}
      transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
      className={`hard-section ${className}`}
    >
      {children}
    </motion.section>
  );
}
