# DB 관련 업데이트 백로그

Supabase 접근이 어려워 **나중에 한 번에 처리**하기로 한 작업들입니다.  
DB/동기화가 가능해지면 아래부터 순서대로 진행하면 됩니다.

## 1. Aussie Pacific API 동기화

**목적:** `image_urls`가 `available_colors`(알파벳 정렬)와 같은 색 블록 순서로 맞도록 하고, 폴백 시 API variant 원본 순서가 아닌 **색 키 정렬**을 쓰도록 한 `scripts/sync-aussie-pacific-api.mjs` 변경을 DB에 반영.

**실행 (레포 루트):**

```bash
npm run sync:aussie-pacific
```

선택: `--dry-run`, `--limit=50` 등으로 먼저 확인.

**환경:** `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`(또는 anon), `AUSSIE_PACIFIC_API_TOKEN` 필요.

**참고 스타일:** 1903L 등 칩 순서(예: Black Navy → Slate → White)와 썸네일 순서가 한 칸 어긋나던 케이스는 **이 동기화로 정렬**되는 것이 전제.

---

## 2. Fashion Biz 폴더 동기화 (Biz Collection / Biz Care / Syzmik)

**목적:** `sync-supplier-catalog.mjs`에서 갤러리를 **색 이름 순(`colorsFromFiles`)과 같은 블록 순서**로 쌓도록 한 변경을 DB의 `image_urls`에 반영.

**실행 예:**

```bash
npm run sync:fashion-biz
# 또는 전체 supplier 스크립트
npm run sync:supplier -- --supplier=fashion-biz
# 브랜드만:
# npm run sync:supplier -- --supplier=fashion-biz --only-brand="Biz Collection"
```

**환경:** Supabase URL + service role(또는 스크립트가 요구하는 키), 로컬/스토리지에 맞는 이미지 경로.

---

## 3. Supabase 마이그레이션 적용 여부 확인

**목적:** 레포의 `supabase/migrations/`가 **실제 프로젝트 DB**에 모두 반영됐는지 확인 (접근 복구 후).

- Supabase CLI: `supabase db push` 또는 대시보드 SQL로 미적용분만 적용.
- 배포 환경과 **동일 프로젝트**인지(`NEXT_PUBLIC_SUPABASE_URL` ref) 확인.

(특정 마이그레이션 이름은 그때그때 `migrations` 폴더와 diff로 점검.)

---

## 4. PDP 캐시 / 배포 (데이터 반영 후)

**목적:** `app/products/[slug]/page.tsx`의 `unstable_cache` 키(`storefront-pdp-v13` 등)가 바뀌었거나, 데이터만 고치고 화면이 잠깐 옛 데이터처럼 보일 때.

- 배포 후 제품 페이지 **강력 새로고침**, 또는 캐시 키 버전 올리기(이미 여러 번 반영됨).

---

## 하지 않기로 한 것 (의도적으로 제외)

- **슬러그별 갤러리 URL 직믈(클라이언트만 회전)** 등 DB 없이 넣는 임시 오버라이드 — DB 고친 뒤 동기화로 맞추는 방향 유지.

---

*이 파일은 에이전트/사람 모두 “DB 관련 업데이트 리스트” 요청 시 이 내용을 기준으로 안내하면 됩니다.*
