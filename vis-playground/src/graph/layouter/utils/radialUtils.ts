import { Circle, Line, Point, PointLike, Segment, Vector } from "2d-geometry";
import { ShapeUtil } from "./shapeUtil";
import { Anchor, EllipticArc } from "src/graph/graphical";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";

/**
 * Converts radians to degrees.
 * @param rad - The angle in radians.
 * @returns The angle in degrees.
 */
export function radToDeg(rad: number) {
    return rad * 180 / Math.PI;
}

/**
 * Converts degrees to radians.
 * @param deg - The angle in degrees.
 * @returns The angle in radians.
 */
export function degToRad(deg: number) {
    return deg * Math.PI / 180;
}

export type ConnectingCircleResult = {
    circle: Circle,
    fixedAnchor: Anchor,
    connectingAnchor: Anchor,
    direction: "clockwise" | "counter-clockwise"
}

export class RadialUtils extends ShapeUtil {

    /**
     * Converts radians to degrees.
     * @param rad - The angle in radians.
     * @returns The angle in degrees.
     */
    static radToDeg(rad: number) {
        return rad * 180 / Math.PI;
    }

    /**
     * Converts degrees to radians.
     * @param deg - The angle in degrees.
     * @returns The angle in radians.
     */
    static degToRad(deg: number) {
        return deg * Math.PI / 180;
    }

    static normalizeRad(rad: number, positive: boolean = false): number {
        if (rad < 0) {
            rad += Math.floor(-rad / (2 * Math.PI) + 1) * 2 * Math.PI;
        }

        rad = rad % (2 * Math.PI);

        if (!positive && rad > Math.PI) {
            return rad - 2 * Math.PI;
        }
        return rad;
    }

    static forwardRadBetweenAngles(startRad: number, endRad: number): number {
        let rad = endRad - startRad;
        while (rad < 0) {
            rad += 2 * Math.PI;
        }
        return rad;
    }

