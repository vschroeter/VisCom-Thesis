import { Point, Vector } from "2d-geometry";
import { CommunicationChannel, CommunicationGraph, CommunicationLink, CommunicationNode, CommunicationTopic } from "../commGraph";
import { CommonSettings } from "../layouter/settings/commonSettings";

import * as d3 from "d3";
import { VisGraph } from "./visGraph";
import { LayoutConnection } from "./layoutConnection";
import { Sorter } from "../algorithms/sortings/sorting";
import { BasicPrecalculator } from "./layouterComponents/precalculator";
import { BasePositioner } from "./layouterComponents/positioner";
import { LineConnector } from "./layouterComponents/connector";
import { Anchor, Node2d } from "../graphical";


export class LayoutNode {

    // Reference to the vis graph
    visGraph: VisGraph;

    // The id of the node
    id: string;

    // The related communication node. Hypernodes with child nodes do not have a single related communication node.
    commNode?: CommunicationNode;

    // Parent node, if any
    parent?: LayoutNode;

    // Child nodes, if any
    children: LayoutNode[] = [];

    // Type of VisNode (TODO: Maybe we dont need this or make it more flexible)
    nodeType: "normal" | "community" | "stronglyCoupled" | "broadcasting" | "similarConnections" = "normal";

    // successorNodes: VisNode[] = [];
    // predecessorNodes: VisNode[] = [];

    // TODO: Associated nodes (somehow, we have to store e.g. duplicated nodes, that are related to this node)
    associatedNodes: LayoutNode[] = [];


    // If the node is finished with the layouting process
    layouted: boolean = false;

    // If the node's size has already been calculated
    // sizeCalculated: boolean = false;

    // The precalculator for the node (e.g. for calculating the size of the node)
    precalculator?: BasicPrecalculator;

    // The positioner for the node (for positioning the children of the node during the layouting process)
    positioner?: BasePositioner;

    // The sorter for the node (for sorting the children of the node before layouting)
    sorter?: Sorter;

    // The connector for the node
    connector?: LineConnector;

    // // List of connections, that are waiting for this node to be layouted
    // connectionsWaitingForLayout: VisConnection[] = [];

    // Outgoing connections to other nodes
    outConnections: LayoutConnection[] = [];
    // Incoming connections from other nodes
    inConnections: LayoutConnection[] = [];

    // The layer of the node (for layered layouting). Leaf nodes have layer 0.
    // layer: number = 0;





    constructor(graph: VisGraph, id: string) {
        this.visGraph = graph;
        this.id = id;
    }


    ////////////////////////////////////////////////////////////////////////////
    // Information about the node
    ////////////////////////////////////////////////////////////////////////////

    // The score of the node (e.g. for ranking the significance of nodes)
    score: number = 0;

    get inDegree(): number {
        return this.inConnections.length;
    }

    get outDegree(): number {
        return this.outConnections.length;
    }

    get degree(): number {
        return this.inDegree + this.outDegree;
    }

    get successorCount(): number {
        // return this.successorNodes.length;
        return this.getSuccessors().length;
    }

