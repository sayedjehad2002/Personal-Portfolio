"use client";

import { Px } from "../ui/Px";

export type Door = { x: number; w: number; floorY: number; kind: "gym" | "lab" | "lift" };

const NEON: Record<Door["kind"], { label: string; sub: string; glow: string; text: string }> = {
  gym: { label: "GYM", sub: "Level 3 · Discipline Lab", glow: "#ff3b3b", text: "#ffd9d9" },
  lab: { label: "AI LAB", sub: "Level 4 · AI Lab", glow: "#4fbaf5", text: "#e6f7ff" },
  lift: { label: "SUMMIT LIFT", sub: "Level 5 · The Summit", glow: "#ffbb33", text: "#fff4d6" },
};

/** Building edge with a lit doorway that hides the seam between two scenes. */
export function DoorFacade({ door, vh, charH }: { door: Door; vh: number; charH: number }) {
  const n = NEON[door.kind];
  const doorH = charH * 1.35;
  const doorW = Math.min(door.w * 0.62, charH * 0.95);
  return (
    <div aria-hidden="true" className="absolute top-0" style={{ left: door.x, width: door.w, height: vh }}>
      {/* wall */}
      <div
        className="absolute inset-0"
        style={{
          background:
            door.kind === "gym"
              ? "linear-gradient(90deg, #1c2433 0%, #2b3446 22%, #262f40 78%, #171d29 100%)"
              : "linear-gradient(90deg, #171d29 0%, #2a3346 25%, #252e40 75%, #1a2130 100%)",
          boxShadow: "inset 6px 0 0 rgba(255,255,255,0.05), inset -8px 0 0 rgba(0,0,0,0.25), 0 0 40px rgba(0,0,0,0.45)",
        }}
      />
      {/* brick / panel texture */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(0deg, rgba(0,0,0,0.35) 2px, transparent 2px), linear-gradient(90deg, rgba(0,0,0,0.25) 2px, transparent 2px)",
          backgroundSize: "56px 28px, 112px 56px",
        }}
      />
      {/* neon sign */}
      <div className="absolute inset-x-0 flex flex-col items-center gap-2" style={{ top: door.floorY - doorH - vh * 0.2 }}>
        <div
          className="rounded-xl border-2 px-4 py-1.5 font-display text-[clamp(22px,3.4vh,38px)] tracking-[0.12em]"
          style={{
            color: n.text,
            borderColor: n.glow,
            textShadow: `0 0 8px ${n.glow}, 0 0 22px ${n.glow}`,
            boxShadow: `0 0 14px ${n.glow}, inset 0 0 12px ${n.glow}66`,
            background: "rgba(8,12,22,0.65)",
          }}
        >
          {n.label}
        </div>
        <Px className="text-center text-[12px] text-white/85">{n.sub}</Px>
      </div>
      {/* doorway */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-t-[14px] border-[5px] border-[#0c111b]"
        style={{
          top: door.floorY - doorH,
          width: doorW,
          height: doorH,
          background:
            door.kind === "gym"
              ? "linear-gradient(180deg, #ffe7c4 0%, #ffcf8a 55%, #f0a64e 100%)"
              : "linear-gradient(180deg, #e8f7ff 0%, #bfe6ff 55%, #7cc8f2 100%)",
          boxShadow: `0 0 50px ${door.kind === "gym" ? "#ffb14e" : "#7cc8f2"}aa`,
        }}
      />
      {/* floor under the doorway */}
      <div className="absolute inset-x-0 bottom-0 bg-[#141a26]" style={{ top: door.floorY }} />
      <div className="absolute inset-x-0 h-1.5 bg-[#394459]" style={{ top: door.floorY }} />
    </div>
  );
}

