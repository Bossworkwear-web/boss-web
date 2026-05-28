import { ensureNodeTimezone } from "@/lib/perth-calendar";

export async function register() {
  ensureNodeTimezone();
}
