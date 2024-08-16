export class Vector2D {
    constructor(
        public x: number,
        public y: number,
    ) { }

    get length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y)
    }

    add(other: Vector2D): Vector2D {
        return new Vector2D(this.x + other.x, this.y + other.y);
    }

    negative(): Vector2D {
        return new Vector2D(-this.x, -this.y);
    }

    multiply(factor: number): Vector2D {
        return new Vector2D(this.x * factor, this.y * factor);
    }

    unity(): Vector2D {
        return this.multiply(1 / this.length);
    }

    subtract(other: Vector2D): Vector2D {
        return new Vector2D(this.x - other.x, this.y - other.y);
    }

    dot(other: Vector2D): number {
        return this.x * other.x + this.y * other.y;
    }

    radBetween(other: Vector2D = new Vector2D(1, 0)): number {

        const dotProduct = this.x * other.x + this.y * other.y;
        const magnitudeA = this.length;
        const magnitudeB = other.length;

        // Calculate the angle in radians
        let angle = Math.acos(dotProduct / (magnitudeA * magnitudeB));

        // Calculate the cross product to determine the sign of the angle
        const crossProduct = this.x * other.y - this.y * other.x;

        // If crossProduct is negative, the angle should be negative
        if (crossProduct < 0) {
            angle = -angle;
        }

        // Convert the angle from radians to degrees
        return angle;
    }

    degBetween(other: Vector2D = new Vector2D(1, 0)): number {
        return this.radBetween(other) * 180 / Math.PI;
    }
}
