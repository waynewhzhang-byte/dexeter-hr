import { z } from "zod";

const SkillSchema = z.object({
  code: z.string().min(1),
  weight: z.number().min(0).max(1),
  requiredLevel: z.number().int().min(1).max(5),
});

const RoleProfileSchema = z.object({
  roleCode: z.string().min(1),
  skills: z.array(SkillSchema),
});

const MetricProxySchema = z.object({
  metricCode: z.string().min(1),
  definition: z.string().min(1),
  source: z.string().min(1),
  refreshCron: z.string().min(1),
});

const ScorePolicySchema = z.object({
  scoreType: z.string().min(1),
  formula: z.string().min(1),
  thresholds: z.object({
    high: z.number().min(0).max(1),
    medium: z.number().min(0).max(1),
  }),
});

export const DomainPackSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  businessLine: z.string().min(1),
  roleProfiles: z.array(RoleProfileSchema),
  metricProxies: z.array(MetricProxySchema),
  scorePolicies: z.array(ScorePolicySchema),
});
