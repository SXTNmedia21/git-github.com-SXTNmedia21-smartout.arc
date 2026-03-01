"use client";

import { useEffect } from "react";
import { getVisitorId } from "../lib/visitor-cookie";

/**
 * Stores the smo_vid cookie value into localStorage
 * so the web app can read it after signup redirect.
 * The web app's post-signup flow links it to user_identity.
 */
export function SignupVisitorLinker() {
  useEffect(() => {
    const visitorId = getVisitorId();
    if (visitorId) {
      try {
        localStorage.setItem("smo_landing_visitor_id", visitorId);
      } catch {
        // Silent fail
      }
    }
  }, []);
  return null;
}
