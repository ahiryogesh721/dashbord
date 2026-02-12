export const LEAD_STAGES = ["new", "contacted", "visit_scheduled", "visit_done", "closed", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const INTEREST_LABELS = ["hot", "warm", "cold"] as const;
export type InterestLabel = (typeof INTEREST_LABELS)[number];

export const SITE_VISIT_STATUSES = ["scheduled", "completed", "cancelled", "no_show"] as const;
export type SiteVisitStatus = (typeof SITE_VISIT_STATUSES)[number];

export const FOLLOW_UP_STATUSES = ["pending", "completed", "skipped", "cancelled"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

