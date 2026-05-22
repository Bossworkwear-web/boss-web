/**
 * Vercel production build wrapper.
 * Clears NEXT_ADAPTER_PATH so Next.js 16 does not run Vercel's modifyConfig adapter
 * (can throw: path argument must be of type string. Received undefined).
 */
import { execSync } from "node:child_process";

if (process.env.NEXT_ADAPTER_PATH) {
  console.log("[boss-web] Clearing NEXT_ADAPTER_PATH for build");
}
delete process.env.NEXT_ADAPTER_PATH;

execSync("npm run build", { stdio: "inherit", env: process.env });
