import { Circle, Line, Point, Segment, Vector } from "2d-geometry";
import { Anchor } from "src/graph/graphical";
import { CircleSegmentSegment } from "src/graph/graphical/primitives/pathSegments/CircleSegment";
import { LayoutConnection, LayoutConnectionPoint, LayoutConnectionPoints } from "src/graph/visGraph/layoutConnection";
import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { RadialUtils } from "../utils/radialUtils";
import { RadialConnectionsHelper } from "./radialConnections";
import { CombinedPathSegment, PathSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";
import { ShapeUtil } from "../utils/shapeUtil";
import { NodeAnchor, RadialAnchor } from "src/graph/graphical/primitives/Anchor";

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

    nodePort?: NodePort;
    nextPort?: NodePort;
    prevPort?: NodePort;

    index: number;
    isBeforeHyperConnection: boolean;
}


export class NodePort {



    node: LayoutNode;
    nodeID: string;

    type: "outgoing" | "incoming";
    hyperConnection: LayoutConnection;

    calculated: boolean = false;
    anchor?: NodeAnchor;

    radialAnchor: RadialAnchor;

    anchors: (NodePort | NodeAnchor)[] = [];

    forces: NodePortForce[] = [];
    currentForce: number = 0;

    // nodePorts: (ConnectionBundlePort | NodeAnchor)[] = [];
    // externalPorts: (ConnectionBundlePort | NodeAnchor)[] = [];

    segments: PathSegment[] = [];

    constructor(node: LayoutNode, type: "outgoing" | "incoming", hyperConnection: LayoutConnection) {
        this.node = node;
        this.nodeID = node.id;
        this.type = type;
        this.hyperConnection = hyperConnection;

        this.radialAnchor = new RadialAnchor(this.node);
    }

    getAnchor(): Anchor {
        const a = this.radialAnchor.getAnchor();
        if (this.type == "outgoing") {
            return a;
        }
        return a.cloneReversed();
    }

    applyForces(alpha: number) {
        const delta = this.currentForce * alpha;
        this.radialAnchor = this.radialAnchor.rotate(delta);
        this.currentForce = 0;
        return Math.abs(delta);
    }

    addAnchor(port?: NodePort | NodeAnchor) {
        if (!port) return;
        this.anchors.push(port);
    }

    addForce(force: NodePortForce) {
        this.forces.push(force);
    }

}

export abstract class NodePortForce {
    strength: number = 1;

    constructor(
        public port: NodePort
    ) { }


    update() { }

    abstract applyLazy(): void;

    static getAttractiveRadialForce(currentAngleRad: number, targetAngleRad: number, strength: number = 1): number {
        return Math.sin(targetAngleRad - currentAngleRad) * strength;
    }
}

export class CenterForce extends NodePortForce {

    node: LayoutNode;
    centerAnchor: RadialAnchor;


    constructor(port: NodePort) {
        super(port);
        this.strength = 0.5
        this.node = port.node;
        this.centerAnchor = new RadialAnchor(port.node)
    }

    override applyLazy() {
        this.port.currentForce += NodePortForce.getAttractiveRadialForce(
            this.port.radialAnchor.angle,
            this.centerAnchor.angle,
            this.strength
        );
    }

}

export class AttractiveAnchorForce extends NodePortForce {

    anchor: NodeAnchor | NodePort;
    node: LayoutNode;

    radialAnchor!: RadialAnchor;

    validOuterRange: number[];

    constructor(port: NodePort, anchor: NodeAnchor | NodePort) {
        super(port);
        this.anchor = anchor;
        this.node = port.node;
        this.port = port;

        // this.validOuterRange = this.node.getValidOuterRadRange(0.8);
        this.validOuterRange = this.node.getValidOuterRadRange(1);

        // this.update();

        // const _anchor = anchor instanceof NodeAnchor ? anchor.anchor : anchor.radialAnchor!.getAnchor();
        // const __a = _anchor.clone()
        // __a._data = { stroke: "blue" };
        // this.port.node.debugShapes.push(__a);
    }

