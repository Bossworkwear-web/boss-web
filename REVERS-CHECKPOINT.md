# revers checkpoint — boss-web storefront snapshot

**Flag:** 사용자가 채팅에 **`revers`** 라고 쓰면 → 이 문서를 기준으로 현재 코드가 여기 설명과 맞는지 확인하고, 빠진 부분은 이 스펙에 맞게 되돌리거나 복구한다.

**날짜 참고:** 2026-04-05 경 작업 묶음

## 핵심 동작 요약

1. **홈 히어로 (`HomeHero`)**
   - 서버 컴포넌트: `app/components/home-hero.tsx`
   - **이미지 없음**, 배경 **남색 `#001f3f`** (`.home-hero-strip` in `app/globals.css`)
   - **풀블리드:** `100vw` + `translateX` 사용 금지. **`width: 100%`** + `<main>`에 **`overflow-x-clip` 없음** (히어로가 잘리지 않게)
   - 홈 `app/page.tsx` 순서: **`TopNav` → `HomeHero` → `ProductShowcase` (`hideTopNav`)**

2. **레이아웃 여백**
   - `lib/site-layout.ts`: `SITE_PAGE_INSET_X_CLASS = px-[5cm]`, `SITE_PAGE_ROW_CLASS` = 전체 폭 + 좌우 5cm
   - 히어로만 예외 (위 CSS), 나머지 섹션·푸터·헤더는 기존 패턴 유지

3. **상단 네비 (`top-nav.tsx`)**
   - `px-[40mm]` 제거됨, 반응형 패딩 + 카테고리 **링크·드롭다운 서브 링크** 동작
   - 모바일 메뉴: 경로 변경·Escape로 닫힘, z-index 분리

4. **카테고리 목록**
   - `lg:grid-cols-5` + `app/store-ui.css` 미디어쿼리로 5열 고정
   - `lib/main-category-browse.ts`: `CATEGORY_BROWSE_PAGE_SIZE = 15`, 페이지네이션 유지
   - `app/categories/[slug]/[subSlug]/page.tsx`: 서브별 상품 목록 (리다이렉트만 하지 않음)

5. **페이지네이션 문구**
   - 카테고리 페이지 하단: `text-[1.05rem]` 등으로 약 20% 큰 글자

6. **제거·주의**
   - 홈 히어로에 **Unsplash/그라데이션 히어로 이미지 없음**
   - `ProductShowcase`의 **`showHomeHero` prop 제거됨** — 히어로는 `page.tsx`의 `HomeHero`만 사용

## 주요 파일 목록

- `app/page.tsx` — TopNav, HomeHero, ProductShowcase(hideTopNav)
- `app/components/home-hero.tsx`
- `app/globals.css` — `.home-hero-strip`, `.home-hero-strip-inner`
- `app/components/product-showcase.tsx` — `hideTopNav`
- `lib/site-layout.ts`
- `app/components/top-nav.tsx`
- `app/store-ui.css` — browse grid 5 col
- `lib/main-category-browse.ts` — `CATEGORY_BROWSE_PAGE_SIZE`
- `app/categories/[slug]/page.tsx`, `[subSlug]/page.tsx`

## 나중에 Git을 쓰게 되면

```bash
git add -A && git commit -m "checkpoint: revers storefront snapshot"
git tag revers
# 복귀: git checkout revers  (또는 main에서 git reset --hard revers 는 주의해서 사용)
```
