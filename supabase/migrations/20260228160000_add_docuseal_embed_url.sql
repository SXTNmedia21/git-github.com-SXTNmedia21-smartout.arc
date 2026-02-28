-- Add docuseal_embed_url column to contract table.
-- signing_url stores a short random token for URL path lookup.
-- docuseal_embed_url stores the actual DocuSeal embed/signing URL.
ALTER TABLE public.contract
  ADD COLUMN IF NOT EXISTS docuseal_embed_url text;

COMMENT ON COLUMN public.contract.docuseal_embed_url IS 'Full DocuSeal embed URL for signing iframe';
COMMENT ON COLUMN public.contract.signing_url IS 'Short token used in /sign/:token URL path for contract lookup';
