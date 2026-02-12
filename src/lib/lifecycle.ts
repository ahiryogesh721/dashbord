import { InterestLabel, LeadStage } from "@prisma/client";

export function initialLeadStage(visitTime?: string | null): LeadStage {
  return visitTime?.trim() ? LeadStage.visit_scheduled : LeadStage.new;
}

export function followUpDueAt({
  interestLabel,
  stage,
  now = new Date(),
}: {
  interestLabel: InterestLabel;
  stage: LeadStage;
  now?: Date;
}): Date {
  const dueAt = new Date(now);

  if (stage === LeadStage.visit_scheduled) {
    dueAt.setHours(dueAt.getHours() + 6);
    return dueAt;
  }

  if (interestLabel === InterestLabel.hot) {
    dueAt.setHours(dueAt.getHours() + 2);
    return dueAt;
  }

  if (interestLabel === InterestLabel.warm) {
    dueAt.setHours(dueAt.getHours() + 24);
    return dueAt;
  }

  dueAt.setHours(dueAt.getHours() + 72);
  return dueAt;
}

export function buildFollowUpMessage(customerName?: string | null): string {
  const name = customerName?.trim() || "there";
  return `Hi ${name}, thank you for your time today. Our team will follow up with the next steps shortly.`;
}