    get predecessorCount(): number {
        // return this.predecessorNodes.length;
        return this.getPredecessors().length;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Position and size of the node
    ////////////////////////////////////////////////////////////////////////////
    /**
     * The radius should be calculated by the precalculator or the layouter during the layouting process, based on the score and children of the node.
     */
    radius: number = 0;


    center: Point = new Point(0, 0);
    get x(): number { return this.center.x; }
    get y(): number { return this.center.y; }
    set x(x: number) { this.center.x = x; }
    set y(y: number) { this.center.y = y; }

    ////////////////////////////////////////////////////////////////////////////
    // Connection methods
    ////////////////////////////////////////////////////////////////////////////

    getBidirectionalConnections(channels?: CommunicationChannel[]): LayoutConnection[] {
        return this.outConnections.filter(c => c.opposite !== undefined);
    }

    getOutgoingConnections(channels?: CommunicationChannel[]): LayoutConnection[] {
        return this.outConnections;
    }

    getIncomingConnections(channels?: CommunicationChannel[]): LayoutConnection[] {
        return this.inConnections;
    }

    // TODO: Channel einbauen
    getSuccessors(channels?: CommunicationChannel[]): LayoutNode[] {
        // if (channels) {
        //     const channelTypes = channels.map(c => c.type);
        //     return this.outConnections.filter(c => c.links.some(l => channelTypes.include(l.channel.type))).map(c => c.target);
        // }
        return this.outConnections.map(c => c.target);
    }

    getPredecessors(channels?: CommunicationChannel[]): LayoutNode[] {
        return this.inConnections.map(c => c.source);
    }


    ////////////////////////////////////////////////////////////////////////////
    // Anchor methods
    ////////////////////////////////////////////////////////////////////////////


    /**
     * Get the anchor of the node directed towards a given point
     * @param point The point, towards which the anchor should be directed
     */
    getAnchor(point: Point): Anchor;
    /**
     * Get the anchor of the node directed towards a given vector
     * @param vector The vector originating from the node's center, towards which the anchor should be directed
     */
    getAnchor(vector: Vector): Anchor;
    getAnchor(param: Point | Vector): Anchor {

        // TODO: This is for round nodes only

        let vector: Vector | null = null;
        if (param instanceof Point) {
            vector = new Vector(param.x - this.center.x, param.y - this.center.y);
        } else if (param instanceof Vector) {
            vector = param;
        }

        if (!vector) {
            throw new Error("Invalid parameter type");
        }

        // For the abstract circle node, the direction is the same as the vector
        // The anchor point is the intersection of the circle and the vector

        const direction = vector;
        // console.log('[NODE] getAnchor', direction, this);
        let anchorPoint: Point;
        if (direction.length == 0) {
            anchorPoint = this.center;
        } else {
            anchorPoint = this.center.translate(direction.normalize().multiply(this.radius));
        }
        return new Anchor(anchorPoint, direction);

    }



    ////////////////////////////////////////////////////////////////////////////
    // Layouting methods
    ////////////////////////////////////////////////////////////////////////////

    precalculate(precalculator?: BasicPrecalculator) {
        const _precalculator = precalculator ?? this.precalculator;
        _precalculator?.precalculate(this, this.visGraph);
    }

    sortChildren(sorter?: Sorter) {
        if (this.children.length == 0) return;

        const _sorter = sorter ?? this.sorter;
        if (!_sorter) {
            return;
        }

        this.children = _sorter.getSorting(this.children);
    }

    positionChildren(positioner?: BasePositioner) {
        if (this.children.length == 0) return;

        const _positioner = positioner ?? this.positioner;
        _positioner?.positionChildren(this);
    }

    connectChildren(connector?: LineConnector) {
        if (this.children.length == 0) return;

        const _connector = connector ?? this.connector;
        if (!_connector) {
            return;
        }

    }

    // layout() {
    //     // TODO: verschiedene Precalculator erlauben

    //     if (this.children.length > 0) {

    //         // If a sorter is defined, we sort the children first
    //         if (this.sorter) {
    //             this.children = this.sorter.getSorting(this.children);
    //         }

    //         // If the node has children, we have to layout them first
    //         this.children.forEach(child => {
    //             child.layout();
    //         });

    //         // After the children are finished, we can layout this node
    //         this.positioner?.positionChildren(this);
    //     }

    //     // Calculate the size of the node (only important for child nodes)
    //     this.precalculator?.precalculate(this, this.visGraph);

    //     this.layouted = true;
    // }

    ////////////////////////////////////////////////////////////////////////////
    // Rendering methods
    ////////////////////////////////////////////////////////////////////////////

    node2d: Node2d | undefined;

    createGraphicalElements() {
        if (!this.node2d) {
            this.node2d = new Node2d(this);
        }

        this.outConnections.forEach(connection => {
            connection.createGraphicalElements();
        });
    }

    updateGraphicalLayout() {

        this.node2d?.updatePositionAndSize(this.center.x, this.center.y, this.radius);
        // this.node2d?.update();

    }

}
