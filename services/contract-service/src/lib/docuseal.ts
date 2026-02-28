import { DocusealApi } from "@docuseal/api";
import { config } from "../config.js";

export const docuseal = new DocusealApi({
  key: config.DOCUSEAL_API_KEY,
  url: config.DOCUSEAL_API_URL,
});
