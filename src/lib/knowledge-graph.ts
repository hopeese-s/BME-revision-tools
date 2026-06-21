// ============================================================================
// EgBE Memory & Revision Engine — Knowledge Graph Traversal
//
// BME requires systems-thinking. Concepts form a directed graph where edges
// represent prerequisite, application, and analogical relationships.
// This module provides graph traversal (BFS/DFS), prerequisite resolution,
// and shortest-path queries for the concept knowledge graph.
// ============================================================================

import type { ConceptEdge, ConceptNode, GraphPath, UUID } from '@/types/schema';

// ---------------------------------------------------------------------------
// Graph data structure (adjacency list)
// ---------------------------------------------------------------------------

export class KnowledgeGraph {
  private nodes: Map<UUID, ConceptNode> = new Map();
  private adjacency: Map<UUID, ConceptEdge[]> = new Map();
  private reverseAdjacency: Map<UUID, ConceptEdge[]> = new Map();

  constructor(nodes: ConceptNode[] = [], edges: ConceptEdge[] = []) {
    for (const node of nodes) {
      this.addNode(node);
    }
    for (const edge of edges) {
      this.addEdge(edge);
    }
  }

  // ---- Mutation ----

  addNode(node: ConceptNode): void {
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, []);
    }
    if (!this.reverseAdjacency.has(node.id)) {
      this.reverseAdjacency.set(node.id, []);
    }
  }

  addEdge(edge: ConceptEdge): void {
    // Forward direction: source → target
    const forward = this.adjacency.get(edge.source_id);
    if (forward) forward.push(edge);

    // Reverse direction: target ← source
    const reverse = this.reverseAdjacency.get(edge.target_id);
    if (reverse) reverse.push(edge);
  }

  removeNode(nodeId: UUID): void {
    this.nodes.delete(nodeId);
    this.adjacency.delete(nodeId);
    this.reverseAdjacency.delete(nodeId);
  }

  // ---- Query ----

  getNode(nodeId: UUID): ConceptNode | undefined {
    return this.nodes.get(nodeId);
  }

  getOutgoingEdges(nodeId: UUID): ConceptEdge[] {
    return this.adjacency.get(nodeId) ?? [];
  }

  getIncomingEdges(nodeId: UUID): ConceptEdge[] {
    return this.reverseAdjacency.get(nodeId) ?? [];
  }

  getAllNodes(): ConceptNode[] {
    return Array.from(this.nodes.values());
  }

  getAllEdges(): ConceptEdge[] {
    const edges: ConceptEdge[] = [];
    for (const edgeList of this.adjacency.values()) {
      edges.push(...edgeList);
    }
    return edges;
  }

  getNodeCount(): number {
    return this.nodes.size;
  }

  // -----------------------------------------------------------------------
  // BFS Traversal — find all reachable nodes from a starting concept
  // -----------------------------------------------------------------------

  /**
   * Breadth-first search from a starting node.
   *
   * @param startId    - Starting concept node ID
   * @param maxDepth   - Maximum traversal depth (prevents infinite loops in cycles)
   * @param relationshipFilter - Optional edge type filter
   * @returns Ordered array of nodes in BFS order
   */
  bfs(
    startId: UUID,
    maxDepth: number = 10,
    relationshipFilter?: ConceptEdge['relationship'][],
  ): GraphPath {
    const visited = new Set<UUID>();
    const nodes: ConceptNode[] = [];
    const edges: ConceptEdge[] = [];
    const queue: Array<{ nodeId: UUID; depth: number }> = [{ nodeId: startId, depth: 0 }];
    let totalStrength = 0;

    visited.add(startId);

    while (queue.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { nodeId, depth } = queue.shift()!;
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      nodes.push(node);

      if (depth >= maxDepth) continue;

      for (const edge of this.getOutgoingEdges(nodeId)) {
        if (relationshipFilter && !relationshipFilter.includes(edge.relationship)) continue;
        if (visited.has(edge.target_id)) continue;

        visited.add(edge.target_id);
        edges.push(edge);
        totalStrength += edge.strength;
        queue.push({ nodeId: edge.target_id, depth: depth + 1 });
      }
    }

    return { nodes, edges, totalStrength };
  }

  // -----------------------------------------------------------------------
  // DFS Traversal — depth-first path exploration
  // -----------------------------------------------------------------------

  dfs(
    startId: UUID,
    maxDepth: number = 10,
    relationshipFilter?: ConceptEdge['relationship'][],
  ): GraphPath {
    const visited = new Set<UUID>();
    const nodes: ConceptNode[] = [];
    const edges: ConceptEdge[] = [];
    let totalStrength = 0;

    const dfsRecursive = (nodeId: UUID, depth: number) => {
      if (depth > maxDepth || visited.has(nodeId)) return;

      visited.add(nodeId);
      const node = this.nodes.get(nodeId);
      if (node) nodes.push(node);

      for (const edge of this.getOutgoingEdges(nodeId)) {
        if (relationshipFilter && !relationshipFilter.includes(edge.relationship)) continue;
        edges.push(edge);
        totalStrength += edge.strength;
        dfsRecursive(edge.target_id, depth + 1);
      }
    };

    dfsRecursive(startId, 0);
    return { nodes, edges, totalStrength };
  }

  // -----------------------------------------------------------------------
  // Prerequisites — find all concepts that must be learned before a target
  // -----------------------------------------------------------------------

  /**
   * Get all prerequisite concepts for a given target concept.
   * Traverses backward through 'prerequisite' edges.
   *
   * @param targetId - The concept to find prerequisites for
   * @param maxDepth - How far back to traverse
   * @returns GraphPath with all prerequisite nodes and edges
   */
  getPrerequisites(targetId: UUID, maxDepth: number = 5): GraphPath {
    const visited = new Set<UUID>();
    const nodes: ConceptNode[] = [];
    const edges: ConceptEdge[] = [];
    const queue: Array<{ nodeId: UUID; depth: number }> = [{ nodeId: targetId, depth: 0 }];
    let totalStrength = 0;

    visited.add(targetId);

    while (queue.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { nodeId, depth } = queue.shift()!;
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      if (nodeId !== targetId) {
        nodes.push(node);
      }

      if (depth >= maxDepth) continue;

      // Look backward: find edges where target_id = nodeId and relationship = 'prerequisite'
      const incoming = this.reverseAdjacency.get(nodeId) ?? [];
      for (const edge of incoming) {
        if (edge.relationship !== 'prerequisite') continue;
        if (visited.has(edge.source_id)) continue;

        visited.add(edge.source_id);
        edges.push(edge);
        totalStrength += edge.strength;
        queue.push({ nodeId: edge.source_id, depth: depth + 1 });
      }
    }

    return { nodes, edges, totalStrength };
  }

  // -----------------------------------------------------------------------
  // Shortest Path — Dijkstra-like traversal between two concepts
  // -----------------------------------------------------------------------

  /**
   * Find the shortest path between two concept nodes using BFS.
   * Edge weights are 1/strength (stronger edges = shorter paths).
   *
   * @param sourceId - Starting concept
   * @param targetId - Target concept
   * @returns GraphPath if a path exists, null otherwise
   */
  shortestPath(sourceId: UUID, targetId: UUID): GraphPath | null {
    if (sourceId === targetId) {
      const node = this.nodes.get(sourceId);
      return node ? { nodes: [node], edges: [], totalStrength: 0 } : null;
    }

    const visited = new Set<UUID>();
    const parent = new Map<UUID, { nodeId: UUID; edge: ConceptEdge }>();
    const queue: UUID[] = [sourceId];
    visited.add(sourceId);

    while (queue.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const currentId = queue.shift()!;

      for (const edge of this.getOutgoingEdges(currentId)) {
        if (visited.has(edge.target_id)) continue;
        visited.add(edge.target_id);
        parent.set(edge.target_id, { nodeId: currentId, edge });

        if (edge.target_id === targetId) {
          // Reconstruct path
          return this.reconstructPath(sourceId, targetId, parent);
        }

        queue.push(edge.target_id);
      }

      // Also check reverse edges (graph may be traversable backward)
      for (const edge of this.getIncomingEdges(currentId)) {
        if (visited.has(edge.source_id)) continue;
        visited.add(edge.source_id);
        parent.set(edge.source_id, { nodeId: currentId, edge });

        if (edge.source_id === targetId) {
          return this.reconstructPath(sourceId, targetId, parent);
        }

        queue.push(edge.source_id);
      }
    }

    return null; // No path found
  }

  private reconstructPath(
    sourceId: UUID,
    targetId: UUID,
    parent: Map<UUID, { nodeId: UUID; edge: ConceptEdge }>,
  ): GraphPath {
    const nodes: ConceptNode[] = [];
    const edges: ConceptEdge[] = [];
    let totalStrength = 0;

    let current = targetId;
    while (current !== sourceId) {
      const node = this.nodes.get(current);
      if (node) nodes.unshift(node);

      const parentEntry = parent.get(current);
      if (!parentEntry) break;

      edges.unshift(parentEntry.edge);
      totalStrength += parentEntry.edge.strength;
      current = parentEntry.nodeId;
    }

    // Add source node
    const sourceNode = this.nodes.get(sourceId);
    if (sourceNode) nodes.unshift(sourceNode);

    return { nodes, edges, totalStrength };
  }

  // -----------------------------------------------------------------------
  // Clinical Applications — find real-world applications of a concept
  // -----------------------------------------------------------------------

  /**
   * Find clinical/engineering applications of a foundational concept.
   * Traverses forward through 'applies_to' and 'clinical_application' edges.
   *
   * @param conceptId  - Foundational concept (e.g., "Fluid Dynamics")
   * @param maxDepth   - How far forward to look
   */
  getApplications(conceptId: UUID, maxDepth: number = 3): GraphPath {
    return this.bfs(conceptId, maxDepth, ['applies_to', 'clinical_application']);
  }

  // -----------------------------------------------------------------------
  // Systems View — get the entire neighborhood around a concept
  // -----------------------------------------------------------------------

  /**
   * Get the complete neighborhood: prerequisites, applications, analogies, components.
   * Useful for rendering a force-directed subgraph in the UI.
   *
   * @param conceptId - Central concept
   * @param radius    - BFS radius
   */
  getNeighborhood(conceptId: UUID, radius: number = 2): GraphPath {
    return this.bfs(conceptId, radius); // all relationship types
  }

  // -----------------------------------------------------------------------
  // Verification — detect cycles and disconnected components
  // -----------------------------------------------------------------------

  /**
   * Detect cycles in the directed graph using DFS with coloring.
   * @returns Array of nodes that participate in cycles
   */
  detectCycles(): UUID[] {
    enum Color { White, Gray, Black }

    const color = new Map<UUID, Color>();
    for (const nodeId of this.nodes.keys()) {
      color.set(nodeId, Color.White);
    }

    const cycleNodes = new Set<UUID>();

    const hasCycle = (nodeId: UUID): boolean => {
      color.set(nodeId, Color.Gray);

      for (const edge of this.getOutgoingEdges(nodeId)) {
        const targetColor = color.get(edge.target_id);
        if (targetColor === Color.Gray) {
          cycleNodes.add(nodeId);
          cycleNodes.add(edge.target_id);
          return true;
        }
        if (targetColor === Color.White && hasCycle(edge.target_id)) {
          cycleNodes.add(nodeId);
          return true;
        }
      }

      color.set(nodeId, Color.Black);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (color.get(nodeId) === Color.White) {
        hasCycle(nodeId);
      }
    }

    return Array.from(cycleNodes);
  }

  /**
   * Find concepts with no connections (isolated nodes).
   */
  findIsolatedNodes(): UUID[] {
    const isolated: UUID[] = [];
    for (const nodeId of this.nodes.keys()) {
      const outgoing = this.adjacency.get(nodeId)?.length ?? 0;
      const incoming = this.reverseAdjacency.get(nodeId)?.length ?? 0;
      if (outgoing === 0 && incoming === 0) {
        isolated.push(nodeId);
      }
    }
    return isolated;
  }

  // -----------------------------------------------------------------------
  // Import/Export for serialization
  // -----------------------------------------------------------------------

  toJSON(): { nodes: ConceptNode[]; edges: ConceptEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.getAllEdges(),
    };
  }

  static fromJSON(data: { nodes: ConceptNode[]; edges: ConceptEdge[] }): KnowledgeGraph {
    return new KnowledgeGraph(data.nodes, data.edges);
  }
}

