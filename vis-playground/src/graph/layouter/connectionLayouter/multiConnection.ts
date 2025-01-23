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

    // segments: PathSegment[] = [];

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
        this.strength = 0.2
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

        this.validOuterRange = this.node.getValidOuterRadRange(0.8);

        // this.update();
    }

    override applyLazy() {

        const portAngle = this.port.radialAnchor.angle;
        const thisAngle = this.radialAnchor.angle;
        const force = NodePortForce.getAttractiveRadialForce(portAngle, thisAngle, this.strength);

        if (this.port.node.id == "obstacle_detector") {

            console.log("FORCE Attractive",
                {
                    port: this.port,
                    anchor: this.anchor,
                    portAngle,
                    thisAngle,
                    force,
                    currentForce: this.port.currentForce
                });
        }

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

        // Case 1
        if (anchorNode == this.node) {
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
            this.strength = 1;
            // const a = this.radialAnchor.getAnchor()
            // a._data = { stroke: "blue" };
            // this.node.debugShapes.push(a);
        }
        // Case 2
        // Here we draw a circular arc from the anchor to the node's circle
        else {
            this.strength = 5;
            try {
                const circle = RadialUtils.getCircleFromCoincidentPointAndTangentAnchor(this.node.center, anchor);

                if (circle) {
                    const intersections = this.node.outerCircle.intersect(circle);
                    let intersection = ShapeUtil.getClosestShapeToPoint(intersections, anchor.anchorPoint);

                    // If there is no intersection, the anchor and its circle are inside of a parent node
                    // In this case, we calculate the intersection from the anchor line with the node's circle
                    if (!intersection) {
                        const lineIntersections = anchor.getLine().intersect(this.node.outerCircle);
                        intersection = ShapeUtil.getClosestShapeToPoint(lineIntersections, anchor.anchorPoint);
                    }

                    const intersectionVector = new Vector(this.node.center, intersection);
                    const slope = intersectionVector.slope
                    // TODO:: A RadialAnchor might not be the best option, because it is alyways a straight anchor at the given angle. Sometimes slanted vectors are better
                    this.radialAnchor = new RadialAnchor(this.node, slope);

                }
                // If the anchor is directly perpendicular to the node's center, we just set the nodes anchor to the anchor
                else {
                    this.radialAnchor = new RadialAnchor(this.node, RadialUtils.radBetweenPoints(this.node.center, anchor.anchorPoint));
                }


                // Check if the slope is in the valid range
                if (!RadialUtils.radIsBetween(this.radialAnchor.angle, this.validOuterRange[0], this.validOuterRange[1])) {
                    this.strength = 0.01
                }

                // const a = this.radialAnchor.getAnchor()
                // a._data = { stroke: "green" };
                // this.node.debugShapes.push(a);

            } catch (e) {

                // this.node.debugShapes.push(anchor);
                // this.node.debugShapes.push(this.node.center);
                // this.node.debugShapes.push(this.node.outerCircle);

                // anchor._data = { stroke: "red", length: 1000 };
                // this.node.debugShapes.push(anchor);
                // this.node.debugShapes.push(this.node.center);

                // const point = this.node.center;
                // const distance = point.distanceTo(anchor.anchorPoint)[0];

                // const circle1 = new Circle(point, distance);
                // const circle2 = new Circle(anchor.anchorPoint, distance);
                // const intersections = circle1.intersect(circle2);

                // // The intersection line is then intersected with the anchor line to get the midpoint
                // const circleIntersectionLine = new Segment(intersections[0], intersections[1]);
                // const intersectionsWithAnchor = anchor.getLine().intersect(circleIntersectionLine);

                // this.node.debugShapes.push(circle1);
                // this.node.debugShapes.push(circle2);
                // this.node.debugShapes.push(circleIntersectionLine);
                // this.node.debugShapes.push(...intersections);
                throw e;
            }

        }


    }
}

export class RepulsiveForce extends NodePortForce {

