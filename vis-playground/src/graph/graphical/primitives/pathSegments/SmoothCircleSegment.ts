import { Circle } from "2d-geometry";
import { Anchor } from "../Anchor";
import { PathSegment } from "./PathSegment";


export class SmoothCircleSegment extends PathSegment {



    startAnchor: Anchor;
    endAnchor: Anchor;
    segmentCircle: Circle;



    override getSvgPath(): string {

        


    }




}

