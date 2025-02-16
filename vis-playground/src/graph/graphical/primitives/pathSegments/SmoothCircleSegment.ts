import { Circle } from "2d-geometry";
import { Anchor } from "../Anchor";
import { PathSegment } from "./PathSegment";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { ConnectingCircleResult, RadialUtils } from "src/graph/layouter/utils/radialUtils";
import { EllipticArc } from "./EllipticArc";
import { StraightLineSegment } from "./LineSegment";
import { SmoothSplineSegment } from "./SmoothSpline";


export class SmoothCircleSegment extends PathSegment {



    startAnchor: Anchor;
    endAnchor: Anchor;
    segmentCircle: Circle;


    constructor(connection: LayoutConnection, startAnchor: Anchor, endAnchor: Anchor, segmentCircle: Circle) {
        super(connection);
        this.startAnchor = startAnchor;
        this.endAnchor = endAnchor;
        this.segmentCircle = segmentCircle;
    }



    getConnectingPathSegments(connectingStartCircle: ConnectingCircleResult, connectingEndCircle: ConnectingCircleResult, circleSegment: Circle): {
        segments: PathSegment[],
        length: number
    } {

        // There are two possibilities:
        // 1. There is a smooth connection from first circle via the segment circle to the second circle
        // 2. The start circle ends further away on the circle segment than the end circle and there would be a reverse path on the circle segment
        //
        // In case 1, we concatenate the path as :
        //  CircleArc(startAnchor->connectingStartCircle.connectionPoint) +
        //  CircleArc(connectingStartCircle.connectionPoint->connectingEndCircle.connectionPoint) +
        //  CircleArc(connectingEndCircle.connectionPoint->endAnchor)
        // In case 2, we first calculate a tangent touching both connecting circles and then calculate the path as:
        //  CircleArc(startAnchor->tangent.start) +
        //  Line(tangent.start->tangent.end) +
        //  CircleArc(tangent.end->endAnchor)

        const startDirection = connectingStartCircle.direction;
        const endDirection = connectingEndCircle.direction;
        const radOfConnectingStartPoint = RadialUtils.radOfPoint(connectingStartCircle.connectingAnchor.anchorPoint, circleSegment.center);
        const radOfConnectingEndPoint = RadialUtils.radOfPoint(connectingEndCircle.connectingAnchor.anchorPoint, circleSegment.center);
        const radDiff = RadialUtils.normalizeRad(radOfConnectingEndPoint - radOfConnectingStartPoint);

        const startDirectionRegardingCircleSegment = connectingStartCircle.connectingAnchor.getDirectionRegardingCircle(circleSegment);


        const cS = connectingStartCircle.circle.clone();
        const cE = connectingEndCircle.circle.clone();

        cS._data = { stroke: "green" };
        cE._data = { stroke: "red" };

        // this.connection.source.debugShapes.push(connectingStartCircle.fixedAnchor);
        // this.connection.source.debugShapes.push(cS);
        // this.connection.source.debugShapes.push(cE);
        // this.connection.source.debugShapes.push(circleSegment);

        // Case 1
        if ((radDiff > 0 && startDirectionRegardingCircleSegment == "clockwise" || radDiff < 0 && startDirectionRegardingCircleSegment == "counter-clockwise")) {
            // console.log("Case 1", this.connection.id, startDirectionRegardingCircleSegment);

            const startArc = RadialUtils.getArcFromConnectingCircle(connectingStartCircle, this.connection);
            const endArc = RadialUtils.getArcFromConnectingCircle(connectingEndCircle, this.connection, true);

            const intermediateDirection = connectingStartCircle.connectingAnchor.getDirectionRegardingCircle(circleSegment);

            const intermediateArc = new EllipticArc(
                this.connection,
                connectingStartCircle.connectingAnchor.anchorPoint,
                connectingEndCircle.connectingAnchor.anchorPoint,
                circleSegment.r,
                circleSegment.r,
                // ).direction(startDirection == "clockwise" ? "counter-clockwise" : "clockwise");
            ).direction(intermediateDirection);

            const rad1 = RadialUtils.radOfPoint(connectingStartCircle.connectingAnchor.anchorPoint, circleSegment.center);
            const rad2 = RadialUtils.radOfPoint(connectingEndCircle.connectingAnchor.anchorPoint, circleSegment.center);
            const radDiff = RadialUtils.normalizeRad(rad2 - rad1);

            // if (startDirection == "clockwise") {

            //     this.connection.source.debugShapes.push(connectingStartCircle.circle);
            //     this.connection.source.debugShapes.push(connectingEndCircle.circle);
            //     this.connection.source.debugShapes.push(circleSegment);

            // }


            return {
                segments: [startArc, intermediateArc, endArc],
                length: Math.abs(radDiff)
            }
        }

        // Case 2
        else {
            // console.log("Case 2", this.connection.id);

            const tangents = RadialUtils.getInnerTangentsBetweenCircles(connectingStartCircle.circle, connectingEndCircle.circle);

            // this.connection.source.debugShapes.push(tangents[0]);
            // this.connection.source.debugShapes.push(tangents[1]);

            // Get the tangent that is in the correct direction
            const tangent = tangents.find(tangent => {
                const a = new Anchor(tangent.start, tangent.end);
                // this.connection.source.debugShapes.push(a);
                const tangentDir = a.getDirectionRegardingCircle(connectingStartCircle.circle);
                return tangentDir == startDirection;
            });

            if (!tangent) {
                console.error("No tangent found", this.connection.id, this);

                // this.connection.debugShapes.push(connectingStartCircle.circle);
                // this.connection.debugShapes.push(connectingEndCircle.circle);
                // this.connection.debugShapes.push(circleSegment);

                return {
                    segments: [],
                    length: Number.MAX_VALUE
                }
            }

            connectingStartCircle.connectingAnchor.anchorPoint = tangent.start;
            connectingEndCircle.connectingAnchor.anchorPoint = tangent.end;
            const startArc = RadialUtils.getArcFromConnectingCircle(connectingStartCircle, this.connection);
            const endArc = RadialUtils.getArcFromConnectingCircle(connectingEndCircle, this.connection, true);

            const rad1 = RadialUtils.radOfPoint(connectingStartCircle.connectingAnchor.anchorPoint, circleSegment.center);
            const rad2 = RadialUtils.radOfPoint(connectingEndCircle.connectingAnchor.anchorPoint, circleSegment.center);
            const radDiff = RadialUtils.normalizeRad(rad2 - rad1);




            return {
                segments: [startArc, new StraightLineSegment(this.connection, tangent.start, tangent.end), endArc],
                // segments: [startArc, new SmoothSplineSegment(this.connection, tangent.start, tangent.end), endArc],
                length: Math.abs(radDiff)
            }
        }
    }



