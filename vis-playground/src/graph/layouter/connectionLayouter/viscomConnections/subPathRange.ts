import { Anchor } from "src/graph/graphical";
import { SubPath } from "./subPath";
import { VisNode } from "./visNode";
import { Point, Segment, Vector } from "2d-geometry";
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
    // combinedPathsDistanceFactor = 1;

    pathRangeMarginFactor = 0.1;

    outerMargin: number;

    constructor(node: VisNode, type: "inside" | "outside", nodeRangeMarginFactor = 0.9) {
        this.type = type;
        this.node = node;

        this.outerMargin = 0;

        if (type === "outside") {
            this.range = node.layoutNode.getValidOuterRadRange(nodeRangeMarginFactor, false);
            this.outerMargin = Math.abs(this.range[0] - node.layoutNode.getValidOuterRadRange(1, false)[0]);
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
     * Check if a specific subpath is registered in this range.
     */
    hasPath(subPath: SubPath): boolean {
        return this.registeredSubPaths.has(this.getRepresentedSubPath(subPath));
    }


    /**
     * Trims the range to the given anchor.
     * If the anchor is inside the range, the range values gets adapted
     */
    trimToAnchor(anchor: Anchor) {
        const anchorRad = this.getRadOfPoint(anchor.anchorPoint);
        if (this.pointIsInside(anchor.anchorPoint)) {

            // const midTo0 = RadialUtils.forwardRadBetweenAngles(this.getMiddleRad(), this.range[0]);
            // const midTo1 = RadialUtils.forwardRadBetweenAngles(this.getMiddleRad(), this.range[1]);

            const midToAnchor = RadialUtils.forwardRadBetweenAngles(this.getMiddleRad(), anchorRad);

            // console.warn("[TRIM]", {
            //     anchorRad,
            //     r: this.range,
            //     id: this.node.id,
            //     midToAnchor
            // });

            // Decide which side to trim
            if (midToAnchor < Math.PI) {
                this.range[1] = anchorRad - this.outerMargin;
                // this.range[1] = anchorRad - 0;
            } else {
                this.range[0] = anchorRad + this.outerMargin;
                // this.range[0] = anchorRad + 0;
            }

            this.calculated = false;
            // console.log(this.range);
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
            console.error(this.node.id, path, this);
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
    getValidAnchorTowardsDirectionForPath(subPath: SubPath, anchorPoint: Point, createFloatingAnchorIfNotRegistered = true): Anchor {

        if (!this.hasPath(subPath)) {
            if (!createFloatingAnchorIfNotRegistered) {
                throw new Error("Path not registered.");
            }

            // If the path is not registered, we create a floating anchor
            // TODO: Take other existing anchors into account
            const anchor = this.getValidAnchorTowardsDirection(anchorPoint);
            return anchor;
        }
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
            const oppositeConnectionPoint = subPath.getOppositeConnectionPoint(this.node)?.clone();

            // const oppositeNode = subPath.getOppositeNodeThan(this.node);
            if (!oppositeConnectionPoint) {
                // return { path: subPath, oppositeNode: undefined, forwardRad: -1 };
                throw new Error("Opposite connection point not found");
            }

            // if (this.node.id == "flint_node") {
            //     console.warn("Get opposite connection point", {
            //         t: this,
            //         cId: subPath.cId,
            //         id: subPath.id,
            //         type: subPath.connectionType,
            //         oppositeNode: subPath.getOppositeNodeThan(this.node)?.id,
            //         node: this.node.id,
            //         point: oppositeConnectionPoint,
            //         fw: RadialUtils.forwardRadBetweenAngles(backRad, this.getRadOfPoint(oppositeConnectionPoint!)),
            //     });
            // }

            const radOfOppositePoint = this.getRadOfPoint(oppositeConnectionPoint);
            const forwardRadToConnectionPoint = RadialUtils.forwardRadBetweenAngles(backRad, radOfOppositePoint);

            const otherLayoutNode = subPath.getLayoutNodeInDirectionOf(subPath.getOppositeNodeThan(this.node));
            const forwardRadToTargetNode = otherLayoutNode ? this.getRadOfPoint(otherLayoutNode.center) : forwardRadToConnectionPoint;

            const desiredAnchor = subPath.getDesiredNodeAnchor(this.node);
            const desiredAnchorPoint = desiredAnchor?.anchorPoint;

            return {
                subPath,
                desiredAnchor,
                desiredAnchorPoint,
                level: subPath.minLevelFromTop,
                forwardRadToConnectionPoint,
                forwardRadToTargetNode,
                sourceVisNode: subPath.sourceVisNode,
                targetVisNode: subPath.targetVisNode,
                oppositeVisNode: subPath.getOppositeNodeThan(this.node),
                oppositeConnectionPoint,
                isInsideRange: false
            };
        });

        pathInformation.sort((a, b) => {

            // if (a.oppositeVisNode === b.oppositeVisNode) {
            //     return a.sourceVisNode === this.node ? -1 : 1;
            // }


            // We first sort by by level, with higher levels being at the outside of the range
            // To determine the side of the sorting, we check wether the forward rad to the connection point is:
            // - between 0° and 180° --> we sort it as first elements
            // - between 180° and 360° --> we sort it as last elements

            if (a.level != b.level) {

                const subPathWithLowerLevel = a.level < b.level ? a : b;
                const subPathWithLowerLevelIsFirst = subPathWithLowerLevel.forwardRadToConnectionPoint < Math.PI;

                if (subPathWithLowerLevelIsFirst) {
                    return a.level - b.level;
                } else {
                    return b.level - a.level;
                }


                // If the levels are different, we sort by level
                // return a.level - b.level;
                return b.level - a.level;

                // const aIsFirst = a.forwardRadToConnectionPoint < Math.PI;
                // const bIsFirst = b.forwardRadToConnectionPoint < Math.PI;

                // // If both should be sorted first, we take the lower level first
                // if (aIsFirst && bIsFirst) return a.subPath.level - b.subPath.level;

                // // If both should be sorted last, we take the higher level first
                // if (!aIsFirst && !bIsFirst) return b.subPath.level - a.subPath.level;

                // // If one is first and the other last, we take the first one first
                // return aIsFirst ? -1 : 1;
            }


            if (Math.abs(a.forwardRadToConnectionPoint - b.forwardRadToConnectionPoint) < EPSILON) {

                if (a.sourceVisNode === this.node && b.sourceVisNode === this.node) {
                    return a.forwardRadToTargetNode - b.forwardRadToTargetNode;
                } else {
                    return a.sourceVisNode === this.node ? -1 : 1;
                }

                // if (Math.abs(a.forwardRadToTargetNode - b.forwardRadToTargetNode) < EPSILON) {
                //     return a.sourceVisNode === this.node ? -1 : 1;
                // }
                // return a.forwardRadToTargetNode - b.forwardRadToTargetNode;
            }
            return a.forwardRadToConnectionPoint - b.forwardRadToConnectionPoint;
        })

        // console.warn("SORTED PATHS" + this.type, this.node.id,
        //     pathInformation.map(p => ({
        //         id: p.subPath.id,
        //         level: p.level,
        //         t: p
        //     }))
        // );


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
            // const margin = (range[1] - range[0]) * this.pathRangeMarginFactor;
            const margin = (range[1] - range[0]) * 0;
            range[0] += margin / 2;
            range[1] -= margin / 2;
        });


        // const doRefine = false;
        const doRefine = true;
        if (doRefine) {
            // Refine the ranges:
            // Beginning on one side, we look, if a path range can be shrank

            let debug = false;
            debug = true;
            debug = false;
            // if (this.node.id == "dialog_session_manager" && this.type == "outside") debug = true;

            const completeRangeDiff = RadialUtils.forwardRadBetweenAngles(this.range[0], this.range[1]);
            const minDistanceBetweenRanges = this.pathRangeMarginFactor * completeRangeDiff / pathToRange.size;

            const minSizeFactor = 0.2;
            const minSizeOfRange = minSizeFactor * completeRangeDiff / pathToRange.size;


            // New refine method

            // Check for each path, if the desired anchor is inside the range
            // If so, we shrink the range to that desired anchor and increase the adjacent ranges
            // If no path changes, we stop the iteration

            let changed = true;
            while (changed) {
                changed = false;

                pathInformation.forEach((pathInfo, i) => {

                    if (pathInfo.isInsideRange) return;

                    // if (pathHasCounterPath.get(pathInfo.subPath)) return;

                    const path = pathInfo.subPath;
                    const range = pathToRange.get(path)!;

                    const desiredAnchor = pathInfo.desiredAnchor;
                    if (!desiredAnchor) return;

                    const desiredAnchorPoint = desiredAnchor.anchorPoint;
                    if (this.pointIsInside(desiredAnchorPoint, range)) {
                        const adaptedAnchor = this.getValidAnchorTowardsDirection(desiredAnchorPoint, range);
                        const anchorSlope = adaptedAnchor.direction.slope;

                        range[0] = RadialUtils.normalizeRad(anchorSlope - minSizeOfRange / 2);
                        range[1] = RadialUtils.normalizeRad(anchorSlope + minSizeOfRange / 2);

                        // Adjust the adjacent ranges
                        if (i > 0) {
                            const previousRange = pathToRange.get(pathInformation[i - 1].subPath)!;
                            // previousRange[1] = range[0] - minDistanceBetweenRanges;
                            previousRange[1] = range[0] - 0;

                            if (RadialUtils.forwardRadBetweenAngles(previousRange[0], previousRange[1]) < minSizeOfRange) {
                                previousRange[0] = range[0] - minSizeOfRange;
                            }
                        }
                        if (i < pathInformation.length - 1) {


                            const nextRange = pathToRange.get(pathInformation[i + 1].subPath)!;

                            const diffBefore = RadialUtils.forwardRadBetweenAngles(nextRange[0], nextRange[1]);
                            const old0 = nextRange[0];

                            nextRange[0] = range[1] + minDistanceBetweenRanges;
                            // nextRange[0] = range[1] + 0;

                            const changIn0 = RadialUtils.forwardRadBetweenAngles(old0, nextRange[0]);

                            const diffAfter = RadialUtils.forwardRadBetweenAngles(nextRange[0], nextRange[1]);

                            // In this case, we overtook the range end
                            if (diffBefore > diffAfter) {
                                nextRange[1] = nextRange[0] + minSizeOfRange;
                            }


                            // if

                            // if (RadialUtils.forwardRadBetweenAngles(nextRange[0], nextRange[1]) < minSizeOfRange) {
                            //     nextRange[1] = range[1] + minSizeOfRange;
                            // }

                        }

                        pathInfo.isInsideRange = true;
                        changed = true;
                    }
                });
            }



            // Old refine method
            [{ info: pathInformation, type: "forward" }, { info: pathInformation.slice().reverse(), type: "backward" }].forEach(({ info, type }) => {

                if (type == "forward") return;
                if (type == "backward") return;

                let currentStart = type == "forward" ? this.range[0] : this.range[1];

                info.forEach(pathInfo => {

                    const i0 = type == "forward" ? 0 : 1;
                    const i1 = type == "forward" ? 1 : 0;

                    const path = pathInfo.subPath;
                    const range = pathToRange.get(path)!;
                    // if (pathHasCounterPath.get(path)) {
                    //     currentStart = range[1] + minDistanceBetweenRanges;
                    //     return;
                    // }

                    range[i0] = currentStart;


                    // Check, where the desired position of the path is
                    const desiredAnchor = path.getDesiredNodeAnchor(this.node);
                    if (debug) {
                        console.warn("[REFINE]:", range[0], range[1], RadialUtils.forwardRadBetweenAngles(range[0], range[1]));

                    }

                    if (desiredAnchor) {
                        const desiredAnchorPoint = desiredAnchor.anchorPoint;
                        const adaptedAnchor = this.getValidAnchorTowardsDirection(desiredAnchorPoint, range);
                        const anchorSlope = adaptedAnchor.direction.slope;

                        range[i0] = RadialUtils.normalizeRad(range[i0]);
                        range[i1] = RadialUtils.normalizeRad(anchorSlope);
                        // if (range[1] < range[0]) range[1] = range[0];

                        const currentRangeSize = RadialUtils.forwardRadBetweenAngles(range[0], range[1]);

                        if (type == "forward") {
                            range[1] += Math.max(0, minSizeOfRange - currentRangeSize);
                        } else {
                            range[0] -= Math.max(0, minSizeOfRange - currentRangeSize);
                        }

                        if (debug) {
                            desiredAnchor._data = { length: 20, stroke: "magenta" };
                            this.node.layoutNode.debugShapes.push(desiredAnchor);
                            adaptedAnchor._data = { length: 15, stroke: "cyan" };
                            this.node.layoutNode.debugShapes.push(adaptedAnchor);


                            console.warn("Adapted range", range, currentRangeSize, minSizeOfRange);
                        }
                    }

                    if (type == "forward") {
                        currentStart = range[1] + minDistanceBetweenRanges;
                    } else {
                        currentStart = range[0] - minDistanceBetweenRanges;
                    }
                });



            })



        }



        pathToRange.forEach((range, path) => {

            // Check if the desired range is inside the valid range
            // const desiredAnchorPoint = path.desiredNodeAnchor?.anchorPoint;
            const desiredAnchorPoint = path.getDesiredNodeAnchor(this.node)?.anchorPoint;
            if (!desiredAnchorPoint || pathHasCounterPath.get(path)) {
            // if (!desiredAnchorPoint) {
                const radDiff = RadialUtils.forwardRadBetweenAngles(range[0], range[1]);
                assignedRads.set(path, range[0] + radDiff / 2);
                return;
            }

            if (this.pointIsInside(desiredAnchorPoint, range)) {

                // console.warn("POINT INSIDE", desiredAnchorPoint, range, this.getRadOfPoint(desiredAnchorPoint));

                assignedRads.set(path, this.getRadOfPoint(desiredAnchorPoint));
                return;
            } else {
                const validAnchor = this.getValidAnchorTowardsDirection(desiredAnchorPoint, range);
                assignedRads.set(path, this.getRadOfPoint(validAnchor.anchorPoint));
            }
        })



        let debug = false;
        debug = true;
        debug = false;
        // if (this.node.id == "facialexpressionmanager_node") debug = true;
        // if (this.node.id == "drive_manager") debug = true;
        // if (this.node.id == "flint_node" && this.type == "outside") debug = true;
        // if (this.node.id == "equalizer") debug = true;
        // if (this.node.id == "dialog_session_manager") debug = true;
        // if (this.node.id == "/dialog/tts_guard") debug = true;
        if (debug) {


            this.node.layoutNode.debugShapes.push(...this.getValidAnchorsOfRange().all);

            console.warn("SORTED PATHS", pathInformation);

            // pathInformation.forEach((pathInfo, i) => {
            //     pathInfo.oppositeConnectionPoint._data = {r: 4, fill: this.type == "inside" ? "red" : "green"};
            //     pathInfo.subPath.connection.debugShapes.push(pathInfo.oppositeConnectionPoint);
            // })

            // const p = new Point(517.7175537019239, -471.7411783240392);
            // const p = new Point(604.7, -369.3);
            // p._data = { r: 7, fill: "blue" };
            // this.node.layoutNode.debugShapes.push(p);

            pathToRange.forEach((range, path) => {

                const startAnchor = this.getAnchorForRad(range[0], "out");
                const endAnchor = this.getAnchorForRad(range[1], "out");

                startAnchor._data = { length: 10, stroke: "green" };
                endAnchor._data = { length: 10, stroke: "red" };

                path.connection.debugShapes.push(startAnchor, endAnchor);


                const desiredAnchor = path.getDesiredNodeAnchor(this.node);
                if (desiredAnchor) {
                    desiredAnchor._data = { length: 150, stroke: "blue" };
                    path.connection.debugShapes.push(desiredAnchor);
                }
                // const desiredAnchorPoint = path.getDesiredNodeAnchor(this.node)?.anchorPoint;

                // if (desiredAnchorPoint && path.fixedPathAnchorPoint) {
                //     const segment = new Segment(path.fixedPathAnchorPoint, desiredAnchorPoint);
                //     path.connection.debugShapes.push(segment);
                // }

            })

            // assignedRads.forEach((rad, path) => {
            //     const anchor = this.getAnchorForRad(rad, "out");
            //     anchor._data = { length: 15, stroke: "blue" };
            //     path.connection.debugShapes.push(anchor);
            // });


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
