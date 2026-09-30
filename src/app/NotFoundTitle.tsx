"use client";

import { useEffect } from "react";

/**
 * The 404 cannot export metadata (only global-not-found can), so it names the tab itself,
 * and keeps it named if the layout's streamed metadata writes the home title afterwards.
 */
export function NotFoundTitle() {
  useEffect(() => {
    const want = "Off the map · Sayed Jehad World";
    const apply = () => {
      if (document.title !== want) document.title = want;
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => mo.disconnect();
  }, []);
  return null;
}
