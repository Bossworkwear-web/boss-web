-- Staff-uploaded mockup images for CRM Send quote page (public URLs, same bucket as customer logos).
alter table public.quote_requests add column if not exists quote_mockup_image_urls text[];
