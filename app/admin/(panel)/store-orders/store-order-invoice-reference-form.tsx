import { updateStoreOrderInvoiceReference } from "@/app/admin/(panel)/store-orders/actions";

export function StoreOrderInvoiceReferenceForm({
  orderId,
  initialReference,
}: {
  orderId: string;
  initialReference: string | null;
}) {
  return (
    <form
      className="mt-2 max-w-[14rem] space-y-1"
      action={async (formData) => {
        "use server";
        const id = String(formData.get("orderId") ?? "").trim();
        const ref = String(formData.get("invoice_reference") ?? "");
        await updateStoreOrderInvoiceReference(id, ref);
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <label className="block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
        Tax invoice · Reference
        <input
          name="invoice_reference"
          defaultValue={initialReference ?? ""}
          maxLength={500}
          placeholder="Optional"
          autoComplete="off"
          className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs text-brand-navy placeholder:text-slate-400"
        />
      </label>
      <button
        type="submit"
        className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[0.7rem] font-semibold text-brand-navy shadow-sm hover:border-brand-orange hover:text-brand-orange"
      >
        Save
      </button>
    </form>
  );
}
