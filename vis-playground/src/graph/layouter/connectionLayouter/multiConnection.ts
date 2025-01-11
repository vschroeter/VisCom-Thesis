import { Circle, Point } from "2d-geometry";
import { Anchor } from "src/graph/graphical";
import { CircleSegmentConnection } from "src/graph/graphical/primitives/pathSegments/CircleSegment";
import { LayoutConnection, LayoutConnectionPoint, LayoutConnectionPoints } from "src/graph/visGraph/layoutConnection";
import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { RadialUtils } from "../utils/radialUtils";
import { RadialConnectionsHelper } from "./radialConnections";

////////////////////////////////////////////////////////////////////////////
// #region Helper Classes
///////////////////////////////////////////////////////////////////////////


/**
 * Helper class to store the anchor point and the parent node of a circle segment connection.
 */
export class CircleSegmentAnchor {
    anchor: Anchor;
    parentNode: LayoutNode;

    constructor(anchor: Anchor, parentNode: LayoutNode) {
        this.anchor = anchor;
        this.parentNode = parentNode;
    }
}

export type MultiConnectionType = "unknown" | "fixed" | "circleSegment" | "";

export class MultiHyperConnection {

    nodePath: LayoutNode[] = [];
    hyperConnection?: LayoutConnection;
    connection?: LayoutConnection;

    segments: (CircleSegmentConnection)[] = [];

    constructor() {

    }

    prepareSegments() {
        
        // There are fixed segments along the path:
        // - already calculated hyper connections 
        // There are fixed parts along the path:
        // - real nodes, where the anchors will start from and end at
        // - virtual nodes, the path will pass through
        // - hyper nodes, that circular segments will placed on 
        
        
        // TODO: Circle segments having the same hyper connection as target don't need to be adapted in radius

        for (let i = 1; i < this.nodePath.length; i++) {
            const prevNode = this.nodePath[i - 1];
            const nextNode = this.nodePath[i];

            const prevParent = prevNode.parent;
            const nextParent = nextNode.parent;

            let type: MultiConnectionType = "unknown";

            if (nextParent == prevParent) type = "fixed";
            if (prevParent == nextNode || nextParent == prevNode) type = "circleSegment";

            console.log(prevNode.id, nextNode.id, type);
        }

    }

    calculateAnchors(
        anchorList: CircleSegmentAnchor[],
        path: LayoutNode[],
        isBeforeHyperConnection: boolean
    ) {
        path.forEach((node, index) => {
            if (node == this.hyperConnection!.source || node == this.hyperConnection!.target) {
                return;
            }

            const parentCenter = node.parent?.center ?? new Point(0, 0);
            const nodeCenter = node.center;

            // Valid outer angles
            const intersections = node.outerCircle.intersect(node.parent?.innerCircle ?? new Circle(new Point(0, 0), 0));
            const radNodeCenter = RadialUtils.radOfPoint(nodeCenter, parentCenter);
            let rad0 = RadialUtils.radOfPoint(intersections[0], nodeCenter);
            let rad1 = RadialUtils.radOfPoint(intersections[1], nodeCenter);

            if (RadialUtils.forwardRadBetweenAngles(radNodeCenter, rad0) < RadialUtils.forwardRadBetweenAngles(radNodeCenter, rad1)) {
                [rad0, rad1] = [rad1, rad0];
            }

            // console.log({
            //     node: node.id,
            //     rad0: radToDeg(rad0),
            //     rad1: radToDeg(rad1),
            // })

            const radRange = RadialUtils.forwardRadBetweenAngles(rad0, rad1);
            const radMid = rad0 + radRange / 2;
            const radFactor = 0.8;
            rad0 = radMid - radRange * radFactor / 2;
            rad1 = radMid + radRange * radFactor / 2;
            rad0 %= 2 * Math.PI;
            rad1 %= 2 * Math.PI;

            const lastAnchor = anchorList[anchorList.length - 1];
            const anchorRad = RadialUtils.radOfPoint(lastAnchor.anchor.anchorPoint, nodeCenter);

            // this.connection?.source.debugShapes.push(new Circle(intersections[0], 2));
            // this.connection?.source.debugShapes.push(new Circle(intersections[1], 2));
            // this.connection?.source.debugShapes.push(new Circle(lastAnchor.anchor.anchorPoint, 2));

            const chosenRad = RadialUtils.putRadBetween(rad0, rad1, anchorRad);
            const chosenVector = RadialUtils.radToVector(chosenRad).multiply(node.outerCircle.r);
            const reverseVector = chosenVector.rotate(Math.PI);
            const chosenPoint = nodeCenter.translate(chosenVector);

            // console.log({
            //     node: node.id,
            //     rad0: radToDeg(rad0),
            //     rad1: radToDeg(rad1),
            //     radRange: radToDeg(radRange),
            //     anchorRad: radToDeg(anchorRad),
            //     chosenRad: radToDeg(chosenRad),
            // })

            // this.connection?.source.debugShapes.push(new Circle(chosenPoint, 2));

            const anchor = new Anchor(chosenPoint, isBeforeHyperConnection ? chosenVector : reverseVector);
            const circleSegmentAnchor = new CircleSegmentAnchor(anchor, node.parent!);
            anchorList.push(circleSegmentAnchor);
        })
    }