    override applyLazy() {

        const portAngle = this.port.radialAnchor.angle;
        const thisAngle = this.radialAnchor.angle;
        const force = NodePortForce.getAttractiveRadialForce(portAngle, thisAngle, this.strength);

        // if (this.port.node.id == "obstacle_detector") {

        //     console.log("FORCE Attractive",
        //         {
        //             port: this.port,
        //             anchor: this.anchor,
        //             portAngle,
        //             thisAngle,
        //             force,
        //             currentForce: this.port.currentForce
        //         });
        // }

        this.port.currentForce += NodePortForce.getAttractiveRadialForce(
            this.port.radialAnchor.angle,
            this.radialAnchor.angle,
            this.strength
        );
    }

    override update() {

        // The given anchor should be an attractive force on the node's radial anchor.
        // To be an attractive anchor, we first have to calculate the radial anchor on the node's circle from the given node anchor.
        // There are two cases:
        // 1. The node anchor has the same node as the given node. In this case, the anchor is on the other side of the port, so we have to calculate the fitting counter anchor.
        // 2. The node anchor has a different node than the given node (so the other node is an outer node of this node).
        //    In this case we expand the outer nodes anchor to the node.
        // In either case, the anchors must be put between the valid outer range of the node's circle.


        const anchor = this.anchor instanceof NodeAnchor ? this.anchor.anchor : this.anchor.radialAnchor!.getAnchor();
        const curvingAnchor = (this.anchor instanceof NodeAnchor ? this.anchor.curvingAnchor : undefined) ?? anchor;
        const anchorNode = this.anchor.node;

        let debug = false;


        // if (this.node.id.startsWith("waypoint_follower")) {
        if (this.node.id.startsWith("aaa")) {
            debug = true;
        }

        if (debug) {
            console.log("FORCE Attractive", {
                port: this,
                portId: this.port.node.id,
                anchor: anchorNode.id,
                anchorNode: anchorNode.id,
            });

            // const __a = anchor.clone()
            // const __a1 = curvingAnchor.clone()
            // __a._data = { stroke: "blue" };
            // __a1._data = { stroke: "cyan" };
            // this.port.node.debugShapes.push(__a);
            // this.port.node.debugShapes.push(__a1);
        }

        // Case 1
        if (anchorNode == this.node) {
            if (debug) console.log("CASE 1");
            // For a smoother transition, we extend the curve from the curving anchor via the anchor to the node's circle
            // We just assume, that the slope of the anchor changes proportionally to the distance
            const curvingSlope = curvingAnchor.direction.slope;
            const anchorSlope = anchor.direction.slope;

            // Here we differentiate between positive and negative curvature
            let radDiff = RadialUtils.forwardRadBetweenAngles(curvingSlope, anchorSlope);
            if (radDiff > Math.PI) radDiff -= Math.PI * 2;

            const distanceBetweenCurvingAnchors = anchor.anchorPoint.distanceTo(curvingAnchor.anchorPoint)[0];

            const distForCalculation = anchorNode == this.node ? this.node.outerRadius : anchor.anchorPoint.distanceTo(this.node.center)[0];

            // The slope difference is added to the anchor slope, proportionally to the node radius
            let slopeAtOtherSideOfNode = distanceBetweenCurvingAnchors > 0 ?
                anchorSlope + radDiff * (distForCalculation / distanceBetweenCurvingAnchors) :
                anchorSlope;

            // If the port is an incoming port, we have to rotate the slope by 180° to get it on the incoming side
            if (this.port.type == "incoming") {
                slopeAtOtherSideOfNode += Math.PI;
            } else {
                // slopeAtOtherSideOfNode += Math.PI;
            }

            // console.log("RAD", {
            //     id: this.node.id,
            //     slopeAtOtherSideOfNode,
            //     min: this.validOuterRange[0],
            //     max: this.validOuterRange[1],
            //     minNorm: RadialUtils.normalizeRad(this.validOuterRange[0], true),
            //     maxNorm: RadialUtils.normalizeRad(this.validOuterRange[1], true),
            //     put: RadialUtils.putRadBetween(slopeAtOtherSideOfNode, this.validOuterRange[0], this.validOuterRange[1])
            // })

            // New we only have to put the slope between the valid outer range of the node's circle
            // slopeAtOtherSideOfNode = RadialUtils.putRadBetween(slopeAtOtherSideOfNode, this.validOuterRange[0], this.validOuterRange[1]);

            // console.log("RADs", this.node.id, { t: this, radDiff, curvingSlope, anchorSlope, slopeAtOtherSideOfNode, distanceBetweenCurvingAnchors, r: this.node.outerRadius });

            this.radialAnchor = new RadialAnchor(this.node, slopeAtOtherSideOfNode);

            if (debug) {
                const a = this.radialAnchor.getAnchor()
                a._data = { stroke: "yellow" };
                this.node.debugShapes.push(a);
            }

            this.strength = 1;
            // const a = this.radialAnchor.getAnchor()
            // a._data = { stroke: "blue" };
            // this.node.debugShapes.push(a);
        }
        // Case 2
        // Here we draw a circular arc from the anchor to the node's circle
        else {
            if (debug) console.log("CASE 2");

            // this.strength = 0.010;
            this.strength = 10;
            const circle = RadialUtils.getCircleFromCoincidentPointAndTangentAnchor(this.node.center, anchor);

            if (circle) {
                const intersections = this.node.outerCircle.intersect(circle);
                let intersection: Point | undefined = undefined;
                // If there is no intersection, the anchor and its circle are inside of a parent node
                // In this case, we calculate the intersection from the anchor line with the node's circle
                if (intersections.length == 0) {
                    const lineIntersections = anchor.getLine().intersect(this.node.outerCircle);
                    intersection = ShapeUtil.getClosestShapeToPoint(lineIntersections, anchor.anchorPoint);
                } else {
                    intersection = ShapeUtil.getClosestShapeToPoint(intersections, anchor.anchorPoint);
                }

                // This block swaps the circle intersection points so that the intersection lying inside the valid outer range is chosen
                // However, this is not the best solution, because it might disrupt the influence of other anchors
                // else if (intersections.length == 2) {
                //     const closestIntersection = ShapeUtil.getClosestShapeToPoint(intersections, anchor.anchorPoint)!;
                //     const farthestIntersection = ShapeUtil.getFurthestShapeToPoint(intersections, anchor.anchorPoint)!;

                //     const slopeClosest = RadialUtils.radOfPoint(closestIntersection, this.node.center);
                //     const slopeFarthest = RadialUtils.radOfPoint(farthestIntersection, this.node.center);

                //     if (RadialUtils.radIsBetween(slopeClosest, this.validOuterRange[0], this.validOuterRange[1])) {
                //         intersection = closestIntersection;
                //     } else {
                //         intersection = farthestIntersection;
                //     }
                // }

                if (!intersection) {
                    console.error("NO INTERSECTION", this.node.id, anchor.anchorPoint, anchor.direction, circle, intersections);
                    throw new Error("No intersection found");
                }

                const intersectionVector = new Vector(this.node.center, intersection);
                const slope = intersectionVector.slope
                // TODO:: A RadialAnchor might not be the best option, because it is always a straight anchor at the given angle. Sometimes slanted vectors are better
                this.radialAnchor = new RadialAnchor(this.node, slope);
            }
            // If the anchor is directly perpendicular to the node's center, we just set the nodes anchor to the anchor
            else {
                this.radialAnchor = new RadialAnchor(this.node, RadialUtils.radBetweenPoints(this.node.center, anchor.anchorPoint));
            }

            // // Check if the slope is in the valid range
            // if (!RadialUtils.radIsBetween(this.radialAnchor.angle, this.validOuterRange[0], this.validOuterRange[1])) {
            //     // Turn the anchor by 180°
            //     this.radialAnchor = this.radialAnchor.rotate(Math.PI);
            // }


            // Check if the slope is in the valid range
            if (!RadialUtils.radIsBetween(this.radialAnchor.angle, this.validOuterRange[0], this.validOuterRange[1])) {

                // Get the distance to the closest valid range
                const dist1 = RadialUtils.normalizeRad(RadialUtils.forwardRadBetweenAngles(this.radialAnchor.angle, this.validOuterRange[0]));
                const dist2 = RadialUtils.normalizeRad(RadialUtils.forwardRadBetweenAngles(this.radialAnchor.angle, this.validOuterRange[1]));

                this.strength = 0.1


                if (debug) {
                    const a = this.radialAnchor.getAnchor()
                    a._data = { stroke: "magenta" };
                    this.node.debugShapes.push(a);

                    console.log({
                        a: this.radialAnchor.angle,
                        min: this.validOuterRange[0],
                        max: this.validOuterRange[1],
                    })
                }

            } else {
                if (debug) {
                    const a = this.radialAnchor.getAnchor()
                    a._data = { stroke: "green" };
                    this.node.debugShapes.push(a);
                }
            }
        }
    }
}

