import { IncomingGoodsClient } from "./incoming-goods-client";
import { listIncomingGoodsRows } from "./actions";

export const dynamic = "force-dynamic";

export default async function IncomingGoodsPage() {
  const res = await listIncomingGoodsRows();
  return <IncomingGoodsClient initial={res} />;
}