    getCircleSegmentConnections(
        circleSegmentAnchors: CircleSegmentAnchor[],
        isForward: boolean
    ): CircleSegmentConnection[] {
        const _circleSegmentConnections: CircleSegmentConnection[] = [];
        for (let i = 1; i < circleSegmentAnchors.length; i++) {

            const startAnchor = circleSegmentAnchors[i - 1];
            const endAnchor = circleSegmentAnchors[i];

            const parentNode = isForward ? startAnchor.parentNode : endAnchor.parentNode;
            const circleSegment = new CircleSegmentConnection(
                startAnchor.anchor,
                endAnchor.anchor,
                parentNode.circle
            );

            circleSegment.parentNode = parentNode;
            circleSegment.connection = this.connection;
            // circleSegment.debug = true;

            _circleSegmentConnections.push(circleSegment);
        }

        // At the end we add the last anchor point
        const lastAnchor = circleSegmentAnchors[circleSegmentAnchors.length - 1];

        return [..._circleSegmentConnections];
    };

    calculatePoints(): {
        circleSegments: CircleSegmentConnection[],
        points: LayoutConnectionPoints
    } {
        const nodesFromHyperConnectionToStart: LayoutNode[] = [];
        const nodesFromHyperConnectionToEnd: LayoutNode[] = [];

        if (this.hyperConnection === undefined) {
            return { circleSegments: [], points: [] };
        }

        let isStart = true;
        this.nodePath.forEach((node, index) => {
            if (isStart) {
                nodesFromHyperConnectionToStart.push(node);
            } else {
                nodesFromHyperConnectionToEnd.push(node);
            }
            if (node == this.hyperConnection!.source) {
                isStart = false;
            }
        })
        nodesFromHyperConnectionToStart.reverse();

        // From hyper start to path start calculate the anchor points:
        // Each node has based on its parent circle a outer range of valid anchor points

        const anchorsFromHyperStartToStart: CircleSegmentAnchor[] = [];
        const anchorsFromHyperEndToEnd: CircleSegmentAnchor[] = [];

        const hyperStartAnchor = this.hyperConnection.startAnchor;
        const hyperEndAnchor = this.hyperConnection.endAnchor;
        if (hyperStartAnchor) {
            anchorsFromHyperStartToStart.push(new CircleSegmentAnchor(hyperStartAnchor, this.hyperConnection.source.parent!));
        }
        if (hyperEndAnchor) {
            anchorsFromHyperEndToEnd.push(new CircleSegmentAnchor(hyperEndAnchor, this.hyperConnection.target.parent!));
        }

        this.calculateAnchors(anchorsFromHyperStartToStart, nodesFromHyperConnectionToStart, true);
        this.calculateAnchors(anchorsFromHyperEndToEnd, nodesFromHyperConnectionToEnd, false);

        const anchorsFromStartToHyperStart = Array.from(anchorsFromHyperStartToStart).reverse();

        const circleSegmentConnections: CircleSegmentConnection[] = [];

        const startCircleSegmentConnections = this.getCircleSegmentConnections(anchorsFromStartToHyperStart, true);
        const endCircleSegmentConnections = this.getCircleSegmentConnections(anchorsFromHyperEndToEnd, false);

        circleSegmentConnections.push(...startCircleSegmentConnections);
        circleSegmentConnections.push(...endCircleSegmentConnections);

        const combinedPoints: LayoutConnectionPoint[] = [
            ...startCircleSegmentConnections,
            ...this.hyperConnection.points,
            ...endCircleSegmentConnections
        ];

        const startAnchor = startCircleSegmentConnections[0]?.startAnchor?.clone() ?? this.hyperConnection.startAnchor?.clone();
        const endAnchor = endCircleSegmentConnections[endCircleSegmentConnections.length - 1]?.endAnchor?.clone() ?? this.hyperConnection.endAnchor?.clone();
        if (!startAnchor) console.warn("No start anchor found", this.connection);
        if (!endAnchor) console.warn("No end anchor found", this.connection);

        const points: LayoutConnectionPoints = {
            startAnchor: startAnchor,
            endAnchor: endAnchor,
            points: combinedPoints
        }

        return {
            points: points,
            circleSegments: circleSegmentConnections
        }
    }
}

