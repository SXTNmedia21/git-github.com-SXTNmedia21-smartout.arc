-- Website Factory integration test seed
-- Inserts a complete website for the HQ workspace with pages, sections,
-- menus, assets, domain, published snapshot, and publish event.
--
-- Depends on: supabase/seed.sql (HQ workspace must exist)
-- Workspace: b0000000-0000-0000-0000-000000000000
-- Profile (owner): f0000000-0000-0000-0000-000000000000

BEGIN;

-- ─── UUIDs ──────────────────────────────────────────────────────
-- Deterministic UUIDs for reproducible test data

DO $$
DECLARE
  v_workspace_id  uuid := 'b0000000-0000-0000-0000-000000000000';
  v_profile_id    uuid := 'f0000000-0000-0000-0000-000000000000';

  v_website_id    uuid := 'aa100000-0000-0000-0000-000000000000';

  -- Pages
  v_page_home_id  uuid := 'aa110000-0000-0000-0000-000000000000';
  v_page_menu_id  uuid := 'aa120000-0000-0000-0000-000000000000';
  v_page_about_id uuid := 'aa130000-0000-0000-0000-000000000000';

  -- Sections
  v_sec_hero_id       uuid := 'aa210000-0000-0000-0000-000000000000';
  v_sec_richtext_id   uuid := 'aa220000-0000-0000-0000-000000000000';
  v_sec_cta_id        uuid := 'aa230000-0000-0000-0000-000000000000';
  v_sec_menufull_id   uuid := 'aa240000-0000-0000-0000-000000000000';
  v_sec_textimage_id  uuid := 'aa250000-0000-0000-0000-000000000000';
  v_sec_faq_id        uuid := 'aa260000-0000-0000-0000-000000000000';

  -- Menu hierarchy
  v_menu_id       uuid := 'aa310000-0000-0000-0000-000000000000';
  v_cat_forrett   uuid := 'aa320000-0000-0000-0000-000000000000';
  v_cat_hovedrett uuid := 'aa330000-0000-0000-0000-000000000000';

  -- Asset
  v_asset_id      uuid := 'aa410000-0000-0000-0000-000000000000';

  -- Domain
  v_domain_id     uuid := 'aa510000-0000-0000-0000-000000000000';

  -- Snapshot + event
  v_snapshot_id   uuid := 'aa610000-0000-0000-0000-000000000000';
  v_event_id      uuid := 'aa710000-0000-0000-0000-000000000000';

  v_now           timestamptz := now();

BEGIN

-- ─── 1. Website ─────────────────────────────────────────────────
INSERT INTO websites.website (
  website_id, workspace_id, site_slug, name, tagline,
  theme, visibility, template_key, template_version,
  booking_provider, booking_url,
  social_links, contact_email, contact_phone, contact_address,
  default_meta_title, default_meta_description,
  created_at, updated_at
) VALUES (
  v_website_id, v_workspace_id, 'hq-workspace',
  'Sjøboden Restaurant', 'Frisk sjømat med utsikt over fjorden',
  '{
    "colors": {
      "primary": "#1a365d",
      "secondary": "#2d3748",
      "accent": "#ed8936",
      "background": "#ffffff",
      "surface": "#f7fafc",
      "text": "#1a202c",
      "textMuted": "#718096"
    },
    "fonts": {
      "heading": "Playfair Display",
      "body": "Inter"
    },
    "borderRadius": "0.5rem",
    "spacing": "comfortable"
  }'::jsonb,
  'live', 'restaurant-classic', 1,
  'dinnerbooking', 'https://dinnerbooking.com/sjoboden',
  '{"instagram": "https://instagram.com/sjoboden", "facebook": "https://facebook.com/sjoboden", "tripadvisor": "https://tripadvisor.com/sjoboden"}'::jsonb,
  'post@sjoboden.no', '+47 22 33 44 55',
  '{"street": "Bryggegata 12", "city": "Oslo", "postalCode": "0250", "country": "NO"}'::jsonb,
  'Sjøboden Restaurant — Frisk sjømat i Oslo',
  'Sjømat-restaurant ved fjorden. Bestill bord i dag.',
  v_now, v_now
);

