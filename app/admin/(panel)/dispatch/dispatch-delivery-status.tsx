import {
  buildDeliveryTimeline,
  type DeliveryTimelineStep,
  type OrderTrackDeliveryPayload,
} from "@/lib/order-track-delivery";

function dotClass(dot: DeliveryTimelineStep["dot"]): string {
  switch (dot) {
    case "complete":
      return "border-brand-orange bg-brand-orange text-white";
    case "current":
      return "border-brand-orange bg-white text-brand-orange ring-2 ring-brand-orange/40";
    case "cancelled":
      return "border-slate-300 bg-slate-200 text-slate-500";
    default:
      return "border-brand-navy/20 bg-white text-transparent";
  }
}

function connectorClass(step: DeliveryTimelineStep, next: DeliveryTimelineStep | undefined): string {
  if (!next) return "bg-transparent";
  const done = step.dot === "complete" || step.dot === "cancelled";
  const nextDone = next.dot === "complete" || next.dot === "cancelled";
  if (done && nextDone) return "bg-brand-orange/50";
  if (done && next.dot === "current") return "bg-gradient-to-r from-brand-orange/50 to-brand-navy/15";
  if (step.dot === "current") return "bg-brand-navy/15";
  return "bg-brand-navy/10";
}

/** Compact horizontal Delivery status (same steps as the customer track page). */
export function DispatchDeliveryStatusHorizontal({ payload }: { payload: OrderTrackDeliveryPayload }) {
  const steps = buildDeliveryTimeline(payload);

  return (
    <ol className="flex w-full min-w-[24rem] list-none items-start p-0" aria-label="Delivery status">
      {steps.map((step, i) => {
        const next = steps[i + 1];
        return (
          <li key={step.key} className="relative flex min-w-0 flex-1 flex-col items-center px-1 text-center">
            <div className="relative flex h-5 w-full items-center justify-center">
              {i > 0 ? (
                <span
                  className={`absolute right-1/2 top-1/2 h-0.5 w-[calc(50%+0.25rem)] -translate-y-1/2 ${connectorClass(steps[i - 1]!, step)}`}
                  aria-hidden
                />
              ) : null}
              {next ? (
                <span
                  className={`absolute left-1/2 top-1/2 h-0.5 w-[calc(50%+0.25rem)] -translate-y-1/2 ${connectorClass(step, next)}`}
                  aria-hidden
                />
              ) : null}
              <span
                className={`relative z-[1] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[0.65rem] font-bold leading-none ${dotClass(step.dot)}`}
                aria-hidden
              >
                {step.dot === "complete" ? "\u2713" : ""}
              </span>
            </div>
            <p className="mt-1.5 text-[0.7rem] font-semibold leading-tight text-brand-navy">{step.title}</p>
            <p className="mt-0.5 line-clamp-2 text-[0.65rem] leading-snug text-slate-500" title={step.subtitle}>
              {step.subtitle}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