export class RepulsiveForce extends NodePortForce {

    size: number = 5 / (2 * Math.PI);

    constructor(port: NodePort, public otherPort: NodePort) {
        super(port);
        this.strength = 0.3;
        // this.size = port.node.outerRadius;
    }


    override applyLazy() {

        // Here we calculate the repulsive force between two ports
        // The force is quadratic to the distance between the two ports

        const thisAngle = this.port.radialAnchor.angle;
        const otherAngle = this.otherPort.radialAnchor.angle;

        const angleDiff = RadialUtils.normalizeRad(thisAngle - otherAngle);
        const angleDiffAbs = Math.abs(angleDiff);
        let force = Math.min(Math.PI / 2, Math.pow(this.size / angleDiffAbs, 2));

        force = angleDiff > 0 ? force : -force;
        // console.log("FORCE Repulsive", this.port.node.id, this.otherPort.node.id, force, thisAngle, otherAngle, angleDiff);
        this.port.currentForce += force * this.strength;
    }
}

export class NodePortSimulation {


    ports: NodePort[] = [];

    nodeToPorts: Map<LayoutNode, NodePort[]> = new Map();

    constructor(ports: NodePort[]) {
        this.ports = ports;

        ports.forEach(port => {
            const node = port.node;
            const portsOfNode = this.nodeToPorts.get(node) ?? [];
            portsOfNode.push(port);
            this.nodeToPorts.set(node, portsOfNode);
        })
    }

