import { GraphLayouter } from "../../layouter";

import { RadialLayouterSettings } from "./radialSettings";
import { Point, PointLike, Vector } from "2d-geometry";
import { BasePositioner } from "src/graph/visGraph/layouterComponents/positioner";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { BasicSizeCalculator } from "src/graph/visGraph/layouterComponents/precalculator";
import { degToRad, RadialUtils } from "../../utils/radialUtils";
import { RadialCircularArcConnectionLayouter } from "../../connectionLayouter/radialConnections";


export class RadialPositionerDynamicDistribution extends BasePositioner {

    /**
     * The margin factor between placed nodes.
     * 0 means that the nodes are placed directly next to each other.
     * 1 means that the nodes are placed with a distance of their radius between them.
     */
    nodeMarginFactor = 1

    /**
     * The margin factor for the radius of a parent node.
     * 1 means that the parent node perimeter touches its children.
     * A value above 1 adds a margin to the parent this perimeter.
     */
    radiusMarginFactor = 1.1

    /**
     * The margin factor between placed nodes when inside a nested hypernode.
     */
    hyperNodeMarginFactor = 0.4

    /**
     * The margin factor for the radius of a parent node when inside a nested hypernode.
     */
    hyperRadiusMarginFactor = 1.1

    /**
     * If false, the parent node's radius is based on the maximum radius of the children.
     * If true, the positioner will adapt the parent's radius to the smallest enclosing circle containing all children.
     */
    adaptEnclosingCircle = true;

    center = new Point(0, 0);
    // private radius: number = 0;

    rotateBasedOnConnections = false;

    gapBetweenStartAndEnd = 0;

    constructor({
        nodeMarginFactor = 1, radiusMarginFactor = 1.1, adaptEnclosingCircle = true,
        rotateBasedOnConnections = false, hyperNodeMarginFactor = 0.4, hyperRadiusMarginFactor = 1.1
    }: {
        nodeMarginFactor?: number;
        radiusMarginFactor?: number;
        adaptEnclosingCircle?: boolean;
        rotateBasedOnConnections?: boolean;
        hyperNodeMarginFactor?: number;
        hyperRadiusMarginFactor?: number;
    } = {}) {
        super();
        this.nodeMarginFactor = nodeMarginFactor;
        this.radiusMarginFactor = radiusMarginFactor;
        this.adaptEnclosingCircle = adaptEnclosingCircle;
        this.rotateBasedOnConnections = rotateBasedOnConnections;
        this.hyperNodeMarginFactor = hyperNodeMarginFactor;
        this.hyperRadiusMarginFactor = hyperRadiusMarginFactor;

        console.log("Created RadialPositionerDynamicDistribution", this.adaptEnclosingCircle);
    }


    getPositionOnCircleAtAngleRad(rad: number, radius: number, centerTranslation?: PointLike): Point {
        return RadialUtils.positionOnCircleAtRad(rad, radius, centerTranslation ?? this.center);
    }