// ---------------------------------------------------------------------------
// Topological Sort — order concepts by prerequisites (Kahn's algorithm)
// ---------------------------------------------------------------------------

/**
 * Return concepts in topological order, respecting prerequisite constraints.
 * Concepts with no prerequisites come first.
 *
 * @param nodes - All concept nodes
 * @param edges - All concept edges (only 'prerequisite' edges are considered)
 * @returns Topologically sorted node IDs
 */
export function topologicalSort(nodes: ConceptNode[], edges: ConceptEdge[]): UUID[] {
  const inDegree = new Map<UUID, number>();
  const adjacency = new Map<UUID, UUID[]>();

  // Initialize
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build graph
  for (const edge of edges) {
    if (edge.relationship !== 'prerequisite') continue;
    adjacency.get(edge.source_id)?.push(edge.target_id);
    inDegree.set(edge.target_id, (inDegree.get(edge.target_id) ?? 0) + 1);
  }

  // Kahn's algorithm
  const queue: UUID[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId);
  }

  const sorted: UUID[] = [];

  while (queue.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const nodeId = queue.shift()!;
    sorted.push(nodeId);

    for (const neighborId of adjacency.get(nodeId) ?? []) {
      const newDegree = (inDegree.get(neighborId) ?? 1) - 1;
      inDegree.set(neighborId, newDegree);
      if (newDegree === 0) queue.push(neighborId);
    }
  }

  // Cycle detected — remaining nodes are in cycles, append them
  if (sorted.length < nodes.length) {
    for (const node of nodes) {
      if (!sorted.includes(node.id)) {
        sorted.push(node.id);
      }
    }
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Cross-domain Linking — find bridges between different domains
// ---------------------------------------------------------------------------

/**
 * Identify concept edges that bridge two different domains.
 * These are the most valuable connections for systems-thinking in BME.
 *
 * @param graph - The knowledge graph
 * @returns Array of cross-domain edges
 */
export function findCrossDomainLinks(graph: KnowledgeGraph): ConceptEdge[] {
  const crossDomain: ConceptEdge[] = [];

  for (const edge of graph.getAllEdges()) {
    const source = graph.getNode(edge.source_id);
    const target = graph.getNode(edge.target_id);

    if (source && target && source.domain && target.domain && source.domain !== target.domain) {
      crossDomain.push(edge);
    }
  }

  return crossDomain;
}