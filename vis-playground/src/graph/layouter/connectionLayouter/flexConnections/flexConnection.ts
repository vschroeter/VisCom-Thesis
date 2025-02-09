import { CombinedPathSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { FlexNode } from "./flexNode";
import { FlexConnectionLayouter } from "./flexLayouter";


export type FlexConnectionParentType = "sameParent" | "differentParent";

export type FlexConnectionType =
    "sameParentDirectForward" | "sameParentDirectBackward" |
    "sameParent" |
    "sameHyperParentDirectForward" | "sameHyperParentDirectBackward" |
    "sameHyperParentDirectForwardBetweenAnchors" | "sameHyperParentDirectBackwardBetweenAnchors" |
    "differentParent" |

    "circleArcForward" | "circleArcBackward" |

    "unknown";


export class FlexConnection extends CombinedPathSegment {
    type: FlexConnectionType

    flexSource: FlexNode;
    flexTarget: FlexNode;

    layouter: FlexConnectionLayouter;

    constructor(connection: LayoutConnection, layouter: FlexConnectionLayouter) {
        super(connection);
        this.layouter = layouter;
        this.flexSource = layouter.getFlexNode(connection.source);
        this.flexTarget = layouter.getFlexNode(connection.target);

        this.type = type;
        this.connection.pathSegment = this;
        this.init();
    }

    init(): void {

    }

    calculate(): void {

    }
}

export class EmptyFlexConnection extends FlexConnection {
    init(): void {
        // this.segments = [];
    }
    calculate(): void {
    }
}


// export class FlexConnection extends CombinedPathSegment {

//     type: FlexConnectionType = "unknown";

//     flexNode: FlexNode;

//     constructor(connection: LayoutConnection, flexNode: FlexNode) {
//         super(connection);
//         connection.pathSegment = this;

//         this.flexNode = flexNode;

//         const source = connection.source;
//         const target = connection.target;

//         if (source.parent === target.parent) {
//             if (this.source.isDirectPredecessorInSortingTo(this.target)) {
//                 this.type = "circleArcForward";
//             } else if (this.source.isDirectSuccessorInSortingTo(this.target)) {
//                 this.type = "circleArcBackward";
//             } else {
//                 this.type = "sameParent"
//             }
//         } else {
//             const commonParent = source.getCommonParent(target);

//             // if ((commonParent == source.parent || commonParent == source.parent?.parent) && (commonParent == target.parent || commonParent == target.parent?.parent)) {
//             //     const firstChildContainingSource = commonParent?.getChildNodeContainingNodeAsDescendant(source);
//             //     const firstChildContainingTarget = commonParent?.getChildNodeContainingNodeAsDescendant(target);

//             //     if (firstChildContainingSource?.isDirectPredecessorInSortingTo(firstChildContainingTarget)) {
//             //         this.type = "sameHyperParentDirectForward";
//             //     } else if (firstChildContainingSource?.isDirectSuccessorInSortingTo(firstChildContainingTarget)) {
//             //         this.type = "sameHyperParentDirectBackward";
//             //     }
//             // }

//             if (source.isAnchor || target.isAnchor) {

//                 const firstChildContainingSource = commonParent?.getChildNodeContainingNodeAsDescendant(source);
//                 const firstChildContainingTarget = commonParent?.getChildNodeContainingNodeAsDescendant(target);

//                 if (firstChildContainingSource?.isDirectPredecessorInSortingTo(firstChildContainingTarget)) {
//                     this.type = "circleArcForward";
//                 } else if (firstChildContainingSource?.isDirectSuccessorInSortingTo(firstChildContainingTarget)) {
//                     this.type = "circleArcBackward";
//                 }
//             }

//             if (this.type == "unknown") {
//                 this.type = "differentParent";
//             }
//         }
//     }
// }


