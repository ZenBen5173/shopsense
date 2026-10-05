"use client";

import { DoorOpen, PackageCheck, ShoppingBag, UserCog, Cat } from "lucide-react";
import { ActivityFeed, type ActivityEvent } from "@/components/ui/activity-feed";
import type { FeedItem } from "@/lib/dashboard";
import type { Lang } from "@/lib/domain/types";
import { Spotlight, PanelTitle } from "./spotlight";
import { t } from "./i18n";

const ICONS = { customer: ShoppingBag, staff: UserCog, delivery: PackageCheck, other: Cat, left: DoorOpen };

export function LiveFeed({ feed, lang, simNow }: { feed: FeedItem[]; lang: Lang; simNow: string }) {
  const c = t(lang);
  // The feed's relative times count from the simulated "now" during a replay.
  const shift = Date.now() - Date.parse(simNow);
  const events: ActivityEvent[] = feed.map((f) => ({
    id: f.id,
    type: f.type,
    who: f.camera,
    what: f.text,
    target: f.confidence === "low" ? "(?)" : undefined,
    at: new Date(Date.parse(f.at) + shift).toISOString(),
  }));
  return (
    <Spotlight className="p-5">
      <PanelTitle
        title={c.live}
        right={
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--red-9)] opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-[var(--red-9)]" />
          </span>
        }
      />
      <div className="mt-4 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
        <ActivityFeed events={events} icons={ICONS} refreshMs={5000} emptyState={<p className="text-sm text-muted-foreground">{c.noData}</p>} />
      </div>
    </Spotlight>
  );
}
