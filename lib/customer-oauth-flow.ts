/** Short-lived cookie: which log-in tab started OAuth (Google / Microsoft). */
export const CUSTOMER_OAUTH_FLOW_COOKIE = "customer_oauth_flow";

export type CustomerOAuthFlow = "login" | "signup";
