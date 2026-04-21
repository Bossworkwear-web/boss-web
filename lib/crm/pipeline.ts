export const PIPELINE_STAGES = ["enquiry", "quote", "approval", "completion"] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_LABELS: Record<PipelineStage, string> = {
  enquiry: "Enquiry",
  quote: "Quote sent",
  approval: "Approval",
  completion: "Completion",
};

export function isPipelineStage(value: string): value is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(value);
}