    simulate() {

        console.log("SIMULATE PORTS", this.ports);

        // Each port is simulated by a number of forces, dragging it to the correct position on the parent node's circle
        // The forces are:
        // - repulsive:
        //   - to ports on the same node (there are different ports for outgoing/incoming and for each different hyper connection)
        //   - to the limitation points for the valid range of the parent node's circle
        // - attractive:
        //   - to the anchors of the port
        // -> anchor point is always on the circle
        // -> anchor point must be between the valid range of the parent node's circle

        //++++ Add the forces ++++//
        this.ports.forEach(port => {
            port.addForce(new CenterForce(port));

            port.anchors.forEach(anchor => {
                port.addForce(new AttractiveAnchorForce(port, anchor));
            })
        })

        this.nodeToPorts.forEach((ports, node) => {
            ports.forEach(port => {
                ports.forEach(otherPort => {
                    if (port == otherPort) return;
                    // port.addForce(new RepulsiveForce(port, otherPort));
                })
            })
        })

        //++++ Init the ports to the center of the outer node range ++++//
        this.ports.forEach(port => {
            port.radialAnchor = new RadialAnchor(port.node)
            // port.node.debugShapes.push(port.radialAnchor.getAnchor());

            const validOuterRange = port.node.getValidOuterRadRange();
            const validInnerRange = port.node.getValidInnerRadRange();

            if (port.node.id.startsWith("waypoint_follower")) {
                // console.log("VALID RANGES", validOuterRange, validInnerRange);
                const segment1 = new Segment(port.node.center, RadialUtils.positionOnCircleAtRad(validOuterRange[0], port.node.outerRadius, port.node.center));
                const segment2 = new Segment(port.node.center, RadialUtils.positionOnCircleAtRad(validOuterRange[1], port.node.outerRadius, port.node.center));
                // const segment3 = new Segment(port.node.center, RadialUtils.positionOnCircleAtRad(validInnerRange[0], port.node.innerRadius, port.node.center));
                // const segment4 = new Segment(port.node.center, RadialUtils.positionOnCircleAtRad(validInnerRange[1], port.node.innerRadius, port.node.center));


                segment1._data = { stroke: "orange" };
                segment2._data = { stroke: "red" };
                // segment3._data = { stroke: "lightgreen" };
                // segment4._data = { stroke: "green" };


                port.node.debugShapes.push(segment1);
                port.node.debugShapes.push(segment2);
                // port.node.debugShapes.push(segment3);
                // port.node.debugShapes.push(segment4);
            }

        })



        this.ports.forEach(port => {
            port.forces.forEach(force => force.update());
        });

        //++++ Simulate the forces ++++//
        const maxIterations = 100;
        let alpha = 1;
        const minAlpha = 0.01;
        const alphaDecay = 1 - Math.pow(minAlpha, 1 / maxIterations);
        // console.log("ALPHA", alphaDecay);

        for (let i = 0; i < maxIterations; i++) {
            let totalDelta = 0;
            this.ports.forEach(port => {
                port.forces.forEach(force => force.update());
            })

            this.ports.forEach(port => {
                port.forces.forEach(force => {
                    force.applyLazy();
                })
                const delta = port.applyForces(alpha);
                totalDelta += Math.abs(delta);
            })

            if (totalDelta < 0.01) break;

            alpha += (-alpha) * alphaDecay;
        }

        // this.ports.forEach(port => {
        //     // port.radialAnchor = port.radialAnchor.rotate(Math.PI);
        //     port.node.debugShapes.push(port.radialAnchor.getAnchor());
        // })




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
    // ports: (ConnectionBundlePort | undefined)[] = [];
    // ports: (NodePort | undefined)[] = [];

    get ports() {
        return this.info.map(info => info.nodePort);
    }


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

        this.info = this.segments.map((segment, i) => {

            const prevHyperConnection = this.hyperConnections.slice(0, i).reverse().find((seg, j) => this.types[i - j - 1] == "fixed");
            const nextHyperConnection = this.hyperConnections.slice(i + 1).find((seg, j) => this.types[i + j + 1] == "fixed");

            const sourceNode = this.nodePath[i];
            const targetNode = this.nodePath[i + 1];

            const isBeforeHyperConnection = i <= this.indexOfHyperConnection;
            const direction = isBeforeHyperConnection ? "outgoing" : "incoming";
            const hyperConnection = isBeforeHyperConnection ? nextHyperConnection : prevHyperConnection;

            const portsNode = isBeforeHyperConnection ? sourceNode : targetNode;
            const port = this.types[i] == "fixed" ? undefined : this.multiConnections.getNodePort(portsNode, hyperConnection, direction)
            port?.segments.push(segment);

            return {
                type: this.types[i],

                index: i,
                isBeforeHyperConnection,

                prevType: i > 0 ? this.types[i - 1] : undefined,
                nextType: i < this.segments.length - 1 ? this.types[i + 1] : undefined,

                segment: segment,
                prevSegment: i > 0 ? this.segments[i - 1] : undefined,
                nextSegment: i < this.segments.length - 1 ? this.segments[i + 1] : undefined,

                prevHyperConnection,
                nextHyperConnection,

                sourceNode,
                targetNode,

                prevPort: undefined,
                nodePort: port,
                nextPort: undefined,
            }
        })

        this.info.forEach((info, i) => {
            // Fill in the next and previous port
            if (i > 0) {
                this.info[i - 1].nextPort = info.nodePort;
            }
            if (i < this.info.length - 1) {
                this.info[i + 1].prevPort = info.nodePort;
            }
        })


    }

