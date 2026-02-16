import { z } from "zod";

export const DomainPackSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  businessLine: z.string().min(1),
  roleProfiles: z.array(z.any()),
  metricProxies: z.array(z.any()),
  scorePolicies: z.array(z.any()),
});