////////////////////////////////////////////////////////////////////////////
// #region Multi Connection Layouter
///////////////////////////////////////////////////////////////////////////

export class RadialMultiConnectionLayouter extends BaseNodeConnectionLayouter {
    override TAG = "RadialSubConnectionLayouter";

    radialConnectionsHelper: RadialConnectionsHelper;

    multiConnections: MultiHyperConnection[] = [];

    constructor() {
        super();

        this.radialConnectionsHelper = new RadialConnectionsHelper({
            forwardBackwardThresholdDeg: 360
        });
    }

    override layoutConnectionsOfNode(node: LayoutNode): void {

        const multiConnections: MultiHyperConnection[] = [];

        node.outConnections.forEach(connection => {
            if (connection.hasParentHyperConnection) {
                // if (!(connection.source.id == "flint_node" && connection.target.id == "system_information")) return;

                const parentHyperConnection = connection.parent!;
                const multiConnection = new MultiHyperConnection();

                // hyperConnection.nodePath = connection.getSubNodePathViaHypernodes();
                multiConnection.nodePath = connection.getConnectionPathViaHyperAndVirtualNodes();
                console.log(multiConnection.nodePath.map(node => node.id));
                
                multiConnection.hyperConnection = parentHyperConnection;
                multiConnection.connection = connection;
                multiConnections.push(multiConnection);

                multiConnection.prepareSegments();
                // hyperConnections.forEach(hyperConnection => {
                //     connection.points = hyperConnection.calculatePoints();
                // })
            } else {
                // console.log(connection.weight);
            }
        })


        this.multiConnections.push(...multiConnections);
    }
    override layoutConnectionsOfChildren(node: LayoutNode): void {

        // Here we adapt the circle segment radius, so that they are not all the same size
        // We only do this for the root node, so that it is done at the end when all connections are calculated
        if (node != node.visGraph.rootNode) {
            return;
        }

        // Get all multi connections of child nodes
        const multiConnections: MultiHyperConnection[] = [];
        node.children.forEach(child => {
            const layouter = child.getConnectionLayouterByTag(this.TAG) as RadialMultiConnectionLayouter;

            if (layouter !== undefined) {
                multiConnections.push(...layouter.multiConnections);
            }
        });

        if (this.multiConnections.length == 0) {
            return;
        }

        // console.log(node.id, hyperConnections);

        const nodeToCircleSegmentsMap = new Map<LayoutNode, CircleSegmentConnection[]>();

        this.multiConnections.forEach(multiConnection => {
            const res = multiConnection.calculatePoints();

            res.circleSegments.forEach(circleSegment => {
                if (!circleSegment.parentNode) return;

                if (!nodeToCircleSegmentsMap.has(circleSegment.parentNode)) {
                    nodeToCircleSegmentsMap.set(circleSegment.parentNode, []);
                }
                nodeToCircleSegmentsMap.get(circleSegment.parentNode)!.push(circleSegment);
            })

            multiConnection.connection!.setPoints(res.points);
        })

        console.log(nodeToCircleSegmentsMap);

        // Adapt the circle segment radius, so that each has a different size
        nodeToCircleSegmentsMap.forEach((circleSegments, parentNode) => {
            // Do this only for circle segments, that are along the circle, direct bezier connections are not adapted
            const segmentsOnCircle = circleSegments.filter(circleSegment => circleSegment.isOnCircle);
            const min = 0.9
            const max = 1.1

            segmentsOnCircle.forEach((circleSegment, index) => {
                circleSegment.circle.r *= min + (max - min) * ((index + 1) / (segmentsOnCircle.length + 1));
                circleSegment.calculate(true)
            });
        })

    }
}