    constructor(port: NodePort, public otherPort: NodePort) {
        super(port);
    }
    override applyLazy() {
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
            // port.addForce(new CenterForce(port));

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

            // const segment1 = new Segment(port.node.center, RadialUtils.positionOnCircleAtRad(validOuterRange[0], port.node.outerRadius, port.node.center));
            // const segment2 = new Segment(port.node.center, RadialUtils.positionOnCircleAtRad(validOuterRange[1], port.node.outerRadius, port.node.center));
            // const segment3 = new Segment(port.node.center, RadialUtils.positionOnCircleAtRad(validInnerRange[0], port.node.innerRadius, port.node.center));
            // const segment4 = new Segment(port.node.center, RadialUtils.positionOnCircleAtRad(validInnerRange[1], port.node.innerRadius, port.node.center));


            // segment1._data = { stroke: "orange" };
            // segment2._data = { stroke: "red" };
            // segment3._data = { stroke: "lightgreen" };
            // segment4._data = { stroke: "green" };


            // port.node.debugShapes.push(segment1);
            // port.node.debugShapes.push(segment2);
            // port.node.debugShapes.push(segment3);
            // port.node.debugShapes.push(segment4);
        })



        this.ports.forEach(port => {
            port.forces.forEach(force => force.update());
        });

        //++++ Simulate the forces ++++//
        const maxIterations = 100;
        let alpha = 1;
        const minAlpha = 0.01;
        const alphaDecay = 1 - Math.pow(minAlpha, 1 / maxIterations);
        console.log("ALPHA", alphaDecay);

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

                if (port.node.id == "obstacle_detector") {
                    console.log("PORT", port.radialAnchor.angle, delta, alpha);
                }

            })

            console.log("ITERATION", i, totalDelta, alpha);
            if (totalDelta < 0.01) break;

            alpha += (-alpha) * alphaDecay;
            console.log("ALPHA AFTER", alpha);
        }

        this.ports.forEach(port => {
            // port.radialAnchor = port.radialAnchor.rotate(Math.PI);
            port.node.debugShapes.push(port.radialAnchor.getAnchor());
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

                const definingPorts = port.type == "outgoing" ? port.outPorts : port.inPorts;
                const otherPorts = port.type == "outgoing" ? port.inPorts : port.outPorts;
                const node = port.node;
                const parentNode = node.parent;

                const definingArray = definingPorts.map(port => port instanceof Anchor ? port : port.portAnchor).filter(port => port) as Anchor[];
                const otherArray = otherPorts.map(port => port instanceof Anchor ? port : port.portAnchor).filter(port => port) as Anchor[];

                // 1. Case:
                // Type == outgoing && only outgoing ports
                // Type == incoming && only incoming ports
                if (definingPorts.length > 0 && otherPorts.length == 0) {
                    console.log("CASE 1 (node to port)", port.nodeID, port.type, i);

                    // In this case, there is only one side of the port defined (by an anchor or the mean of multiple anchors).
                    // The other side of the port is the node and thus open to be defined.
                    // We construct a new anchor, that allows a smooth transition from the node center to the defined side of the port.
                    // This is done by finding a fitting circle segment between the node and the defined side of the port.

                    // const anchors = definingArray.filter(port => port instanceof Anchor) as Anchor[];
                    // const anchors = definingArray.map(port => port instanceof Anchor ? port : port.portAnchor).filter(port => port) as Anchor[];
                    const anchors = definingArray;
                    const meanAnchor = Anchor.mean(anchors, parentNode?.circle);
                    if (!meanAnchor) {
                        throw new Error("No mean anchor found");
                    }

                    const tangentCircle = RadialUtils.getCircleFromCoincidentPointAndTangentAnchor(node.center, meanAnchor);
                    const midPoint = Anchor.getMidPointBetweenPointAndAnchor(node.center, meanAnchor);

                    // From the tangent circle, we get the intersections with the node circle
                    const intersections = node.outerCircle.intersect(tangentCircle);
                    const anchorPoint = ShapeUtil.getClosestShapeToPoint(intersections, midPoint);

                    if (!anchorPoint) {
                        throw new Error("No anchor point found");
                    }

                    const _intersectionVector = new Vector(tangentCircle.center, anchorPoint)

                    const radDiff = RadialUtils.normalizeRad(RadialUtils.radBetweenPoints(node.center, anchorPoint, tangentCircle.center));
                    const _nodeAnchor = radDiff > 0 ? new Anchor(anchorPoint, _intersectionVector.rotate90CW()) : new Anchor(anchorPoint, _intersectionVector.rotate90CCW());


                    // const _nodeAnchor = new Anchor(node.center, midPoint);
                    const nodeAnchor = port.type == "outgoing" ? _nodeAnchor : _nodeAnchor.cloneReversed();

                    port.portAnchor = nodeAnchor;

                    if (port.nodeID.startsWith("__hypernode_7")) {
                        port.node.debugShapes.push(port.portAnchor);
                        port.node.debugShapes.push(meanAnchor);
                        port.node.debugShapes.push(tangentCircle)
                        port.node.debugShapes.push(node.center)
                        port.node.debugShapes.push(Anchor.getMidPointBetweenPointAndAnchor(node.center, meanAnchor))
                    }

                } else if (definingArray.length == 0 && otherArray.length > 0) {
                    // console.log("CASE 3 (port to node)", port);
                    // throw new Error("THIS SHOULD NOT HAPPEN " + port.nodeID);

                    console.log("CASE 3 (port with one undefined side)", port.nodeID, port.type, i);

                    const meanAnchor = Anchor.mean(otherArray);
                    if (meanAnchor) {
                        meanAnchor.anchorPoint = node.center;
                        meanAnchor.anchorPoint = meanAnchor.getPointInDirection(node.outerRadius);
                    }


                    port.portAnchor = meanAnchor;

                } else if (definingArray.length > 0 && otherArray.length == 0) {
                    // console.log("CASE 3 (port to node)", port);
                    // throw new Error("THIS SHOULD NOT HAPPEN " + port.nodeID);

                    console.log("CASE 4 (port with one undefined side)", port.nodeID, port.type, i);

                    const meanAnchor = Anchor.mean(definingArray);
                    if (meanAnchor) {
                        meanAnchor.anchorPoint = node.center;
                        meanAnchor.anchorPoint = meanAnchor.getPointInDirection(node.outerRadius);
                    }


                    port.portAnchor = meanAnchor;

                }
                else if (definingArray.length > 0 && otherArray.length > 0) {

                    // In this case, the port-anchor is defined by the mean of the anchors
                    // const outAnchors = port.outPorts.map(port => port instanceof Anchor ? port : port.portAnchor).filter(port => port) as Anchor[];
                    // const inAnchors = port.inPorts.map(port => port instanceof Anchor ? port : port.portAnchor).filter(port => port) as Anchor[];

                    const outAnchors = definingArray;
                    const inAnchors = otherArray;

                    console.log("CASE 2 (mean of port anchors)", outAnchors.length, inAnchors.length, port.node);


                    const meanOutAnchor = Anchor.mean(outAnchors, undefined);
                    const meanInAnchor = Anchor.mean(inAnchors, undefined);

                    if (!meanOutAnchor || !meanInAnchor) {

                        port.node.debugShapes.push(...outAnchors);
                        port.node.debugShapes.push(...inAnchors);
                        console.log(outAnchors, inAnchors);
                        throw new Error("No mean anchor found");
                    }

                    // TODO: Atm mean causes the loss of the anchor point, so we reset it here
                    meanOutAnchor.anchorPoint = outAnchors[0].anchorPoint;
                    meanInAnchor.anchorPoint = inAnchors[0].anchorPoint;

                    // The mean anchors are now adapted based on their distances to the node center (inverse proportionality)
                    const distanceIn = meanInAnchor.anchorPoint.distanceTo(node.center)[0];
                    const distanceOut = meanOutAnchor.anchorPoint.distanceTo(node.center)[0];

                    const stretchedVectorIn = meanInAnchor.direction.multiply(1 / distanceIn);
                    const stretchedVectorOut = meanOutAnchor.direction.multiply(1 / distanceOut);


                    // const stretchedVectorIn = meanInAnchor.direction.normalize().multiply(1 * distanceIn);
                    // const stretchedVectorOut = meanOutAnchor.direction.normalize().multiply(1 * distanceOut);

                    const meanVector = stretchedVectorIn.add(stretchedVectorOut);
                    const _meanAnchor = new Anchor(node.center, meanVector);

                    const meanAnchor = _meanAnchor.move(port.type == "outgoing" ? node.outerRadius : -node.outerRadius);
                    // new Anchor(_meanAnchor.getPointInDirection(node.outerRadius), meanVector);

                    if (!meanAnchor) {
                        throw new Error("No mean anchor found");
                    }

                    // meanAnchor.anchorPoint = node.center;
                    // meanAnchor.anchorPoint = meanAnchor.getPointInDirection(node.outerRadius);

                    // TODO: Check, if the anchors lie in the allowed range of the node

                    // if (port.nodeID.startsWith("drive_manager_in") && port.type == "incoming") {
                    //     console.log("PORT", distanceIn, distanceOut);
                    //     outAnchors.forEach(anchor => port.node.debugShapes.push(anchor));
                    //     inAnchors.forEach(anchor => port.node.debugShapes.push(anchor));
                    //     port.node.debugShapes.push(meanAnchor);
                    //     // port.node.debugShapes.push(meanInAnchor);
                    //     // port.node.debugShapes.push(meanOutAnchor);
                    // }

                    port.portAnchor = meanAnchor;
                }
                else {
                    console.log("UNKNOWN CASE", port.nodeID, port.type, i);
                }


                // if (port.nodeID.startsWith("drive_manager_in")) {
                // if (port.nodeID.startsWith("drive_manager_in")) {
                //     if (port.portAnchor) port.node.debugShapes.push(port.portAnchor);
                // }
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

        // this.prepareBundlePorts();
        this.prepareNodePorts();

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

    mapNodeToBundlePorts: Map<LayoutNode, ConnectionBundlePort[]> = new Map();
    mapNodeToPorts: Map<LayoutNode, NodePort[]> = new Map();


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

        const portSimulation = new NodePortSimulation(Array.from(this.mapNodeToPorts.values()).flat());
        portSimulation.simulate();

        multiConnections.forEach(multiConnection => {

            multiConnection.ports.forEach(port => {

                port?.anchors.forEach(anchor => {
                    if (anchor instanceof NodeAnchor) {
                        port?.node.debugShapes.push(anchor.anchor);
                    }
                })
            })

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
                            if (info.prevSegment) info.prevSegment.endAnchor = port.getAnchor();
                        }

                        if (info.nextType == "circleSegment") {
                            if (info.nextSegment) info.nextSegment.startAnchor = port.getAnchor();
                        }

                    }



                }
            });

            console.log(multiConnection.ports, multiConnection.segments);

            multiConnection.info.forEach((info, i) => {
                if (info.type == "circleSegment") {
                    (info.segment as CircleSegmentSegment).calculate();
                }
            })
        })

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