    /**
     * Returns the radian value between the given start and end radian values.
     * If the target radian is not between the start and end radian values, the closest value is returned.
     * If the target radian is between the start and end radian values, the target radian is returned.
     * @param startRad The minimum radian value.
     * @param endRad The maximum radian value.
     * @param targetRad The target radian value.
     */
    static putRadBetween(targetRad: number, startRad: number, endRad: number,
        direction: "clockwise" | "counter-clockwise" | "closer" = "closer",
        tolerance = 0.001): number {

        if (Math.abs(startRad - endRad) < tolerance) {
            return startRad;
        }

        startRad = RadialUtils.normalizeRad(startRad);
        endRad = RadialUtils.normalizeRad(endRad);
        targetRad = RadialUtils.normalizeRad(targetRad);

        const forwardRad = RadialUtils.forwardRadBetweenAngles(startRad, endRad);

        const forwardTargetToStart = RadialUtils.forwardRadBetweenAngles(targetRad, startRad);
        const forwardStartToTarget = RadialUtils.forwardRadBetweenAngles(startRad, targetRad);
        const forwardTargetToEnd = RadialUtils.forwardRadBetweenAngles(targetRad, endRad);

        // console.log({
        //     startRad: radToDeg(startRad),
        //     endRad: radToDeg(endRad),
        //     targetRad: radToDeg(targetRad),
        //     forwardTargetToStart: radToDeg(forwardTargetToStart),
        //     forwardStartToTarget: radToDeg(forwardStartToTarget),
        //     forwardTargetToEnd: radToDeg(forwardTargetToEnd),
        // })

        // If the target rad is outside the range, return the closest value
        if (forwardTargetToStart < forwardTargetToEnd) {

            if (direction == "closer") {
                if (forwardTargetToStart < Math.abs(forwardTargetToEnd - 2 * Math.PI)) {
                    return startRad;
                }
                return endRad;
            } else if (direction == "clockwise") {
                return startRad;
            } else if (direction == "counter-clockwise") {
                return endRad;
            }

        }

        return targetRad;
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Vectors
    ////////////////////////////////////////////////////////////////////////////

    static radToVector(rad: number): Vector {
        return new Vector(Math.cos(rad), Math.sin(rad));
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Angles in a circle
    ////////////////////////////////////////////////////////////////////////////

    /**
     * Calculates the angle in radians of a point relative to a center point.
     * @param point - The point for which to calculate the angle.
     * @param center - The center point. Defaults to { x: 0, y: 0 }.
     * @returns The angle in radians.
     */
    static radOfPoint(point: PointLike, center?: PointLike): number {
        const _center = center ?? { x: 0, y: 0 };
        return Math.atan2(point.y - _center.y, point.x - _center.x);
    }

    /**
     * Calculates the angle in degrees of a point relative to a center point.
     * @param point - The point for which to calculate the angle.
     * @param center - The center point. Defaults to { x: 0, y: 0 }.
     * @returns The angle in degrees.
     */
    static degOfPoint(point: PointLike, center?: PointLike): number {
        return radToDeg(RadialUtils.radOfPoint(point, center));
    }

    /**
     * Calculates the angle in radians between two points relative to a center point.
     * @param point1 - The first point.
     * @param point2 - The second point.
     * @param center - The center point. Defaults to { x: 0, y: 0 }.
     * @returns The angle in radians.
     */
    static radBetweenPoints(point1: PointLike, point2: PointLike, center?: PointLike): number {
        const _center = center ?? { x: 0, y: 0 };
        const diff = Math.atan2(point2.y - _center.y, point2.x - _center.x) - Math.atan2(point1.y - _center.y, point1.x - _center.x);
        return RadialUtils.normalizeRad(diff, false);
    }

    /**
     * Check if the given rad is between the start and end rad.
     * @param rad The rad to check
     * @param startRad The start rad
     * @param endRad The end rad
     */
    static radIsBetween(rad: number, startRad: number, endRad: number): boolean {

        rad = RadialUtils.normalizeRad(rad);
        startRad = RadialUtils.normalizeRad(startRad);
        endRad = RadialUtils.normalizeRad(endRad);

        const forwardRad = RadialUtils.forwardRadBetweenAngles(startRad, endRad);
        const forwardStartToRad = RadialUtils.forwardRadBetweenAngles(startRad, rad);
        const forwardRadToEnd = RadialUtils.forwardRadBetweenAngles(rad, endRad);

        return forwardStartToRad <= forwardRad && forwardRadToEnd <= forwardRad;
    }

    /**
     * Calculates the angle in degrees between two points relative to a center point.
     * @param point1 - The first point.
     * @param point2 - The second point.
     * @param center - The center point. Defaults to { x: 0, y: 0 }.
     * @returns The angle in degrees.
     */
    static degBetweenPoints(point1: PointLike, point2: PointLike, center?: PointLike): number {
        return radToDeg(RadialUtils.radBetweenPoints(point1, point2, center));
    }

    /**
     * Calculates the forward angle in radians between two points relative to a center point.
     * @param point1 - The first point.
     * @param point2 - The second point.
     * @param center - The center point. Defaults to { x: 0, y: 0 }.
     * @returns The forward angle in radians.
     */
    static forwardRadBetweenPoints(point1: PointLike, point2: PointLike, center?: PointLike): number {
        const rad = RadialUtils.radBetweenPoints(point1, point2, center);
        return rad < 0 ? rad + 2 * Math.PI : rad;
    }

    /**
     * Calculates the forward angle in degrees between two points relative to a center point.
     * @param point1 - The first point.
     * @param point2 - The second point.
     * @param center - The center point. Defaults to { x: 0, y: 0 }.
     * @returns The forward angle in degrees.
     */
    static forwardDegBetweenPoints(point1: PointLike, point2: PointLike, center?: PointLike): number {
        return radToDeg(RadialUtils.forwardRadBetweenPoints(point1, point2, center));
    }

    static getEnclosingAngle(point1: PointLike, point2: PointLike, point3: PointLike): number {
        const angle = RadialUtils.normalizeRad(RadialUtils.radBetweenPoints(point1, point3, point2), true);
        if (angle > Math.PI) return Math.PI * 2 - angle;
        return angle;
    }

    /**
     * Check if rad1 comes after rad2, with respect to the reference rad.
     * @param rad1 Rad1
     * @param rad2 Rad2
     * @param referenceRad Reference rad for comparison
     * @returns True if rad1 comes after rad2, otherwise false
     */
    static rad1ComesAfterRad2(rad1: number, rad2: number, referenceRad: number) {
        if (RadialUtils.forwardRadBetweenAngles(referenceRad, rad1) < RadialUtils.forwardRadBetweenAngles(referenceRad, rad2)) {
            return false;
        }
        return true;
    }

    /**
     * Check if rad1 comes before rad2, with respect to the reference rad.
     * @param rad1 Rad1
     * @param rad2 Rad2
     * @param referenceRad Reference rad for comparison
     * @returns True if rad1 comes before rad2, otherwise false
     */
    static rad1ComesBeforeRad2(rad1: number, rad2: number, referenceRad: number) {
        return !RadialUtils.rad1ComesAfterRad2(rad1, rad2, referenceRad);
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Positions on a circle
    ////////////////////////////////////////////////////////////////////////////



    /**
     * Calculates the position on a circle at a given angle in radians.
     * @param rad - The angle in radians.
     * @param radius - The radius of the circle.
     * @param centerTranslation - The center translation. Defaults to { x: 0, y: 0 }.
     * @returns The position on the circle as a Point.
     */
    static positionOnCircleAtRad(rad: number, radius: number, centerTranslation?: PointLike): Point {
        const _centerTranslation = centerTranslation ?? { x: 0, y: 0 };
        const x = _centerTranslation.x + radius * Math.cos(rad);
        const y = _centerTranslation.y + radius * Math.sin(rad);

        return new Point(x, y);
    }

    /**
     * Calculates the position on a circle at a given angle in degrees.
     * @param deg - The angle in degrees.
     * @param radius - The radius of the circle.
     * @param centerTranslation - The center translation. Defaults to { x: 0, y: 0 }.
     * @returns The position on the circle as a Point.
     */
    static positionOnCircleAtDeg(deg: number, radius: number, centerTranslation?: PointLike): Point {
        const rad = degToRad(deg);
        return RadialUtils.positionOnCircleAtRad(rad, radius, centerTranslation);
    }


    ////////////////////////////////////////////////////////////////////////////
    // #region Distances between points
    ////////////////////////////////////////////////////////////////////////////

    /**
     * Calculates the straight distance between two points.
     * @param point1 - The first point.
     * @param point2 - The second point.
     * @returns The straight distance between the points.
     */
    static straightDistance(point1: PointLike, point2: PointLike): number {
        return Math.sqrt((point1.x - point2.x) ** 2 + (point1.y - point2.y) ** 2);
    }

    /**
     * Calculates the radial distance between two angles on a circle.
     * @param radStart - The starting angle in radians.
     * @param radEnd - The ending angle in radians.
     * @param radius - The radius of the circle.
     * @param returnShortestPath - Whether to return the shortest path. If false, the actual path from start to end is returned. Defaults to true.
     * @returns The radial distance.
     */
    static radialDistance(radStart: number, radEnd: number, radius: number, returnShortestPath: boolean = true): number {
        if (returnShortestPath) {
            return (Math.abs(radStart - radEnd) % (2 * Math.PI)) * radius;
        }

        const angleDiff = radEnd - radStart;
        const angleDiffForward = (angleDiff < 0 ? angleDiff + 2 * Math.PI : angleDiff) % (2 * Math.PI);

        return angleDiffForward * radius;
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Tangents
    ////////////////////////////////////////////////////////////////////////////

    static getTangentsFromPointToCircle(point: Point, circle: Circle): Segment[] {

        // There are two possible tangents from a point to a circle
        // We construct the tangents using the thales theorem

        try {

            const distanceToCenter = point.distanceTo(circle.center)[0];

            if (distanceToCenter < circle.r) {
                return [];
            }

            const thalesRadius = distanceToCenter / 2;
            const thalesCenter = new Segment(point, circle.center).middle();

            const thalesCircle = new Circle(thalesCenter, thalesRadius);

            const intersectionPoints = thalesCircle.intersect(circle);

            if (intersectionPoints.length < 2) {
                throw new Error("No intersection points found.");
            }

            return [
                new Segment(point, intersectionPoints[0]),
                new Segment(point, intersectionPoints[1])
            ];
        } catch (error) {
            // console.error(error);
            return [];
        }
    }

    static getInnerTangentsBetweenCircles(circle1: Circle, circle2: Circle): Segment[] {

        // From https://de.wikipedia.org/wiki/Kreistangente#Konstruktion_der_inneren_Tangenten

        if (circle1.intersect(circle2).length == 2) {
            return [];
        } else if (circle1.intersect(circle2).length == 1) {
            // If the circles are touching, there is only one tangent at the touching point
            // TODO: Implement this case
            return [];
        }


        const c_P = circle1;
        const c_Q = circle2;

        const P = c_P.center;
        const Q = c_Q.center;

        const r_P = c_P.r;
        const r_Q = c_Q.r;

        const l_PQ = new Line(P, Q);
        const M = new Point((P.x + Q.x) / 2, (P.y + Q.y) / 2);

        const c_T = new Circle(M, P.distanceTo(Q)[0] / 2);

        const A = ShapeUtil.getClosestShapeToPoint(c_P.intersect(l_PQ), M)!;
        const c_in_A_with_r_Q = new Circle(A, r_Q);
        const B = ShapeUtil.getClosestShapeToPoint(c_in_A_with_r_Q.intersect(l_PQ), Q)!;
        const distance_PB = P.distanceTo(B)[0];

        const c_fromP_with_r_PB = new Circle(P, distance_PB);

        const intersectionPoints = c_fromP_with_r_PB.intersect(c_T);
        const G1 = intersectionPoints[0];
        const G2 = intersectionPoints[1];

        const l_PG1 = new Segment(P, G1);
        const l_PG2 = new Segment(P, G2);

        const L1 = l_PG1.intersect(c_P)[0]!;
        const L2 = l_PG2.intersect(c_P)[0]!;

        const l_PG1_parallel_in_Q = new Line(Q, l_PG1.vector.rotate90CW());
        const l_PG2_parallel_in_Q = new Line(Q, l_PG2.vector.rotate90CW());

        const intersectionPoints1 = l_PG1_parallel_in_Q.intersect(c_Q);
        const R1 = ShapeUtil.getClosestShapeToPoint(intersectionPoints1, P)!;

        const intersectionPoints2 = l_PG2_parallel_in_Q.intersect(c_Q);
        const R2 = ShapeUtil.getClosestShapeToPoint(intersectionPoints2, P)!;

        return [
            new Segment(L1, R1),
            new Segment(L2, R2)
        ];
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Circle Construction
    ////////////////////////////////////////////////////////////////////////////

    static getCircleFromThreePoints(point1: Point, point2: Point, point3: Point): Circle {

        const maxDistanceBetweenPoints = Math.max(
            point1.distanceTo(point2)[0],
            point1.distanceTo(point3)[0],
            point2.distanceTo(point3)[0]
        );

        const circle1 = new Circle(point1, maxDistanceBetweenPoints);
        const circle2 = new Circle(point2, maxDistanceBetweenPoints);
        const circle3 = new Circle(point3, maxDistanceBetweenPoints);

        const intersectionPoints1 = circle1.intersect(circle2);
        const intersectionPoints2 = circle2.intersect(circle3);

        if (intersectionPoints1.length < 2 || intersectionPoints2.length < 2) {
            throw new Error("No intersection points found.");
        }

        const line1 = new Line(intersectionPoints1[0], intersectionPoints1[1]);
        const line2 = new Line(intersectionPoints2[0], intersectionPoints2[1]);

        const lineIntersections = line1.intersect(line2);

        if (lineIntersections.length < 1) {
            throw new Error("No intersection points found.");
        }

        const center = lineIntersections[0];
        const radius = center.distanceTo(point1)[0];

        return new Circle(center, radius);
    }

    static getCircleFromCoincidentPointAndTangentAnchor(coincidentPoint: Point, anchor: Anchor): Circle | undefined {

        const midPoint = Anchor.getMidPointBetweenPointAndAnchor(coincidentPoint, anchor);

        if (!midPoint) {
            return undefined
            // throw new Error("No mid point found.");
        }

        const segToMidPoint = new Segment(coincidentPoint, midPoint);

        // We don't have to rotate the anchors, because the line construction takes normal vectors
        const perpLine1 = new Line(coincidentPoint, segToMidPoint.vector);
        const perpLine2 = new Line(anchor.anchorPoint, anchor.direction);

        const intersection = perpLine1.intersect(perpLine2);

        if (intersection.length < 1) {
            // throw new Error("No intersection found");
            return undefined;
        }

        const center = intersection[0];
        const radius = center.distanceTo(coincidentPoint)[0];

        return new Circle(center, radius);
    }

    static getConnectingCirclesForAnchorAndCircle(anchor: Anchor, circle: Circle, connection?: LayoutConnection): ConnectingCircleResult[] {

        const point = anchor.anchorPoint;
        const dir = anchor.direction;
        const r = circle.r;

        const p_perpendicular_line_in_point = new Line(point, dir);
        const c_in_point = new Circle(point, r);

        const c_intersections_with_perpendicular = c_in_point.intersect(p_perpendicular_line_in_point);

        if (c_intersections_with_perpendicular.length < 2) {
            throw new Error("Insufficient intersection points found.");
        }

        const foundCircles: ConnectingCircleResult[] = [];

        for (const intersection of c_intersections_with_perpendicular) {

            const l_line_from_center_to_intersection = new Line(circle.center, intersection);
            const m_midpoint_of_l = new Point((circle.center.x + intersection.x) / 2, (circle.center.y + intersection.y) / 2);

            const plm_perpendicular_line_in_m = new Line(m_midpoint_of_l, new Vector(circle.center, intersection));

            const intersections_of_plm_with_p = plm_perpendicular_line_in_m.intersect(p_perpendicular_line_in_point);


            if (intersections_of_plm_with_p.length < 1) {
                throw new Error("No intersection found between lines.");
            }

            const foundCircleCenter = intersections_of_plm_with_p[0];
            const foundCircleRadius = Math.abs(foundCircleCenter.distanceTo(circle.center)[0] - r);

            const connectingCircle = new Circle(foundCircleCenter, foundCircleRadius);

            // Intersection with the origin circle is the connecting point
            const intersectionsWithCircle = circle.intersect(new Line(circle.center, foundCircleCenter));
            const connectingPoint = ShapeUtil.getClosestShapeToPoint(intersectionsWithCircle, foundCircleCenter);



            if (!connectingPoint) {
                throw new Error("No fitting intersection found.");
            }

            // To get the correct connecting anchor, we have to check the direction of the given anchor
            // and construct a fitting anchor in the connection point
            const anchorDirection = anchor.getDirectionRegardingCircle(connectingCircle);
            const rad = RadialUtils.radOfPoint(connectingPoint, connectingCircle.center);
            const connectingAnchor = Anchor.getAnchorOnCircle(connectingCircle, rad, anchorDirection);

            // const c = connectingCircle.clone();
            // c._data = { stroke: "green" }
            // connection?.debugShapes.push(anchor);
            // connection?.debugShapes.push(foundCircleCenter);
            // connection?.debugShapes.push(c);


            foundCircles.push({
                fixedAnchor: anchor,
                connectingAnchor,
                circle: connectingCircle,
                direction: anchorDirection
            });
        }

        if (foundCircles.length < 2) {
            throw new Error("Not enough circles found.");
        }

        return foundCircles;
    }

    static getArcFromConnectingCircle(connectingCircle: ConnectingCircleResult, connection: LayoutConnection, reversed: boolean = false): EllipticArc {

        // const dir = !reversed ?
        //     connectingCircle.direction :
        //     (connectingCircle.direction == "clockwise" ? "counter-clockwise" : "clockwise");

        const dir = connectingCircle.direction;

        const arc = new EllipticArc(
            connection,
            !reversed ? connectingCircle.fixedAnchor.anchorPoint : connectingCircle.connectingAnchor.anchorPoint,
            !reversed ? connectingCircle.connectingAnchor.anchorPoint : connectingCircle.fixedAnchor.anchorPoint,
            connectingCircle.circle.r,
            connectingCircle.circle.r
        ).direction(dir);
        // ).direction("clockwise");
    // ).direction("counter-clockwise");
        // ).direction(connectingCircle.direction == "clockwise" ? "counter-clockwise" : "clockwise");

        return arc;
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Algorithms
    ////////////////////////////////////////////////////////////////////////////

    /**
     * Find the minimum enclosing circle of a set of points using the Welzl's algorithm.
     * @param points The points for which to find the minimum enclosing circle.
     * @returns The minimum enclosing circle.
     */
    static getMinimumEnclosingCircle(points: Point[]): Circle {
        console.log("Finding minimum enclosing circle for", points);
        function welzl(points: Point[], r: Point[]): Circle {
            if (points.length === 0 || r.length === 3) {
                // if (n === 0 || r.length === 3) {
                switch (r.length) {
                    case 0:
                        return new Circle(new Point(0, 0), 0);
                    case 1:
                        return new Circle(r[0], 0);
                    case 2:
                        const midPoint = new Point((r[0].x + r[1].x) / 2, (r[0].y + r[1].y) / 2);
                        return new Circle(midPoint, r[0].distanceTo(r[1])[0] / 2);
                    case 3:
                        return RadialUtils.getCircleFromThreePoints(r[0], r[1], r[2]);
                }
            }

            const circle = welzl(points.slice(1), Array.from(r));

            if (circle.contains(points[0])) {
                return circle;
            }

            const newR = Array.from(r);
            newR.push(points[0]);
            return welzl(points.slice(1), newR);
        }

        // Permute the points randomly
        const perm = Array.from(points).sort(() => Math.random() - 0.5);
        return welzl(perm, []);
    }


}
