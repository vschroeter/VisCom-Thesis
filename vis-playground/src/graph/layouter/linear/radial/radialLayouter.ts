import { CommunicationGraph, CommunicationLink, CommunicationNode } from "src/graph/commGraph";
import { GraphLayouter } from "../../layouter";
import { Graph2d } from "src/graph/graphical/Graph2d";

import * as d3 from "d3";
import { Connection2d, EllipticArc, Node2d } from "src/graph/graphical";
import { RadialLayouterSettings } from "./radialSettings";
import { CommonSettings } from "../../settings/commonSettings";
import { Circle, Line, Point, Segment, Vector } from "2d-geometry";
import { Anchor } from "src/graph/graphical/primitives/Anchor2d";

export function radToDeg(rad: number) {
    return rad * 180 / Math.PI;
}

export function degToRad(deg: number) {
    return deg * Math.PI / 180;
}

export class RadialLayouter extends GraphLayouter<RadialLayouterSettings> {


    getRadius() {
        return this.settings.size.radius.getValue(this.settings.getContext({ graph2d: this.graph2d })) ?? 5;
    }

    getPositionForRad(rad: number, radius?: number, centerTranslation?: { x: number, y: number }): Point {
        
        const radius_ = radius ?? this.getRadius();
        const centerTranslation_ = centerTranslation ?? this.center;
        
        const x = centerTranslation_.x + radius_ * Math.cos(rad);
        const y = centerTranslation_.y + radius_ * Math.sin(rad);

        return new Point(x, y);
    }

