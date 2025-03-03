import { Anchor } from "src/graph/graphical";
import { SubPath } from "./subPath";
import { VisNode } from "./visNode";
import { Point, Vector } from "2d-geometry";
import { RadialUtils } from "../../utils/radialUtils";



export class SubPathRange {

    // Type of the range, either inside or outside
    type: "inside" | "outside";

    // The node this range belongs to
    node: VisNode;

    // The valid range in radians
    range: [number, number];



    // The subpaths registered in this range
    subPaths: SubPath[] = [];

    // We only calculate the range once
    calculated = false;

    // The rad values assigned to the subpaths as soon as the range is calculated
    assignedRads: Map<SubPath, number> = new Map();
    assignedRadRanges: Map<SubPath, [number, number]> = new Map();

    // /**
    //  * During calculation
    //  */
    // assignedRadRanges: Map<SubPath, [number, number]> = new Map();

    combinedPathsDistanceFactor = 0.125;

    pathRangeMarginFactor = 0.1;

    constructor(node: VisNode, type: "inside" | "outside", nodeRangeMarginFactor = 0.9) {
        this.type = type;
        this.node = node;

        if (type === "outside") {
            this.range = node.layoutNode.getValidOuterRadRange(nodeRangeMarginFactor);
        } else {
            this.range = node.layoutNode.getValidInnerRadRange(nodeRangeMarginFactor);
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Sub Path Management
    ////////////////////////////////////////////////////////////////////////////

    registeredSubPaths: Set<SubPath> = new Set();

    registerSubPath(subPath: SubPath) {

        // If the subpath has a group, only add the range representative
        if (subPath.group) {
            if (!subPath.group.rangeRepresentative) {
                throw new Error("Group has no range representative");
            }

            if (this.registeredSubPaths.has(subPath.group.rangeRepresentative)) return;

            this.subPaths.push(subPath.group.rangeRepresentative);
            this.registeredSubPaths.add(subPath.group.rangeRepresentative);
            this.calculated = false;
            return;
        }

        this.subPaths.push(subPath);
        this.registeredSubPaths.add(subPath);
        this.calculated = false;
    }

    /**
     * Converts the subpath to the represented subpath if it is part of a group.
     * Otherwise, the subpath itself is returned.
     * @param subPath The subpath to get the represented subpath for.
     */
    getRepresentedSubPath(subPath: SubPath): SubPath {
        return subPath.group?.rangeRepresentative ?? subPath;
    }

    /**
     * Trims the range to the given anchor.
     * If the anchor is inside the range, the range values gets adapted
     */
    trimToAnchor(anchor: Anchor) {
        const anchorRad = this.getRadOfPoint(anchor.anchorPoint);
        if (this.pointIsInside(anchor.anchorPoint)) {

            // Decide which side to trim
            if (RadialUtils.forwardRadBetweenAngles(this.getMiddleRad(), anchorRad) < Math.PI) {
                this.range[1] = anchorRad;
            } else {
                this.range[0] = anchorRad;
            }
        }
    }


    ////////////////////////////////////////////////////////////////////////////
    // #region SubPath Anchor methods
    ////////////////////////////////////////////////////////////////////////////


    /**
     * Get the rad assigned to a specific path.
     * Calculates the range if not done yet.
     * @param path The path to get the rad for.
     * @returns The rad assigned to the path.
     */
    getRadForPath(path: SubPath): number {
        if (!this.calculated) {
            this.calculate();
        }
        path = this.getRepresentedSubPath(path);

        if (!this.assignedRads.has(path)) {
            console.warn(this);
            throw new Error(`Path ${path.id} not in continuum`);
        }

        return this.assignedRads.get(path)!;
    }

    /**
     * Returns the valid range for a specific path.
     * Calculates the range if not done yet.
     * @param path The path to get the range for.
     * @returns The valid range for the specified path.
     */
    getRangeForPath(path: SubPath): [number, number] {
        if (!this.calculated) {
            this.calculate();
        }
        path = this.getRepresentedSubPath(path);

        if (!this.assignedRadRanges.has(path)) {
            console.warn(this);
            throw new Error(`Path ${path.id} not in continuum`);
        }

        return this.assignedRadRanges.get(path)!;
    }

    /**
     * Check if a rad is inside the range.
     * @param rad The rad to check.
     * @returns True if the rad is inside the range, false otherwise.
     */
    radIsInside(rad: number, range?: [number, number]): boolean {
        range = range ?? this.range;
        return RadialUtils.radIsBetween(rad, range[0], range[1]);
    }

    /**
     * Check if the given point is inside the valid range.
     * @param point The point to check.
     * @returns True if the point is inside the range, false otherwise.
     */
    pointIsInside(point?: Point, range?: [number, number]): boolean {
        if (!point) return false;

        range = range ?? this.range;
        return this.radIsInside(this.getRadOfPoint(point), range);
    }

    /**
     * Returns the rad of a specific point relative to the center of the range's node.
     */
    getRadOfPoint(point: Point): number {
        return RadialUtils.radOfPoint(point, this.node.layoutNode.center);
    }

    /**
     * Get the anchor for a specific path.
     * Calculates the range if not done yet.
     * @param path The path to get the anchor for.
     * @param direction The direction of the anchor.
     * @returns The created anchor for the specified path and direction.
     */
    getAnchorForPath(path: SubPath, direction: "in" | "out"): Anchor {
        const rad = this.getRadForPath(path);
        return this.getAnchorForRad(rad, direction);
    }

    /**
     * Get the anchor for a specific rad.
     * This does not check if the anchor is valid.
     * @param rad The rad to get the anchor for.
     * @param direction The direction of the anchor.
     * @returns The created anchor.
     */
    getAnchorForRad(rad: number, direction: "in" | "out"): Anchor {
        const anchor = new Anchor(this.node.layoutNode.center, new Vector(rad)).move(this.node.layoutNode.outerRadius);
        if (direction === "in") return anchor.cloneReversed();
        return anchor;
    }

    /**
     * Returns a valid anchor towards a specific point.
     * @param anchorPoint The point to get the anchor towards.
     * @param range The range to get the anchor in. If not specified, the global valid range is used.
     * @returns The created anchor towards the specified point.
     */
    getValidVectorTowardsDirection(anchorPoint: Point, range?: [number, number]): Vector {
        if (!range) range = this.range;
        const rad = RadialUtils.radOfPoint(anchorPoint, this.node.layoutNode.center);
        const adaptedRad = RadialUtils.putRadBetween(rad, range[0], range[1]);

        return new Vector(adaptedRad);
    }

    /**
     * Returns a valid anchor towards a specific point.
     * @param anchorPoint The point to get the anchor towards.
     * @param range The range to get the anchor in. If not specified, the global valid range is used.
     * @returns The created anchor towards the specified point.
     */
    getValidAnchorTowardsDirection(anchorPoint: Point, range?: [number, number]): Anchor {
        if (!range) range = this.range;
        const vector = this.getValidVectorTowardsDirection(anchorPoint, range);
        return new Anchor(this.node.layoutNode.center, vector).move(this.node.layoutNode.outerRadius);
    }

    /**
     * Returns a valid anchor towards a specific point for the given path.
     * @param subPath The path to get the anchor for.
     * @param anchorPoint  The point to get the anchor towards.
     * @returns The created anchor towards the specified point in the valid range of the path.
     */
    getValidAnchorTowardsDirectionForPath(subPath: SubPath, anchorPoint: Point): Anchor {
        const range = this.getRangeForPath(subPath);
        const vector = this.getValidVectorTowardsDirection(anchorPoint, range);
        return new Anchor(this.node.layoutNode.center, vector).move(this.node.layoutNode.outerRadius);
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Range methods
    ////////////////////////////////////////////////////////////////////////////

    /**
     * Returns the edge anchors of the range for calculation and debugging purposes.
     * @returns An object containing the start, end, and backside anchors as well as all anchors in an array.
     */
    getValidAnchorsOfRange() {

        const startAnchor = new Anchor(this.node.layoutNode.center, new Vector(this.range[0]));
        const endAnchor = new Anchor(this.node.layoutNode.center, new Vector(this.range[1]));
        const backsideAnchor = new Anchor(this.node.layoutNode.center, new Vector(this.getMiddleRadOnBackside()));

        startAnchor._data = { length: this.node.layoutNode.outerRadius, stroke: "green" };
        endAnchor._data = { length: this.node.layoutNode.outerRadius, stroke: "red" };
        backsideAnchor._data = { length: this.node.layoutNode.outerRadius, stroke: "blue" };

        return {
            startAnchor, endAnchor, backsideAnchor, all: [startAnchor, endAnchor, backsideAnchor]
        };
    }

    /**
     * Returns the rad in the middle of the backside of the range.
     * This rad is OUTSIDE the valid range.
     * Used for calculation purposes.
     * @returns The rad in the middle of the backside of the range.
     */
    getMiddleRadOnBackside(): number {
        return RadialUtils.normalizeRad(this.range[1] + RadialUtils.forwardRadBetweenAngles(this.range[1], this.range[0]) / 2);
    }


    /**
     * Returns the middle rad within the range.
     * @returns The middle rad in the range as a normalized value.
     */
    getMiddleRad(): number {
        return RadialUtils.normalizeRad(this.range[0] + RadialUtils.forwardRadBetweenAngles(this.range[0], this.range[1]) / 2);
    }


    ////////////////////////////////////////////////////////////////////////////
    // #region Calculate
    ////////////////////////////////////////////////////////////////////////////

    calculate() {
        const EPSILON = 0.01;
        // Sort the paths by their opposite node position
        // For the same position, first take outgoing, then incoming connections

        // This is the center rad on the backside of the range
        // We sort against this rad, to avoid problems where close to border connections are sorted to the wrong side
        const backRad = this.getMiddleRadOnBackside();

        const pathInformation = this.subPaths.map(subPath => {

            // const oppositeConnectionAnchor= subPath.getOppositeConnectionAnchor(this.node);
            const oppositeConnectionPoint = subPath.getOppositeConnectionPoint(this.node);

            // const oppositeNode = subPath.getOppositeNodeThan(this.node);
            if (!oppositeConnectionPoint) {
                // return { path: subPath, oppositeNode: undefined, forwardRad: -1 };
                throw new Error("Opposite connection point not found");
            }

            const radOfOppositePoint = this.getRadOfPoint(oppositeConnectionPoint);
            const forwardRadToConnectionPoint = RadialUtils.forwardRadBetweenAngles(backRad, radOfOppositePoint);

            const otherLayoutNode = subPath.getLayoutNodeInDirectionOf(subPath.getOppositeNodeThan(this.node));
            const forwardRadToTargetNode = otherLayoutNode ? this.getRadOfPoint(otherLayoutNode.center) : forwardRadToConnectionPoint;

            return {
                subPath,
                forwardRadToConnectionPoint,
                forwardRadToTargetNode,
                sourceVisNode: subPath.sourceVisNode,
                targetVisNode: subPath.targetVisNode,
                oppositeVisNode: subPath.getOppositeNodeThan(this.node),
            };
        });

        pathInformation.sort((a, b) => {

            // if (a.oppositeVisNode === b.oppositeVisNode) {
            //     return a.sourceVisNode === this.node ? -1 : 1;
            // }

            if (Math.abs(a.forwardRadToConnectionPoint - b.forwardRadToConnectionPoint) < EPSILON) {
                if (Math.abs(a.forwardRadToTargetNode - b.forwardRadToTargetNode) < EPSILON) {
                    return a.sourceVisNode === this.node ? -1 : 1;
                }
                return a.forwardRadToTargetNode - b.forwardRadToTargetNode;
            }
            return a.forwardRadToConnectionPoint - b.forwardRadToConnectionPoint;
        })

        // After sorted, we add the connections to our continuum
        // For that, we first add each connection with a distance of 1
        const assignedRads: Map<SubPath, number> = new Map();
        const pathToRange: Map<SubPath, [number, number]> = new Map();

        const increaseStep = 1;
        // let currentPosition = 1;
        // let currentPosition = increaseStep / 2;
        // let currentPosition = increaseStep;
        let currentPosition = 0;

        const pathHasCounterPath: Map<SubPath, boolean> = new Map();

        pathInformation.forEach((pathInfo, i) => {
            const subPath = pathInfo.subPath;
            const nextSubPath = pathInformation[i + 1]?.subPath;
            const previousSubPath = i > 0 ? pathInformation[i - 1].subPath : undefined;

            const range: [number, number] = [currentPosition, currentPosition];
            let padding = 0;
            pathHasCounterPath.set(subPath, false);


            // If the next path is the counter path of the current one (so source and target node are switched), we add a distance of 1 * this.combinedPathsDistanceFactor
            if (subPath.isCounterPathOf(nextSubPath)) {
                range[0] += (1 - this.combinedPathsDistanceFactor) * increaseStep;
                range[1] = range[0];
                range[1] += increaseStep * this.combinedPathsDistanceFactor;
                // const maxWidth = Math.max(subPath.connection.weight, nextSubPath.connection.weight);
                // currentPosition += 1 * this.combinedPathsDistanceFactor;
                // currentPosition += maxWidth * this.combinedPathsDistanceFactor;
                pathHasCounterPath.set(subPath, true);
            } else if (previousSubPath && subPath.isCounterPathOf(previousSubPath)) {
                range[1] += increaseStep * this.combinedPathsDistanceFactor;
                padding = (1 - this.combinedPathsDistanceFactor) * increaseStep;
                pathHasCounterPath.set(subPath, true);
            }

            else {
                // currentPosition += 1;
                range[1] += increaseStep;
            }

            pathToRange.set(subPath, range);
            currentPosition = range[1] + padding;
        });
        // currentPosition += increaseStep;

        // Now, we normalize the ranges based on the available space
        const radDiff = RadialUtils.forwardRadBetweenAngles(this.range[0], this.range[1]);
        const totalDistance = currentPosition;

        pathToRange.forEach((range, path) => {

            // Convert the linear range to the real rad range
            range[0] = (range[0] / totalDistance) * radDiff + this.range[0];
            range[1] = (range[1] / totalDistance) * radDiff + this.range[0];

            // Shrink the range by the margin factor
            const margin = (range[1] - range[0]) * this.pathRangeMarginFactor;
            range[0] += margin / 2;
            range[1] -= margin / 2;
        });

        pathToRange.forEach((range, path) => {

            // Check if the desired range is inside the valid range
            // const desiredAnchorPoint = path.desiredNodeAnchor?.anchorPoint;
            const desiredAnchorPoint = path.getDesiredNodeAnchor(this.node)?.anchorPoint;
            if (!desiredAnchorPoint || pathHasCounterPath.get(path)) {
                assignedRads.set(path, (range[0] + range[1]) / 2);
                return;
            }

            if (this.pointIsInside(desiredAnchorPoint, range)) {

                console.warn("POINT INSIDE", desiredAnchorPoint, range, this.getRadOfPoint(desiredAnchorPoint));

                assignedRads.set(path, this.getRadOfPoint(desiredAnchorPoint));
                return;
            } else {
                const validAnchor = this.getValidAnchorTowardsDirection(desiredAnchorPoint, range);
                assignedRads.set(path, this.getRadOfPoint(validAnchor.anchorPoint));
            }
        })

        let debug = false;
        debug = false;
        // if (this.node.id == "facialexpressionmanager_node") debug = true;
        // if (this.node.id == "drive_manager") debug = true;
        if (debug) {


            // console.warn("SORTED PATHS", pathInformation);

            pathToRange.forEach((range, path) => {

                const startAnchor = this.getAnchorForRad(range[0], "out");
                const endAnchor = this.getAnchorForRad(range[1], "out");

                startAnchor._data = { length: 10, stroke: "green" };
                endAnchor._data = { length: 10, stroke: "red" };

                path.connection.debugShapes.push(startAnchor, endAnchor);
            })

            assignedRads.forEach((rad, path) => {
                const anchor = this.getAnchorForRad(rad, "out");
                anchor._data = { length: 15, stroke: "blue" };
                path.connection.debugShapes.push(anchor);
            });


        }

        // this.paths.forEach((path, index) => {
        //     const distance = assignedRads.get(path)!;
        //     const normalizedDistance = (distance / totalDistance) * radDiff + this.range[0];
        //     this.mapPathToRad.set(path, normalizedDistance);
        // });

        this.assignedRads = assignedRads;
        this.assignedRadRanges = pathToRange;
        this.calculated = true;
    }



}
