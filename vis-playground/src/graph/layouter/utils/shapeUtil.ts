import { Point } from "2d-geometry";

export class ShapeUtil {

    static getClosestShapeToPoint<T>(
        shapes: T[],
        point: Point,
        xGetter: (shape: T) => number,
        yGetter: (shape: T) => number
    ): T | undefined {
        if (shapes.length === 0) {
            return undefined;
        }
        let closestShape = shapes[0];
        let closestDistance = Math.sqrt((xGetter(shapes[0]) - point.x) ** 2 + (yGetter(shapes[0]) - point.y) ** 2);

        for (let i = 1; i < shapes.length; i++) {
            const distance = Math.sqrt((xGetter(shapes[i]) - point.x) ** 2 + (yGetter(shapes[i]) - point.y) ** 2);
            if (distance < closestDistance) {
                closestShape = shapes[i];
                closestDistance = distance;
            }
        }

        return closestShape;
    }

}
