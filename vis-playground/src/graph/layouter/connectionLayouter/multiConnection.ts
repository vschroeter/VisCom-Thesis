import { Circle, Point, Segment } from "2d-geometry";
import { Anchor } from "src/graph/graphical";
import { CircleSegmentSegment } from "src/graph/graphical/primitives/pathSegments/CircleSegment";
import { LayoutConnection, LayoutConnectionPoint, LayoutConnectionPoints } from "src/graph/visGraph/layoutConnection";
import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { RadialUtils } from "../utils/radialUtils";
import { RadialConnectionsHelper } from "./radialConnections";
import { CombinedPathSegment, PathSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";
import { ShapeUtil } from "../utils/shapeUtil";

////////////////////////////////////////////////////////////////////////////
// #region Helper Classes
///////////////////////////////////////////////////////////////////////////

export type MultiConnectionType = "unknown" | "fixed" | "circleSegment" | "";

type MultiSegmentInformation = {
    type: MultiConnectionType,
    prevType?: MultiConnectionType,
    nextType?: MultiConnectionType,

    segment: PathSegment,
    prevSegment?: PathSegment,
    nextSegment?: PathSegment,

    prevHyperConnection?: LayoutConnection,
    nextHyperConnection?: LayoutConnection,

    sourceNode: LayoutNode,
    targetNode: LayoutNode,
}

export class ConnectionBundlePort {


    node: LayoutNode;
    nodeID: string;
    type: "outgoing" | "incoming";

    hyperConnection: LayoutConnection;
    calculated: boolean = false;
    portAnchor?: Anchor;
    // outAnchor?: Anchor;
    // inAnchor?: Anchor;

    segments: PathSegment[] = [];

    constructor(node: LayoutNode, type: "outgoing" | "incoming", hyperConnection: LayoutConnection) {
        this.node = node;
        this.nodeID = node.id;
        this.type = type;
        this.hyperConnection = hyperConnection;
    }

    inPorts: (ConnectionBundlePort | Anchor)[] = [];
    outPorts: (ConnectionBundlePort | Anchor)[] = [];

    addInPort(port?: ConnectionBundlePort | Anchor) {
        if (!port) return;
        this.inPorts.push(port);

        if (port instanceof ConnectionBundlePort) {
            port.outPorts.push(this);
        }
    }

    addOutPort(port?: ConnectionBundlePort | Anchor) {
        if (!port) return;
        this.outPorts.push(port);

        if (port instanceof ConnectionBundlePort) {
            port.inPorts.push(this);
        }
    }

    addSegment(segment: PathSegment) {
        this.segments.push(segment);
    }

    applyToSegments() {
        this.segments.forEach(segment => {
            if (this.portAnchor) {
                if (this.type == "outgoing") {
                    segment.endAnchor = this.portAnchor;
                } else {
                    segment.startAnchor = this.portAnchor;
                }
            }
        })
    }
}

export class ConnectionBundlePortChain {

    layers: ConnectionBundlePort[][] = [];

    constructor(port: ConnectionBundlePort) {

        // Find the first layer
        while (port.inPorts.length > 0 && port.inPorts.some(port => port instanceof ConnectionBundlePort)) {
            port = port.inPorts.find(port => port instanceof ConnectionBundlePort) as ConnectionBundlePort;
        }

        let currentLayer = [port];
        this.layers.push(currentLayer);

        while (currentLayer.length > 0) {
            const nextLayer: ConnectionBundlePort[] = [];
            currentLayer.forEach(port => {
                nextLayer.push(...port.outPorts.filter(port => port instanceof ConnectionBundlePort) as ConnectionBundlePort[]);
            })
            if (nextLayer.length == 0) break;
            this.layers.push(nextLayer);
            currentLayer = nextLayer;
        }
    }

    calculate() {
        console.log("CALC PORTS", this.layers);

        this.layers.forEach((layer, i) => {
            layer.forEach(port => {

                const definingArray = port.type == "outgoing" ? port.outPorts : port.inPorts;
                const otherArray = port.type == "outgoing" ? port.inPorts : port.outPorts;
                const node = port.node;
                const parentNode = node.parent;

                // 1. Case:
                // Type == outgoing && only outgoing ports
                // Type == incoming && only incoming ports
                if (definingArray.length > 0 && otherArray.length == 0) {
                    //TODO: Improve this case to use elliptic arcs
                    console.log("CASE 1 (node to port)", port.nodeID, port.type, i);

                    // In this case, there is only one side of the port defined (by an anchor or the mean of multiple anchors).
                    // The other side of the port is the node and thus open to be defined.
                    // We construct a new anchor, that allows a smooth transition from the node center to the defined side of the port.

                    const anchors = definingArray.filter(port => port instanceof Anchor) as Anchor[];
                    const meanAnchor = Anchor.mean(anchors, parentNode?.circle);
                    if (!meanAnchor) {
                        throw new Error("No mean anchor found");
                    }

                    const distance = node.center.distanceTo(meanAnchor.anchorPoint)[0];
                    const circle1 = new Circle(node.center, distance);
                    const circle2 = new Circle(meanAnchor.anchorPoint, distance);
                    const intersections = circle1.intersect(circle2);

                    if (intersections.length != 2) {
                        throw new Error("No intersection found");
                    }

                    const circleIntersectionLine = new Segment(intersections[0], intersections[1]);
                    const intersectionsWithAnchor = meanAnchor.getLine().intersect(circleIntersectionLine);
                    if (intersectionsWithAnchor.length != 1) {
                        throw new Error("No intersection with anchor found");
                    }

                    const _nodeAnchor = new Anchor(node.center, intersectionsWithAnchor[0]);
                    const nodeAnchor = port.type == "outgoing" ? _nodeAnchor : _nodeAnchor.cloneReversed();

                    port.portAnchor = nodeAnchor;

                    // // In this case, the port-anchor is defined by the mean of the anchors
                    // const anchors = definingArray.filter(port => port instanceof Anchor) as Anchor[];
                } else if (definingArray.length == 0 && otherArray.length > 0) {
                    throw new Error("THIS SHOULD NOT HAPPEN" + port.nodeID);
                } else if (definingArray.length > 0 && otherArray.length > 0) {
                    console.log("CASE 2 (mean of port anchors)");

                    // In this case, the port-anchor is defined by the mean of the anchors
                    const outAnchors = port.outPorts.map(port => port instanceof Anchor ? port : port.portAnchor).filter(port => port) as Anchor[];
                    const inAnchors = port.inPorts.map(port => port instanceof Anchor ? port : port.portAnchor).filter(port => port) as Anchor[];

                    const meanOutAnchor = Anchor.mean(outAnchors, undefined);
                    const meanInAnchor = Anchor.mean(inAnchors, undefined);

                    const meanAnchor = Anchor.mean([meanOutAnchor, meanInAnchor]);
                    meanAnchor.anchorPoint = node.center;
                    meanAnchor.anchorPoint = meanAnchor.getPointInDirection(node.radius);
                    
                    // TODO: Check, if the anchors lie in the allowed range of the node

                    port.portAnchor = meanAnchor;
                }
                else {
                    console.log("UNKNOWN CASE", port.nodeID, port.type, i);
                }


                if (port.portAnchor) port.node.debugShapes.push(port.portAnchor);
                port.calculated = true;
            })
        })
    }


}

export class MultiHyperConnection extends CombinedPathSegment {

    nodePath: LayoutNode[] = [];
    hyperConnection: LayoutConnection;

    hyperConnections: (LayoutConnection | undefined)[] = [];

    types: MultiConnectionType[] = [];

    info: MultiSegmentInformation[] = [];

    indexOfHyperConnection: number = -1;

    multiConnections: RadialMultiConnectionLayouter;

    constructor(layoutConnection: LayoutConnection, hyperConnection: LayoutConnection, connections: RadialMultiConnectionLayouter) {
        super(layoutConnection);
        this.hyperConnection = hyperConnection;
        this.multiConnections = connections;
    }


    private calculateTypesAndSegments() {
        this.segments = [];
        this.types = [];

        for (let i = 1; i < this.nodePath.length; i++) {
            const prevNode = this.nodePath[i - 1];
            const nextNode = this.nodePath[i];

            const prevParent = prevNode.parent;
            const nextParent = nextNode.parent;

            if (prevNode == this.hyperConnection?.source && nextNode == this.hyperConnection?.target) {
                this.indexOfHyperConnection = i - 1;
            }

            let type: MultiConnectionType = "unknown";

            if (nextParent == prevParent) type = "fixed";
            if (prevParent == nextNode || nextParent == prevNode) type = "circleSegment";
            this.types.push(type);

            if (type == "circleSegment") {
                const circleSegmentConnection = new CircleSegmentSegment(this.connection);
                const parent = prevParent == nextNode ? prevParent : nextParent;
                circleSegmentConnection.parentNode = parent
                circleSegmentConnection.circle = parent!.circle.clone();

                if (prevNode.isVirtual) {
                    circleSegmentConnection.crossNode = prevNode;
                } else if (nextNode.isVirtual) {
                    circleSegmentConnection.crossNode = nextNode;
                }

                this.segments.push(circleSegmentConnection);
                this.hyperConnections.push(undefined);

            } else if (type == "fixed") {
                const existingConnection = prevNode.getConnectionTo(nextNode);
                const existingPathSegment = existingConnection?.pathSegment;

                if (!existingPathSegment) {
                    throw new Error("No path segment found");
                }

                this.segments.push(existingPathSegment);
                this.hyperConnections.push(existingConnection);
            }
        }
    }

    private calculateSegmentInformation() {

        this.info = this.segments.map((segment, index) => {

            const prevHyperConnection = this.hyperConnections.slice(0, index).reverse().find((seg, i) => this.types[index - i - 1] == "fixed");
            const nextHyperConnection = this.hyperConnections.slice(index + 1).find((seg, i) => this.types[index + i + 1] == "fixed");

            return {
                type: this.types[index],
                prevType: index > 0 ? this.types[index - 1] : undefined,
                nextType: index < this.segments.length - 1 ? this.types[index + 1] : undefined,

                segment: segment,
                prevSegment: index > 0 ? this.segments[index - 1] : undefined,
                nextSegment: index < this.segments.length - 1 ? this.segments[index + 1] : undefined,

                prevHyperConnection,
                nextHyperConnection,

                sourceNode: this.nodePath[index],
                targetNode: this.nodePath[index + 1],
            }
        })


    }

    prepareBundlePorts() {

        console.log(this.nodePath.map(node => node.id));

        let lastAnchorOrPort: ConnectionBundlePort | Anchor | undefined = undefined;
        this.info.forEach((info, i) => {
            const type = info.type;
            const segment = info.segment;
            const isBeforeHyperConnection = i <= this.indexOfHyperConnection;
            const lastWasBeforeHyperConnection = i > 0 && i - 1 <= this.indexOfHyperConnection;

            const ids = this.nodePath.map(node => node.id);
            const connId = ids[i] + "->" + ids[i + 1];
            console.log(connId, type, lastWasBeforeHyperConnection, isBeforeHyperConnection);

            if (type == "fixed") {

                if (lastAnchorOrPort && lastAnchorOrPort instanceof ConnectionBundlePort) {
                    console.log(connId, "Fixed: ADD OUT PORT", lastAnchorOrPort.node.id);
                    lastAnchorOrPort.addOutPort(info.segment.startAnchor);
                    // if (lastWasBeforeHyperConnection) {
                    //     console.log(connId, "Fixed: ADD OUT PORT", lastAnchorOrPort.node.id);
                    //     lastAnchorOrPort.addOutPort(info.segment.startAnchor);
                    // } else {
                    //     console.log(connId, "Fixed: ADD IN PORT", lastAnchorOrPort.node.id);
                    //     lastAnchorOrPort.addInPort(info.segment.endAnchor);
                    // }
                }

                lastAnchorOrPort = isBeforeHyperConnection ? info.segment.endAnchor : info.segment.startAnchor;
            } else if (type == "circleSegment") {
                const node = isBeforeHyperConnection ? info.sourceNode : info.targetNode;
                const direction = isBeforeHyperConnection ? "outgoing" : "incoming";

                const hyperConnection = isBeforeHyperConnection ? info.nextHyperConnection : info.prevHyperConnection;
                if (!hyperConnection) {
                    console.log(this.nodePath.map(node => node.id), {
                        index: i,
                        indexOfHyperConnection: this.indexOfHyperConnection,
                        info,
                        infos: this.info,
                        lastAnchorOrPort,
                    });
                    throw new Error("No hyper connection found, THIS SHOULD NOT HAPPEN");
                }

                const bundlePort = this.multiConnections.getBundlePort(node, hyperConnection, direction);
                bundlePort.addSegment(segment);
                if (lastAnchorOrPort) {

                    console.log(connId, "Circle: ADD IN PORT", bundlePort.node.id);
                    bundlePort.addInPort(lastAnchorOrPort);

                    // if (isBeforeHyperConnection) {
                    //     console.log(connId, "Circle: ADD IN PORT", bundlePort.node.id);
                    //     bundlePort.addInPort(lastAnchorOrPort);
                    // } else {
                    //     console.log(connId, "Circle: ADD OUT PORT", bundlePort.node.id);
                    //     bundlePort.addOutPort(lastAnchorOrPort);
                    // }
                }
                lastAnchorOrPort = bundlePort;
            }
        })


    }

    prepareSegments() {

        // There are fixed segments along the path:
        // - already calculated hyper connections 
        // There are fixed parts along the path:
        // - real nodes, where the anchors will start from and end at
        // - virtual nodes, the path will pass through
        // - hyper nodes, that circular segments will placed on 


        // TODO: Circle segments having the same hyper connection as target don't need to be adapted in radius

        this.calculateTypesAndSegments();
        this.calculateSegmentInformation();

        this.prepareBundlePorts();

        return;

        // function range(start: number, end: number): number[] {
        //     return Array.from({ length: end - start }, (_, i) => start + i);
        // }

        // const processIndices = [...range(0, this.indexOfHyperConnection).reverse(), ...range(this.indexOfHyperConnection, this.segments.length)];
        // // Set fixed anchors to adjacent circle segments
        // // for (let i = 0; i < this.segments.length; i++) {
        // for (let pi = 0; pi < processIndices.length; pi++) {
        //     const i = processIndices[pi];
        //     const info = this.info[i];
        //     const { segment, prevSegment, nextSegment, sourceNode, targetNode, type, prevType, nextType } = info;

        //     if (type == "circleSegment") {
        //         if (!prevSegment) {
        //             // seg.startAnchor = source.getAnchor(target.center);
        //         }
        //         if (!nextSegment) {
        //             // seg.endAnchor = target.getAnchor(source.center).cloneReversed();
        //         }
        //     }
        //     else if (type == "fixed") {
        //         if (prevSegment && prevType == "circleSegment") {
        //             prevSegment.endAnchor = segment.startAnchor;
        //         }
        //         if (nextSegment && nextType == "circleSegment") {
        //             nextSegment.startAnchor = segment.endAnchor;
        //         }
        //     }
        // }

        // console.log(this.connection.id, this.segments.map(seg => seg.constructor.name), this.segments);

        // let changed = true;

        // // Calculate the undefined anchors for the circle segments
        // // Do this until no more changes are made
        // while (changed) {
        //     changed = false;
        //     for (let i = 0; i < this.segments.length; i++) {
        //         const info = this.info[i];
        //         const { segment, prevSegment, nextSegment, sourceNode, targetNode, type, prevType, nextType } = this.info[i];

        //         // We only adapt circle segment's anchors
        //         // We should always have at least one fixed segment, that defines the adjacent circle segment's anchor
        //         if (type == "circleSegment") {
        //             if (!segment.startAnchor && segment.endAnchor) {
        //                 const node = this.nodePath[i];
        //                 segment.startAnchor = this.calculateCircleSegmentAnchor(node, info);
        //                 changed = true;

        //                 // Propagate the anchor to the previous circle segment
        //                 if (prevType == "circleSegment" && prevSegment && !prevSegment.endAnchor) {
        //                     prevSegment.endAnchor = segment.startAnchor;
        //                 }
        //             }
        //             if (!segment.endAnchor && segment.startAnchor) {
        //                 const node = this.nodePath[i + 1];
        //                 segment.endAnchor = this.calculateCircleSegmentAnchor(node, info)
        //                 changed = true;

        //                 // Propagate the anchor to the next circle segment
        //                 if (nextType == "circleSegment" && nextSegment && !nextSegment.startAnchor) {
        //                     nextSegment.startAnchor = segment.endAnchor;
        //                 }
        //             }
        //         }
        //     }
        // }
    }

    calculateCircleSegmentAnchor(anchorNode: LayoutNode, info: MultiSegmentInformation): Anchor {
        const { segment, prevSegment, nextSegment, sourceNode, targetNode, type, prevType, nextType } = info;

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

        if (this.connection?.source.id == "11image_preprocessor" && this.connection.target.id == "11obstacle_detector") {
            this.connection.debugShapes.push(chosenPoint);
            this.connection.debugShapes.push(intersections[0]);
            this.connection.debugShapes.push(intersections[1]);
            this.connection.debugShapes.push(nodeCenter);
            // this.connection.debugShapes.push(existingAnchor);
            // if (segment.startAnchor) this.connection.debugShapes.push(segment.startAnchor);
            // if (segment.endAnchor) this.connection.debugShapes.push(segment.endAnchor);
            this.connection.debugShapes.push(new Anchor(chosenPoint, chosenVector));
            console.log(anchorNode.id)
        }

        if (anchorNode.parent == sourceNode) {
            return new Anchor(chosenPoint, reverseVector);
        }



        // return new Anchor(chosenPoint, newAnchorIsEndAnchor ? reverseVector : chosenVector);
        return new Anchor(chosenPoint, chosenVector);
        // return new Anchor(chosenPoint, reverseVector);
    }
}

////////////////////////////////////////////////////////////////////////////
// #region Multi Connection Layouter
///////////////////////////////////////////////////////////////////////////

export class RadialMultiConnectionLayouter extends BaseNodeConnectionLayouter {
    override TAG = "RadialSubConnectionLayouter";

    radialConnectionsHelper: RadialConnectionsHelper;

    multiConnections: MultiHyperConnection[] = [];

    mapNodeToBundlePorts: Map<LayoutNode, ConnectionBundlePort[]> = new Map();


    constructor() {
        super();

        this.radialConnectionsHelper = new RadialConnectionsHelper({
            forwardBackwardThresholdDeg: 360
        });
    }


    getBundlePort(node: LayoutNode, hyperConnection: LayoutConnection, direction: "outgoing" | "incoming") {
        const portsOfNode = this.mapNodeToBundlePorts.get(node) ?? [];
        const port = portsOfNode.find(port => port.hyperConnection == hyperConnection && port.type == direction);

        if (port) return port;

        const newPort = new ConnectionBundlePort(node, direction, hyperConnection);
        portsOfNode.push(newPort);
        this.mapNodeToBundlePorts.set(node, portsOfNode);
        return newPort;
    }

    override layoutConnectionsOfNode(node: LayoutNode): void {

        const multiConnections: MultiHyperConnection[] = [];

        node.outConnections.forEach(connection => {
            if (connection.hasParentHyperConnection) {
                const parentHyperConnection = connection.parent!;
                const multiConnection = new MultiHyperConnection(connection, parentHyperConnection, this);
                connection.pathSegment = multiConnection;

                multiConnection.nodePath = connection.getConnectionPathViaHyperAndVirtualNodes();
                // console.log(multiConnection.nodePath.map(node => node.id));

                multiConnections.push(multiConnection);

                multiConnection.prepareSegments();

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

        const multiConnections = this.multiConnections;
        if (multiConnections.length == 0) {
            return;
        }

        this.calculatePortChains();
        console.log("[BUNDLE PORTS]");
        console.log(Array.from(this.mapNodeToBundlePorts.values()));

        return;

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
    }


    calculatePortChains() {

        const ports = Array.from(this.mapNodeToBundlePorts.values()).flat();

        ports.forEach(port => {

            // if (port.node.id == "drive_manager_in___hypernode_0") {
            //     port.node.debugShapes.push(...port.outPorts);
            //     port.node.debugShapes.push(...port.inPorts);
            // }

            if (port.calculated) return;

            const chain = new ConnectionBundlePortChain(port);
            chain.calculate();
        })


    }

}
