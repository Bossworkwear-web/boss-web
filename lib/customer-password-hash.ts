import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEYLEN = 64;
const PREFIX = "v1";

/** Stored format: v1$<salt_hex>$<hash_hex> */
export function hashCustomerPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p });
  return `${PREFIX}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function isCustomerPasswordHash(stored: string | null | undefined): boolean {
  const s = String(stored ?? "").trim();
  return s.startsWith(`${PREFIX}$`);
}

export function verifyCustomerPassword(plain: string, stored: string | null | undefined): boolean {
  const s = String(stored ?? "").trim();
  if (!s) {
    return false;
  }

  if (isCustomerPasswordHash(s)) {
    const parts = s.split("$");
    if (parts.length !== 3 || parts[0] !== PREFIX) {
      return false;
    }
    let salt: Buffer;
    let expected: Buffer;
    try {
      salt = Buffer.from(parts[1]!, "hex");
      expected = Buffer.from(parts[2]!, "hex");
    } catch {
      return false;
    }
    if (salt.length < 8 || expected.length < 32) {
      return false;
    }
    let hash: Buffer;
    try {
      hash = scryptSync(plain, salt, expected.length, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p });
    } catch {
      return false;
    }
    if (hash.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(hash, expected);
  }

  const a = Buffer.from(plain, "utf8");
  const b = Buffer.from(s, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
