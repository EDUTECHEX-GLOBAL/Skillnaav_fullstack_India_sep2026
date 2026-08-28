// config.js
import { Client, Account } from "appwrite";

// Initialize Appwrite Client
const client = new Client();
client
  .setEndpoint("https://cloud.appwrite.io/v1") // Appwrite endpoint
  .setProject("6715ee9b0034e652fb17"); // Replace with your actual project ID

// OAuth Credentials
export const googleOAuth = {
  appId:
    "805153616143-nrsjta36jv8i0skke363gustddqpctjn.apps.googleusercontent.com",
  appSecret:
    "805153616143-nrsjta36jv8i0skke363gustddqpctjn.apps.googleusercontent.com",
  redirectUri:
    "https://cloud.appwrite.io/v1/account/sessions/oauth2/callback/google/6715ee9b0034e652fb17",
};

export const account = new Account(client);
export default client;

// ---- API hosts (env-driven; no runtime overrides) ----
const stripTrailingSlash = (s = "") => s.replace(/\/+$/, "");

// Accept either REACT_APP_API_BASE or REACT_APP_API_BASE_URL
const rawApiBase =
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_BASE_URL ||
  "";

export const API_BASE = stripTrailingSlash(rawApiBase);

// Frontend base: use env if provided, else current origin
export const FRONTEND_BASE = stripTrailingSlash(
  process.env.REACT_APP_FRONTEND_BASE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "")
);

// Browser navigation URL to your backend auth route
export const GOOGLE_AUTH_URL = `${API_BASE}/api/google/auth`;