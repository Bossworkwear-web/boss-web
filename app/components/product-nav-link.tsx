"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { persistSidebarNavClient } from "@/lib/sidebar-nav";

type ProductNavLinkProps = {
  href: string;
  mainSlug: string;
  subSlug: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export function ProductNavLink({ href, mainSlug, subSlug, className, style, children }: ProductNavLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      style={style}
      onClick={() => persistSidebarNavClient(mainSlug, subSlug)}
    >
      {children}
    </Link>
  );
}
