# Product backlog (Cursor To-do → GitHub / Notion)

이 문장들을 **GitHub Issues**에는 제목·본문으로 각각 새 이슈에 붙여 넣거나, **Notion**에는 체크리스트/데이터베이스 항목으로 복사하면 됩니다. (이 폴더는 git 원격·토큰 없이 로컬에만 기록합니다.)

---

## 1. Real payments (PSP)

**제목 (GitHub Issue title)**

```text
Real payments: integrate PSP (e.g. Stripe Checkout/Elements + webhooks), persist payment id on store_orders, only mark paid after confirmation; test with test keys on localhost/staging
```

**본문 (선택, GitHub Issue body / Notion 설명)**

```text
Real payments: integrate PSP (e.g. Stripe Checkout/Elements + webhooks), persist payment id on store_orders, only mark paid after confirmation; test with test keys on localhost/staging
```

---

## 2. Xero accounting integration

**제목 (GitHub Issue title)**

```text
Xero 연동: Zapier/Make 등 노코드 검토 vs 커스텀 Accounting API(주문→Contact+Sales Invoice); OAuth·토큰·idempotency; AU GST/계정 매핑·회계사 검토; 필요 시 Xero 경험 있는 개발자 검토
```

**본문 (선택, GitHub Issue body / Notion 설명)**

```text
Xero 연동: Zapier/Make 등 노코드 검토 vs 커스텀 Accounting API(주문→Contact+Sales Invoice); OAuth·토큰·idempotency; AU GST/계정 매핑·회계사 검토; 필요 시 Xero 경험 있는 개발자 검토
```

---

## GitHub에서 한 번에 만들 때 (CLI)

저장소가 git으로 연결되어 있고 `gh` 로그인이 되어 있다면, 프로젝트 루트에서 예시:

```bash
gh issue create --title "Real payments: integrate PSP (e.g. Stripe Checkout/Elements + webhooks), persist payment id on store_orders, only mark paid after confirmation; test with test keys on localhost/staging" --body "Same as title."

gh issue create --title "Xero 연동: Zapier/Make 등 노코드 검토 vs 커스텀 Accounting API(주문→Contact+Sales Invoice); OAuth·토큰·idempotency; AU GST/계정 매핑·회계사 검토; 필요 시 Xero 경험 있는 개발자 검토" --body "Same as title."
```
