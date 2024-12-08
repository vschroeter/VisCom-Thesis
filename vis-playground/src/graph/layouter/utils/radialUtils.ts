import { Circle, Line, Point, PointLike, Segment, Vector } from "2d-geometry";
import { ShapeUtil } from "./shapeUtil";

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

    static forwardRadBetweenAngles(startRad: number, endRad: number): number {
        const rad = endRad - startRad;
        return rad < 0 ? rad + 2 * Math.PI : rad;
    }

    /**
     * Returns the radian value between the given start and end radian values.
     * If the target radian is not between the start and end radian values, the closest value is returned.
     * If the target radian is between the start and end radian values, the target radian is returned.
     * @param startRad The minimum radian value.
     * @param endRad The maximum radian value.
     * @param targetRad The target radian value.
     */
    static putRadBetween(startRad: number, endRad: number, targetRad: number): number {
        const forwardRad = RadialUtils.forwardRadBetweenAngles(startRad, endRad);

        const forwardTargetToStart = RadialUtils.forwardRadBetweenAngles(targetRad, startRad);
        const forwardStartToTarget = RadialUtils.forwardRadBetweenAngles(startRad, targetRad);
        const forwardTargetToEnd = RadialUtils.forwardRadBetweenAngles(targetRad, endRad);

        

        // If the target rad is outside the range, return the closest value
        if (forwardTargetToStart < forwardTargetToEnd) {
            
            if (forwardTargetToStart < Math.abs(forwardTargetToEnd - 2 * Math.PI)) {
                return startRad;
            }
            return endRad;
        }

        return targetRad;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Vectors
    ////////////////////////////////////////////////////////////////////////////

    static radToVector(rad: number): Vector {
        return new Vector(Math.cos(rad), Math.sin(rad));
    }

    ////////////////////////////////////////////////////////////////////////////
    // Angles in a circle
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
        return Math.atan2(point2.y - _center.y, point2.x - _center.x) - Math.atan2(point1.y - _center.y, point1.x - _center.x);
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

    ////////////////////////////////////////////////////////////////////////////
    // Positions on a circle
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
    // Distances between points
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
    // Tangents
    ////////////////////////////////////////////////////////////////////////////

    static getTangentsToCircle(point: Point, circle: Circle): Segment[] {

        // The tangent from a point to a circle is perpendicular to the radius at the point of tangency
        // Thus, there are two possible tangents from a point to a circle

        try {

            const connectionLine = new Segment(point, circle.center);
            const perpendicular = new Line(circle.center, connectionLine.vector);

            const intersectionPoints = circle.intersect(perpendicular);

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

}
