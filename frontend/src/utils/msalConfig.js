import { PublicClientApplication } from "@azure/msal-browser";

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID || "common";

export const isMicrosoftLoginEnabled = !!clientId;

const msalConfig = {
  auth: {
    clientId: clientId || "00000000-0000-0000-0000-000000000000",
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

const loginRequest = {
  scopes: ["openid", "profile", "email"],
};

let _instance = null;

export async function getMsalInstance() {
  if (!isMicrosoftLoginEnabled) return null;
  if (!_instance) {
    _instance = new PublicClientApplication(msalConfig);
    await _instance.initialize();
  }
  return _instance;
}

export { loginRequest };
