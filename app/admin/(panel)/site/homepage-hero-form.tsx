"use client";

import type { HomepageHeroContent } from "@/lib/site-content";

import { saveHomepageHeroContent } from "./actions";

type Props = {
  initial: HomepageHeroContent;
};

export function HomepageHeroForm({ initial }: Props) {
  return (
    <form action={saveHomepageHeroContent} className="grid max-w-2xl gap-4">
      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-brand-navy">Headline line 1</span>
        <input
          name="line1"
          defaultValue={initial.line1}
          required
          className="rounded-md border border-slate-200 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-brand-navy">Headline line 2</span>
        <input
          name="line2"
          defaultValue={initial.line2}
          required
          className="rounded-md border border-slate-200 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-brand-navy">Subtext</span>
        <textarea
          name="subtext"
          defaultValue={initial.subtext}
          required
          rows={3}
          className="rounded-md border border-slate-200 px-3 py-2"
        />
      </label>
      <div>
        <button
          type="submit"
          className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-navy hover:brightness-95"
        >
          Save homepage hero
        </button>
      </div>
    </form>
  );
}
