"use client";

/** Magnetic Button from the component library, as a real submit/click button. */
import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

const { stiffness, damping, mass } = SPRING.follow;
const FOLLOW = { stiffness, damping, mass };

export function MagneticSave({
  children,
  strength = 0.35,
  className,
  type = "submit",
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
  type?: "submit" | "button";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, FOLLOW);
  const sy = useSpring(y, FOLLOW);
  const labelX = useTransform(sx, (v) => v * 0.4);
  const labelY = useTransform(sy, (v) => v * 0.4);

  return (
    <motion.button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={{ x: sx, y: sy }}
      whileTap={{ scale: 0.95 }}
      className={cn("relative shrink-0 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background disabled:opacity-50", className)}
    >
      <motion.span style={{ x: labelX, y: labelY }} className="pointer-events-none block">
        {children}
      </motion.span>
    </motion.button>
  );
}
