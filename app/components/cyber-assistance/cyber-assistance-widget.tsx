"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

import {
  buildCyberAssistTourSteps,
  cyberAssistPageLabel,
} from "@/lib/cyber-assistance/build-tour-steps";
import { cyberAssistPageFromPathname } from "@/lib/cyber-assistance/page-context";
import { useDesktopAssistEnabled } from "@/lib/cyber-assistance/use-desktop-assist";
import {
  cyberAssistBottomPxForChatLayout,
  STOREFRONT_CHAT_LAYOUT_EVENT,
  type StorefrontChatLayoutDetail,
} from "@/lib/storefront-chat-layout";

import "@/app/cyber-assistance.css";

const ASSIST_Z = "z-[117]";
/** driver.js stagePadding is px; ~3mm at 96dpi for quote pill highlight inset. */
const QUOTE_CTA_STAGE_PADDING_PX = Math.round((3 * 96) / 25.4);

/** Above driver.js overlay + popover (library default ≈ 1e9). */
const CLERK_Z_INDEX = 1_000_000_002;
const CLERK_WIDTH_PX = 148;
const CLERK_GAP_PX = 20;
/** Bump when replacing `public/cyber-assistance/call-bell.png` so browsers skip stale cache. */
const CALL_BELL_SRC = "/cyber-assistance/call-bell.png?v=20260524";

type ClerkFloatPosition = {
  top: number;
  left: number;
  placeRight: boolean;
};

function positionClerkBesidePopover(wrapper: HTMLElement): ClerkFloatPosition {
  const rect = wrapper.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  const placeLeft = rect.left - CLERK_WIDTH_PX - CLERK_GAP_PX >= 12;
  const left = placeLeft ? rect.left - CLERK_WIDTH_PX - CLERK_GAP_PX : rect.right + CLERK_GAP_PX;
  return { top: midY, left, placeRight: !placeLeft };
}