    override async positionChildren(parentNode: LayoutNode): Promise<void> {
        const nodes = parentNode.children;
        if (nodes.length == 0) {
            return;
        }

        // // Determine if we're inside a nested hypernode structure
        // // const isNested = parentNode.parent?.isHyperNode ?? false;
        // const isNested = parentNode.isHyperNode ?? false;

        // // Use appropriate margin factors based on nesting
        // const effectiveNodeMarginFactor = isNested ? this.hyperNodeMarginFactor : this.nodeMarginFactor;
        // const effectiveRadiusMarginFactor = isNested ? this.hyperRadiusMarginFactor : this.radiusMarginFactor;

        const continuumMap = new Map<LayoutNode, number>();

        const nodeMarginOfNode = (node: LayoutNode) => node.isHyperNode ? this.hyperNodeMarginFactor : this.nodeMarginFactor;
        // const radiusMarginOfNode = (node: LayoutNode) => node.isHyperNode ? this.hyperRadiusMarginFactor : this.radiusMarginFactor;
        // const radiusMargin = radiusMarginOfNode(parentNode);
        const radiusMargin = this.radiusMarginFactor;


        let currentPosition = 0;
        nodes.forEach((node, i) => {
            const nodeMarginFactor = nodeMarginOfNode(node);
            const r = node.outerRadius;
            currentPosition += r * nodeMarginFactor
            currentPosition += r;
            continuumMap.set(node, currentPosition);
            currentPosition += r;
            currentPosition += r * nodeMarginFactor;
        });

        let radius = currentPosition / (2 * Math.PI);

        // Normalize continuum to [0, 1]
        const max = currentPosition;
        continuumMap.forEach((node, key) => {
            continuumMap.set(key, continuumMap.get(key)! / max);
        })

        const startAngleDeg = -90;
        const startAngleRad = degToRad(startAngleDeg);

        // If there is only one node, place it at the center and set the radius to the node's radius
        if (nodes.length == 1) {
            const maxRadius = nodes[0].radius; 0
            nodes[0].x = this.center.x;
            nodes[0].y = this.center.y;
            const nodeMarginFactor = nodeMarginOfNode(nodes[0]);
            radius = maxRadius;
            parentNode.radius = radius * nodeMarginFactor;
            parentNode.innerRadius = radius;
        }
        // If there are exactly two nodes, place them on opposite sides of the circle
        else if (nodes.length == 2) {

            const r0 = nodes[0].radius;
            const r1 = nodes[1].radius;

            const marginFactor = Math.max(nodeMarginOfNode(nodes[0]), nodeMarginOfNode(nodes[1]));

            const distanceBetweenNodeCentersWithoutMargin = r0 + r1;
            const margin = distanceBetweenNodeCentersWithoutMargin * marginFactor;
            const distanceBetweenNodeCenters = distanceBetweenNodeCentersWithoutMargin + margin;

            const totalRadius = distanceBetweenNodeCentersWithoutMargin + margin / 2;

            nodes[0].x = this.center.x - distanceBetweenNodeCentersWithoutMargin / 2 - margin / 2;
            nodes[0].y = this.center.y;

            nodes[1].x = this.center.x + distanceBetweenNodeCentersWithoutMargin / 2 + margin / 2;
            nodes[1].y = this.center.y;

            parentNode.innerRadius = distanceBetweenNodeCenters / 2;
            parentNode.radius = totalRadius * radiusMargin;
        }
        else {
            // Place nodes on a circle with radius
            const angleRadMap = new Map<LayoutNode, number>();
            nodes.forEach((node, i) => {
                const placement = continuumMap.get(node)!;
                const angle = startAngleRad + placement * 2 * Math.PI;
                angleRadMap.set(node, angle);
                const pos = this.getPositionOnCircleAtAngleRad(angle, radius);
                node.x = pos.x;
                node.y = pos.y;

                // If the node has a anchor child node, we want to rotate the node so that the anchor node is directed to the center
                const anchorNode = node.anchorNode;
                if (anchorNode) {
                    const nodeCenter = new Point(0, 0); // Because the node is positioned with the parent assumed at (0, 0)
                    const currentSlope = new Vector(anchorNode.center, nodeCenter).slope;
                    node.rotateChildrenLocally(angle - currentSlope);
                }
            });

            const maxNodeRadius = Math.max(...nodes.map(n => n.radius));
            parentNode.radius = (radius + maxNodeRadius) * radiusMargin;
            parentNode.innerRadius = radius;
        }

        // Find the minimum enclosing circle for the nodes
        if (this.adaptEnclosingCircle) {
            const expandedPoints = nodes.map(n => {
                // Here we expand the points away from the center to find the minimum enclosing circle for the children
                try {
                    const center = parentNode.center;
                    const direction = new Vector(center, n.center).normalize();
                    const expandedPoint = n.center.translate(direction.scale(n.outerRadius));
                    // const expandedPoint = n.center.translate(direction.scale(n.radius));
                    return expandedPoint;
                } catch (e) {
                    return n.center;
                }
            });

            const enclosingCircle = RadialUtils.getMinimumEnclosingCircle(expandedPoints);

            parentNode.radius = enclosingCircle.r * radiusMargin;
            parentNode.innerEnclosingRadius = enclosingCircle.r;
            const innerTranslation = new Vector(parentNode.center, enclosingCircle.center);
            parentNode.innerCenterTranslation = innerTranslation;

            parentNode.children.forEach(child => {
                child.center = child.center.translate(innerTranslation.scale(-1));
            });
        }
    }

    private computeNetOutsideConnectionRotation(parentNode: LayoutNode): number {
        let sumVector = new Vector(0, 0);

        // Get all descendants of the node
        const descendants = parentNode.descendants;
        const descendantsSet = new Set(descendants);

        // Gather all outside connections
        const outsideConnections = descendants.flatMap(d => d.outConnections.concat(d.inConnections)).filter(conn => {
            return !descendantsSet.has(conn.source) || !descendantsSet.has(conn.target);
        });

        // console.warn(`Outside connections for ${parentNode.id}:`, outsideConnections.map(c => c.id));

        // We build a vector based on the direction of the target node
        for (const conn of outsideConnections) {

            const direction = descendantsSet.has(conn.source) ? "out" : "in";

            let nodeInsideParent = direction == "out" ? conn.source : conn.target;
            let nodeOutsideParent = direction == "out" ? conn.target : conn.source;

            const nodePath = conn.getConnectionPathViaHyperAndVirtualNodes();

            // Check if there are virtual node
            // If so, take the virtual nodes instead of the actual nodes
            if (direction == "out") {
                if (nodePath[1] && nodePath[1].isVirtual) {
                    nodeInsideParent = nodePath[1];
                }
                if (nodePath[nodePath.length - 2] && nodePath[nodePath.length - 2].isVirtual) {
                    nodeOutsideParent = nodePath[nodePath.length - 2];
                }
            } else {
                if (nodePath[nodePath.length - 2] && nodePath[nodePath.length - 2].isVirtual) {
                    nodeInsideParent = nodePath[nodePath.length - 2];
                }
                if (nodePath[1] && nodePath[1].isVirtual) {
                    nodeOutsideParent = nodePath[1];
                }
            }

            // console.log(nodePath);

            const connectionVector = new Vector(nodeInsideParent.center, nodeOutsideParent.center);
            const centerToNodeInside = new Vector(parentNode.center, nodeInsideParent.center);
            const centerToNodeOutside = new Vector(parentNode.center, nodeOutsideParent.center);

            const radDiff = centerToNodeOutside.slope - centerToNodeInside.slope;

            sumVector = sumVector.add(new Vector(radDiff).normalize().multiply(conn.weight));
        }

        return sumVector.slope;
    }

