import { DocusealApi } from "@docuseal/api";
import { config } from "../config.js";
import { getSecrets } from "../secrets.js";

let _docuseal: DocusealApi | null = null;

/**
 * Returns the DocuSeal API client, lazily initialized with the Vault key.
 * loadSecrets() must have been called before first use.
 */
export function getDocuseal(): DocusealApi {
  if (!_docuseal) {
    _docuseal = new DocusealApi({
      key: getSecrets().docusealApiKey,
      url: config.DOCUSEAL_API_URL,
    });
  }
  return _docuseal;
}
