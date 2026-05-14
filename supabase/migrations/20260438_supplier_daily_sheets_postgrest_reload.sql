-- Ensures PostgREST picks up supplier_daily_sheets after 20260437 (avoids stale schema cache).

notify pgrst, 'reload schema';
