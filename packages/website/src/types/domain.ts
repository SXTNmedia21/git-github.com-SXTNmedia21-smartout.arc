export type DomainType = "platform_subdomain" | "custom";

export type DomainStatus = "pending_verification" | "verified" | "failed" | "active";

export type SslStatus = "pending" | "active" | "error";

export type RedirectBehavior = "primary_only" | "serve_direct" | "redirect_to_primary";

export type SiteVisibility = "draft" | "live" | "offline";

export type PageType =
  | "home"
  | "menu"
  | "about"
  | "careers"
  | "contact"
  | "gallery"
  | "events"
  | "custom";

export type BookingProvider = "none" | "dinnerbooking" | "opentable" | "custom";

export type MenuSourceType = "structured" | "pdf";

export type PublishAction = "publish" | "rollback" | "unpublish";

export type DraftSource = "manual" | "autosave" | "generator" | "template_apply";

export type ContactAddress = {
  street: string;
  city: string;
  postalCode: string;
  country: string;
};

export type SocialLinks = {
  instagram?: string;
  facebook?: string;
  tripadvisor?: string;
  googleMaps?: string;
};