-- ─── 2. Pages ───────────────────────────────────────────────────
INSERT INTO websites.website_page (website_page_id, website_id, workspace_id, page_type, slug, title, is_visible, sort_order, created_at, updated_at) VALUES
  (v_page_home_id,  v_website_id, v_workspace_id, 'home',  '',      'Hjem',     true, 0, v_now, v_now),
  (v_page_menu_id,  v_website_id, v_workspace_id, 'menu',  'meny',  'Meny',     true, 1, v_now, v_now),
  (v_page_about_id, v_website_id, v_workspace_id, 'about', 'om-oss','Om oss',   true, 2, v_now, v_now);

-- ─── 3. Sections ────────────────────────────────────────────────
-- Home: hero + rich_text + cta
INSERT INTO websites.website_section (website_section_id, website_page_id, workspace_id, section_type, content, settings, is_visible, sort_order, created_at, updated_at) VALUES
  (v_sec_hero_id, v_page_home_id, v_workspace_id, 'hero',
   '{"heading": "Velkommen til Sjøboden", "subheading": "Frisk sjømat med utsikt over Oslofjorden", "backgroundImage": null, "ctaText": "Bestill bord", "ctaUrl": "https://dinnerbooking.com/sjoboden"}'::jsonb,
   '{"paddingY": "lg", "theme": "dark"}'::jsonb, true, 0, v_now, v_now),

  (v_sec_richtext_id, v_page_home_id, v_workspace_id, 'rich_text',
   '{"html": "<p>Vi serverer dagens fangst med kjærlighet og respekt for råvarene. Vår kjøkkensjef henter inspirasjon fra den norske kysttradisjonen.</p>"}'::jsonb,
   '{"paddingY": "md", "theme": "light"}'::jsonb, true, 1, v_now, v_now),

  (v_sec_cta_id, v_page_home_id, v_workspace_id, 'cta',
   '{"heading": "Bestill bord i kveld", "description": "Vi har ledige plasser. Ring oss eller bestill online.", "buttonText": "Reserver nå", "buttonUrl": "https://dinnerbooking.com/sjoboden"}'::jsonb,
   '{"paddingY": "lg", "theme": "accent"}'::jsonb, true, 2, v_now, v_now);

-- Menu page: menu_full
INSERT INTO websites.website_section (website_section_id, website_page_id, workspace_id, section_type, content, settings, is_visible, sort_order, created_at, updated_at) VALUES
  (v_sec_menufull_id, v_page_menu_id, v_workspace_id, 'menu_full',
   '{"heading": "Vår meny", "description": "Sesongens beste råvarer"}'::jsonb,
   '{"paddingY": "lg", "theme": "light"}'::jsonb, true, 0, v_now, v_now);

-- About page: text_image + faq
INSERT INTO websites.website_section (website_section_id, website_page_id, workspace_id, section_type, content, settings, is_visible, sort_order, created_at, updated_at) VALUES
  (v_sec_textimage_id, v_page_about_id, v_workspace_id, 'text_image',
   '{"heading": "Vår historie", "body": "Sjøboden åpnet dørene i 2018 med en visjon om å bringe fjordens smaker til byen. Vi samarbeider med lokale fiskere og bønder.", "imagePosition": "right"}'::jsonb,
   '{"paddingY": "lg", "theme": "light"}'::jsonb, true, 0, v_now, v_now),

  (v_sec_faq_id, v_page_about_id, v_workspace_id, 'faq',
   '{"heading": "Ofte stilte spørsmål", "items": [{"question": "Har dere parkering?", "answer": "Ja, det er gratis parkering rett ved restauranten."}, {"question": "Er det mulig å bestille for store selskaper?", "answer": "Absolutt! Vi tar imot selskaper opp til 60 personer. Ta kontakt for tilpasset meny."}, {"question": "Har dere allergivennlige alternativer?", "answer": "Ja, vi tilpasser retter etter allergier. Gi beskjed ved bestilling."}]}'::jsonb,
   '{"paddingY": "md", "theme": "light"}'::jsonb, true, 1, v_now, v_now);

