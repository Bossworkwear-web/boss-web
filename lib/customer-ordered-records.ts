/**
 * My account → Ordered records: how many recent `store_orders` rows to load per signed-in customer.
 * Keep in sync with `app/customer/page.tsx`.
 */
export const MY_ACCOUNT_ORDERED_RECORDS_LIMIT = 50;

/** Admin → Customer Invoices: recent storefront orders (newest first) with the same PDF download as My account. */
export const ADMIN_CUSTOMER_INVOICES_LIMIT = 100;