    override layout(isUpdate = false) {
        const radius = this.getRadius();
        
        const sorter = this.settings.sorting.getSorter(this.commGraph);
        const nodes = sorter.getSorting2dNodes(this.graph2d)
        
        // Get the nodes position on the interval [0, 1]
        const continuumMap = new Map<Node2d, number>();
        nodes.forEach((node, i) => {
            continuumMap.set(node, i / nodes.length);
        });


        // Place nodes on a circle with radius
        const angleRadMap = new Map<Node2d, number>();
        // const angleRadStep = 2 * Math.PI / nodes.length;
        nodes.forEach((node, i) => {
            const placement = continuumMap.get(node)!;
            const angle = placement * 2 * Math.PI;
            angleRadMap.set(node, angle);
            const pos = this.getPositionForRad(angle);
            node.x = pos.x;
            node.y = pos.y;
            console.log("Set node position", node.id, pos, node.circle);
        });

        console.log("Placed nodes on circle", nodes);

        

        // // Adapt to the center
        // this.adaptNodesByCenterTranslation();


        // Calculate the links

        // We distinguish between two types of links:
        // Forward links from node a to b, where b is a successor of a in the sorted list
        // Backward links from node a to b, where b is a predecessor of a in the sorted list


        this.getFilteredLinks().forEach(link => {
            // return;
            const startNode = link.source;
            const endNode = link.target;

            if (startNode == endNode) {
                return;
            }

            if (startNode.id == "1" && endNode.id == "4") {
                console.log("Link", link);
            }

            const startAngleDeg = radToDeg(angleRadMap.get(startNode)!);
            const startAngleRad = angleRadMap.get(startNode)!;
            const endAngleDeg = radToDeg(angleRadMap.get(endNode)!);
            const endAngleRad = angleRadMap.get(endNode)!;

            const angleDiffDeg = endAngleDeg - startAngleDeg;
            const endIsSortedAfterStart = nodes.indexOf(startNode) < nodes.indexOf(endNode);

            // Forward diff = if b < a, then diff is angleDiff + 360 (since we cross the circle's 0° point)
            const angleDiffForwardDeg = angleDiffDeg < 0 ? angleDiffDeg + 360 : angleDiffDeg;
            const angleDiffForwardRad = degToRad(angleDiffForwardDeg);
            const angleDiffBackwardDeg = 360 - angleDiffForwardDeg;
            const angleDiffBackwardRad = degToRad(angleDiffBackwardDeg);

            // Forward links should be inside the circle
            // Backward links should be outside the circle

            // We have to make a decision on how we treat forward and backward links:
            // We can either:
            // 1.) Distinguish them clearly by the sorting result. This way, backward links based on the sorting are always outside the circle
            //     This could however lead to the case, that a link between nodes that are close on the circle is drawn a much longer way outside the circle
            // 2.) Distinguish them by the angle difference. This way, links are drawn in a way that makes the most sense based on the circular layout
            // Cases for angle a and b:
            // - a < b:
            //     - 1.) Either always a forward link
            //     - 2.) Or a forward link if the angle difference is less than 180 (or another threshold) degrees
            // - a > b:
            //     - 1.) Either we have a backward link
            //     - 2.) Or a link between nodes via the 0 degree point (e.g. from 270° to 0° --> Diff is -270°, but actually it is a 90° forward link)
            //    --> again, we could use a threshold to decide if we treet it as a forward or backward link

            // Links below the threshold are forward links
            const forwardBackwardThreshold = 270;

            const isForwardLink = angleDiffForwardDeg <= forwardBackwardThreshold;

            console.log({
                startNode: startNode.id,
                endNode: endNode.id,
                // isForwardLink,
                // startAngle,
                // endAngle,
                angleDiff: angleDiffDeg,
                angleDiffForward: angleDiffForwardDeg,
            })


            if (isForwardLink) {
                /** 
                For a forward link, we want a circular arc that is inside the circle.
                This circle arc is defined by the following:
                - arcStartAnchor: The point on the circle where the link starts
                - arcEndAnchor: The point on the circle where the link ends
                - arcRadius: The radius of the circle

                The following constants are given:
                - center = center of the radial layout circle
                - radialLayoutCircle = new Circle(center, radius)
                - startPoint = startNode.center
                - endPoint = endNode.center
                - midPoint = mid points between start and end point == (startPoint + endPoint) / 2
                - radialMidPoint = getPositionOnCircle(startAngle + angleDiffForward / 2)

                We want outgoing and incoming arcs to be different, so we have to distinguish between the two cases.
                To do so, we define an asymmetric angle delta (so != 180°) for which the connection line should be (nearly) straight.
                For connection lines below this angle delta, the circular arc will be curved concave (so contrary to the circle).
                For connection lines above this angle delta, the circular arc will be curved convex (so in the direction of the circle).

                E.g.:
                - straightLineAtAngleDelta = 70°
                With this, we can get the point and the vector to this delta point on the circle
                - straightLinePoint = getPositionOnCircle(startAngle + straightLineAtAngleDelta)
                - vectorToStraightLinePoint = new Vector(startPoint, straightLinePoint) 
                - lineToStraightLinePoint = new Line(startPoint, vectorToStraightLinePoint)

                We also need the orthogonal line to the lineToStraightLinePoint. On this line will be all center points of the circular arcs.
                - orthogonalVector = vectorToStraightLinePoint.rotate90CW()
                - lineToStraightLinePointOrthogonal = new Line(startPoint, orthogonalVector)

                The center point of the circular arc is the intersection of this orthogonal line and the line from the midPoint to the radialMidPoint (which is the orthogonal line of the connection line between both nodes).
                - radialMidPointLine = new Line(midPoint, new Vector(midPoint, radialMidPoint))
                - arcCenter = lineToStraightLinePointOrthogonal.intersection(radialMidPointLine)

                With that, we can calculate the radius of the circular arc:
                - arcRadius = new Vector(arcCenter, startPoint).length()
                - arcCircle = new Circle(arcCenter, arcRadius)

                Now we want to get the anchor points
                - startCircle = startNode.circle
                - endCircle = endNode.circle
                - intersectionsStart = arcCircle.intersection(startCircle)
                - intersectionsEnd = arcCircle.intersection(endCircle)

                Because there are two intersections, we have to decide which one to take.
                - intersectionStart = intersectionsStart[0] if radialLayoutCircle.contains(intersectionsStart[0]) else intersectionsStart[1]
                - intersectionEnd = intersectionsEnd[0] if radialLayoutCircle.contains(intersectionsEnd[0]) else intersectionsEnd[1]

                We get the anchors:
                - startAnchor = startNode.getAnchor(intersectionStart)
                - endAnchor = endNode.getAnchor(intersectionEnd)

                Then we can construct the arc
                - arc = new EllipticArc()
                    .radius(arcRadius)
                    .startPoint(startAnchor.anchorPoint)
                    .endPoint(endAnchor.anchorPoint)
                    .direction("clockwise")
                */

                // Given Constants
                const center = this.center;
                const radialLayoutCircle = new Circle(center, radius);
                const startPoint = startNode.center;
                const endPoint = endNode.center;
                const midPoint = new Segment(startPoint, endPoint).middle();
                const radialMidPoint = this.getPositionForRad(startAngleRad + angleDiffForwardRad / 2);

                // Calculate the straight line information
                const straightLineAtDegreeDelta = 120;
                const straightLineAtRadDelta = degToRad(straightLineAtDegreeDelta);

                const straightLinePoint = this.getPositionForRad(startAngleRad + straightLineAtRadDelta);
                console.log({
                    startNode,
                    endNode,
                    startAngle: startAngleRad,
                    endAngle: endAngleRad,
                    straightLinePoint
                });
                const vectorToStraightLinePoint = new Vector(startPoint, straightLinePoint);
                const orthogonalVector = vectorToStraightLinePoint.rotate90CW();
                
                // We have to rotate the vectors by 90° to get the normal vectors for the lines --> we can just take the inverted results of before
                const lineToStraightLinePoint = new Line(startPoint, orthogonalVector);
                const lineToStraightLinePointOrthogonal = new Line(startPoint, vectorToStraightLinePoint);

                // Calculate the center of the arc
                const radialMidPointLine = new Line(midPoint, radialMidPoint);
                const arcCenter = lineToStraightLinePointOrthogonal.intersect(radialMidPointLine)[0];

                // Calculate the radius of the arc
                const arcRadius = new Vector(arcCenter, startPoint).length;

                // Calculate the arc points
                const arcCircle = new Circle(arcCenter, arcRadius);
                const intersectionsStart = arcCircle.intersect(startNode.circle);
                const intersectionsEnd = arcCircle.intersect(endNode.circle);

                console.log({
                    arcCircle,
                    startNodeCircle: startNode.circle,
                    endNodeCircle: endNode.circle,
                    intersectionsStart,
                    intersectionsEnd
                });

                const intersectionStart = radialLayoutCircle.contains(intersectionsStart[0]) ? intersectionsStart[0] : intersectionsStart[1];
                const intersectionEnd = radialLayoutCircle.contains(intersectionsEnd[0]) ? intersectionsEnd[0] : intersectionsEnd[1];

                // Get the anchors
                // The vectore are a 90° rotation of the vector from the arc center to the intersection point.
                let tangentInStartIntersection; Vector;
                let tangentInEndIntersection; Vector;
                
                // The rotation depends on the curvature of the link, so we have to distinguish between the two cases
                if (angleDiffForwardDeg > straightLineAtDegreeDelta) {
                    tangentInStartIntersection = new Vector(arcCenter, intersectionStart).normalize().rotate90CW();
                    tangentInEndIntersection = new Vector(arcCenter, intersectionEnd).normalize().rotate90CCW();
                } else {
                    tangentInStartIntersection = new Vector(arcCenter, intersectionStart).normalize().rotate90CCW();
                    tangentInEndIntersection = new Vector(arcCenter, intersectionEnd).normalize().rotate90CW();
                }


                const startAnchor = new Anchor(intersectionStart, tangentInStartIntersection)
                const endAnchor = new Anchor(intersectionEnd, tangentInEndIntersection);
                
                // Construct the arc
                const direction = angleDiffForwardDeg > straightLineAtDegreeDelta ? "clockwise" : "counter-clockwise";

                const arc = new EllipticArc()
                    .radius(arcRadius)
                    .startPoint(startAnchor.anchorPoint)
                    .endPoint(endAnchor.anchorPoint)
                    .largeArc(0)
                    .direction(direction);
                
                link.points = [
                    startAnchor,
                    arc,
                    endAnchor
                ];                
            }


            

        })


        // this.emitEvent("update");
        this.emitEvent("end");
    }
}