    override getSvgPath(): string {

        // Get both valid circles to connect the start anchor with the circle segment
        const connectingStartCircles = RadialUtils.getConnectingCirclesForAnchorAndCircle(this.startAnchor, this.segmentCircle, this.connection);
        const connectingEndCircles = RadialUtils.getConnectingCirclesForAnchorAndCircle(this.endAnchor, this.segmentCircle, this.connection);


        const aS = this.startAnchor.clone();
        const aE = this.endAnchor.clone();

        aS._data = { stroke: "green" };
        aE._data = { stroke: "red" };


        // this.connection.source.debugShapes.push(aS);
        // this.connection.source.debugShapes.push(aE);

        // connectingStartCircles.forEach(circle => {
        //     const c = circle.circle.clone();
        //     c._data = { stroke: "green" };
        //     this.connection.source.debugShapes.push(c);
        // });

        // connectingEndCircles.forEach(circle => {
        //     const c = circle.circle.clone();
        //     c._data = { stroke: "red" };
        //     this.connection.source.debugShapes.push(c);
        // });



        // return "";


        const combinations: [ConnectingCircleResult, ConnectingCircleResult][] = []

        // Of both circle combinations, there are two fitting pairs, where the directions match
        connectingStartCircles.forEach(startCircle => {
            connectingEndCircles.forEach(endCircle => {
                if (startCircle.direction != endCircle.direction) {
                    combinations.push([startCircle, endCircle]);
                }
            });
        });

        let minLen = Number.MAX_VALUE;
        let minPaths: PathSegment[] = [];

        combinations.forEach(([startCircle, endCircle]) => {
            const paths = this.getConnectingPathSegments(startCircle, endCircle, this.segmentCircle);
            if (paths.length < minLen) {
                minLen = paths.length;
                minPaths = paths.segments;
            }
        })


        return minPaths.map(path => path.getSvgPath()).join(" ");


        // let debug = false;
        // if (this.source.id == "flint_node" && this.target.id == "tts_pico") {
        //     debug = true;
        // }

        // if (debug) {



        //     connectingEndCircles.forEach(circle => {
        //         console.log("Connecting end circle: ", {
        //             circle: circle.circle,
        //             connectingAnchor: circle.connectingAnchor,
        //             combinations: combinations
        //         });
        //         this.connection.source.debugShapes.push(circle.circle);
        //         this.connection.source.debugShapes.push(this.segmentCircle);
        //         this.connection.source.debugShapes.push(circle.connectingAnchor);
        //         this.connection.source.debugShapes.push(this.endAnchor);

        //     })
        // }




        return "";

    }




}

