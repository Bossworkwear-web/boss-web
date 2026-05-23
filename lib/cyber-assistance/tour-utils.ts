import type { DriveStep } from "driver.js";

export function stepTargetExists(step: DriveStep): boolean {
  const el = step.element;
  if (!el || typeof el !== "string") {
    return true;
  }
  return Boolean(document.querySelector(el));
}

export function filterTourSteps(steps: DriveStep[]): DriveStep[] {
  return steps.filter(stepTargetExists);
}