    prepareBundlePorts() {

        // console.log(this.nodePath.map(node => node.id));

        // let lastAnchorOrPort: ConnectionBundlePort | Anchor | undefined = undefined;
        // this.info.forEach((info, i) => {
        //     const type = info.type;
        //     const segment = info.segment;
        //     const isBeforeHyperConnection = i <= this.indexOfHyperConnection;
        //     const lastWasBeforeHyperConnection = i > 0 && i - 1 <= this.indexOfHyperConnection;

        //     const ids = this.nodePath.map(node => node.id);
        //     const connId = ids[i] + "->" + ids[i + 1];
        //     console.log(connId, type, lastWasBeforeHyperConnection, isBeforeHyperConnection);

        //     if (type == "fixed") {
        //         if (lastAnchorOrPort && lastAnchorOrPort instanceof ConnectionBundlePort) {
        //             console.log(connId, "Fixed: ADD OUT PORT", lastAnchorOrPort.node.id);
        //             lastAnchorOrPort.addOutPort(info.segment.startAnchor);
        //         }

        //         lastAnchorOrPort = isBeforeHyperConnection ? info.segment.endAnchor : info.segment.startAnchor;

        //         this.ports.push(undefined);

        //     } else if (type == "circleSegment") {
        //         const node = isBeforeHyperConnection ? info.sourceNode : info.targetNode;
        //         const direction = isBeforeHyperConnection ? "outgoing" : "incoming";

        //         const hyperConnection = isBeforeHyperConnection ? info.nextHyperConnection : info.prevHyperConnection;
        //         if (!hyperConnection) {
        //             console.log(this.nodePath.map(node => node.id), {
        //                 index: i,
        //                 indexOfHyperConnection: this.indexOfHyperConnection,
        //                 info,
        //                 infos: this.info,
        //                 lastAnchorOrPort,
        //             });
        //             throw new Error("No hyper connection found, THIS SHOULD NOT HAPPEN");
        //         }

        //         const bundlePort = this.multiConnections.getBundlePort(node, hyperConnection, direction);
        //         bundlePort.addSegment(segment);
        //         if (lastAnchorOrPort) {

        //             console.log(connId, "Circle: ADD IN PORT", bundlePort.node.id);
        //             bundlePort.addInPort(lastAnchorOrPort);
        //         }
        //         lastAnchorOrPort = bundlePort;

        //         this.ports.push(bundlePort);
        //     }
        // })
    }

