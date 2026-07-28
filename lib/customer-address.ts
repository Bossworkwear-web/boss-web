/** Stored customer profile addresses (comma-separated segments). */

export type CustomerAddressParts = {
  address1: string;
  address2: string;
  suburb: string;
  postcode: string;
  state: string;
  country: string;
};

const AU_POSTCODE_RE = /^\d{4}$/;

function emptyParts(): CustomerAddressParts {
  return { address1: "", address2: "", suburb: "", postcode: "", state: "", country: "" };
}

/** Pull a trailing Australian postcode off a segment like "Salisbury South 5106". */
function splitTrailingPostcode(segment: string): { text: string; postcode: string } {
  const trimmed = segment.trim();
  const m = trimmed.match(/^(.*?)(?:\s+)(\d{4})$/);
  if (m?.[1]?.trim() && AU_POSTCODE_RE.test(m[2] ?? "")) {
    return { text: m[1].trim(), postcode: m[2]! };
  }
  return { text: trimmed, postcode: "" };
}

/**
 * Parse a stored address. Supports legacy order (…, suburb, postcode, state, country)
 * and current order (…, suburb, state, postcode, country).
 */
export function parseCustomerAddress(rawAddress: string | null | undefined): CustomerAddressParts {
  const segments = (rawAddress ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (segments.length === 0) {
    return emptyParts();
  }

  const country = segments.length >= 2 ? (segments[segments.length - 1] ?? "") : "";
  const beforeCountry = segments.length >= 2 ? segments.slice(0, -1) : segments;

  let postcode = "";
  let state = "";
  let head = beforeCountry;

  if (beforeCountry.length >= 2) {
    const a = beforeCountry[beforeCountry.length - 2] ?? "";
    const b = beforeCountry[beforeCountry.length - 1] ?? "";
    if (AU_POSTCODE_RE.test(a) && !AU_POSTCODE_RE.test(b)) {
      // Legacy: …, postcode, state
      postcode = a;
      state = b;
      head = beforeCountry.slice(0, -2);
    } else if (AU_POSTCODE_RE.test(b)) {
      // Current: …, state, postcode
      state = a;
      postcode = b;
      head = beforeCountry.slice(0, -2);
    } else {
      const splitB = splitTrailingPostcode(b);
      if (splitB.postcode) {
        state = a;
        postcode = splitB.postcode;
        head = [...beforeCountry.slice(0, -2), splitB.text].filter(Boolean);
      } else {
        const splitA = splitTrailingPostcode(a);
        if (splitA.postcode) {
          postcode = splitA.postcode;
          state = b;
          head = [...beforeCountry.slice(0, -2), splitA.text].filter(Boolean);
        } else {
          state = b;
          head = beforeCountry.slice(0, -1);
        }
      }
    }
  } else if (beforeCountry.length === 1) {
    const split = splitTrailingPostcode(beforeCountry[0] ?? "");
    if (split.postcode) {
      postcode = split.postcode;
      head = split.text ? [split.text] : [];
    }
  }

  // Also peel postcode mashed into the last head segment (suburb line).
  if (!postcode && head.length > 0) {
    const last = head[head.length - 1] ?? "";
    const split = splitTrailingPostcode(last);
    if (split.postcode) {
      postcode = split.postcode;
      head = [...head.slice(0, -1), split.text].filter(Boolean);
    }
  }

  if (head.length >= 3) {
    return {
      address1: head[0] ?? "",
      address2: head[1] ?? "",
      suburb: head.slice(2).join(", "),
      postcode,
      state,
      country,
    };
  }
  if (head.length === 2) {
    return {
      address1: head[0] ?? "",
      address2: "",
      suburb: head[1] ?? "",
      postcode,
      state,
      country,
    };
  }
  return {
    address1: head[0] ?? "",
    address2: "",
    suburb: "",
    postcode,
    state,
    country,
  };
}

/** Persist order: address lines, suburb, state, postcode, country. */
export function composeCustomerAddress(parts: CustomerAddressParts): string {
  return [parts.address1, parts.address2, parts.suburb, parts.state, parts.postcode, parts.country]
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0)
    .join(", ");
}

/** Reorder a stored address for display (postcode after state). */
export function formatCustomerAddressForDisplay(rawAddress: string | null | undefined): string {
  const raw = (rawAddress ?? "").trim();
  if (!raw) {
    return "";
  }
  return composeCustomerAddress(parseCustomerAddress(raw));
}
