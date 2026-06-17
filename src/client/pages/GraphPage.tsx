/**
 * Link graph. Fetches GET /api/graph and lays it out with d3-force, rendered as SVG.
 * - forceLink / forceManyBody / forceCenter / forceCollide
 * - Color-coded by category; missing nodes are shown with a grey dashed border
 * - Click to preview in right pane; hover to highlight neighbors (others dimmed)
 * - Wheel zoom + background drag to pan (viewBox transform, no d3-zoom)
 * - Node drag to reposition (drag does not trigger click navigation)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import type { Graph, GraphNode } from '@shared/types';
import { fetchGraph, ApiHttpError } from '../api';
import { useCategoryStyles } from '../hooks/useCategoryStyles';
import { GraphPreviewPane } from '../components/GraphPreviewPane';
import { PageContainer, PageBar, PageTitle, Loading } from '../components/Page';

interface SimNode extends SimulationNodeDatum {
  id: string;
  title: string;
  category: string;
  missing: boolean;
}

type SimLink = SimulationLinkDatum<SimNode>;

const WIDTH = 1200;
const HEIGHT = 800;

export function GraphPage() {
  const { categoryColor, categoryIcon } = useCategoryStyles();
  const [graph, setGraph] = useState<Graph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, forceRender] = useState(0);
  // ID of the selected node (shown in the right preview pane). null = full-width
  const [selected, setSelected] = useState<string | null>(null);

  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // viewBox (pan/zoom)
  const [view, setView] = useState({ x: 0, y: 0, w: WIDTH, h: HEIGHT });
  const [hovered, setHovered] = useState<string | null>(null);
  const dragState = useRef<
    | { kind: 'pan'; startX: number; startY: number; origin: typeof view }
    | { kind: 'node'; node: SimNode }
    | null
  >(null);
  // Node drag detection: pointerdown position and whether movement exceeded the threshold
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetchGraph()
      .then((g) => {
        if (active) setGraph(g);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof ApiHttpError ? err.message : 'Failed to load graph.');
      });
    return () => {
      active = false;
    };
  }, []);

  // Build simulation
  useEffect(() => {
    if (!graph) return;
    const nodes: SimNode[] = graph.nodes.map((n: GraphNode) => ({
      id: n.id,
      title: n.title,
      category: n.category,
      missing: !!n.missing,
    }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = graph.edges
      .filter((e) => byId.has(e.source) && byId.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));

    nodesRef.current = nodes;
    linksRef.current = links;

    const sim = forceSimulation<SimNode, SimLink>(nodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(90)
          .strength(0.6),
      )
      .force('charge', forceManyBody<SimNode>().strength(-260))
      .force('center', forceCenter<SimNode>(WIDTH / 2, HEIGHT / 2))
      .force('collide', forceCollide<SimNode>(34));

    sim.on('tick', () => {
      forceRender((n) => n + 1);
    });

    simRef.current = sim;
    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, [graph]);

  // Close preview on Escape
  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  // Neighbor set (for highlight). Built directly from graph.edges.
  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!graph) return map;
    for (const e of graph.edges) {
      if (!map.has(e.source)) map.set(e.source, new Set());
      if (!map.has(e.target)) map.set(e.target, new Set());
      map.get(e.source)!.add(e.target);
      map.get(e.target)!.add(e.source);
    }
    return map;
  }, [graph]);

  const isDimmed = (id: string): boolean => {
    if (!hovered) return false;
    if (id === hovered) return false;
    // Never dim the selected node (always fully opaque)
    if (id === selected) return false;
    return !neighbors.get(hovered)?.has(id);
  };

  // Convert client coordinates to SVG user coordinates
  const toUser = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const px = (clientX - rect.left) / rect.width;
      const py = (clientY - rect.top) / rect.height;
      return { x: view.x + px * view.w, y: view.y + py * view.h };
    },
    [view],
  );

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1;
    const focus = toUser(e.clientX, e.clientY);
    setView((v) => {
      const w = v.w * factor;
      const h = v.h * factor;
      // Zoom while keeping the focal point fixed
      return {
        w,
        h,
        x: focus.x - ((focus.x - v.x) / v.w) * w,
        y: focus.y - ((focus.y - v.y) / v.h) * h,
      };
    });
  };

  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragState.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, origin: view };
  };

  const onNodePointerDown = (e: React.PointerEvent, node: SimNode) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragState.current = { kind: 'node', node };
    // Reset drag detection and record the start position
    pointerStart.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    simRef.current?.alphaTarget(0.3).restart();
    node.fx = node.x;
    node.fy = node.y;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds) return;
    if (ds.kind === 'pan') {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dx = ((e.clientX - ds.startX) / rect.width) * ds.origin.w;
      const dy = ((e.clientY - ds.startY) / rect.height) * ds.origin.h;
      setView({ ...ds.origin, x: ds.origin.x - dx, y: ds.origin.y - dy });
    } else {
      // Treat as drag (suppress click) once cumulative movement exceeds ~5px threshold
      const start = pointerStart.current;
      if (start && !movedRef.current) {
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (dx * dx + dy * dy > 25) movedRef.current = true;
      }
      const p = toUser(e.clientX, e.clientY);
      ds.node.fx = p.x;
      ds.node.fy = p.y;
    }
  };

  const onPointerUp = () => {
    const ds = dragState.current;
    if (ds?.kind === 'node') {
      simRef.current?.alphaTarget(0);
      ds.node.fx = null;
      ds.node.fy = null;
    }
    dragState.current = null;
  };

  if (error) {
    return (
      <PageContainer>
        <div
          className="my-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3.5"
          role="alert"
        >
          <div className="mb-1 font-bold text-destructive">Graph Error</div>
          <div className="whitespace-pre-wrap font-mono text-[13px] text-[#991b1b]">
            {error}
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!graph) return <Loading />;

  const nodes = nodesRef.current;
  const links = linksRef.current;

  return (
    <div className="flex h-full flex-col">
      <PageBar tight>
        <PageTitle>Link Graph</PageTitle>
        <span className="text-xs text-muted-foreground">
          Click to preview / Drag node to reposition / Drag background to pan /
          Scroll to zoom
        </span>
      </PageBar>
      <div className="flex min-h-0 flex-1">
      <div className="sb-graph-canvas">
        <svg
          ref={svgRef}
          className="sb-graph-svg"
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          onWheel={onWheel}
          onPointerDown={onBackgroundPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <g>
            {links.map((l, i) => {
              const s = l.source as SimNode;
              const t = l.target as SimNode;
              if (typeof s !== 'object' || typeof t !== 'object') return null;
              const dim = isDimmed(s.id) && isDimmed(t.id);
              return (
                <line
                  key={i}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  className="sb-graph-edge"
                  opacity={dim ? 0.08 : 0.5}
                />
              );
            })}
          </g>
          <g>
            {nodes.map((n) => {
              const dim = isDimmed(n.id);
              const color = n.missing ? '#9ca3af' : categoryColor(n.category);
              const icon = n.missing ? undefined : categoryIcon(n.category);
              const isSelected = n.id === selected;
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x ?? 0}, ${n.y ?? 0})`}
                  className="sb-graph-node"
                  opacity={dim ? 0.2 : 1}
                  onPointerDown={(e) => onNodePointerDown(e, n)}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => {
                    // Ignore clicks immediately after a drag
                    if (movedRef.current) return;
                    if (!n.missing) setSelected(n.id);
                  }}
                  style={{ cursor: n.missing ? 'default' : 'pointer' }}
                >
                  {isSelected && (
                    <circle
                      r={19}
                      fill="none"
                      stroke={color}
                      strokeWidth={2.5}
                    />
                  )}
                  <circle
                    r={14}
                    fill={n.missing ? 'transparent' : color}
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray={n.missing ? '4 3' : undefined}
                  />
                  {icon && (
                    <svg
                      x={-8}
                      y={-8}
                      width={16}
                      height={16}
                      viewBox="0 0 24 24"
                      style={{ pointerEvents: 'none' }}
                    >
                      <DynamicIcon name={icon as IconName} color="#fff" size={24} />
                    </svg>
                  )}
                  <text className="sb-graph-label" x={18} y={4}>
                    {n.title}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
        {selected !== null && (
          <GraphPreviewPane
            id={selected}
            title={
              nodes.find((n) => n.id === selected)?.title ?? selected
            }
            onClose={() => setSelected(null)}
            onSelect={setSelected}
          />
        )}
      </div>
    </div>
  );
}
