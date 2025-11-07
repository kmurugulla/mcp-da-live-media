import { getUserAgent } from "universal-user-agent";

export const VERSION = process.env.VERSION || "0.0.1";
export const USER_AGENT = `modelcontextprotocol/servers/da-live/v${VERSION} ${getUserAgent()}`;
export const ADMIN_API_URL = "https://admin.da.live";

export const LIBRARY_TYPES = {
  BLOCKS: 'blocks',
  TEMPLATES: 'templates',
  ICONS: 'icons',
  PLACEHOLDERS: 'placeholders'
};

export const LIBRARY_CONFIG = {
  blocks: {
    multiSheet: true,
    hasOptions: true
  }
};

export const CONFIG_TYPES = {
  METADATA: 'metadata',
  REDIRECTS: 'redirects'
};