-- ─── 4. Menu hierarchy ─────────────────────────────────────────
INSERT INTO websites.website_menu (website_menu_id, website_id, workspace_id, name, description, source_type, is_visible, sort_order, created_at, updated_at) VALUES
  (v_menu_id, v_website_id, v_workspace_id, 'Hovedmeny', 'Vår faste meny', 'structured', true, 0, v_now, v_now);

INSERT INTO websites.website_menu_category (website_menu_category_id, website_menu_id, website_id, workspace_id, name, description, sort_order, created_at, updated_at) VALUES
  (v_cat_forrett,   v_menu_id, v_website_id, v_workspace_id, 'Forrett',    'Starters',      0, v_now, v_now),
  (v_cat_hovedrett, v_menu_id, v_website_id, v_workspace_id, 'Hovedrett',  'Main courses',   1, v_now, v_now);

INSERT INTO websites.website_menu_item (website_menu_category_id, website_id, workspace_id, name, description, price, currency, allergens, dietary_tags, is_visible, sort_order, created_at, updated_at) VALUES
  -- Forrett
  (v_cat_forrett, v_website_id, v_workspace_id, 'Gravlaks',          'Husets gravlaks med sennepssaus og dill',       159.00, 'NOK', ARRAY['fisk'],         ARRAY['glutenfri'],          true, 0, v_now, v_now),
  (v_cat_forrett, v_website_id, v_workspace_id, 'Blåskjell',         'Dampede blåskjell i hvitvin og hvitløk',        179.00, 'NOK', ARRAY['bløtdyr'],      ARRAY[]::text[],             true, 1, v_now, v_now),
  (v_cat_forrett, v_website_id, v_workspace_id, 'Fiskesuppe',        'Kremet fiskesuppe med brød',                    149.00, 'NOK', ARRAY['fisk', 'melk'], ARRAY[]::text[],             true, 2, v_now, v_now),
  -- Hovedrett
  (v_cat_hovedrett, v_website_id, v_workspace_id, 'Ovnsbakt torsk',   'Med smørsaus, gulrøtter og potet',             329.00, 'NOK', ARRAY['fisk', 'melk'], ARRAY['glutenfri'],          true, 0, v_now, v_now),
  (v_cat_hovedrett, v_website_id, v_workspace_id, 'Grillet laks',     'Med sesonggrønnsaker og urtesmør',              299.00, 'NOK', ARRAY['fisk', 'melk'], ARRAY['glutenfri'],          true, 1, v_now, v_now),
  (v_cat_hovedrett, v_website_id, v_workspace_id, 'Sjøkreps',         'Helstekt sjøkreps med aioli og pommes frites',  379.00, 'NOK', ARRAY['skalldyr'],     ARRAY[]::text[],             true, 2, v_now, v_now),
  (v_cat_hovedrett, v_website_id, v_workspace_id, 'Vegetar risotto',  'Sopprisotto med trøffelolje og parmesan',       269.00, 'NOK', ARRAY['melk'],         ARRAY['vegetar'],            true, 3, v_now, v_now);

-- ─── 5. Asset ───────────────────────────────────────────────────
INSERT INTO websites.website_asset (website_asset_id, website_id, workspace_id, storage_path, file_name, mime_type, width, height, file_size_bytes, alt_text, uploaded_by, created_at, updated_at) VALUES
  (v_asset_id, v_website_id, v_workspace_id,
   'b0000000-0000-0000-0000-000000000000/hero-sjoboden.jpg',
   'hero-sjoboden.jpg', 'image/jpeg', 1920, 1080, 245000,
   'Sjøboden restaurant ved fjorden', v_profile_id, v_now, v_now);

