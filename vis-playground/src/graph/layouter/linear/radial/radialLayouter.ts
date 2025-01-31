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
    outerMarginFactor = 1.1

    /**
     * If false, the parent node's radius is based on the maximum radius of the children.
     * If true, the positioner will adapt the parent's radius to the smallest enclosing circle containing all children.
     */
    adaptEnclosingCircle = true;

    center = new Point(0, 0);
    private radius: number = 0;

    constructor({
        nodeMarginFactor = 1, outerMarginFactor = 1.1, adaptEnclosingCircle = true
    }: {
        nodeMarginFactor?: number;
        outerMarginFactor?: number;
        adaptEnclosingCircle?: boolean;
    } = {}) {
        super();
        this.nodeMarginFactor = nodeMarginFactor;
        this.outerMarginFactor = outerMarginFactor;
        this.adaptEnclosingCircle = adaptEnclosingCircle;

        console.log("Created RadialPositionerDynamicDistribution", this.adaptEnclosingCircle);
    }


    getPositionOnCircleAtAngleRad(rad: number, radius?: number, centerTranslation?: PointLike): Point {
        return RadialUtils.positionOnCircleAtRad(rad, radius ?? this.radius, centerTranslation ?? this.center);
    }

    override positionChildren(parentNode: LayoutNode): void {
        const nodes = parentNode.children;
        if (nodes.length == 0) {
            return;
        }
        const continuumMap = new Map<LayoutNode, number>();

        let currentPosition = 0;
        nodes.forEach((node, i) => {
            const r = node.outerRadius;
            currentPosition += r * this.nodeMarginFactor;
            currentPosition += r;
            continuumMap.set(node, currentPosition);
            currentPosition += r;
            currentPosition += r * this.nodeMarginFactor;
        });

        this.radius = currentPosition / (2 * Math.PI);

        // Normalize continuum to [0, 1]
        const max = currentPosition;
        continuumMap.forEach((node, key) => {
            continuumMap.set(key, continuumMap.get(key)! / max);
        })

        const startAngleDeg = 180;
        const startAngleRad = degToRad(startAngleDeg);

        // If there is only one node, place it at the center and set the radius to the node's radius
        if (nodes.length == 1) {
            const maxRadius = nodes[0].radius; 0
            nodes[0].x = this.center.x;
            nodes[0].y = this.center.y;
            this.radius = maxRadius;
            parentNode.radius = (this.radius + maxRadius);
            parentNode.innerRadius = this.radius;
        }
        // If there are exactly two nodes, place them on opposite sides of the circle
        else if (nodes.length == 2) {

            const r0 = nodes[0].radius;
            const r1 = nodes[1].radius;

            const distanceBetweenNodeCentersWithoutMargin = r0 + r1;
            const margin = distanceBetweenNodeCentersWithoutMargin * this.nodeMarginFactor;
            const distanceBetweenNodeCenters = distanceBetweenNodeCentersWithoutMargin + margin;

            const totalRadius = distanceBetweenNodeCentersWithoutMargin + margin / 2;

            nodes[0].x = this.center.x - r1 - margin / 2;
            nodes[0].y = this.center.y;

            nodes[1].x = this.center.x + r0 + margin / 2;
            nodes[1].y = this.center.y;

            parentNode.innerRadius = distanceBetweenNodeCenters;
            parentNode.radius = totalRadius * this.outerMarginFactor;
        }
        else {
            // Place nodes on a circle with radius
            const angleRadMap = new Map<LayoutNode, number>();
            // const angleRadStep = 2 * Math.PI / nodes.length;
            nodes.forEach((node, i) => {
                const placement = continuumMap.get(node)!;
                const angle = startAngleRad + placement * 2 * Math.PI;
                angleRadMap.set(node, angle);
                const pos = this.getPositionOnCircleAtAngleRad(angle);
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
            parentNode.radius = (this.radius + maxNodeRadius) * this.outerMarginFactor;
            parentNode.innerRadius = this.radius;
        }


        // Find the minimum enclosing circle for the nodes

        const expandedPoints = nodes.map(n => {
            // Here we expand the points away from the center to find the minimum enclosing circle for the children
            const center = parentNode.center;
            const direction = new Vector(center, n.center).normalize();
            const expandedPoint = n.center.translate(direction.scale(n.radius));
            return expandedPoint;
        });

        if (this.adaptEnclosingCircle) {
            const enclosingCircle = RadialUtils.getMinimumEnclosingCircle(expandedPoints);

            // Adapt all children to the enclosing circle
            parentNode.radius = enclosingCircle.r * this.outerMarginFactor;
            const innerTranslation = new Vector(parentNode.center, enclosingCircle.center)//.scale(-1);
            parentNode.innerCenterTranslation = innerTranslation;

            parentNode.children.forEach(child => {
                child.center = child.center.translate(innerTranslation.scale(-1));
            });
        }
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

    override positionChildren(parentNode: LayoutNode): void {
        const nodes = parentNode.children;
        const continuumMap = new Map<LayoutNode, number>();
        nodes.forEach((node, i) => {
            continuumMap.set(node, i / nodes.length);
        });


        // Place nodes on a circle with radius
        const angleRadMap = new Map<LayoutNode, number>();
        // const angleRadStep = 2 * Math.PI / nodes.length;
        nodes.forEach((node, i) => {
            const placement = continuumMap.get(node)!;
            const angle = placement * 2 * Math.PI;
            angleRadMap.set(node, angle);
            const pos = this.getPositionOnCircleAtAngleRad(angle);
            node.x = pos.x;
            node.y = pos.y;
            // console.log("Set node position", node.id, pos, node.circle);
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

    override layout(isUpdate = false) {
        this.visGraph.setPrecalculator(new BasicSizeCalculator({ sizeMultiplier: 50 }));
        // this.visGraph.setPositioner(new RadialPositioner({ radius: this.getRadius() }));
        this.visGraph.setPositioner(new RadialPositionerDynamicDistribution({
            nodeMarginFactor: this.settings.spacing.nodeMarginFactor.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 1,
            outerMarginFactor: this.settings.spacing.outerMarginFactor.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 1.1,
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

        this.visGraph.layout();

        this.markConnectionsAsUpdateRequired();
        // this.emitEvent("update");
        this.emitEvent("end");

        return;
    }
}
