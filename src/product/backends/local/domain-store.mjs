import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { z } from 'zod';

const id = z.string().min(1).max(200);
const association = z.object({
  projectId: id, coordinatorSessionId: id, messageId: id, messageSeq: z.number().int().nonnegative(),
  threadId: z.string().uuid(), threadSessionId: z.string().uuid(), title: id, requestTitle: id,
  status: z.string().min(1).max(64), phase: z.enum(['pending', 'active']),
  createdAt: z.number().finite(), updatedAt: z.number().finite(), version: z.number().int().positive(),
  idempotencyKey: id, lastError: z.string().optional(),
}).strict();
const scope = z.object({ projectId: z.string().uuid(), coordinatorSessionId: z.string().uuid(), title: id, cwd: z.string().min(1), createdAt: z.number().finite(), ready: z.boolean() }).strict();
/** Only association state plus the explicitly enabled development entry's scope addresses; no full Project Store. */
export async function openAssociationDomain(storageDomain, namespace) {
  return storageDomain.open(defineDomain({ name: namespace, version: 1, layout: 'single', tables: { links: domainTable(association), scopes: domainTable(scope) } }));
}
