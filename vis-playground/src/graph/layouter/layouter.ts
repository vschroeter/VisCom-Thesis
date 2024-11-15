import { Circle, Point, Segment, Shape, ShapeTag } from "2d-geometry";
import { CommunicationGraph, CommunicationNode, NodeToNodeConnection } from "../commGraph";
import { Connection2d, Node2d } from "../graphical";
import { Graph2d } from "../graphical/Graph2d";
import { MouseEvents, UserInteractions } from "../visualizations/interactions";
import { CommonSettings } from "./settings/commonSettings";
import { GraphLayouterSettings } from "./settings/settings";

import * as d3 from 'd3';
import { VisGraph } from "../visGraph/visGraph";
import { LayoutNode } from "../visGraph/layoutNode";

export interface GraphLayouterConstructorArgs<T extends GraphLayouterSettings> {
    // nodes: Node2d[];
    nodes: CommunicationNode[];
    // links: Connection2d[];
    settings: T;
    commGraph: CommunicationGraph;
    commonSettings: CommonSettings;
    userInteractions: UserInteractions;
}

export class RenderArgs {
    commonSettings: CommonSettings;
    userInteractions: UserInteractions;
    nodeScoring: NodeScoring;
    nodeFillColorGetter: (n: LayoutNode) => string;

    constructor(commonSettings: CommonSettings, userInteractions: UserInteractions, nodeScoring: NodeScoring, nodeFillColorGetter: (n: LayoutNode) => string) {
        this.commonSettings = commonSettings;
        this.userInteractions = userInteractions;
        this.nodeScoring = nodeScoring;
        this.nodeFillColorGetter = nodeFillColorGetter;
    }
}

export class NodeScoring {
    extent: [number, number] = [0, 0];
    colorScheme: (t: number) => string = d3.interpolateRdYlGn;

    getColor(value: number) {
        if (!this.isExtentValid()) {
            return "red";
        }

        const scale = d3.scaleLinear().domain(this.extent).range([0, 1]);
        return this.colorScheme(scale(value));
    }

    getExtent(nodes: Node2d[]) {
        this.extent = d3.extent(nodes, d => d.score) as [number, number];
    }

    isExtentValid() {
        return this.extent[0] !== this.extent[1] && Math.abs(this.extent[0]) !== Infinity && Math.abs(this.extent[1]) !== Infinity;
    }
}

export class GraphLayouter<T extends GraphLayouterSettings> {

    settings: T;
    // graph2d: Graph2d;
    visGraph: VisGraph;

    debugShapes: Shape[] = [];

    gParent: d3.Selection<SVGGElement | null, unknown, null, undefined> | null = null;

    renderArgs: RenderArgs;
    get commonSettings() {
        return this.renderArgs.commonSettings;
    }
    get userInteractions() {
        return this.renderArgs.userInteractions;
    }
    // commonSettings: CommonSettings;
    // userInteractions: UserInteractions;
    // nodeScoring: NodeScoring = new NodeScoring();

    commGraph: CommunicationGraph;
    nodes: CommunicationNode[] = [];

    center: Point = new Point(0, 0);

    // nodes: Node2d[] = [];
    // links: Connection2d[] = [];
    calculateMetrics: boolean = true;

    protected events: { [key: string]: ((this: GraphLayouter<any>) => void) } = {};

    constructor(layouterArgs: GraphLayouterConstructorArgs<T>) {
        this.commGraph = layouterArgs.commGraph;
        this.settings = layouterArgs.settings;
        // this.graph2d = new Graph2d(this.commGraph);
        this.renderArgs = new RenderArgs(
            layouterArgs.commonSettings,
            layouterArgs.userInteractions,
            new NodeScoring(),
            (n) => layouterArgs.commonSettings.nodeColor.getValue(n)?.toString() ?? "red");
        // this.commonSettings = layouterArgs.commonSettings;
        // this.userInteractions = layouterArgs.userInteractions;
        this.nodes = layouterArgs.nodes;
        // this.links = layouterArgs.links;

        this.visGraph = VisGraph.fromCommGraph(this.commGraph, layouterArgs.commonSettings, this.userInteractions);

        // this.graph2d = Graph2d.createFromCommNodes(this.commGraph, this.nodes, this);
    }

    get nodes2d(): Node2d[] {
        // return this.graph2d.nodes;
        return this.visGraph.allGraphicalNodes;
    }

    get connections2d(): Connection2d[] {
        // return this.graph2d.links;
        return this.visGraph.allGraphicalConnections;
    }

    adaptNodesByCenterTranslation() {
        this.nodes2d.forEach(node => {
            node.x += this.center.x;
            node.y += this.center.y;
        });
    }

    createGraph2d() {
        return new Graph2d(this);
    }

    updateGraphByCommonSettings() {
        // this.nodes2d.forEach(node => {
        //     node.radius = this.commonSettings.nodeSize.getValue(node) ?? 10;
        // });
        this.updateStyle();
    }

    updateLayout(isUpdate: boolean = false): void {
        this.updateGraphByCommonSettings();
        // this.updateStyle();
        this.layout(isUpdate);
    }

