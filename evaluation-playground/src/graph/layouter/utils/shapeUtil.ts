import { Point } from "2d-geometry";

export class ShapeUtil {

    static getClosestShapeToPoint<T>(
        shapes: T[],
        point: Point,
        pointGetter: (shape: T) => Point = (shape: T) => shape as unknown as Point
    ): T | undefined {
        if (shapes.length === 0) {
            return undefined;
        }

        let closestShape = shapes[0];
        let closestDistance = Math.sqrt((pointGetter(shapes[0]).x - point.x) ** 2 + (pointGetter(shapes[0]).y - point.y) ** 2);

        for (let i = 1; i < shapes.length; i++) {
            const distance = Math.sqrt((pointGetter(shapes[i]).x - point.x) ** 2 + (pointGetter(shapes[i]).y - point.y) ** 2);
            if (distance < closestDistance) {
                closestShape = shapes[i];
                closestDistance = distance;
            }
        }

        return closestShape;
    }

    static getFurthestShapeToPoint<T>(
        shapes: T[],
        point: Point,
        pointGetter: (shape: T) => Point = (shape: T) => shape as unknown as Point
    ): T | undefined {
        if (shapes.length === 0) {
            return undefined;
        }

        let furthestShape = shapes[0];
        let furthestDistance = Math.sqrt((pointGetter(shapes[0]).x - point.x) ** 2 + (pointGetter(shapes[0]).y - point.y) ** 2);

        for (let i = 1; i < shapes.length; i++) {
            const distance = Math.sqrt((pointGetter(shapes[i]).x - point.x) ** 2 + (pointGetter(shapes[i]).y - point.y) ** 2);
            if (distance > furthestDistance) {
                furthestShape = shapes[i];
                furthestDistance = distance;
            }
        }

        return furthestShape;
    }

}
