import { Router, type Request, type Response } from 'express';
import { loadSpecs } from '../store.js';
import type { Graph, GraphNode, GraphEdge } from '../../shared/types.js';

export function graphRouter(specsDir: string): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const specs = await loadSpecs(specsDir);
      const filtered = specs.filter((s) => s.slug !== '_template');

      const existingIds = new Set(filtered.map((s) => s.id));

      const nodes: GraphNode[] = filtered.map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category,
      }));

      const edges: GraphEdge[] = [];
      const missingIds = new Set<string>();

      for (const spec of filtered) {
        for (const linkTarget of spec.links) {
          edges.push({ source: spec.id, target: linkTarget });
          if (!existingIds.has(linkTarget)) {
            missingIds.add(linkTarget);
          }
        }
      }

      // Add missing nodes
      for (const missingId of missingIds) {
        // Derive a rough title from the id
        const lastColon = missingId.lastIndexOf(':');
        const title = lastColon >= 0 ? missingId.slice(lastColon + 1) : missingId;
        const category = lastColon >= 0 ? missingId.slice(0, lastColon) : '';
        nodes.push({ id: missingId, title, category, missing: true });
      }

      const graph: Graph = { nodes, edges };
      res.json(graph);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
