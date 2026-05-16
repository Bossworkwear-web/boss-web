# 정식 런치 전 짧은 체크리스트

런치 준비할 때 이 파일을 열어 확인하세요.

- [ ] **원격 Git 반영:** 테스트가 끝난 뒤 `git push origin main` (또는 팀 규칙에 맞는 브랜치/PR)으로 GitHub 등에 올리기
- [ ] 프로덕션 환경 변수·시크릿 최종 점검 (`NEXT_PUBLIC_SITE_URL=https://bossworkwear.au`)
- [ ] DB 마이그레이션 적용 여부 확인 (Staging / Production)
- [ ] 스테이징에서 최종 확인 후 프로덕션 배포
- [ ] 이미지 최적화: `npm run optimize:public-images` (런치 전 또는 배포 파이프라인에 포함)
- [ ] sharp 로컬 확인: `npm run reinstall:sharp` → `sharp: ok`
- [ ] `npm run build` 로컬 통과 확인
- [ ] 홈 `/` ISR 60초 (`revalidate = 60`), `/?q=`·`/?category=` 는 middleware 리다이렉트