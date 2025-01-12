import { Circle, Point } from "2d-geometry";
import { Anchor } from "src/graph/graphical";
import { CircleSegmentSegment } from "src/graph/graphical/primitives/pathSegments/CircleSegment";
import { LayoutConnection, LayoutConnectionPoint, LayoutConnectionPoints } from "src/graph/visGraph/layoutConnection";
import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { RadialUtils } from "../utils/radialUtils";
import { RadialConnectionsHelper } from "./radialConnections";
import { CombinedPathSegment, PathSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";

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

type MultiSegmentInformation = {
    type: MultiConnectionType,
    prevType?: MultiConnectionType,
    nextType?: MultiConnectionType,

    segment: PathSegment,
    prevSegment?: PathSegment,
    nextSegment?: PathSegment,

    sourceNode: LayoutNode,
    targetNode: LayoutNode,
}

export class MultiHyperConnection extends CombinedPathSegment {

    nodePath: LayoutNode[] = [];
    hyperConnection?: LayoutConnection;

    types: MultiConnectionType[] = [];

    info: MultiSegmentInformation[] = [];

    constructor(layoutConnection: LayoutConnection) {
        super(layoutConnection);
    }

    prepareSegments() {

        // There are fixed segments along the path:
        // - already calculated hyper connections 
        // There are fixed parts along the path:
        // - real nodes, where the anchors will start from and end at
        // - virtual nodes, the path will pass through
        // - hyper nodes, that circular segments will placed on 


        // TODO: Circle segments having the same hyper connection as target don't need to be adapted in radius

        this.segments = [];
        this.types = [];
        const types = this.types;

        const source = this.connection.source;
        const target = this.connection.target;

        if (source.id == "image_preprocessor" && target.id == "obstacle_detector") {
            const x = 5;
        }

        for (let i = 1; i < this.nodePath.length; i++) {
            const prevNode = this.nodePath[i - 1];
            const nextNode = this.nodePath[i];

            const prevParent = prevNode.parent;
            const nextParent = nextNode.parent;

            let type: MultiConnectionType = "unknown";

            if (nextParent == prevParent) type = "fixed";
            if (prevParent == nextNode || nextParent == prevNode) type = "circleSegment";

            if (type == "circleSegment") {
                const circleSegmentConnection = new CircleSegmentSegment(this.connection);
                const parent = prevParent == nextNode ? prevParent : nextParent;
                circleSegmentConnection.parentNode = parent
                circleSegmentConnection.circle = parent!.circle.clone();

                this.segments.push(circleSegmentConnection);

            } else if (type == "fixed") {
                const existingConnection = prevNode.getConnectionTo(nextNode);
                const existingPathSegment = existingConnection?.pathSegment;

                if (!existingPathSegment) {
                    throw new Error("No path segment found");
                }

                this.segments.push(existingPathSegment);
            }

            types.push(type);

            // console.log(prevNode.id, nextNode.id, type);
        }


        this.info = this.segments.map((segment, index) => {
            const prevSegment = index > 0 ? this.segments[index - 1] : undefined;
            const nextSegment = index < this.segments.length - 1 ? this.segments[index + 1] : undefined;

            const prevType = index > 0 ? types[index - 1] : undefined;
            const nextType = index < this.segments.length - 1 ? types[index + 1] : undefined;
            const type = types[index];

            const sourceNode = this.nodePath[index];
            const targetNode = this.nodePath[index + 1];

            return {
                type: type,
                prevType: prevType,
                nextType: nextType,

                segment: segment,
                prevSegment: prevSegment,
                nextSegment: nextSegment,

                sourceNode: sourceNode,
                targetNode: targetNode,
            }
        })



        // Set fixed anchors to adjacent circle segments
        for (let i = 0; i < this.segments.length; i++) {
            const info = this.info[i];
            const { segment, prevSegment, nextSegment, sourceNode, targetNode, type, prevType, nextType } = info;

            if (type == "circleSegment") {
                if (!prevSegment) {
                    // seg.startAnchor = source.getAnchor(target.center);
                }
                if (!nextSegment) {
                    // seg.endAnchor = target.getAnchor(source.center).cloneReversed();
                }
            }
            else if (type == "fixed") {
                if (prevSegment && prevType == "circleSegment") {
                    prevSegment.endAnchor = segment.startAnchor;
                }
                if (nextSegment && nextType == "circleSegment") {
                    nextSegment.startAnchor = segment.endAnchor;
                }
            }
        }

        console.log(this.segments.map(seg => seg.constructor.name), this.segments);

        let changed = true;
        
        // Calculate the undefined anchors for the circle segments
        // Do this until no more changes are made
        while (changed) {
            changed = false;
            for (let i = 0; i < this.segments.length; i++) {
                const { segment, prevSegment, nextSegment, sourceNode, targetNode, type, prevType, nextType } = this.info[i];

                // We only adapt circle segment's anchors
                // We should always have at least one fixed segment, that defines the adjacent circle segment's anchor
                if (type == "circleSegment") {
                    if (!segment.startAnchor && segment.endAnchor) {
                        const node = this.nodePath[i];
                        segment.startAnchor = this.calculateCircleSegmentAnchor(node, segment)
                        changed = true;

                        // Propagate the anchor to the previous circle segment
                        if (prevType == "circleSegment" && prevSegment && !prevSegment.endAnchor) {
                            prevSegment.endAnchor = segment.startAnchor;
                        }
                    }
                    if (!segment.endAnchor && segment.startAnchor) {
                        const node = this.nodePath[i + 1];
                        segment.endAnchor = this.calculateCircleSegmentAnchor(node, segment)
                        changed = true;

                        // Propagate the anchor to the next circle segment
                        if (nextType == "circleSegment" && nextSegment && !nextSegment.startAnchor) {
                            nextSegment.startAnchor = segment.endAnchor;
                        }
                    }
                }
            }
        }
    }

    calculateCircleSegmentAnchor(anchorNode: LayoutNode, segment: PathSegment): Anchor {
        const parentCenter = anchorNode.parent?.center ?? new Point(0, 0);
        const nodeCenter = anchorNode.center;

        // Valid outer angles
        const intersections = anchorNode.outerCircle.intersect(anchorNode.parent?.innerCircle ?? new Circle(new Point(0, 0), 0));
        const radNodeCenter = RadialUtils.radOfPoint(nodeCenter, parentCenter);
        let rad0 = RadialUtils.radOfPoint(intersections[0], nodeCenter);
        let rad1 = RadialUtils.radOfPoint(intersections[1], nodeCenter);

        if (RadialUtils.forwardRadBetweenAngles(radNodeCenter, rad0) < RadialUtils.forwardRadBetweenAngles(radNodeCenter, rad1)) {
            [rad0, rad1] = [rad1, rad0];
        }

        const radRange = RadialUtils.forwardRadBetweenAngles(rad0, rad1);
        const radMid = rad0 + radRange / 2;
        const radFactor = 0.8;
        rad0 = radMid - radRange * radFactor / 2;
        rad1 = radMid + radRange * radFactor / 2;
        rad0 %= 2 * Math.PI;
        rad1 %= 2 * Math.PI;

        const existingAnchor = segment.startAnchor ?? segment.endAnchor;

        if (!existingAnchor) {
            throw new Error("No existing anchor found");
        }

        const newAnchorIsEndAnchor = !(segment.endAnchor == existingAnchor);

        const anchorRad = RadialUtils.radOfPoint(existingAnchor.anchorPoint, nodeCenter);

        // this.connection?.source.debugShapes.push(new Circle(intersections[0], 2));
        // this.connection?.source.debugShapes.push(new Circle(intersections[1], 2));
        // this.connection?.source.debugShapes.push(new Circle(lastAnchor.anchor.anchorPoint, 2));

        const chosenRad = RadialUtils.putRadBetween(rad0, rad1, anchorRad);
        const chosenVector = RadialUtils.radToVector(chosenRad).multiply(anchorNode.outerCircle.r);
        const reverseVector = chosenVector.rotate(Math.PI);
        const chosenPoint = nodeCenter.translate(chosenVector);

        // this.connection?.source.debugShapes.push(new Circle(chosenPoint, 2));

        return new Anchor(chosenPoint, newAnchorIsEndAnchor ? reverseVector : chosenVector);
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
    ): CircleSegmentSegment[] {
        const _circleSegmentConnections: CircleSegmentSegment[] = [];
        for (let i = 1; i < circleSegmentAnchors.length; i++) {

            const startAnchor = circleSegmentAnchors[i - 1];
            const endAnchor = circleSegmentAnchors[i];

            const parentNode = isForward ? startAnchor.parentNode : endAnchor.parentNode;
            const circleSegment = new CircleSegmentSegment(
                this.connection,
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
        circleSegments: CircleSegmentSegment[],
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

        const circleSegmentConnections: CircleSegmentSegment[] = [];

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
                const multiConnection = new MultiHyperConnection(connection);
                connection.pathSegment = multiConnection;

                // hyperConnection.nodePath = connection.getSubNodePathViaHypernodes();
                multiConnection.nodePath = connection.getConnectionPathViaHyperAndVirtualNodes();
                console.log(multiConnection.nodePath.map(node => node.id));

                multiConnection.hyperConnection = parentHyperConnection;
                // multiConnection.connection = connection;
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
        // return;
        // Here we adapt the circle segment radius, so that they are not all the same size
        // We only do this for the root node, so that it is done at the end when all connections are calculated
        if (node != node.visGraph.rootNode) {
            return;
        }

        // console.log(this.multiConnections);
        // return;

        // Get all multi connections of child nodes
        // const multiConnections: MultiHyperConnection[] = [];
        // node.children.forEach(child => {
        //     const layouter = child.getConnectionLayouterByTag(this.TAG) as RadialMultiConnectionLayouter;

        //     if (layouter !== undefined) {
        //         multiConnections.push(...layouter.multiConnections);
        //     }
        // });

        const multiConnections = this.multiConnections;
        if (multiConnections.length == 0) {
            return;
        }

        // console.log(node.id, hyperConnections);

        
        // At the end, we want to adapt the circle segment radius, so that they are not all the same size
        // We only do this for circle segments, that have the same parent node and different hyper connections as target

        const nodeToCircleSegmentsMap = new Map<LayoutNode, CircleSegmentSegment[]>();

        multiConnections.forEach(multiConnection => {
            multiConnection.info.forEach(segmentInfo => {
                const { segment, sourceNode, targetNode, type } = segmentInfo;
                if (type != "circleSegment") return;

                const circleSegment = segment as CircleSegmentSegment;
                if (circleSegment.parentNode == undefined) return;

                if (!nodeToCircleSegmentsMap.has(circleSegment.parentNode)) {
                    nodeToCircleSegmentsMap.set(circleSegment.parentNode, []);
                }
                nodeToCircleSegmentsMap.get(circleSegment.parentNode)!.push(circleSegment);
            })
        })

        console.log(nodeToCircleSegmentsMap);
        
        // // Adapt the circle segment radius, so that each has a different size
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

        // const nodeToCircleSegmentsMap = new Map<LayoutNode, CircleSegmentSegment[]>();

        // this.multiConnections.forEach(multiConnection => {
        //     const res = multiConnection.calculatePoints();

        //     res.circleSegments.forEach(circleSegment => {
        //         if (!circleSegment.parentNode) return;

        //         if (!nodeToCircleSegmentsMap.has(circleSegment.parentNode)) {
        //             nodeToCircleSegmentsMap.set(circleSegment.parentNode, []);
        //         }
        //         nodeToCircleSegmentsMap.get(circleSegment.parentNode)!.push(circleSegment);
        //     })

        //     multiConnection.connection!.setPoints(res.points);
        // })

        // console.log(nodeToCircleSegmentsMap);

        // // Adapt the circle segment radius, so that each has a different size
        // nodeToCircleSegmentsMap.forEach((circleSegments, parentNode) => {
        //     // Do this only for circle segments, that are along the circle, direct bezier connections are not adapted
        //     const segmentsOnCircle = circleSegments.filter(circleSegment => circleSegment.isOnCircle);
        //     const min = 0.9
        //     const max = 1.1

        //     segmentsOnCircle.forEach((circleSegment, index) => {
        //         circleSegment.circle.r *= min + (max - min) * ((index + 1) / (segmentsOnCircle.length + 1));
        //         circleSegment.calculate(true)
        //     });
        // })

    }
}
