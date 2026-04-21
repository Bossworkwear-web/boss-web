-- Remove demo rows inserted by the old "Load sample data" / dev auto-seed flow.
delete from public.supplier_order_lines
where notes = 'SAMPLE:seed';
