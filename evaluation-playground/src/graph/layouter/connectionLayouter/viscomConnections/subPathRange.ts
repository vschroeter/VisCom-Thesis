import { Anchor } from "src/graph/graphical";
import { SubPath } from "./subPath";
import { VisNode } from "./visNode";
import { Point, Segment, Vector } from "2d-geometry";
import { RadialUtils } from "../../utils/radialUtils";


export type SubPathInformation = {
    subPath: SubPath;
    desiredAnchor?: Anchor;
    desiredAnchorPoint?: Point;
    desiredForwardRad?: number;
    desiredCounterAnchor?: Anchor;
    desiredCounterForwardRad?: number;
    forwardParentRad?: number;
    oppositeParentRad?: number;
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
    type: "inside" | "outside" | "circleArcForward" | "circleArcBackward";

    // The node this range belongs to
    node: VisNode;

    // The valid range in radians
    range: [number, number];

    backsideRad: number;


    // The subpaths registered in this range
    subPaths: SubPath[] = [];

    // We only calculate the range once
    calculated = false;

    // We only need to sort the paths once
    sorted = false;

    // Store the opposite ranges for the subpaths
    oppositeRanges: Map<SubPath, SubPathRange> = new Map();

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

    constructor(node: VisNode, type: "inside" | "outside" | "circleArcForward" | "circleArcBackward", nodeRangeMarginFactor = 0.90) {
        this.type = type;
        this.node = node;

        this.outerMargin = 0;

        // const arcF = 0.1;
        const arcF1 = 0.2;
        const arcF2 = -0.4;

        if (type === "outside") {
            this.range = node.layoutNode.getValidOuterRadRange(nodeRangeMarginFactor, false);
            this.outerMargin = RadialUtils.forwardRadBetweenAngles(node.layoutNode.getValidOuterRadRange(1, false)[0], this.range[0]);

            // Calc the backside rad as the rad for the connection line to the parent center
            if (this.node.parent) {
                this.backsideRad = RadialUtils.normalizeRad(new Vector(this.node.center, this.node.parent!.innerCircle.center).slope);
            } else {
                this.backsideRad = RadialUtils.normalizeRad(this.getMiddleRadOnBackside());
            }
        } else if (type === "inside") {
            // this.range = node.layoutNode.getValidInnerRadRange(nodeRangeMarginFactor);
            this.range = node.layoutNode.getValidInnerRadRange(nodeRangeMarginFactor, false);
            // this.range = node.layoutNode.getValidInnerRadRange(nodeRangeMarginFactor, this.node.layoutNode.isHyperNode);
            this.outerMargin = RadialUtils.forwardRadBetweenAngles(node.layoutNode.getValidInnerRadRange(1, false)[0], this.range[0]);
            // this.outerMargin = Math.abs(this.range[0] - node.layoutNode.getValidInnerRadRange(1, this.node.layoutNode.isHyperNode)[0]);
            this.backsideRad = this.getMiddleRadOnBackside();
        } else if (type === "circleArcForward") {
            // this.range = [-0.3, 0];
            this.range = node.layoutNode.getValidCircularRadRange(arcF1, arcF2, "clockwise");
            this.backsideRad = this.getMiddleRad(node.layoutNode.getValidCircularRadRange(arcF1, arcF2, "counterclockwise"));
        } else if (type === "circleArcBackward") {
            // this.range = [0, 0.3];
            this.range = node.layoutNode.getValidCircularRadRange(arcF1, arcF2, "counterclockwise");
            this.backsideRad = this.getMiddleRad(node.layoutNode.getValidCircularRadRange(arcF1, arcF2, "clockwise"));
        }
        else {
            this.range = [0, 0];
            this.backsideRad = 0;
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Sub Path Management
    ////////////////////////////////////////////////////////////////////////////

    registeredSubPaths: Set<SubPath> = new Set();


    registerSubPath(subPath: SubPath, oppositeRange: SubPathRange) {
        this.oppositeRanges.set(subPath, oppositeRange);

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

        let debug = false;
        debug = false;

        // if (this.type == "outside" && this.node.id == "right_motor_controller") {
        //     debug = true;
        // }

        const anchorRad = this.getRadOfPoint(anchor.anchorPoint);
        if (this.pointIsInside(anchor.anchorPoint, [this.range[0] - this.outerMargin, this.range[1] + this.outerMargin])) {

            // const midTo0 = RadialUtils.forwardRadBetweenAngles(this.getMiddleRad(), this.range[0]);
            // const midTo1 = RadialUtils.forwardRadBetweenAngles(this.getMiddleRad(), this.range[1]);

            const midToAnchor = RadialUtils.forwardRadBetweenAngles(this.getMiddleRad(), anchorRad);

            const rangeBefore = this.range.slice();


            // Decide which side to trim
            if (midToAnchor < Math.PI) {
                this.range[1] = anchorRad - this.outerMargin;
                // this.range[1] = anchorRad - 0;
            } else {
                this.range[0] = anchorRad + this.outerMargin;
                // this.range[0] = anchorRad + 0;
            }


            if (debug) {
                console.warn("[TRIM]", {
                    anchorRad,
                    margin: this.outerMargin,
                    id: this.node.id,
                    rangeBefore,
                    rangeAfter: this.range,
                });
            }


            this.calculated = false;
            this.sorted = false;
            // console.log(this.range);
        } else {
            if (debug) {
                console.warn("[N TRIM] Anchor not inside range", {
                    anchorRad,
                    margin: this.outerMargin,
                    range: this.range,
                    id: this.node.id,
                })
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

        // // We check, if the desired rad is inside the range
        // if (this.radIsInside(desiredRad, range)) {
        //     return desiredRad;
        // }

        // // Otherwise, we check which side of the range is closer to the counter anchor
        // const anchorPoint = pathInformation!.desiredAnchor?.anchorPoint;
        // const counterPoint = pathInformation!.desiredCounterAnchor?.anchorPoint;

        // if (anchorPoint && counterPoint) {
        //     const dist0 = RadialUtils.positionOnCircleAtRad(range[0], this.node.layoutNode.radius, this.node.layoutNode.center).distanceTo(counterPoint);
        //     const dist1 = RadialUtils.positionOnCircleAtRad(range[1], this.node.layoutNode.radius, this.node.layoutNode.center).distanceTo(counterPoint);

        //     if (dist0 > dist1) {
        //         return range[0];
        //     } else {
        //         return range[1];
        //     }
        // }


        return RadialUtils.putRadBetween(desiredRad, range[0], range[1]);
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

        const subPathInfo = this.mappedSubPathInformation.get(path);
        if (subPathInfo && subPathInfo.desiredAnchor) {

            const radOfDesiredAnchor = this.getRadOfPoint(subPathInfo.desiredAnchorPoint!);

            if (Math.abs(rad - radOfDesiredAnchor) < 0.01) {

                if (direction === "in") return subPathInfo.desiredAnchor.cloneReversed();
                return subPathInfo.desiredAnchor.clone();
            }
        }

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
    getValidAnchorsOfRange(range?: [number, number]) {

        range = range ?? this.range;

        const startAnchor = new Anchor(this.node.layoutNode.center, new Vector(range[0]));
        const endAnchor = new Anchor(this.node.layoutNode.center, new Vector(range[1]));
        const backsideAnchor = new Anchor(this.node.layoutNode.center, new Vector(this.backsideRad));

        const opacity = 1;

        startAnchor._data = { length: this.node.layoutNode.outerRadius, stroke: "green", strokeWidth: 4, opacity };
        endAnchor._data = { length: this.node.layoutNode.outerRadius, stroke: "red", strokeWidth: 4, opacity };
        backsideAnchor._data = { length: this.node.layoutNode.outerRadius, stroke: "blue", strokeWidth: 4, opacity };

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
    getMiddleRad(range?: [number, number]): number {
        range = range ?? this.range;
        return RadialUtils.normalizeRad(range[0] + RadialUtils.forwardRadBetweenAngles(range[0], range[1]) / 2);
    }


    ////////////////////////////////////////////////////////////////////////////
    // #region Sub Path Info
    ////////////////////////////////////////////////////////////////////////////

    getSortedSubPathInfo(): SubPathInformation[] {

        if (this.sorted) return this.subPathInformation;

        const useHierarchicalSubPaths = this.node.parentLayouter.useHierarchicalSubPaths;

        const EPSILON = 0.01;
        // Sort the paths by their opposite node position
        // For the same position, first take outgoing, then incoming connections

        // This is the center rad on the backside of the range
        // We sort against this rad, to avoid problems where close to border connections are sorted to the wrong side
        const backRad = this.backsideRad;

        const pathInformation = this.subPaths.map((subPath, i) => {

            // const oppositeConnectionAnchor= subPath.getOppositeConnectionAnchor(this.node);
            const oppositeConnectionPoint = subPath.getOppositeConnectionPoint(this.node)?.clone();

            const oppositeVisNode = subPath.getOppositeNodeThan(this.node);
            if (!oppositeConnectionPoint || !oppositeVisNode) {
                // return { path: subPath, oppositeNode: undefined, forwardRad: -1 };
                throw new Error("Opposite connection point not found");
            }

            const oppositeRange = this.oppositeRanges.get(subPath);

            if (!oppositeRange) {

                console.warn({
                    t: this,
                    subPath,
                    oppositeRanges: this.oppositeRanges,
                })

                throw new Error("Opposite range not found");
            }

            const otherBackRad = oppositeRange.backsideRad;


            const radOfOppositePoint = this.getRadOfPoint(oppositeConnectionPoint);
            const forwardRadToConnectionPoint = RadialUtils.forwardRadBetweenAngles(backRad, radOfOppositePoint);

            const otherLayoutNode = subPath.getLayoutNodeInDirectionOf(subPath.getOppositeNodeThan(this.node));
            const forwardRadToTargetNode = otherLayoutNode ? this.getRadOfPoint(otherLayoutNode.center) : forwardRadToConnectionPoint;

            const desiredAnchorWithoutDirectConnection = subPath.getDesiredNodeAnchor(this.node, {
                directConnectionAtHypernode: false,
            });
            const desiredAnchor = subPath.getDesiredNodeAnchor(this.node, {
                directConnectionAtHypernode: useHierarchicalSubPaths,
            });
            const desiredAnchorPoint = desiredAnchor?.anchorPoint;

            const desiredAnchorPointWithoutDirectConnection = desiredAnchorWithoutDirectConnection?.anchorPoint;
            // const toleranceRad = 10 * Math.PI / 180;
            const toleranceRad = 0 * Math.PI / 180;
            const desiredForwardRad = desiredAnchorPointWithoutDirectConnection ? RadialUtils.forwardRadBetweenAngles(backRad, this.getRadOfPoint(desiredAnchorPointWithoutDirectConnection) - toleranceRad) : undefined;

            // const counterNode =  otherLayoutNode ? subPath.getNextNonHyperNodeBetween(this.node, this.node.parentLayouter.getVisNode(otherLayoutNode)) : undefined;
            const desiredCounterAnchorWithoutDirectConnection = oppositeVisNode ? subPath.getDesiredNodeAnchor(oppositeVisNode, {
                directConnectionAtHypernode: false,
            }) : undefined;
            const desiredCounterAnchor = oppositeVisNode ? subPath.getDesiredNodeAnchor(oppositeVisNode, {
                directConnectionAtHypernode: useHierarchicalSubPaths,
            }) : undefined;


            const desiredCounterAnchorPoint = desiredCounterAnchor?.anchorPoint;

            const desiredCounterAnchorPointWithoutDirectConnection = desiredCounterAnchorWithoutDirectConnection?.anchorPoint;

            const desiredCounterForwardRad = desiredCounterAnchorPointWithoutDirectConnection ?
                RadialUtils.forwardRadBetweenAngles(otherBackRad, oppositeRange.getRadOfPoint(desiredCounterAnchorPointWithoutDirectConnection) - toleranceRad) : undefined;

            const oppositeParent = oppositeVisNode.parentVisNode;
            const thisParent = this.node.parentVisNode;

            const forwardParentRad = oppositeParent ? RadialUtils.forwardRadBetweenAngles(backRad, new Vector(this.node.center, oppositeParent.center).slope) : undefined;
            const oppositeParentRad = thisParent ? RadialUtils.forwardRadBetweenAngles(otherBackRad, new Vector(oppositeVisNode.center, thisParent.center).slope) : undefined;


            return {
                subPath,
                desiredAnchor,
                desiredAnchorPoint,
                level: subPath.minLevelFromTop,
                forwardRadToConnectionPoint,
                forwardRadToTargetNode,
                sourceVisNode: subPath.sourceVisNode,
                targetVisNode: subPath.targetVisNode,
                // oppositeVisNode: subPath.getOppositeNodeThan(this.node),
                oppositeConnectionPoint,
                isInsideRange: false,
                hasCounterPath: false,
                hasCounterPathBefore: false,
                hasCounterPathAfter: false,
                desiredForwardRad,
                node: this.node,
                otherLayoutNode: otherLayoutNode,
                oppositeVisNode: oppositeVisNode,
                desiredCounterAnchor,
                desiredCounterAnchorPoint,
                desiredCounterForwardRad,
                forwardParentRad,
                oppositeParentRad,
            };
        });


        // if (this.node.id.startsWith("display_right")) {
        //     const x = 5;
        // }

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

            // // First sort by direction
            // const aIsOutgoing = a.sourceVisNode == this.node;
            // const bIsOutgoing = b.sourceVisNode == this.node;

            // if (aIsOutgoing && !bIsOutgoing) {
            //     return -1;
            // } else if (!aIsOutgoing && bIsOutgoing) {
            //     return 1;
            // }

            // if (a.forwardParentRad && b.forwardParentRad) {
            //     if (Math.abs(a.forwardParentRad - b.forwardParentRad) > EPSILON) {
            //         return a.forwardParentRad - b.forwardParentRad;
            //     }
            // }

            if (a.desiredForwardRad && b.desiredForwardRad) {
                if (Math.abs(a.desiredForwardRad - b.desiredForwardRad) > EPSILON) {
                    return a.desiredForwardRad - b.desiredForwardRad;
                }
            }

            if (a.desiredCounterForwardRad && b.desiredCounterForwardRad) {
                if (Math.abs(a.desiredCounterForwardRad - b.desiredCounterForwardRad) > EPSILON) {
                    return b.desiredCounterForwardRad - a.desiredCounterForwardRad;
                }
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


        const oppositePathInformation = pathInformation.slice();

        oppositePathInformation.sort((a, b) => {
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

            if (a.desiredCounterForwardRad && b.desiredCounterForwardRad) {
                if (Math.abs(a.desiredCounterForwardRad - b.desiredCounterForwardRad) > EPSILON) {
                    return b.desiredCounterForwardRad - a.desiredCounterForwardRad;
                }
            }

            if (a.desiredForwardRad && b.desiredForwardRad) {
                if (Math.abs(a.desiredForwardRad - b.desiredForwardRad) > EPSILON) {
                    return a.desiredForwardRad - b.desiredForwardRad;
                }
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
        // oppositePathInformation.reverse();



        // There are cases, where the nodes could not be sorted consistently across both hypernodes
        // E.g. subpath should be first in both hypernodes
        // In this case crossings are unavoidable
        // To get a consistent sorting, we determine, that outgoing paths have a higher priority
        // So we merge the sorted paths with the opposite sorted paths

        const mergedPathInformation = [];

        if (!this.node.parentLayouter.useHierarchicalSubPaths) {
            mergedPathInformation.push(...pathInformation);
        }

        if (mergedPathInformation.length == 0) {

            if (this.type == "circleArcBackward") {
                oppositePathInformation.reverse();
                pathInformation.reverse();
            }


            const addedIds: Set<string> = new Set();

            let i = 0;
            let j = 0;

            // console.error("[MERGING]", {
            //     id: this.node.id,
            //     dir: this.type,
            //     pathInformation: pathInformation.map(p => p.subPath.cId),
            //     oppositePathInformation: oppositePathInformation.map(p => p.subPath.cId)
            // });

            while (true) {

                let id: string | undefined = undefined;
                let oId: string | undefined = undefined;

                while (i < pathInformation.length) {
                    id = pathInformation[i].subPath.cId;
                    if (addedIds.has(id)) {
                        i++;
                        continue;
                    }
                    break;
                }

                while (j < oppositePathInformation.length) {
                    oId = oppositePathInformation[j].subPath.cId;
                    if (addedIds.has(oId)) {
                        j++;
                        continue;
                    }
                    break;
                }

                if (i == pathInformation.length) id = undefined;
                if (j == oppositePathInformation.length) oId = undefined;

                if (id == undefined || oId == undefined) {

                    while (i < pathInformation.length) {
                        if (addedIds.has(pathInformation[i].subPath.cId)) {
                            i++;
                            continue;
                        }
                        mergedPathInformation.push(pathInformation[i]);
                        i++;
                    }

                    while (j < oppositePathInformation.length) {
                        if (addedIds.has(oppositePathInformation[j].subPath.cId)) {
                            j++;
                            continue;
                        }
                        mergedPathInformation.push(oppositePathInformation[j]);
                        j++;
                    }

                    break;
                }

                if (id == oId) {
                    mergedPathInformation.push(pathInformation[i]);
                    // console.log("Adding", pathInformation[i].subPath.cId);
                    addedIds.add(id!);

                    continue;
                }
                else {

                    // Decide by node score (if equal score, sort by name)
                    const paths = [pathInformation[i], oppositePathInformation[j]];
                    paths.sort((a, b) => {
                        if (a.subPath.source.score != b.subPath.source.score) {
                            return b.subPath.source.score - a.subPath.source.score;
                        }
                        return a.subPath.cId.localeCompare(b.subPath.cId);
                    });

                    mergedPathInformation.push(paths[0]);
                    // console.log("Adding", paths[0].subPath.cId, {
                    //     a: pathInformation[i].subPath.cId,
                    //     b: oppositePathInformation[j].subPath.cId,
                    //     aScore: pathInformation[i].subPath.source.score,
                    //     bScore: oppositePathInformation[j].subPath.source.score
                    // });
                    addedIds.add(paths[0].subPath.cId);
                }
            }

            if (this.type == "circleArcBackward") {
                oppositePathInformation.reverse();
                pathInformation.reverse();
                mergedPathInformation.reverse();
            }
        }

        // this.subPathInformation = pathInformation;
        this.subPathInformation = mergedPathInformation;

        if (this.node.id == "sensor3") {
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


        pathInformation.forEach(info => {
            this.mappedSubPathInformation.set(info.subPath, info);
        });

        if (false && (this.node.id == "display_manager" && this.type == "outside")) {
            // if ((this.node.id == "car_simulator" && this.type == "outside") || (this.node.id == "waypoint_updater" && this.type == "outside")) {
            // if (this.node.layoutNode.children.length == 5 || this.node.layoutNode.children.length == 4) {
            console.warn("[SORT]", {
                id: this.node.id,
                dir: this.type,
                pathInformation,
                pathIds: pathInformation.map(p => p.subPath.cId),
                oppositePathIds: oppositePathInformation.map(p => p.subPath.cId),
                mergedPathInformation: mergedPathInformation.map(p => p.subPath.cId)
            })
        }


        this.sorted = true;

        return pathInformation;
    }


    ////////////////////////////////////////////////////////////////////////////
    // #region Calculate
    ////////////////////////////////////////////////////////////////////////////

    calculate() {

        if (!this.sorted) {
            this.getSortedSubPathInfo();
        }

        // console.warn("[CALCULATE]", this.node.id, this.type);

        // if (this.node.id.startsWith("sensor2") && this.type == "outside") {
        //     const x = 5;
        // }

        this.lastAssignedRad = this.range[0];
        this.assignedRads = new Map();
        this.assignedRadRanges = new Map();

        // After sorted, we add the connections to our continuum
        // For that, we first add each connection with a distance of 1
        const assignedRads: Map<SubPath, number> = new Map();
        const pathToRange: Map<SubPath, [number, number]> = new Map();

        const increaseStep = 1;
        let currentPosition = 0;

        const pathInformation = this.subPathInformation;
        pathInformation.forEach((pathInfo, i) => {
            const subPath = pathInfo.subPath;
            const nextSubPath = pathInformation[i + 1]?.subPath;
            const previousSubPath = i > 0 ? pathInformation[i - 1].subPath : undefined;

            const range: [number, number] = [currentPosition, currentPosition];

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
        let doRefine = this.node.parentLayouter.optimizeConnectionAnchors;

        const isArc = this.type == "circleArcBackward" || this.type == "circleArcForward";

        if (doRefine && isArc) {
            doRefine = false;
        }

        // New refine method
        // For the paths, that have no desired anchor and are sorted at the sides (so at the very start or end),
        // we reserve a minimum space for them.
        // All other paths are then sorted in the remaining space so that they keep the sorted order
        // We do this in both directions

        const pathMids: Map<SubPath, number> = new Map();

        const pathCount = Math.max(6, this.subPaths.length);

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

            // if (this.node.id == "sensor3" && this.type == "outside") {
            //     const x = 5;
            // }


            let currentRad = minRadForMidPoints;
            let isUndesiredAtBeginning = true;
            pathInformation.forEach((pathInfo, i) => {
                const maxRadForThisPath = RadialUtils.normalizeRad(maxRad - (minSizeOfRange * (pathInformation.length - i - 1)) - minSizeOfRange / 2);
                currentRad = RadialUtils.putRadBetween(currentRad, minRadForMidPoints, maxRadForThisPath, "closer");

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

                    let adaptDirection: "closer" | "clockwise" | "counter-clockwise" = "closer";
                    adaptDirection = "closer";
                    // const adaptDirection: "closer" | "clockwise" | "counter-clockwise" = "closer";

                    // if (RadialUtils.rad1ComesAfterRad2(desiredRad, this.backsideRad, this.getMiddleRad())) {
                    //     adaptDirection = "clockwise";
                    // } else {
                    //     adaptDirection = "counter-clockwise";
                    // }

                    desiredRad = RadialUtils.putRadBetween(desiredRad, currentRad, maxRadForThisPath, adaptDirection);

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

                const subPathBefore = i > 0 ? pathInformation[i - 1].subPath : undefined; 1
                const subPathAfter = i < pathInformation.length - 1 ? pathInformation[i + 1].subPath : undefined;
                const subPath = pathInfo.subPath;

                const rad = pathMids.get(subPath)!;

                const range = pathToRange.get(subPath)!;
                let startRad = this.range[0];
                let endRad = this.range[1];

                if (subPathBefore) {
                    const radBefore = pathMids.get(subPathBefore)!
                    startRad = radBefore + RadialUtils.forwardRadBetweenAngles(radBefore, rad) / 2;
                }

                if (subPathAfter) {
                    const radAfter = pathMids.get(subPathAfter)!
                    endRad = radAfter - RadialUtils.forwardRadBetweenAngles(rad, radAfter) / 2;
                }

                // const startRad = subPathBefore ? (radBefore + RadialUtils.forwardRadBetweenAngles(radBefore, rad) / 2) : this.range[0];
                // const endRad = subPathAfter ? (radAfter - RadialUtils.forwardRadBetweenAngles(rad, radAfter) / 2) : this.range[1];

                pathToRange.set(subPath, [startRad, endRad]);
            });

        }

        let rangePadding = Math.min(Math.max(0, this.node.parentLayouter.rangePaddingFactor), 1);

        let doCombinePaths = this.node.parentLayouter.combineCounterPaths;
        const combinedPathsDistanceFactor = Math.max(0, Math.min(1, this.node.parentLayouter.combinedPathsDistanceFactor));

        if (isArc) {
            doCombinePaths = false;
            rangePadding = 0.9;
        }

        // Here we apply the padding
        pathInformation.forEach((pathInfo, i) => {
            // return;
            const subPath = pathInfo.subPath;
            const range = pathToRange.get(subPath)!;
            let startRad = range[0];
            let endRad = range[1];

            let rangeDelta = RadialUtils.forwardRadBetweenAngles(startRad, endRad);
            // const padding = 0.1 * rangeDelta;
            // const padding = rangePadding * rangeDelta;
            const padding = doRefine ?
                Math.min(rangePadding * minSizeOfRange, rangePadding * rangeDelta) :
                rangePadding * rangeDelta;


            // If there is no counter path we apply normal padding
            if (!doCombinePaths || !pathInfo.hasCounterPath) {
                startRad += padding / 2;
                endRad -= padding / 2;
            } else {

                if (pathInfo.hasCounterPathAfter) {
                    const subPathAfter = pathInformation[i + 1].subPath!;
                    const counterRangeAfter = pathToRange.get(subPathAfter)!;

                    // Adapt the larger range to the smaller range
                    const counterRangeDelta = RadialUtils.forwardRadBetweenAngles(counterRangeAfter[0], counterRangeAfter[1]);

                    if (rangeDelta < counterRangeDelta) {
                        const newCounterRange = [counterRangeAfter[0], counterRangeAfter[0] + rangeDelta] as [number, number];
                        pathToRange.set(subPathAfter, newCounterRange);
                    } else if (counterRangeDelta < rangeDelta) {
                        endRad = range[1];
                        startRad = range[1] - counterRangeDelta;

                        const newRange = [startRad, endRad] as [number, number];
                        pathToRange.set(subPath, newRange);

                        rangeDelta = RadialUtils.forwardRadBetweenAngles(startRad, endRad);
                    }
                }

                const rangeSize = rangeDelta * combinedPathsDistanceFactor;
                const counterPadding = rangeDelta - rangeSize / 2 - rangeSize;

                // if (this.node.id == "sensor3") {
                //     console.warn("RANGE", {
                //         range,
                //         rangeSize,
                //         rangeDelta,
                //         padding,
                //         minSizeOfRange,
                //         startRad,
                //         endRad,
                //         counterPadding
                //     });
                // }

                // If there is a counter path, we apply on the fitting side a smaller padding and shrink the range on the other side
                if (pathInfo.hasCounterPathAfter) {
                    // startRad += rangeDelta * (1 - combinedPathsDistanceFactor);
                    // endRad -= padding * combinedPathsDistanceFactor;
                    endRad -= rangeSize / 2;
                    startRad += counterPadding;
                } else {
                    // startRad += padding * combinedPathsDistanceFactor;
                    // endRad -= rangeDelta * (1 - combinedPathsDistanceFactor);
                    startRad += rangeSize / 2;
                    endRad -= counterPadding;
                }

                // if (this.node.id == "p1") {
                //     console.warn("RANGE After", {
                //         startRad,
                //         endRad,
                //     });
                // }

            }
            pathToRange.set(subPath, [startRad, endRad]);
        });


        pathToRange.forEach((range, path) => {

            // Check if the desired range is inside the valid range
            // const desiredAnchorPoint = path.desiredNodeAnchor?.anchorPoint;
            const desiredAnchorPoint = path.getDesiredNodeAnchor(this.node)?.anchorPoint;

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

                let adaptDirection: "closer" | "clockwise" | "counter-clockwise" = "closer";
                let desiredRad = this.getRadOfPoint(desiredAnchorPoint);

                if (!this.pointIsInside(desiredAnchorPoint, this.range)) {
                    if (RadialUtils.rad1ComesAfterRad2(desiredRad, this.backsideRad, this.getMiddleRad())) {
                        adaptDirection = "clockwise";
                    } else {
                        adaptDirection = "counter-clockwise";
                    }
                }

                desiredRad = RadialUtils.putRadBetween(desiredRad, range[0], range[1], adaptDirection);

                const validAnchor = this.getAnchorForRad(desiredRad, "out");
                // const validAnchor = this.getValidAnchorTowardsDirection(desiredAnchorPoint, range);
                assignedRads.set(path, this.getRadOfPoint(validAnchor.anchorPoint));
            }
        })

        ////////////////////////////////////////////////////////////////////////////
        // #region Debug
        ////////////////////////////////////////////////////////////////////////////

        let debug = false;
        debug = false;
        // if (this.type == "outside") {
        //     debug = true;
        // }
        // debug = true;

        // if (this.node.id == "display_manager") debug = true;
        // if (this.node.id == "display_bottom") debug = true;
        // if (this.node.id == "motor") debug = true;
        // if (this.node.id == "sensor2") debug = true;
        // if (this.node.id == "sensor3") debug = true;

        // if (this.type != "outside") debug = false;

        // if (this.node.id == "facialexpressionmanager_node") debug = true;
        // if (this.node.id == "drive_manager") debug = true;
        // if (this.node.id == "flint_node" && this.type == "outside") debug = true;
        // if (this.node.id == "equalizer") debug = true;
        // if (this.node.id == "dialog_session_manager") debug = true;

        // if (this.node.layoutNode.children.find(c => c.id == "car_simulator")) debug = true;

        // if (this.node.id == "/dialog/tts_guard") debug = true;pathCount
        // if (this.node.id.includes("__hypernode_")) debug = true;
        // if (this.node.id.includes("p2")) debug = true;
        // if (this.node.id.includes("M")) debug = true;
        if (debug) {


            this.node.layoutNode.debugShapes.push(...[this.getValidAnchorsOfRange().startAnchor, this.getValidAnchorsOfRange().endAnchor]);
            // this.node.layoutNode.debugShapes.push(...[this.getValidAnchorsOfRange().startAnchor, this.getValidAnchorsOfRange().endAnchor, this.getValidAnchorsOfRange().backsideAnchor]);

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

                startAnchor._data = { length: 10, stroke: "green", opacity: 1 };
                endAnchor._data = { length: 10, stroke: "red", opacity: 1 };

                path.connection.debugShapes.push(startAnchor, endAnchor);

                // const desiredAnchor = path.getDesiredNodeAnchor(this.node);
                const desiredAnchor = this.subPathInformation.find(p => p.subPath == path)?.desiredAnchor;
                if (desiredAnchor) {
                    desiredAnchor._data = { length: 5, stroke: "blue" };
                    path.connection.debugShapes.push(desiredAnchor);

                    const _s = new Segment(desiredAnchor.anchorPoint, startAnchor.anchorPoint);
                    path.connection.debugShapes.push(_s);

                    // const segment1 = new Segment(desiredAnchor.anchorPoint, this.node.layoutNode.center);
                    // const segment2 = new Segment(desiredAnchor.anchorPoint, path.sourceVisNode.layoutNode.center);
                    // const segment3 = new Segment(desiredAnchor.anchorPoint, path.targetVisNode.layoutNode.center);
                    // path.connection.debugShapes.push(segment1);
                    // path.connection.debugShapes.push(segment2);
                    // path.connection.debugShapes.push(segment3);

                }
                const desiredAnchorPoint = path.getDesiredNodeAnchor(this.node)?.anchorPoint;

                if (desiredAnchorPoint && path.fixedPathAnchorPoint) {
                    const segment = new Segment(path.fixedPathAnchorPoint, desiredAnchorPoint);
                    segment._data = { stroke: "orange" }
                    // path.connection.debugShapes.push(segment);
                }

                if (pathMids.has(path)) {
                    const midRad = pathMids.get(path)!;
                    const midAnchor = this.getAnchorForRad(midRad, "out");
                    midAnchor._data = { length: 5, stroke: "blue" };
                    // path.connection.debugShapes.push(midAnchor);
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