    override refinePositions(parentNode: LayoutNode): void {
        // Here we rotate the nodes based on their connections
        // This refinement is done bottom-up, so that the children are rotated first
        if (!this.rotateBasedOnConnections) {
            return;
        }

        // Skip the rotation, if there is an anchor node
        if (parentNode.children.some(c => c.anchorNode)) {
            return;
        }

        const center = parentNode.center;

        const netRad = this.computeNetOutsideConnectionRotation(parentNode);

        // Perform rotation for each child with no anchor node
        parentNode.rotateChildrenLocally(netRad, center);
    }

}

export class RadialPositioner extends BasePositioner {

    // The radius to place the child nodes
    radius: number;

    // The outer radius that the parent node gets
    outerRadius: number;

    // The center of the circle
    center: Point;

    constructor({
        radius = 100,
        outerRadius,
    }: {
        radius?: number;
        outerRadius?: number;
    } = {}) {
        super();
        this.radius = radius;
        this.outerRadius = outerRadius ?? radius;
        this.center = new Point(0, 0);
    }

    getPositionOnCircleAtAngleRad(rad: number, radius?: number, centerTranslation?: PointLike): Point {
        return RadialUtils.positionOnCircleAtRad(rad, radius ?? this.radius, centerTranslation ?? this.center);
    }

    override async positionChildren(parentNode: LayoutNode): Promise<void> {
        const nodes = parentNode.children;
        const continuumMap = new Map<LayoutNode, number>();
        nodes.forEach((node, i) => {
            continuumMap.set(node, i / nodes.length);
        });

        // Place nodes on a circle with radius
        const angleRadMap = new Map<LayoutNode, number>();
        nodes.forEach((node, i) => {
            const placement = continuumMap.get(node)!;
            const angle = placement * 2 * Math.PI;
            angleRadMap.set(node, angle);
            const pos = this.getPositionOnCircleAtAngleRad(angle);
            node.x = pos.x;
            node.y = pos.y;
        });

        parentNode.radius = this.outerRadius;
        parentNode.innerRadius = this.radius;
    }
}



export class RadialLayouter<T extends RadialLayouterSettings = RadialLayouterSettings> extends GraphLayouter<T> {


    getRadius() {
        return this.settings.size.radius.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 5;
    }

    getPositionForRad(rad: number, radius?: number, centerTranslation?: { x: number, y: number }): Point {

        const radius_ = radius ?? this.getRadius();
        const centerTranslation_ = centerTranslation ?? this.center;

        const x = centerTranslation_.x + radius_ * Math.cos(rad);
        const y = centerTranslation_.y + radius_ * Math.sin(rad);

        return new Point(x, y);
    }

    override async layout(isUpdate = false) {
        this.visGraph.setPrecalculator(new BasicSizeCalculator({
            sizeMultiplier: 50,
            adaptRadiusBasedOnScore: this.commonSettings.showNodeScore.getValue() ?? true,

        }));
        const context = this.settings.getContext({ visGraph: this.visGraph });
        this.visGraph.setPositioner(new RadialPositionerDynamicDistribution({
            nodeMarginFactor: this.settings.spacing.nodeMarginFactor.getValue(context) ?? 1,
            radiusMarginFactor: this.settings.spacing.radiusMarginFactor.getValue(context) ?? 1.1,
            hyperNodeMarginFactor: this.settings.spacing.hyperNodeMarginFactor.getValue(context) ?? 0.4,
            hyperRadiusMarginFactor: this.settings.spacing.hyperRadiusMarginFactor.getValue(context) ?? 1.1,
            adaptEnclosingCircle: this.settings.spacing.adaptEnclosingCircle.getValue(context) ?? true,
            rotateBasedOnConnections: this.settings.spacing.rotateBasedOnConnections.getValue(context) ?? false,
        }));

        const sorter = this.settings.sorting.getSorter(this.visGraph, this.commonSettings);
        this.visGraph.setSorter(sorter);

        const forwardBackwardThreshold = this.settings.edges.forwardBackwardThreshold.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 270;
        const straightForwardLineAtDegreeDelta = this.settings.edges.straightForwardLineAtDegreeDelta.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 135;
        const backwardLineCurvature = this.settings.edges.backwardLineCurvature.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 120;

        this.visGraph.setConnectionLayouter(new RadialCircularArcConnectionLayouter({
            forwardBackwardThreshold,
            straightForwardLineAtDegreeDelta,
            backwardLineCurvature
        }));

        await this.visGraph.layout();

        this.markConnectionsAsUpdateRequired();
        this.emitEvent("end");

        return;
    }
}
