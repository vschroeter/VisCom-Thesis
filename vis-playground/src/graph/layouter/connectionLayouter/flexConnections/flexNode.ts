import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { FlexConnection, FlexConnectionType, FlexPath } from "./flexConnection";
import { FlexConnectionLayouter } from "./flexLayouter";
import { Anchor } from "src/graph/graphical";
import { Point, Vector } from "2d-geometry";
import { RadialUtils } from "../../utils/radialUtils";


export class FlexContinuum {

    type: "inside" | "outside";
    node: FlexNode;
    range: [number, number];

    paths: FlexPath[] = [];

    calculated = false;

    mapPathToRad: Map<FlexPath, number> = new Map();

    combinedPathsDistanceFactor = 0.125;


    constructor(node: FlexNode, type: "outside" | "inside") {
        this.node = node;

        this.type = type;

        if (type === "outside") {
            this.range = node.layoutNode.getValidOuterRadRange(0.9);
        } else {
            this.range = node.layoutNode.getValidInnerRadRange(0.9);
        }

    }

    addPath(connection: FlexPath) {
        this.paths.push(connection);
        this.calculated = false;
    }

    getValidRangeAnchors(): Anchor[] {

        const anchor1 = new Anchor(this.node.layoutNode.center, new Vector(this.range[0]));
        const anchor2 = new Anchor(this.node.layoutNode.center, new Vector(this.range[1]));
        const anchor3 = new Anchor(this.node.layoutNode.center, new Vector(this.getBacksideRad()));

        anchor1._data = { length: this.node.layoutNode.outerRadius, stroke: "green" };
        anchor2._data = { length: this.node.layoutNode.outerRadius, stroke: "red" };
        anchor3._data = { length: this.node.layoutNode.outerRadius, stroke: "blue" };

        return [anchor1, anchor2, anchor3];
    }

    getBacksideRad(): number {
        return this.range[1] + RadialUtils.forwardRadBetweenAngles(this.range[1], this.range[0]) / 2;
    }

    getAnchorForRad(rad: number, direction: "in" | "out"): Anchor {
        const anchor = new Anchor(this.node.layoutNode.center, new Vector(rad)).move(this.node.layoutNode.outerRadius);
        if (direction === "in") return anchor.cloneReversed();
        return anchor;
    }

    calculate() {
        // Sort the paths by their opposite node position
        // For the same position, first take outgoing, then incoming connections

        // This is the center rad on the backside of the range
        // We sort against this rad, to avoid problems where close to border connections are sorted to the wrong side
        const backRad = this.range[1] + RadialUtils.forwardRadBetweenAngles(this.range[1], this.range[0]) / 2;

        // const pathInformation = this.paths.map(path => {

        //     const oppositeNode = path.getOppositeNodeThan(this.node);
        //     if (!oppositeNode) {
        //         return { path, oppositeNode: undefined, forwardRad: -1 };
        //     }

        //     const rad = RadialUtils.radOfPoint(oppositeNode.layoutNode.center, this.node.layoutNode.center);
        //     const forwardRad = RadialUtils.forwardRadBetweenAngles(backRad, rad);

        //     console.log("[FLEX] RAD", path.id, rad, forwardRad);

        //     return { path, oppositeNode, oppId: oppositeNode.id, nId: this.node.id, forwardRad };
        // });

        // console.log("[FLEX] pathInformation", pathInformation, this.node, backRad);

        this.paths.sort((a, b) => {


            // TODO: Sort not only by opposite node, but also by the next path anchor if exists

            const aOpposite = a.getOppositeNodeThan(this.node);
            const bOpposite = b.getOppositeNodeThan(this.node);

            if (!aOpposite || !bOpposite) {
                return 0;
            }

            const aRad = RadialUtils.radOfPoint(aOpposite.layoutNode.center, this.node.layoutNode.center);
            const bRad = RadialUtils.radOfPoint(bOpposite.layoutNode.center, this.node.layoutNode.center);

            const startToA = RadialUtils.forwardRadBetweenAngles(backRad, aRad);
            const startToB = RadialUtils.forwardRadBetweenAngles(backRad, bRad);

            if (Math.abs(startToA - startToB) < 0.001) {
                return a.sourceFlexNode == this.node ? -1 : 1;
            }

            return startToA - startToB;
        });


        // After sorted, we add the connections to our continuum
        // For that, we first add each connection with a distance of 1
        const pathContinuum: Map<FlexPath, number> = new Map();
        let currentPosition = 1;

        this.paths.forEach((path, i) => {
            const nextPath = this.paths[i + 1];
            pathContinuum.set(path, currentPosition);

            // If the next path is the counter path of the current one (so source and target node are switched), we add a distance of 1 * this.combinedPathsDistanceFactor
            if (path.isCounterPathOf(nextPath)) {
                const maxWidth = Math.max(path.connection.weight, nextPath.connection.weight);
                currentPosition += 1 * this.combinedPathsDistanceFactor;
                // currentPosition += maxWidth * this.combinedPathsDistanceFactor;
            } else {
                currentPosition += 1;
            }
        });

        // Now, we normalize the distances based on the available space

        const radDiff = RadialUtils.forwardRadBetweenAngles(this.range[0], this.range[1]);

        const totalDistance = currentPosition;
        this.paths.forEach((path, index) => {
            const distance = pathContinuum.get(path)!;
            const normalizedDistance = (distance / totalDistance) * radDiff + this.range[0];
            this.mapPathToRad.set(path, normalizedDistance);
        });

        this.calculated = true;
    }