-- ─── 6. Domain ──────────────────────────────────────────────────
INSERT INTO websites.website_domain (website_domain_id, website_id, workspace_id, domain, domain_type, is_primary, status, ssl_status, created_at, updated_at) VALUES
  (v_domain_id, v_website_id, v_workspace_id,
   'hq-workspace.public.localhost', 'platform_subdomain', true, 'active', 'active',
   v_now, v_now);

-- ─── 7. Published snapshot ──────────────────────────────────────
INSERT INTO websites.website_published_snapshot (
  snapshot_id, website_id, workspace_id, version, snapshot_data, snapshot_hash,
  is_active, published_by, published_at, created_at, updated_at
) VALUES (
  v_snapshot_id, v_website_id, v_workspace_id, 1,
  '{
    "site": {
      "name": "Sjøboden Restaurant",
      "tagline": "Frisk sjømat med utsikt over fjorden",
      "contact": {
        "email": "post@sjoboden.no",
        "phone": "+47 22 33 44 55",
        "address": {
          "street": "Bryggegata 12",
          "city": "Oslo",
          "postalCode": "0250",
          "country": "NO"
        }
      },
      "social": {
        "instagram": "https://instagram.com/sjoboden",
        "facebook": "https://facebook.com/sjoboden",
        "tripadvisor": "https://tripadvisor.com/sjoboden"
      }
    },
    "theme": {
      "colors": {
        "primary": "#1a365d",
        "secondary": "#2d3748",
        "accent": "#ed8936",
        "background": "#ffffff",
        "surface": "#f7fafc",
        "text": "#1a202c",
        "textMuted": "#718096"
      },
      "fonts": {
        "heading": "Playfair Display",
        "body": "Inter"
      },
      "borderRadius": "0.5rem",
      "spacing": "comfortable"
    },
    "navigation": {
      "pages": [
        {"slug": "", "title": "Hjem", "sortOrder": 0},
        {"slug": "meny", "title": "Meny", "sortOrder": 1},
        {"slug": "om-oss", "title": "Om oss", "sortOrder": 2}
      ]
    },
    "pages": {
      "": {
        "title": "Hjem",
        "slug": "",
        "meta": {"title": "Sjøboden Restaurant — Frisk sjømat i Oslo", "description": "Sjømat-restaurant ved fjorden.", "ogImage": ""},
        "sections": [
          {"id": "aa210000-0000-0000-0000-000000000000", "type": "hero", "content": {"heading": "Velkommen til Sjøboden", "subheading": "Frisk sjømat med utsikt over Oslofjorden", "backgroundImage": null, "ctaText": "Bestill bord", "ctaUrl": "https://dinnerbooking.com/sjoboden"}, "settings": {"paddingY": "lg", "theme": "dark"}, "sortOrder": 0},
          {"id": "aa220000-0000-0000-0000-000000000000", "type": "rich_text", "content": {"html": "<p>Vi serverer dagens fangst med kjærlighet og respekt for råvarene.</p>"}, "settings": {"paddingY": "md", "theme": "light"}, "sortOrder": 1},
          {"id": "aa230000-0000-0000-0000-000000000000", "type": "cta", "content": {"heading": "Bestill bord i kveld", "description": "Vi har ledige plasser.", "buttonText": "Reserver nå", "buttonUrl": "https://dinnerbooking.com/sjoboden"}, "settings": {"paddingY": "lg", "theme": "accent"}, "sortOrder": 2}
        ]
      },
      "meny": {
        "title": "Meny",
        "slug": "meny",
        "meta": {"title": "Meny — Sjøboden", "description": "Se vår meny", "ogImage": ""},
        "sections": [
          {"id": "aa240000-0000-0000-0000-000000000000", "type": "menu_full", "content": {"heading": "Vår meny", "description": "Sesongens beste råvarer"}, "settings": {"paddingY": "lg", "theme": "light"}, "sortOrder": 0}
        ]
      },
      "om-oss": {
        "title": "Om oss",
        "slug": "om-oss",
        "meta": {"title": "Om oss — Sjøboden", "description": "Vår historie", "ogImage": ""},
        "sections": [
          {"id": "aa250000-0000-0000-0000-000000000000", "type": "text_image", "content": {"heading": "Vår historie", "body": "Sjøboden åpnet dørene i 2018.", "imagePosition": "right"}, "settings": {"paddingY": "lg", "theme": "light"}, "sortOrder": 0},
          {"id": "aa260000-0000-0000-0000-000000000000", "type": "faq", "content": {"heading": "Ofte stilte spørsmål", "items": [{"question": "Har dere parkering?", "answer": "Ja, gratis parkering."}]}, "settings": {"paddingY": "md", "theme": "light"}, "sortOrder": 1}
        ]
      }
    },
    "menuData": {
      "menus": [
        {
          "name": "Hovedmeny",
          "description": "Vår faste meny",
          "sourceType": "structured",
          "categories": [
            {
              "name": "Forrett",
              "description": "Starters",
              "items": [
                {"name": "Gravlaks", "description": "Husets gravlaks med sennepssaus og dill", "price": 159, "currency": "NOK", "allergens": ["fisk"], "dietaryTags": ["glutenfri"]},
                {"name": "Blåskjell", "description": "Dampede blåskjell i hvitvin og hvitløk", "price": 179, "currency": "NOK", "allergens": ["bløtdyr"], "dietaryTags": []},
                {"name": "Fiskesuppe", "description": "Kremet fiskesuppe med brød", "price": 149, "currency": "NOK", "allergens": ["fisk", "melk"], "dietaryTags": []}
              ]
            },
            {
              "name": "Hovedrett",
              "description": "Main courses",
              "items": [
                {"name": "Ovnsbakt torsk", "description": "Med smørsaus, gulrøtter og potet", "price": 329, "currency": "NOK", "allergens": ["fisk", "melk"], "dietaryTags": ["glutenfri"]},
                {"name": "Grillet laks", "description": "Med sesonggrønnsaker og urtesmør", "price": 299, "currency": "NOK", "allergens": ["fisk", "melk"], "dietaryTags": ["glutenfri"]},
                {"name": "Sjøkreps", "description": "Helstekt sjøkreps med aioli og pommes frites", "price": 379, "currency": "NOK", "allergens": ["skalldyr"], "dietaryTags": []},
                {"name": "Vegetar risotto", "description": "Sopprisotto med trøffelolje og parmesan", "price": 269, "currency": "NOK", "allergens": ["melk"], "dietaryTags": ["vegetar"]}
              ]
            }
          ]
        }
      ]
    },
    "seoDefaults": {
      "title": "Sjøboden Restaurant — Frisk sjømat i Oslo",
      "description": "Sjømat-restaurant ved fjorden. Bestill bord i dag.",
      "ogImage": ""
    },
    "assets": {
      "byId": {
        "aa410000-0000-0000-0000-000000000000": {
          "storagePath": "b0000000-0000-0000-0000-000000000000/hero-sjoboden.jpg",
          "alt": "Sjøboden restaurant ved fjorden",
          "width": 1920,
          "height": 1080,
          "mimeType": "image/jpeg"
        }
      },
      "storageBaseUrl": "http://127.0.0.1:54321/storage/v1/object/public/website-assets"
    },
    "integrations": {
      "booking": {
        "provider": "dinnerbooking",
        "url": "https://dinnerbooking.com/sjoboden"
      }
    },
    "buildMeta": {
      "snapshotVersion": 1,
      "templateKey": "restaurant-classic",
      "templateVersion": 1,
      "schemaVersion": 1,
      "publishedAt": "2026-03-22T00:00:00.000Z",
      "publishedBy": "f0000000-0000-0000-0000-000000000000"
    }
  }'::jsonb,
  'seed-snapshot-hash-v1',
  true, v_profile_id, v_now, v_now, v_now
);

-- ─── 8. Publish event ───────────────────────────────────────────
INSERT INTO websites.website_publish_event (publish_event_id, website_id, workspace_id, snapshot_id, action, performed_by, created_at) VALUES
  (v_event_id, v_website_id, v_workspace_id, v_snapshot_id, 'publish', v_profile_id, v_now);

END;
$$;

COMMIT;
