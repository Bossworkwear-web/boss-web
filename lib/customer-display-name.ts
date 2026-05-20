/** First token of customer_name for short greetings (e.g. "Hi, Jane"). */
export function customerFirstName(customerName: string): string {
  const trimmed = customerName.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.split(/\s+/)[0] ?? trimmed;
}