export function CyberAssistanceWidget() {
  const pathname = usePathname();
  const desktop = useDesktopAssistEnabled();
  const driverRef = useRef<Driver | null>(null);
  const [tourActive, setTourActive] = useState(false);
  const [clerkPos, setClerkPos] = useState<ClerkFloatPosition | null>(null);
  const [clerkVisible, setClerkVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const clerkSyncRafRef = useRef<number | null>(null);
  const [bellBottomPx, setBellBottomPx] = useState<number | null>(null);

  useEffect(() => {
    const onChatLayout = (event: Event) => {
      const detail = (event as CustomEvent<StorefrontChatLayoutDetail>).detail;
      setBellBottomPx(cyberAssistBottomPxForChatLayout(detail));
    };
    window.addEventListener(STOREFRONT_CHAT_LAYOUT_EVENT, onChatLayout);
    return () => window.removeEventListener(STOREFRONT_CHAT_LAYOUT_EVENT, onChatLayout);
  }, []);

  useEffect(() => setMounted(true), []);

  const cancelClerkSync = useCallback(() => {
    if (clerkSyncRafRef.current != null) {
      cancelAnimationFrame(clerkSyncRafRef.current);
      clerkSyncRafRef.current = null;
    }
  }, []);

  const destroyTour = useCallback(() => {
    cancelClerkSync();
    driverRef.current?.destroy();
    driverRef.current = null;
    setTourActive(false);
    setClerkPos(null);
    setClerkVisible(false);
  }, [cancelClerkSync]);

  useEffect(() => {
    return () => destroyTour();
  }, [destroyTour]);

  useEffect(() => {
    destroyTour();
  }, [pathname, destroyTour]);

  const hideClerk = useCallback(() => {
    cancelClerkSync();
    setClerkVisible(false);
  }, [cancelClerkSync]);

  /** Hide during step change; show only after popover has finished laying out. */
  const syncClerkToPopover = useCallback(
    (wrapper: HTMLElement | null | undefined) => {
      cancelClerkSync();
      setClerkVisible(false);

      if (!wrapper) {
        setClerkPos(null);
        return;
      }

      const apply = () => {
        const rect = wrapper.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) {
          return;
        }
        setClerkPos(positionClerkBesidePopover(wrapper));
        setClerkVisible(true);
      };

      clerkSyncRafRef.current = requestAnimationFrame(() => {
        clerkSyncRafRef.current = requestAnimationFrame(() => {
          clerkSyncRafRef.current = null;
          apply();
        });
      });
    },
    [cancelClerkSync],
  );

  const pageKind = cyberAssistPageFromPathname(pathname);

  const startTour = useCallback(() => {
    const steps = buildCyberAssistTourSteps(pathname);
    if (steps.length === 0) {
      return;
    }

    destroyTour();

    const driverObj = driver({
      showProgress: true,
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      popoverClass: "cyber-assist-popover",
      stagePadding: 10,
      stageRadius: 12,
      allowClose: true,
      overlayOpacity: 0.55,
      smoothScroll: true,
      steps,
      onHighlightStarted: (_element, step) => {
        hideClerk();
        const target = typeof step?.element === "string" ? step.element : "";
        const isQuoteCta = target.includes("cat-quote");
        const isPagination = target.includes("cat-pagination");
        // setConfig replaces the whole config — must spread existing steps/options.
        driverObj.setConfig({
          ...driverObj.getConfig(),
          smoothScroll: !isQuoteCta,
          stagePadding: isQuoteCta ? QUOTE_CTA_STAGE_PADDING_PX : isPagination ? 4 : 10,
          stageRadius: isQuoteCta ? 999 : 12,
        });
      },
      onHighlighted: () => {
        const el = document.querySelector(".driver-popover.cyber-assist-popover") as HTMLElement | null;
        syncClerkToPopover(el ?? undefined);
      },
      onDestroyed: () => {
        cancelClerkSync();
        driverRef.current = null;
        setTourActive(false);
        setClerkPos(null);
        setClerkVisible(false);
      },
    });

    driverRef.current = driverObj;
    setTourActive(true);
    driverObj.drive();
  }, [destroyTour, hideClerk, pathname, syncClerkToPopover, cancelClerkSync]);

  useEffect(() => {
    if (!tourActive) {
      return;
    }
    const onResize = () => {
      const el = document.querySelector(".driver-popover.cyber-assist-popover") as HTMLElement | null;
      syncClerkToPopover(el ?? undefined);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [tourActive, syncClerkToPopover]);

  const handleBellClick = useCallback(() => {
    if (tourActive) {
      destroyTour();
      return;
    }
    startTour();
  }, [destroyTour, startTour, tourActive]);

  const floatingClerk =
    mounted && tourActive && clerkPos
      ? createPortal(
          <div
            className={`cyber-assist-clerk-float ${clerkVisible ? "cyber-assist-clerk-float--visible" : ""} ${clerkPos.placeRight ? "cyber-assist-clerk-float--right" : "cyber-assist-clerk-float--left"}`}
            style={{
              top: clerkPos.top,
              left: clerkPos.left,
              zIndex: CLERK_Z_INDEX,
            }}
            aria-hidden
          >
            <Image
              src="/cyber-assistance/clerk.png"
              alt=""
              width={148}
              height={200}
              className="cyber-assist-clerk-img"
              priority={false}
            />
          </div>,
          document.body,
        )
      : null;

  if (!desktop) {
    return null;
  }

  return (
    <>
      {floatingClerk}
      <div
        className={`cyber-assist-bell-anchor print:hidden fixed right-5 ${ASSIST_Z} ${bellBottomPx == null ? "bottom-[5.75rem]" : ""}`}
        style={bellBottomPx != null ? { bottom: bellBottomPx } : undefined}
      >
        <button
          type="button"
          onClick={handleBellClick}
          className={`cyber-assist-bell group flex h-14 w-14 items-center justify-center rounded-full bg-transparent p-0 shadow-lg transition hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 ${
            tourActive ? "ring-2 ring-brand-orange/60 ring-offset-2" : ""
          }`}
          aria-label={
            tourActive
              ? "Close page guide"
              : `Need help on this ${cyberAssistPageLabel(pageKind)}? Start page guide`
          }
          aria-pressed={tourActive}
          title="Page guide"
        >
          <Image
            src={CALL_BELL_SRC}
            unoptimized
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 rounded-full object-cover"
            priority={false}
          />
        </button>
        <p className="pointer-events-none absolute -top-7 right-0 hidden whitespace-nowrap rounded-lg bg-brand-navy px-2 py-1 text-[0.65rem] font-semibold text-white opacity-0 shadow-md transition group-hover:opacity-100 xl:block">
          Page guide
        </p>
      </div>
    </>
  );
}