    protected markConnectionsAsUpdateRequired() {
        this.connections2d.forEach(link => {
            link.requireUpdate();
        });
    }

    protected markNodesAsUpdateRequired() {
        this.nodes2d.forEach(node => {
            node.requireUpdate();
        });
    }

    layout(isUpdate = false): void {
        throw new Error("Method not implemented.");
    }

    getFilteredLinks() {
        // Filtering already done at initialization 
        // return this.graph2d.links;
        return this.visGraph.allGraphicalConnections;
        // console.log("Filtering links", this.commonSettings.hideLinksThreshold.getValue());
        // const filteredLinks = this.graph2d.links.filter(l => {
        //     const weight = l.data?.weight ?? 1;
        //     return weight > (this.commonSettings.hideLinksThreshold.getValue() ?? 0.25);
        // })
        // // console.log("Filtered links", filteredLinks);
        // return filteredLinks;
    }

    reset() {
        this.nodes2d.forEach(node => {
            node.x = 0;
            node.y = 0;
            // node.vx = 0;
            // node.vy = 0;
            // node.fx = null;
            // node.fy = null;
        });
        this.updateStyle();
        this.layout();
    }

    protected emitEvent(type: "update" | "end") {
        if (this.events[type]) {
            this.events[type].call(this);
        }
    }

