-- Staff draft on CRM Send quote: embroidery vs print service wording for the customer.
alter table public.quote_requests add column if not exists quote_email_embroidery_service text;
alter table public.quote_requests add column if not exists quote_email_print_service text;
