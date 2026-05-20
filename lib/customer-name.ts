/** Combine first + surname for customer_profiles.customer_name (no DB schema change). */
export function combineCustomerName(firstName: string, surname: string): string {
  return [firstName.trim(), surname.trim()].filter(Boolean).join(" ");
}

/** Split stored customer_name for editing (first token / remainder). */
export function splitCustomerName(customerName: string): { firstName: string; surname: string } {
  const trimmed = customerName.trim();
  if (!trimmed) {
    return { firstName: "", surname: "" };
  }
  const space = trimmed.indexOf(" ");
  if (space === -1) {
    return { firstName: trimmed, surname: "" };
  }
  return {
    firstName: trimmed.slice(0, space).trim(),
    surname: trimmed.slice(space + 1).trim(),
  };
}
