"use client";

/**
 * Spotlight Card from the component library, generalised into a panel:
 * a radial glow follows the cursor and the border lights up on hover.
 */
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function Spotlight({
  children,
  className,
  glow = "rgba(99,102,241,0.16)",
  size = 360,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  glow?: string;
  size?: number;
  as?: "div" | "section" | "article";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  return (
    <Tag
      ref={ref}
      onMouseMove={(e: React.MouseEvent<HTMLDivElement>) => {
        const r = ref.current?.getBoundingClientRect();
        if (r) setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card transition-colors duration-300 hover:border-foreground/20",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: visible ? 1 : 0,
          background: `radial-gradient(${size}px circle at ${pos.x}px ${pos.y}px, ${glow}, transparent 70%)`,
        }}
      />
      <div className="relative">{children}</div>
    </Tag>
  );
}

export function PanelTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
