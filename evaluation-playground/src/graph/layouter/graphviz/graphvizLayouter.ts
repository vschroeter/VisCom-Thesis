import { Point, PointLike, Vector } from "2d-geometry";
import { BasePositioner } from "src/graph/visGraph/layouterComponents/positioner";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { BasicSizeCalculator } from "src/graph/visGraph/layouterComponents/precalculator";
import { RadialCircularArcConnectionLayouter } from "../connectionLayouter/radialConnections";
import { GraphLayouter } from "../layouter";
import { RadialPositionerDynamicDistribution } from "../linear/radial/radialLayouter";
import { GraphvizLayouterSettings } from "./graphvizSettings";
import { BaseConnectionLayouter, BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { StringSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";
import { Anchor } from "src/graph/graphical";
import { renderGraphViz, visGraphToDOT } from "src/api/graphVizApi";

export class GraphvizPositioner extends BasePositioner {
    savedSVG: string | undefined;
    settings: GraphvizLayouterSettings;

    constructor(settings: GraphvizLayouterSettings) {
        super();
        this.settings = settings;
    }

    async positionNodesFromSVG(svg: string, parentNode: LayoutNode) {
        console.log("Positioning nodes from SVG", svg);
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svg, "image/svg+xml");

        // Extract node positions from SVG
        const nodeElements = svgDoc.querySelectorAll("g.node");

        nodeElements.forEach(nodeElement => {
            const titleElement = nodeElement.querySelector("title");
            if (!titleElement || !titleElement.textContent) return;

            const nodeId = titleElement.textContent;
            const node = parentNode.visGraph.getNode(nodeId);
            if (!node) return;

            // Extract position from ellipse or polygon
            const ellipse = nodeElement.querySelector("ellipse");
            if (ellipse) {
                const cx = parseFloat(ellipse.getAttribute("cx") || "0");
                const cy = parseFloat(ellipse.getAttribute("cy") || "0");
                const r = parseFloat(ellipse.getAttribute("rx") || "0");
                // Note: GraphViz y coordinates are inverted compared to our system
                node.x = cx;
                // node.y = -cy; // Invert y-coordinate
                node.y = cy;
                node.radius = r;
                console.log(`Positioned node ${nodeId} at (${node.x}, ${node.y})`);
            }
        });
    }

    override async positionChildren(parentNode: LayoutNode): Promise<void> {
        const visGraph = parentNode.visGraph;
        if (parentNode != visGraph.rootNode) return;

        // Get settings from the GraphvizLayouterSettings
        const adaptSizeToScore = this.settings.nodes.adaptSizeToScore.getValue();
        // const includeNodeLabels = this.settings.nodes.includeNodeLabels.getValue();
        const includeNodeLabels = true;
        const allConnections = this.settings.edges.allConnections.getValue();
        const includeEdgeLabels = this.settings.edges.includeEdgeLabels.getValue();
        const layoutEngine = this.settings.engine.layoutEngine.getValue() as "dot" | "circo" | "fdp" | "neato" | "twopi" | "sfdp" | "osage" | "patchwork";
        const horizontalLayout = this.settings.engine.horizontalLayout.getValue();

        // Create DOT string with the configured settings
        let dotString = 'digraph G {\n';

        // Add horizontal layout if enabled
        if (horizontalLayout) {
            dotString += '  rankdir=LR;\n';
        }

        // Continue with normal DOT generation
        dotString += visGraphToDOT(visGraph, {
            allConnections,
            adaptSizeToScore,
            includeEdgeLabels,
            includeNodeLabels
        }).substring(11); // Remove the initial "digraph G {\n" since we already added our own

        console.log("Graphviz DOT string:", dotString);

        try {
            this.savedSVG = await renderGraphViz(dotString, layoutEngine);
            await this.positionNodesFromSVG(this.savedSVG, parentNode);
        } catch (error) {
            console.error("Failed to render graph:", error);
        }
    }
}

export class GraphvizConnectionLayouter extends BaseNodeConnectionLayouter {
    positioner: GraphvizPositioner;

    constructor(positioner: GraphvizPositioner) {
        super();
        this.positioner = positioner;
    }

    extractPathFromSVG(svg: string): Map<string, {
        path: string,
        source: string,
        target: string,
        arrowPolygon?: string
    }> {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svg, "image/svg+xml");

        const edgeMap = new Map<string, {
            path: string,
            source: string,
            target: string,
            arrowPolygon?: string
        }>();

        // Extract edge paths from SVG
        const edgeElements = svgDoc.querySelectorAll("g.edge");

        edgeElements.forEach(edgeElement => {
            const titleElement = edgeElement.querySelector("title");
            if (!titleElement || !titleElement.textContent) return;

            // Title format is typically "node1->node2"
            const titleText = titleElement.textContent;
            const [source, target] = titleText.split("->");

            if (!source || !target) return;

            const pathElement = edgeElement.querySelector("path");
            const polygonElement = edgeElement.querySelector("polygon");

            if (!pathElement) return;

            const pathData = pathElement.getAttribute("d") || "";
            const polygonPoints = polygonElement?.getAttribute("points") || "";
            const edgeId = `${source}->${target}`;

            edgeMap.set(edgeId, {
                path: pathData,
                source: source.trim(),
                target: target.trim(),
                arrowPolygon: polygonPoints
            });
        });

        return edgeMap;
    }

    calculateAnchorFromPath(
        path: string,
        polygonPoints: string | undefined,
        node: LayoutNode,
        isStart: boolean
    ): Anchor | undefined {
        if (isStart && polygonPoints) {
            // Parse the polygon points
            const points = polygonPoints.trim().split(/\s+/).map(pointStr => {
                const [x, y] = pointStr.split(',').map(parseFloat);
                return { x, y };
            });

            if (points.length >= 3) {
                // First point is the arrow tip
                const tip = new Point(points[1].x, points[1].y);

                // Calculate midpoint between second and third points for direction
                const midpoint = new Point(
                    (points[0].x + points[2].x) / 2,
                    (points[0].y + points[2].y) / 2
                );

                // Direction is from midpoint to tip
                const direction = new Vector(
                    tip.x - midpoint.x,
                    tip.y - midpoint.y
                );

                // Create and return the anchor
                return new Anchor(tip, direction).cloneReversed();
            }
        }

        // Fallback to default path-based calculation if no polygon or not start anchor
        if (isStart) {
            // Parse path and extract the first point and direction
            const pathCommands = path.trim().split(/[\s,]+/);

            // For start anchor, use the first point and direction
            if (pathCommands[0] === 'M' && pathCommands.length >= 3) {
                const x1 = parseFloat(pathCommands[1]);
                const y1 = parseFloat(pathCommands[2]);
                const x2 = parseFloat(pathCommands[4] || pathCommands[1]);
                const y2 = parseFloat(pathCommands[5] || pathCommands[2]);

                const point = new Point(x1, y1);
                const direction = new Vector(x2 - x1, y2 - y1);

                return new Anchor(point, direction);
            }
        }

        // For end anchors or if calculations fail, return undefined as requested
        return undefined;
    }

    override layoutConnectionsOfRootNode(root: LayoutNode): void {
        const svg = this.positioner.savedSVG;
        if (!svg) return;

        const pathMap = this.extractPathFromSVG(svg);

        root.visGraph.allLayoutConnections.forEach((connection) => {
            const edgeId = `${connection.fromId}->${connection.toId}`;
            const edgeData = pathMap.get(edgeId);

            if (edgeData) {
                const extractedSvgPath = edgeData.path;

                const endAnchor = this.calculateAnchorFromPath(
                    extractedSvgPath,
                    edgeData.arrowPolygon,
                    connection.source,
                    true
                )?.cloneReversed();

                // Set end anchor to undefined as requested
                const startAnchor = undefined;

                connection.pathSegment = new StringSegment(
                    connection,
                    extractedSvgPath,
                    startAnchor,
                    endAnchor
                );
            }
        });
    }
}

export class GraphvizLayouter extends GraphLayouter<GraphvizLayouterSettings> {
    override async layout(isUpdate = false) {

        this.visGraph.setPrecalculator(new BasicSizeCalculator({
            sizeMultiplier: 10,
        }));

        const positioner = new GraphvizPositioner(this.settings);
        this.visGraph.setPositioner(positioner);

        const connectionLayouter = new GraphvizConnectionLayouter(positioner);
        this.visGraph.setConnectionLayouter(connectionLayouter);

        // Need to await the async operations
        await this.visGraph.layout();

        this.markConnectionsAsUpdateRequired();
        this.emitEvent("end");

        console.log("Graphviz layout completed");

        return;
    }
}
