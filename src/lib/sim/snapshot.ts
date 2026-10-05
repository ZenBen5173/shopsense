/**
 * Draws a simulated camera snapshot as SVG from an event's ground truth.
 *
 * These are real images, not placeholders: with AWS credentials set, they are
 * rasterised to PNG and sent to Bedrock exactly like a Ring snapshot, so the
 * vision prompt is exercised end to end even without a physical camera.
 */

import type { BackTruth, FrontTruth, SimEvent } from "./scenario";
import { rng } from "./random";

const W = 640;
const H = 360;

function person(x: number, y: number, scale: number, shirt: string, apron: boolean, facing: "in" | "out") {
  const s = scale;
  const skin = "#d6a77a";
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="118" rx="26" ry="6" fill="#000" opacity="0.25"/>
    <rect x="-14" y="62" width="11" height="54" rx="4" fill="#1f2937"/>
    <rect x="3" y="62" width="11" height="54" rx="4" fill="#1f2937"/>
    <rect x="-22" y="8" width="44" height="62" rx="12" fill="${shirt}"/>
    ${apron ? `<rect x="-15" y="18" width="30" height="50" rx="4" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.5"/><text x="0" y="46" font-size="7" text-anchor="middle" fill="#fff" font-family="sans-serif">STAFF</text>` : ""}
    <circle cx="0" cy="-8" r="15" fill="${skin}"/>
    ${facing === "out" ? `<path d="M-15 -10 a15 15 0 0 1 30 0 v4 h-30z" fill="#111827"/>` : `<path d="M-15 -14 a15 15 0 0 1 30 0z" fill="#111827"/><circle cx="-5" cy="-8" r="1.6" fill="#111"/><circle cx="5" cy="-8" r="1.6" fill="#111"/>`}
  </g>`;
}

function stamp(ts: number, label: string) {
  const d = new Date(ts);
  const kl = new Date(d.getTime() + 8 * 3600_000).toISOString().replace("T", " ").slice(0, 19);
  return `<rect x="0" y="0" width="${W}" height="22" fill="#000" opacity="0.55"/>
  <text x="10" y="15" font-size="12" fill="#e5e7eb" font-family="monospace">${label}</text>
  <text x="${W - 10}" y="15" font-size="12" fill="#e5e7eb" font-family="monospace" text-anchor="end">${kl}</text>
  <circle cx="${W - 175}" cy="11" r="4" fill="#ef4444"/>`;
}

function frontScene(e: SimEvent, t: FrontTruth) {
  const r = rng(e.id);
  const people: string[] = [];
  const total = t.entering + t.leaving;
  let i = 0;
  const place = (count: number, facing: "in" | "out", staffLeft: number) => {
    for (let k = 0; k < count; k++, i++) {
      const x = 170 + ((i + 0.5) / Math.max(total, 1)) * 300 + r.int(-12, 12);
      const near = facing === "in";
      const y = near ? 170 + r.int(0, 20) : 120 + r.int(0, 10);
      const isStaff = k < staffLeft;
      people.push(person(x, y, near ? 1.15 : 0.8, isStaff ? "#f3f4f6" : t.shirts[k % t.shirts.length] ?? "#94a3b8", isStaff, facing));
    }
  };
  place(t.entering, "in", t.staff);
  place(t.leaving, "out", t.shirts.every((c) => c === "#dc2626") ? t.leaving : 0);

  return `
  <rect width="${W}" height="${H}" fill="#3f3f46"/>
  <polygon points="0,${H} ${W},${H} ${W - 120},210 120,210" fill="#a8a29e"/>
  <rect x="150" y="40" width="340" height="175" fill="#1c1917"/>
  <rect x="160" y="50" width="320" height="160" fill="#fef3c7" opacity="0.85"/>
  <rect x="175" y="64" width="90" height="120" fill="#f59e0b" opacity="0.5"/>
  <rect x="375" y="64" width="90" height="120" fill="#10b981" opacity="0.45"/>
  <rect x="140" y="28" width="360" height="22" fill="#b91c1c"/>
  <text x="320" y="44" font-size="14" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="bold">KEDAI RUNCIT AH KOW</text>
  ${people.join("")}
  <text x="16" y="${H - 14}" font-size="11" fill="#e7e5e4" font-family="sans-serif" opacity="0.7">camera above the door, looking out · facing camera = walking in</text>
  ${stamp(e.start, "FRONT DOOR")}`;
}

function backScene(e: SimEvent, t: BackTruth) {
  let subject = "";
  if (t.isDelivery && t.phase !== "unload") {
    const big = t.vehicle?.includes("lorry");
    const w = big ? 330 : 270;
    subject = `
    <g transform="translate(${t.phase === "leave" ? 260 : 150} 120)">
      <rect x="0" y="0" width="${w}" height="${big ? 150 : 120}" rx="10" fill="${t.colour}"/>
      <rect x="${w}" y="${big ? 50 : 40}" width="80" height="${big ? 100 : 80}" rx="10" fill="${t.colour}" stroke="#111" stroke-width="2"/>
      <rect x="${w + 12}" y="${big ? 60 : 50}" width="55" height="35" rx="4" fill="#bae6fd"/>
      <text x="${w / 2}" y="${big ? 85 : 70}" font-size="${big ? 28 : 24}" text-anchor="middle" fill="${t.colour === "#f4f4f5" || t.colour === "#eab308" ? "#111827" : "#ffffff"}" font-family="sans-serif" font-weight="bold">${t.logo}</text>
      <circle cx="60" cy="${big ? 155 : 125}" r="22" fill="#111"/><circle cx="${w + 30}" cy="${big ? 155 : 125}" r="22" fill="#111"/>
    </g>`;
  } else if (t.isDelivery) {
    subject = `
    <g transform="translate(250 120)">
      ${person(60, 50, 1.2, "#334155", false, "in")}
      <rect x="20" y="70" width="80" height="55" fill="#b45309" stroke="#78350f" stroke-width="2"/>
      <text x="60" y="102" font-size="10" text-anchor="middle" fill="#fff" font-family="sans-serif">${t.logo}</text>
      <rect x="130" y="110" width="70" height="50" fill="#b45309" stroke="#78350f" stroke-width="2"/>
      <rect x="140" y="70" width="60" height="40" fill="#a16207" stroke="#78350f" stroke-width="2"/>
    </g>`;
  } else if (t.what === "staff_rubbish") {
    subject = `<g transform="translate(300 150)">${person(0, 0, 1.1, "#f3f4f6", true, "out")}<ellipse cx="45" cy="80" rx="22" ry="28" fill="#111827"/></g>`;
  } else if (t.what === "cat") {
    subject = `<g transform="translate(330 260)"><ellipse cx="0" cy="0" rx="34" ry="16" fill="#f97316"/><circle cx="34" cy="-12" r="12" fill="#f97316"/><path d="M28 -22 l4 -10 l5 9 M38 -22 l5 -9 l3 10" fill="#f97316"/><path d="M-34 0 q-25 -20 -10 -38" stroke="#f97316" stroke-width="6" fill="none"/></g>`;
  } else {
    subject = `<g transform="translate(260 190)"><circle cx="0" cy="60" r="24" fill="#111"/><circle cx="110" cy="60" r="24" fill="#111"/><rect x="10" y="20" width="90" height="30" rx="10" fill="#7c3aed"/>${person(60, -30, 0.9, "#0ea5e9", false, "out")}</g>`;
  }

  return `
  <rect width="${W}" height="${H}" fill="#27272a"/>
  <rect x="0" y="40" width="${W}" height="120" fill="#52525b"/>
  <rect x="40" y="55" width="120" height="105" fill="#3f3f46" stroke="#18181b" stroke-width="3"/>
  <text x="100" y="112" font-size="11" text-anchor="middle" fill="#a1a1aa" font-family="sans-serif">BACK DOOR</text>
  <polygon points="0,${H} ${W},${H} ${W},160 0,160" fill="#57534e"/>
  <line x1="0" y1="250" x2="${W}" y2="250" stroke="#facc15" stroke-dasharray="20 18" stroke-width="3" opacity="0.6"/>
  ${subject}
  ${stamp(e.start, "BACK LANE")}`;
}

export function renderSnapshotSvg(e: SimEvent): string {
  const body = e.truth.kind === "front" ? frontScene(e, e.truth) : backScene(e, e.truth);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
}
