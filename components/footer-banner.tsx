"use client";

import React from "react";
import { cn } from "@/lib/utils";

function isIp(host?: string): boolean {
  if (!host) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true; // IPv4
  if (host.includes(":")) return true; // IPv6 (loose)
  return false;
}

function looksLikeDomain(host?: string): boolean {
  if (!host) return false;
  if (isIp(host)) return false;
  if (host === "localhost") return false;
  return /[a-zA-Z]/.test(host) && host.includes(".");
}

function getDomains(): string {
  const fromEnv = process.env.NEXT_PUBLIC_DOMAINS?.trim();
  if (fromEnv && !isIp(fromEnv)) return fromEnv;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (looksLikeDomain(host)) return host;
  }
  return "NETGEAR";
}

export default function FooterBanner() {
  const domains = getDomains();
  return (
    <footer
      className={cn(
        "mt-10 border-t",
        "bg-secondary/40 border-border"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-xs leading-relaxed text-muted-foreground">
        <div className="text-center">
          <div>
            Built with passion ❤️ by Jay Prakash © 2025 {domains || "NETGEAR"}. All rights reserved.
          </div>
          <div className="mt-1">
            Confidential information. No screenshots, copying, or sharing is allowed. This is the property of {domains || "NETGEAR"} and must not be used elsewhere.
          </div>
        </div>
      </div>
    </footer>
  );
}
