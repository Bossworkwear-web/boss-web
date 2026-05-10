import { updateStoreOrderHoldFields } from "@/app/admin/(panel)/store-orders/actions";

export function StoreOrderHoldForm({
  orderId,
  initialHoldProcess,
  initialHoldNote,
}: {
  orderId: string;
  initialHoldProcess: boolean;
  initialHoldNote: string | null;
}) {
  return (
    <form className="mt-2 max-w-[18rem] space-y-2" action={updateStoreOrderHoldFields}>
      <input type="hidden" name="orderId" value={orderId} />
      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-brand-navy">
        <input
          type="checkbox"
          name="hold_process"
          value="1"
          defaultChecked={initialHoldProcess}
          className="h-4 w-4 rounded border-slate-300 text-brand-orange focus:ring-brand-orange"
        />
        Hold process
      </label>
      <label className="block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
        Note
        <textarea
          name="hold_note"
          defaultValue={initialHoldNote ?? ""}
          rows={2}
          maxLength={2000}
          placeholder="Optional"
          className="mt-0.5 w-full resize-y rounded border border-slate-200 px-2 py-1 text-xs text-brand-navy placeholder:text-slate-400"
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
