import { Anchor } from "src/graph/graphical";
import { SubPath } from "./subPath";
import { VisNode } from "./visNode";
import { Point, Segment, Vector } from "2d-geometry";
import { RadialUtils } from "../../utils/radialUtils";


export type SubPathInformation = {
    subPath: SubPath;
    desiredAnchor?: Anchor;
    desiredAnchorPoint?: Point;
    level: number;
    forwardRadToConnectionPoint: number;
    forwardRadToTargetNode: number;
    sourceVisNode: VisNode;
    targetVisNode: VisNode;
    oppositeVisNode: VisNode | undefined;
    oppositeConnectionPoint: Point;
    isInsideRange: boolean;
    hasCounterPath: boolean;
    hasCounterPathBefore: boolean;
    hasCounterPathAfter: boolean;
};


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

    // We only need to sort the paths once
    sorted = false;

    // The sorted information about the subpaths
    subPathInformation: SubPathInformation[] = [];
    mappedSubPathInformation: Map<SubPath, SubPathInformation> = new Map();

    // The rad values assigned to the subpaths as soon as the range is calculated
    lastAssignedRad = 0;
    assignedRads: Map<SubPath, number> = new Map();
    assignedRadRanges: Map<SubPath, [number, number]> = new Map();

    // /**
    //  * During calculation
    //  */
    // assignedRadRanges: Map<SubPath, [number, number]> = new Map();

    minimumDistanceBetweenPathsFactor = 0.5;

    // combinedPathsDistanceFactor = 0.125;
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
            this.sorted = false;
            return;
        }

        this.subPaths.push(subPath);
        this.registeredSubPaths.add(subPath);
        this.calculated = false;
        this.sorted = false;
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
            this.sorted = false;
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
        if (!this.registeredSubPaths.has(path)) {
            throw new Error(`Path ${path.id} not in continuum`);
        }

        if (!this.calculated) {
            this.calculate();
        }
        path = this.getRepresentedSubPath(path);

        // If we already have the rad, we return it
        if (this.assignedRads.has(path)) {
            return this.assignedRads.get(path)!;
        }

        // Otherwise, we assign a new rad by taking the assigned range and
        // put the rad in this range in the desired anchor direction
        // of if there is no desired anchor, we just take the middle of the range
        const pathInformation = this.mappedSubPathInformation.get(path);
        if (!pathInformation) {
            throw new Error(`Path ${path.id} not in continuum. This should not happen`);
        }

        const range = this.getRangeForPath(path);
        // If the path has no desired anchor, we just take the middle of the range
        if (!pathInformation!.desiredAnchor) {
            return range[0] + RadialUtils.forwardRadBetweenAngles(range[0], range[1]) / 2;
        }

        // If the path has a desired anchor, we put the rad in direction of the anchor
        const desiredRad = this.getRadOfPoint(pathInformation!.desiredAnchorPoint!);
        return RadialUtils.putRadBetween(desiredRad, range[0], range[1]);

        // return this.assignedRads.get(path)!;
    }

    /**
     * Returns the valid range for a specific path.
     * Calculates the range if not done yet.
     * @param path The path to get the range for.
     * @returns The valid range for the specified path.
     */
    getRangeForPath(path: SubPath): [number, number] {
        if (!this.registeredSubPaths.has(path)) {
            throw new Error(`Path ${path.id} not in continuum`);
        }

        if (!this.calculated) {
            this.calculate();
        }
        path = this.getRepresentedSubPath(path);

        if (this.assignedRadRanges.has(path)) {
            return this.assignedRadRanges.get(path)!;
        }

        // This would return the full range and thus allow full access to the subpath
        return this.range;


        // If we already have the range, we return it
        if (this.assignedRadRanges.has(path)) {
            return this.assignedRadRanges.get(path)!;
        }

        // Otherwise, we assign a new valid range
        const pathInformation = this.mappedSubPathInformation.get(path);
        if (!pathInformation) {
            throw new Error(`Path ${path.id} not in continuum. This should not happen`);
        }

        // This was the rad that we assigned to the last new subpath
        const lastAssignedRad = this.lastAssignedRad;

        // This is the minimum distance between the paths
        const minDistance = this.minimumDistanceBetweenPathsFactor * RadialUtils.forwardRadBetweenAngles(this.range[0], this.range[1]) / this.subPaths.length;
        // const minSize = minDistance;

        // If the subpath does not have a desired anchor, we just increase the last rad by the minimum distance to have some difference
        if (!pathInformation!.desiredAnchor) {
            this.lastAssignedRad += minDistance;
            const assignedRange: [number, number] = [this.lastAssignedRad - minDistance / 2, this.lastAssignedRad + minDistance / 2];
            this.assignedRadRanges.set(path, assignedRange);
            return assignedRange;
        }

        // If the subpath has a desired anchor, we either:
        // 1.) Take the desired anchor if the space left would be enough to distribute the other paths
        // 2.) If not, we take the last assigned rad and increase it by the minimum distance
        let desiredRad = this.getRadOfPoint(pathInformation!.desiredAnchorPoint!);

        // If the path has no counter part, it must maintain the minimum distance to the last path
        // if (!pathInformation?.hasCounterPath) {
        if (RadialUtils.forwardRadBetweenAngles(lastAssignedRad, desiredRad) < minDistance) {
            desiredRad = lastAssignedRad + minDistance;
        }
        // }

        const rangeLeft = RadialUtils.forwardRadBetweenAngles(lastAssignedRad, this.range[1]);
        const rangePerOtherPath = rangeLeft / (this.subPaths.length - this.assignedRadRanges.size);

        if (rangePerOtherPath >= minDistance) {
            this.lastAssignedRad = desiredRad;
            const assignedRange: [number, number] = [desiredRad - minDistance / 2, desiredRad + minDistance / 2];
            this.assignedRadRanges.set(path, assignedRange);
            return assignedRange;
        } else {

            this.lastAssignedRad += minDistance;
            const assignedRange: [number, number] = [this.lastAssignedRad - minDistance / 2, this.lastAssignedRad + minDistance / 2];
            this.assignedRadRanges.set(path, assignedRange);
            return assignedRange;
        }
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

    getSortedSubPathInfo() {

        if (this.sorted) return this.subPathInformation;

        const EPSILON = 0.01;
        // Sort the paths by their opposite node position
        // For the same position, first take outgoing, then incoming connections

        // This is the center rad on the backside of the range
        // We sort against this rad, to avoid problems where close to border connections are sorted to the wrong side
        const backRad = this.getMiddleRadOnBackside();

        const pathInformation = this.subPaths.map((subPath, i) => {

            // const oppositeConnectionAnchor= subPath.getOppositeConnectionAnchor(this.node);
            const oppositeConnectionPoint = subPath.getOppositeConnectionPoint(this.node)?.clone();

            // const oppositeNode = subPath.getOppositeNodeThan(this.node);
            if (!oppositeConnectionPoint) {
                // return { path: subPath, oppositeNode: undefined, forwardRad: -1 };
                throw new Error("Opposite connection point not found");
            }

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
                isInsideRange: false,
                hasCounterPath: false,
                hasCounterPathBefore: false,
                hasCounterPathAfter: false
            };
        });

        pathInformation.sort((a, b) => {
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
            }


            if (Math.abs(a.forwardRadToConnectionPoint - b.forwardRadToConnectionPoint) < EPSILON) {

                if (a.sourceVisNode === this.node && b.sourceVisNode === this.node) {
                    return a.forwardRadToTargetNode - b.forwardRadToTargetNode;
                } else {
                    return a.sourceVisNode === this.node ? -1 : 1;
                }
            }
            return a.forwardRadToConnectionPoint - b.forwardRadToConnectionPoint;
        });


        if (this.node.id == "display_right" && this.type == "inside") {
            const x = 5;
        }

        // After sorting, we can apply the counter path information
        pathInformation.forEach((info, i, arr) => {
            const subPath = info.subPath;
            const nextSubPath = i + 1 < arr.length ? arr[i + 1].subPath : undefined;
            const previousSubPath = i > 0 ? arr[i - 1].subPath : undefined;

            let hasCounterPath = false;
            let hasCounterPathBefore = false;
            let hasCounterPathAfter = false;
            if (nextSubPath && subPath.isCounterPathOf(nextSubPath)) {
                hasCounterPath = true;
                hasCounterPathAfter = true;
            } else if (previousSubPath && subPath.isCounterPathOf(previousSubPath)) {
                hasCounterPath = true;
                hasCounterPathBefore = true;
            }

            info.hasCounterPath = hasCounterPath;
            info.hasCounterPathBefore = hasCounterPathBefore;
            info.hasCounterPathAfter = hasCounterPathAfter;
        })


        // this.sorted = true;
        this.subPathInformation = pathInformation;

        pathInformation.forEach(info => {
            this.mappedSubPathInformation.set(info.subPath, info);
        });

        return pathInformation;
    }

    calculate() {

        if (!this.sorted) {
            this.getSortedSubPathInfo();
        }

        this.lastAssignedRad = this.range[0];
        this.assignedRads = new Map();
        this.assignedRadRanges = new Map();

        // After sorted, we add the connections to our continuum
        // For that, we first add each connection with a distance of 1
        const assignedRads: Map<SubPath, number> = new Map();
        const pathToRange: Map<SubPath, [number, number]> = new Map();

        const increaseStep = 1;
        let currentPosition = 0;

        const pathHasCounterPath: Map<SubPath, boolean> = new Map();

        const pathInformation = this.subPathInformation;
        pathInformation.forEach((pathInfo, i) => {
            const subPath = pathInfo.subPath;
            const nextSubPath = pathInformation[i + 1]?.subPath;
            const previousSubPath = i > 0 ? pathInformation[i - 1].subPath : undefined;

            const range: [number, number] = [currentPosition, currentPosition];
            pathHasCounterPath.set(subPath, false);

            range[1] += increaseStep;

            pathToRange.set(subPath, range);
            currentPosition = range[1];
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
        const doRefine = this.node.parentLayouter.optimizeConnectionAnchors;

        // New refine method
        // For the paths, that have no desired anchor and are sorted at the sides (so at the very start or end),
        // we reserve a minimum space for them.
        // All other paths are then sorted in the remaining space so that they keep the sorted order
        // We do this in both directions

        const pathMids: Map<SubPath, number> = new Map();

        const pathCount = Math.max(6, this.subPaths.length);

        const rangePadding = Math.min(Math.max(0, this.node.parentLayouter.rangePaddingFactor), 1);
        const completeRangeDiff = RadialUtils.forwardRadBetweenAngles(this.range[0], this.range[1]);
        const minDistanceBetweenRanges = this.pathRangeMarginFactor * completeRangeDiff / pathCount;

        const minSizeFactor = Math.min(Math.max(0, this.node.parentLayouter.minimumRangeSizeFactor), 1);
        const minSizeOfRange = minSizeFactor * completeRangeDiff / pathCount;

        if (doRefine) {

            // pathToRange.clear();
            // const pathStarts: Map<SubPath, number> = new Map();
            // const pathEnds: Map<SubPath, number> = new Map();




            // Begin with forward
            const minRad = this.range[0];
            const maxRad = this.range[1];

            const minRadForMidPoints = RadialUtils.normalizeRad(this.range[0] + minSizeOfRange / 2);
            const maxRadForMidPoints = RadialUtils.normalizeRad(this.range[1] - minSizeOfRange / 2);

            if (this.node.id == "started_nodes_gatherer" && this.type == "inside") {
                const x = 5;
            }


            let currentRad = minRadForMidPoints;
            let isUndesiredAtBeginning = true;
            pathInformation.forEach((pathInfo, i) => {
                const maxRadForThisPath = RadialUtils.normalizeRad(maxRad - (minSizeOfRange * (pathInformation.length - i - 1)) - minSizeOfRange / 2);
                currentRad = RadialUtils.putRadBetween(currentRad, minRadForMidPoints, maxRadForThisPath);

                if (!pathInfo.desiredAnchor) {
                    if (isUndesiredAtBeginning) {
                        pathMids.set(pathInfo.subPath, currentRad);
                        currentRad += minSizeOfRange;
                    } else {
                        pathMids.set(pathInfo.subPath, maxRadForThisPath);
                    }
                } else {
                    isUndesiredAtBeginning = false;

                    // Calc the max rad, so that there is enough space for the other rads to be distributed
                    // (The minSizeOfRange / 2; is subtracted because we calculate midpoints)


                    let desiredRad = this.getRadOfPoint(pathInfo.desiredAnchorPoint!);
                    // desiredRad = RadialUtils.putRadBetween(desiredRad, currentRad, this.range[1]);
                    desiredRad = RadialUtils.putRadBetween(desiredRad, currentRad, maxRadForThisPath);

                    pathMids.set(pathInfo.subPath, desiredRad);
                    currentRad = desiredRad + minSizeOfRange;

                    // if (pathInfo.hasCounterPathAfter) {
                    //     pathMids.set(pathInfo.subPath, desiredRad + minSizeOfRange * (1 - this.combinedPathsDistanceFactor));
                    //     currentRad = desiredRad + minSizeOfRange;
                    //     // currentRad = desiredRad + minSizeOfRange * this.combinedPathsDistanceFactor;
                    //     // currentRad = desiredRad + minSizeOfRange * 1;
                    // } else {
                    //     pathMids.set(pathInfo.subPath, desiredRad);
                    //     currentRad = desiredRad + minSizeOfRange;
                    // }
                }

            });

            // Now we have the start and end rads for each path
            // We can now assign the ranges
            pathInformation.forEach((pathInfo, i) => {

                const subPathBefore = i > 0 ? pathInformation[i - 1].subPath : undefined;
                const subPathAfter = i < pathInformation.length - 1 ? pathInformation[i + 1].subPath : undefined;
                const subPath = pathInfo.subPath;

                const radBefore = subPathBefore ? pathMids.get(subPathBefore)! : this.range[0] - minSizeOfRange / 2;
                const radAfter = subPathAfter ? pathMids.get(subPathAfter)! : this.range[1] + minSizeOfRange / 2;
                const rad = pathMids.get(subPath)!;

                const startRad = radBefore + RadialUtils.forwardRadBetweenAngles(radBefore, rad) / 2;
                const endRad = radAfter - RadialUtils.forwardRadBetweenAngles(rad, radAfter) / 2;

                pathToRange.set(subPath, [startRad, endRad]);
            });

        }

        const combinedPathsDistanceFactor = this.node.parentLayouter.combinedPathsDistanceFactor;

        // Here we apply the padding
        pathInformation.forEach((pathInfo, i) => {
            const subPath = pathInfo.subPath;
            const range = pathToRange.get(subPath)!;
            let startRad = range[0];
            let endRad = range[1];

            const rangeDelta = RadialUtils.forwardRadBetweenAngles(startRad, endRad);
            // const padding = 0.1 * rangeDelta;
            // const padding = rangePadding * rangeDelta;
            const padding = Math.min(rangePadding * minSizeOfRange, rangePadding * rangeDelta);

            // If there is no counter path we apply normal padding
            if (!pathInfo.hasCounterPath) {
                startRad += padding / 2;
                endRad -= padding / 2;
            } else {

                // If there is a counter path, we apply on the fitting side a smaller padding and shrink the range on the other side
                if (pathInfo.hasCounterPathAfter) {
                    startRad += rangeDelta * (1 - combinedPathsDistanceFactor);
                    endRad -= padding * combinedPathsDistanceFactor;
                } else {
                    startRad += padding * combinedPathsDistanceFactor;
                    endRad -= rangeDelta * (1 - combinedPathsDistanceFactor);
                }

            }
            pathToRange.set(subPath, [startRad, endRad]);
        });



        pathToRange.forEach((range, path) => {

            // Check if the desired range is inside the valid range
            // const desiredAnchorPoint = path.desiredNodeAnchor?.anchorPoint;
            const desiredAnchorPoint = path.getDesiredNodeAnchor(this.node)?.anchorPoint;
            // if (!desiredAnchorPoint || pathHasCounterPath.get(path)) {
            if (!desiredAnchorPoint) {
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
        debug = false;
        // debug = true;
        // if (this.node.id == "facialexpressionmanager_node") debug = true;
        // if (this.node.id == "drive_manager") debug = true;
        // if (this.node.id == "flint_node" && this.type == "outside") debug = true;
        // if (this.node.id == "equalizer") debug = true;
        // if (this.node.id == "dialog_session_manager") debug = true;
        // if (this.node.id == "/dialog/tts_guard") debug = true;pathCount
        if (this.node.id.includes("__hypernode_")) debug = true;
        if (debug) {


            this.node.layoutNode.debugShapes.push(...this.getValidAnchorsOfRange().all);

            // console.warn("SORTED PATHS", pathInformation);

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
                    desiredAnchor._data = { length: 3, stroke: "blue" };
                    path.connection.debugShapes.push(desiredAnchor);
                }
                const desiredAnchorPoint = path.getDesiredNodeAnchor(this.node)?.anchorPoint;

                if (desiredAnchorPoint && path.fixedPathAnchorPoint) {
                    const segment = new Segment(path.fixedPathAnchorPoint, desiredAnchorPoint);
                    segment._data = { stroke: "orange" }
                    path.connection.debugShapes.push(segment);
                }

                if (pathMids.has(path)) {
                    const midRad = pathMids.get(path)!;
                    const midAnchor = this.getAnchorForRad(midRad, "out");
                    midAnchor._data = { length: 5, stroke: "blue" };
                    path.connection.debugShapes.push(midAnchor);
                }

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
