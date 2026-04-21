/** User-facing message when Storage returns bucket missing (setup not run on this project). */
export function formatClickUpSheetStorageError(message: string): string {
  const m = message.trim();
  const lower = m.toLowerCase();
  if (
    lower.includes("bucket not found") ||
    lower.includes("the specified bucket does not exist") ||
    (lower.includes("not found") && lower.includes("bucket"))
  ) {
    return (
      "Supabase에 스토리지 버킷 click-up-sheet-images 가 없습니다. " +
      "SQL Editor에서 supabase/sql-editor/click_up_sheet_images_full_setup.sql 전체를 실행하세요(테이블+버킷). " +
      "테이블은 이미 있다면 supabase/sql-editor/click_up_sheet_images_bucket_only.sql 만 실행해도 됩니다. " +
      "실행 후 이 페이지에서 다시 업로드하세요.\n\nDetails: " +
      m
    );
  }
  return m;
}