    getRadForPath(path: FlexPath): number {

        if (!this.calculated) {
            this.calculate();
        }

        if (!this.mapPathToRad.has(path)) {
            throw new Error(`Path ${path.id} not in continuum`);
        }

        return this.mapPathToRad.get(path)!;
    }

    getAnchorForPath(path: FlexPath, direction: "in" | "out"): Anchor {
        const rad = this.getRadForPath(path);
        return this.getAnchorForRad(rad, direction);
    }


    radIsInside(rad: number): boolean {
        return RadialUtils.radIsBetween(rad, this.range[0], this.range[1]);
    }

    pointIsInside(point: Point): boolean {
        const radOfPoint = RadialUtils.radOfPoint(point, this.node.layoutNode.center);
        return this.radIsInside(radOfPoint);
    }

    getValidVectorTowardsDirection(anchorPoint: Point) {
        const rad = RadialUtils.radOfPoint(anchorPoint, this.node.layoutNode.center);
        const adaptedRad = RadialUtils.putRadBetween(rad, this.range[0], this.range[1]);

        return new Vector(adaptedRad);
    }

    getValidAnchorTowardsDirection(anchorPoint: Point): Anchor {
        const vector = this.getValidVectorTowardsDirection(anchorPoint);
        return new Anchor(this.node.layoutNode.center, vector).move(this.node.layoutNode.outerRadius);
    }

}


export class FlexNode {

    layoutNode: LayoutNode;

    get center() {
        return this.layoutNode.center;
    }

    connections: FlexConnection[] = [];

    outConnections: FlexConnection[] = [];
    inConnections: FlexConnection[] = [];

    parentLayouter: FlexConnectionLayouter;

    innerContinuum: FlexContinuum;
    outerContinuum: FlexContinuum;

    mapTargetNodeToPath: Map<FlexNode, FlexPath> = new Map();

    get outerCircle() {
        return this.layoutNode.outerCircle;
    }

    get circle() {
        return this.layoutNode.circle;
    }

    getPathTo(targetFlexNode: FlexNode): FlexPath | undefined {
        return this.mapTargetNodeToPath.get(targetFlexNode);
    }

    get id() {
        return this.layoutNode.id;
    }

    constructor(layoutNode: LayoutNode, parentLayouter: FlexConnectionLayouter) {
        this.layoutNode = layoutNode;
        this.parentLayouter = parentLayouter;

        this.innerContinuum = new FlexContinuum(this, "inside");
        this.outerContinuum = new FlexContinuum(this, "outside");
    }