    prepareNodePorts() {
        const ids = this.nodePath.map(node => node.id);

        console.log(ids);
        console.log(this.info, this.hyperConnections)

        this.info.forEach((info, i) => {
            const type = info.type;
            const segment = info.segment;
            const isBeforeHyperConnection = info.isBeforeHyperConnection;

            const connId = ids[i] + "->" + ids[i + 1];
            console.log(connId, type, isBeforeHyperConnection);

            if (type == "fixed") {
                // At the fixed type, the node port should be undefined
                if (info.nodePort) {
                    throw new Error("Node port should be undefined");
                }

                if (!segment.startAnchor || !segment.endAnchor) {
                    throw new Error("No anchor found");
                }

                // The fixed segment influences the adjacent node ports

                // TODO: Atm we just rotate by 180, but this should be actually smoothed by a fitting circle segment
                if (isBeforeHyperConnection) {
                    info.prevPort?.addAnchor(new NodeAnchor(info.sourceNode, segment.startAnchor, segment.endAnchor));
                    info.nextPort?.addAnchor(new NodeAnchor(info.targetNode, segment.endAnchor, segment.startAnchor));
                } else {
                    info.prevPort?.addAnchor(new NodeAnchor(info.sourceNode, segment.startAnchor, segment.endAnchor));
                    info.nextPort?.addAnchor(new NodeAnchor(info.targetNode, segment.endAnchor, segment.startAnchor));
                }

            } else if (type == "circleSegment") {

                // At the circle segment type, the node port should be defined
                if (!info.nodePort) {
                    throw new Error("Node port should be defined");
                }

                // This node port influences adjacent node ports, if existing
                // (This only happens if multiple circle segments are adjacent)
                info.prevPort?.addAnchor(info.nodePort);
                info.nextPort?.addAnchor(info.nodePort);
            }
        })

        console.log("PREPARED NODE PORTS", ids)
        console.log(this.info.map(info => info.nodePort));
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

        this.prepareNodePorts();
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

        const chosenRad = RadialUtils.putRadBetween(anchorRad, rad0, rad1);
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

    mapNodeToPorts: Map<LayoutNode, NodePort[]> = new Map();


    constructor() {
        super();

        this.radialConnectionsHelper = new RadialConnectionsHelper({
            forwardBackwardThresholdDeg: 360
        });
    }

    getNodePort(node: LayoutNode, hyperConnection?: LayoutConnection, direction: "outgoing" | "incoming" = "outgoing") {
        if (!hyperConnection) {
            return undefined;
        }
        const portsOfNode = this.mapNodeToPorts.get(node) ?? [];
        const port = portsOfNode.find(port => port.hyperConnection == hyperConnection && port.type == direction);

        if (port) return port;

        const newPort = new NodePort(node, direction, hyperConnection);
        portsOfNode.push(newPort);
        this.mapNodeToPorts.set(node, portsOfNode);
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
                // connection.isThroughVirtualNodes = multiConnection.nodePath.slice(1, -1).some(node => node.isVirtual);
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

        console.log("[NODE PORTS]");
        console.log(Array.from(this.mapNodeToPorts.values()));

        const portSimulation = new NodePortSimulation(Array.from(this.mapNodeToPorts.values()).flat());
        portSimulation.simulate();

        multiConnections.forEach(multiConnection => {

            // multiConnection.ports.forEach(port => {

            //     port?.anchors.forEach(anchor => {
            //         if (anchor instanceof NodeAnchor) {
            //             port?.node.debugShapes.push(anchor.anchor);
            //         }
            //     })
            // })

            // return;


            // let lastAnchor: Anchor | undefined = undefined;

            multiConnection.info.forEach((info, i) => {

                const port = multiConnection.ports[i];
                const isBeforeHyperConnection = i <= multiConnection.indexOfHyperConnection;
                const segment = info.segment;
                const nextSegment = info.nextSegment;
                const nextType = info.nextType;

                if (info.type == "fixed") {
                    if (info.nextSegment) info.nextSegment.startAnchor = segment.endAnchor;
                    if (info.prevSegment) info.prevSegment.endAnchor = segment.startAnchor;
                }

                if (info.type == "circleSegment") {
                    if (port) {
                        if (isBeforeHyperConnection) (segment as CircleSegmentSegment).intermediateStartAnchor = port.getAnchor();
                        else (segment as CircleSegmentSegment).intermediateEndAnchor = port.getAnchor();


                        if (info.prevType == "circleSegment") {
                            if (info.prevSegment) info.prevSegment.endAnchor = segment.startAnchor;
                        }

                        if (info.nextType == "circleSegment") {
                            if (info.nextSegment) info.nextSegment.startAnchor = segment.endAnchor;
                        }

                    }
                }
            });

            // console.log(multiConnection.ports, multiConnection.segments);





            multiConnection.info.forEach((info, i) => {
                if (info.type == "circleSegment") {
                    (info.segment as CircleSegmentSegment).calculate(true);
                }
            })
        })

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

        // console.log(nodeToCircleSegmentsMap);

        // // // Adapt the circle segment radius, so that each has a different size
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
