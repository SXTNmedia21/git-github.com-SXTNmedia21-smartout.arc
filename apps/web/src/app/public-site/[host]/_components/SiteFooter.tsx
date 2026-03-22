import type { SiteSnapshot } from "@smartout/website";

export function SiteFooter({ site }: { site: SiteSnapshot["site"] }) {
  const { contact, social } = site;

  const socialLinks = [
    { key: "instagram", url: social.instagram, label: "Instagram" },
    { key: "facebook", url: social.facebook, label: "Facebook" },
    { key: "tripadvisor", url: social.tripadvisor, label: "TripAdvisor" },
    { key: "googleMaps", url: social.googleMaps, label: "Google Maps" },
  ].filter((link) => link.url);

  return (
    <footer className="bg-[var(--site-muted)] py-12 text-[var(--site-muted-foreground)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Site info */}
          <div>
            <h3
              className="mb-3 text-lg font-semibold text-[var(--site-foreground)]"
              style={{ fontFamily: "var(--site-font-heading)" }}
            >
              {site.name}
            </h3>
            {site.tagline && <p className="text-sm">{site.tagline}</p>}
          </div>

          {/* Contact */}
          <div>
            <h4 className="mb-3 text-sm font-semibold tracking-wider text-[var(--site-foreground)] uppercase">
              Kontakt
            </h4>
            <address className="space-y-1 text-sm not-italic">
              {contact.address.street && <p>{contact.address.street}</p>}
              {(contact.address.postalCode || contact.address.city) && (
                <p>
                  {contact.address.postalCode} {contact.address.city}
                </p>
              )}
              {contact.phone && (
                <p>
                  <a href={`tel:${contact.phone}`} className="hover:text-[var(--site-primary)]">
                    {contact.phone}
                  </a>
                </p>
              )}
              {contact.email && (
                <p>
                  <a href={`mailto:${contact.email}`} className="hover:text-[var(--site-primary)]">
                    {contact.email}
                  </a>
                </p>
              )}
            </address>
          </div>

          {/* Social links */}
          {socialLinks.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-semibold tracking-wider text-[var(--site-foreground)] uppercase">
                Sosiale medier
              </h4>
              <div className="flex gap-4">
                {socialLinks.map((link) => (
                  <a
                    key={link.key}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm transition-colors hover:text-[var(--site-primary)]"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-[var(--site-foreground)]/10 pt-8 text-center text-xs">
          <p>
            &copy; {new Date().getFullYear()} {site.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