    on(typenames: "update" | "end", listener: null | ((this: GraphLayouter<any>) => void)) {
        if (listener == null) {
            delete this.events[typenames];
            return;
        } else {
            this.events[typenames] = listener;
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // D3 Selection methods
    ////////////////////////////////////////////////////////////////////////////

    selectGroup(className: string) {
        const selector = `g.${className}`
        const parent = this.gParent;
        if (!parent) {
            throw new Error("Parent group not set");
        }
        parent.selectChildren(selector).data([0]).join("g").classed(className, true);
        return parent.select<SVGGElement | null>(selector);
    }

    setParentGroup(group: d3.Selection<any, any, any, any>) {
        this.gParent = group;
    }



    ////////////////////////////////////////////////////////////////////////////
    // Render methods
    ////////////////////////////////////////////////////////////////////////////



    updateStyle() {
        this.visGraph.updateGraphicalStyle();
        return;
        // Get the node score extent
        const scoring = this.renderArgs.nodeScoring;
        scoring.extent = d3.extent(this.nodes2d, d => d.score) as [number, number];
        const validScores = scoring.isExtentValid();

        // Set the score colors of the nodes
        this.nodes2d.forEach(node => {
            // node.updateStyleFill((n) => this.commonSettings.nodeColor.getValue(n), this.nodeScoring.extent);

            if (!validScores) {
                const v = this.commonSettings.nodeColor.getValue(node.layoutNode)?.toString() ?? "red";
                node.updateStyleFill(v);
                return;
            }

            node.updateStyleFill(scoring.getColor(node.score));
        })

        // Update the node stroke based on the communities
        this.nodes2d.forEach(node => {
            if (!node.communities) {
                return;
            }

            const communities = node.communities.getCommunitiesOfNode(node.id);

            if (communities.length === 0) {
                return;
            }

            const totalCommunityCount = node.communities.countOfCommunities;
            if (totalCommunityCount === 0) {
                return;
            }

            const colors = communities.map(community => {
                const positionOfNodeCommunity = community / totalCommunityCount;
                return d3.hsl(d3.interpolateSinebow(positionOfNodeCommunity));
            });

            // Get the average color of all communities
            const averageColor = d3.hsl(d3.mean(colors, c => c.h)!, d3.mean(colors, c => c.s)!, d3.mean(colors, c => c.l)!);
            node.updateStyleStroke(averageColor.formatRgb());
        })

        // Update the opacities based on the user interactions
        const userInteractions = this.userInteractions;
        this.nodes2d.forEach(node => {
            let opacity = 1;
            if (userInteractions.somethingIsSelectedOrFocusedOrHovered) {
                if (userInteractions.isHovered(node)) {
                    opacity = 1;
                } else {
                    opacity = 0.2;
                }
            }
            node.updateStyleOpacity(opacity);
        })

        // Update the links opacity based on the user interactions and
        // the width based on the weight

        const minW = 0.1;
        const maxW = 5;
        const wMultiplier = 2;

        const stroke = this.commonSettings.linkColor.getValue()?.toString() ?? "black";
        const strokeWithoutAlpha = d3.color(stroke)?.copy({ opacity: 1 })?.toString() ?? "black";
        const alpha = d3.color(stroke)?.opacity ?? 1;

        this.connections2d.forEach(link => {
            const weight = link.weight;
            let opacity = Math.min(Math.max(0.01, weight), 1) * alpha;
            const width = Math.min(maxW, Math.max(minW, weight * wMultiplier));

            if (userInteractions.somethingIsSelectedOrFocusedOrHovered) {
                const startNode = link.source;
                const endNode = link.target;

                if (userInteractions.isHovered(startNode) || userInteractions.isHovered(endNode)) {
                    opacity = alpha;
                } else {
                    opacity *= 0.2;
                }
            }
            link.updateStyleOpacity(opacity);
            link.updateStyleStroke(strokeWithoutAlpha, width);
        })
    }



    renderAll(events?: {
        nodesEvents?: MouseEvents<Node2d>,
        linksEvents?: MouseEvents<Connection2d>,
        labelsEvents?: MouseEvents<Node2d>
    }) {
        if (!this.gParent) {
            throw new Error("Parent group not set");
        }

        const parent = this.gParent;

        this.renderLinks(this.selectGroup('links'), events?.linksEvents);
        this.renderNodes(this.selectGroup('nodes'), events?.nodesEvents);
        this.renderLabels(this.selectGroup('labels'), events?.labelsEvents);
        this.renderDebuggingShapes(parent);
    }

    renderNodes(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>, events?: MouseEvents<Node2d>) {
        // Get the current classname of this object
        const className = this.constructor.name.toLowerCase();
        // console.log("Render nodes", className, selection, selection.selectChildren('g.node').size(), this.graph2d.nodes);

        const nodes = selection.selectChildren('g.node')
            .data(this.visGraph.allGraphicalNodes)
            .join(
                // enter => enter.append('g').classed('node', true).call(d => d.datum().enter(d)),
                enter => enter.append('g').classed('node', true).each((d, i, g) => {
                    // console.log("Enter", d, i, g);
                    d.enter(d3.select(g[i]));
                }),
                // update => update.call(d => d.datum().update(d)),
                update => update.each((d, i, g) => {
                    // console.log("Update", d, i, g);
                    d.update(d3.select(g[i]));
                }),
                // exit => exit.call(d => d.datum().exit(d))                
                exit => exit.each((d, i, g) => {
                    // console.log("Exit", d, i, g);
                    d.exit(d3.select(g[i]));
                })
            )

        if (events?.click) nodes.on("click", (e, d) => events.click?.(d, e))
        if (events?.mouseleave) nodes.on("mouseleave", (e, d) => events.mouseleave?.(d, e))
        if (events?.mouseenter) nodes.on("mouseenter", (e, d) => events.mouseenter?.(d, e))
    }

    renderLinks(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>, events?: MouseEvents<Connection2d>) {

        const links = selection.selectChildren('g.link')
            .data(this.visGraph.allGraphicalConnections)
            .join(
                // enter => enter.append('g').classed('node', true).call(d => d.datum().enter(d)),
                enter => enter.append('g').classed('link', true).each((d, i, g) => {
                    // console.log("Enter", d, i, g);
                    d.enter(d3.select(g[i]));
                }),
                // update => update.call(d => d.datum().update(d)),
                update => update.each((d, i, g) => {
                    d.update(d3.select(g[i]));
                }),
                // exit => exit.call(d => d.datum().exit(d))                
                exit => exit.each((d, i, g) => {
                    d.exit(d3.select(g[i]));
                })
            )


        if (events?.click) links.on("click", (e, d) => events.click?.(d, e))
        if (events?.mouseleave) links.on("mouseleave", (e, d) => events.mouseleave?.(d, e))
        if (events?.mouseenter) links.on("mouseenter", (e, d) => events.mouseenter?.(d, e))
    }

    renderLabels(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>, events?: MouseEvents<Node2d>) {
        selection.selectChildren('text')
            .data(this.visGraph.allGraphicalNodes)
            .join('text')
            .attr('x', (d: Node2d) => d.x + 10)
            .attr('y', (d: Node2d) => d.y)
            .text((d: Node2d) => d.id ?? "")
    }

    renderDebuggingShapes(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>) {
        selection.selectChildren('g.debug')
            .data(this.debugShapes)
            .join('g').classed('debug', true)
            .each((shape, i, g) => {
                const d = d3.select(g[i]);
                d.selectChildren('*').remove();

                switch (shape.tag) {
                    // case ShapeTag.Segment: {
                    //     drawSegment(shape as Segment); break
                    // }
                    case ShapeTag.Circle: {
                        const c = shape as Circle;
                        d.append('circle')
                            .attr('cx', c.center.x)
                            .attr('cy', c.center.y)
                            .attr('r', c.r)
                            .attr('fill', 'none')
                            .attr('stroke', c._data?.stroke ?? 'blue')
                            .attr('stroke-width', 0.25)

                        break;
                    }
                    case ShapeTag.Segment: {
                        d.append('line')
                            .attr('x1', (shape as Segment).start.x)
                            .attr('y1', (shape as Segment).start.y)
                            .attr('x2', (shape as Segment).end.x)
                            .attr('y2', (shape as Segment).end.y)
                            .attr('stroke', shape._data?.stroke ?? 'green')
                            .attr('stroke-width', 0.25)

                        break;
                    }
                    case ShapeTag.Point: {
                        const p = shape as Point;
                        d.append('circle')
                            .attr('cx', p.x)
                            .attr('cy', p.y)
                            .attr('r', 0.5)
                            .attr('fill', p._data?.fill ?? 'green')
                            .attr('stroke', 'none')
                        break;
                    }
                }

            })
    }
}