    initConnections() {
        this.connections = [];
        this.outConnections = [];
        this.inConnections = [];

        this.layoutNode.outConnectionsWithoutSelfLoops.forEach(connection => {
            this.addConnection(connection);
        });
        this.layoutNode.inConnectionsWithoutSelfLoops.forEach(connection => {
            this.addConnection(connection);
        });
    }

    addConnection(layoutConnection: LayoutConnection) {
        // const connection = new FlexConnection(layoutConnection, this);
        // const connection = FlexNode.createConnection(layoutConnection, this);
        const connection = this.parentLayouter.getFlexConnection(layoutConnection);
        this.connections.push(connection);
        if (connection.source === this.layoutNode) {
            this.outConnections.push(connection);
        } else {
            this.inConnections.push(connection);
        }
    }

    // static createConnection(connection: LayoutConnection, flexNode: FlexNode): FlexConnection {
    //     const source = connection.source;
    //     const target = connection.target;
    //     let type: FlexConnectionType = "unknown";
    //     if (source.parent === target.parent) {
    //         if (source.isDirectPredecessorInSortingTo(target)) {
    //             type = "circleArcForward";
    //         } else if (source.isDirectSuccessorInSortingTo(target)) {
    //             type = "circleArcBackward";
    //         } else {
    //             type = "sameParent";
    //         }
    //     } else {
    //         const commonParent = source.getCommonParent(target);

    //         // if ((commonParent == source.parent || commonParent == source.parent?.parent) && (commonParent == target.parent || commonParent == target.parent?.parent)) {
    //         //     const firstChildContainingSource = commonParent?.getChildNodeContainingNodeAsDescendant(source);
    //         //     const firstChildContainingTarget = commonParent?.getChildNodeContainingNodeAsDescendant(target);

    //         //     if (firstChildContainingSource?.isDirectPredecessorInSortingTo(firstChildContainingTarget)) {
    //         //         this.type = "sameHyperParentDirectForward";
    //         //     } else if (firstChildContainingSource?.isDirectSuccessorInSortingTo(firstChildContainingTarget)) {
    //         //         this.type = "sameHyperParentDirectBackward";
    //         //     }
    //         // }

    //         if (source.isAnchor || target.isAnchor) {

    //             const firstChildContainingSource = commonParent?.getChildNodeContainingNodeAsDescendant(source);
    //             const firstChildContainingTarget = commonParent?.getChildNodeContainingNodeAsDescendant(target);

    //             if (firstChildContainingSource?.isDirectPredecessorInSortingTo(firstChildContainingTarget)) {
    //                 type = "circleArcForward";
    //             } else if (firstChildContainingSource?.isDirectSuccessorInSortingTo(firstChildContainingTarget)) {
    //                 type = "circleArcBackward";
    //             }
    //         }

    //         if (type == "unknown") {
    //             type = "differentParent";
    //         }
    //     }

    //     switch (type) {
    //         case "circleArcForward":
    //             return new DirectCircleArcConnection(connection, type, flexNode);
    //         case "circleArcBackward":
    //             return new DirectCircleArcConnection(connection, type, flexNode);
    //         case "sameParent":
    //             return new InsideParentConnection(connection, type, flexNode);

    //         // case "differentParent":
    //         //     return
    //         // // return new DifferentParentConnection(connection, flexNode);
    //         // default:
    //         //     throw new Error(`Unknown FlexConnectionType: ${type}`);
    //     }

    //     return new EmptyFlexConnection(connection, type, flexNode);
    // }

    ////////////////////////////////////////////////////////////////////////////
    // #regio Flex Connection Types
    ////////////////////////////////////////////////////////////////////////////

    get circleArcForwardConnections() {
        return this.connections.filter(c => c.type === "circleArcForward");
    }

    get circleArcBackwardConnections() {
        return this.connections.filter(c => c.type === "circleArcBackward");
    }

    get circleArcConnections() {
        return this.circleArcForwardConnections.concat(this.circleArcBackwardConnections);
    }

    get sameParentConnections() {
        return this.connections.filter(c => c.type === "sameParent");
    }

}
