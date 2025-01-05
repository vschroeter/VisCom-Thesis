import { Circle, Point, Segment, Shape, ShapeTag } from "2d-geometry";
import { CommunicationGraph, CommunicationNode } from "../commGraph";
import { Connection2d, Node2d } from "../graphical";
import { MouseEvents, UserInteractions } from "../visualizations/interactions";
import { CommonSettings } from "./settings/commonSettings";
import { GraphLayouterSettings } from "./settings/settings";

import * as d3 from 'd3';
import { VisGraph } from "../visGraph/visGraph";
import { LayoutNode } from "../visGraph/layoutNode";

export interface GraphLayouterConstructorArgs<T extends GraphLayouterSettings> {
    nodes: CommunicationNode[];
    settings: T;
    commGraph: CommunicationGraph;
    commonSettings: CommonSettings;
    initOnConstruction?: boolean;
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
    visGraph!: VisGraph;

    // debugShapes: Shape[] = [];

    get debugShapes(): Shape[] {
        const shapes: Shape[] = [];
        this.visGraph.allGraphicalNodes.forEach(n => {
            if (n.layoutNode.debugShapes.length > 0) {
                shapes.push(...n.layoutNode.debugShapes);
            }
        });

        this.visGraph.allGraphicalConnections.forEach(l => {
            if (l.layoutConnection.debugShapes.length > 0) {
                shapes.push(...l.layoutConnection.debugShapes);
            }
        });
        return shapes;
    }

    gParent: d3.Selection<SVGGElement | null, unknown, null, undefined> | null = null;

    get userInteractions() {
        return this.visGraph.userInteractions;
    }
    commonSettings: CommonSettings;
    // userInteractions: UserInteractions;
    // nodeScoring: NodeScoring = new NodeScoring();

    commGraph: CommunicationGraph;
    nodes: CommunicationNode[] = [];

    center: Point = new Point(0, 0);

    calculateMetrics: boolean = true;

    protected events: { [key: string]: ((this: GraphLayouter<any>) => void) } = {};

    constructor(layouterArgs: GraphLayouterConstructorArgs<T>) {
        console.log("Creating layouter", layouterArgs);
        this.commGraph = layouterArgs.commGraph;
        this.settings = layouterArgs.settings;
        this.commonSettings = layouterArgs.commonSettings;

        this.nodes = layouterArgs.nodes;

        if (layouterArgs.initOnConstruction) {
            this.resetVisGraph();
            this.initVisGraph();
        }
    }

    resetVisGraph() {
        this.visGraph = VisGraph.fromCommGraph(this.commGraph, this.commonSettings);
    }

    protected initVisGraph(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    get nodes2d(): Node2d[] {
        return this.visGraph.allGraphicalNodes;
    }

    get connections2d(): Connection2d[] {
        return this.visGraph.allGraphicalConnections;
    }

    adaptNodesByCenterTranslation() {
        this.nodes2d.forEach(node => {
            node.x += this.center.x;
            node.y += this.center.y;
        });
    }

    updateGraphByCommonSettings() {
        this.updateStyle();
    }

    updateLayout(isUpdate: boolean = false): void {
        this.initVisGraph().then(() => {
            this.updateGraphByCommonSettings();
            this.layout(isUpdate);
            // this.emitEvent("update");
        });
        // this.layout(isUpdate);
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

    reset() {
        this.nodes2d.forEach(node => {
            node.x = 0;
            node.y = 0;
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
    // #region D3 Selection methods
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
    // #region Render methods
    ////////////////////////////////////////////////////////////////////////////



    updateStyle() {
        this.visGraph.updateGraphicalStyle();
        return;
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

        this.renderNodes(this.selectGroup('nodes'), events?.nodesEvents);
        this.renderLinks(this.selectGroup('links'), events?.linksEvents);
        this.renderLabels(this.selectGroup('labels'), events?.labelsEvents);
        this.renderDebuggingShapes(parent);
    }

    renderNodes(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>, events?: MouseEvents<Node2d>) {
        // Get the current classname of this object
        const className = this.constructor.name.toLowerCase();

        const nodes = selection.selectChildren('g.node')
            .data<Node2d>(this.visGraph.allGraphicalNodes, (d, i, g) => {
                return (d as Node2d).id;
            })
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
            .data<Connection2d>(this.visGraph.allGraphicalConnections, (d, i, g) => {
                return (d as Connection2d).id;
            })
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
            .data<Node2d>(this.visGraph.allGraphicalNodes.filter(n => n.layoutNode.showLabel), (d, i, g) => {
                return (d as Node2d).id;
            })
            .join('text')
            // .attr('x', (d: Node2d) => {
            //     return d.x;            
            // })
            // .attr('y', (d: Node2d) => d.y + d.radius * 0.1)
            // .attr('text-anchor', (d: Node2d) => {
            //     return "middle";
            // })
            .attr('dominant-baseline', (d: Node2d) => {
                return "middle";
            })
            // .attr("stroke", "white")
            // .attr("stroke-width", (d: Node2d) => Math.min(0.5, d.radius * 0.01))
            .attr('x', (d: Node2d) => {

                const translationRelativeToParent = d.layoutNode.translationRelativeToParent;
                if (translationRelativeToParent.x > 0) {
                    return d.x + d.radius * 1.1;
                }
                return d.x - d.radius * 1.1;
            })
            .attr('y', (d: Node2d) => d.y)
            .attr('text-anchor', (d: Node2d) => {
                const translationRelativeToParent = d.layoutNode.translationRelativeToParent;
                if (translationRelativeToParent.x > 0) {
                    return "start";
                }
                return "end";
            })
            .text((d: Node2d) => d.id ?? "")
            .attr("font-size", (d: Node2d) => `${Math.min(20, d.layoutNode.radius * 2 * 0.6)}px`)
            .attr("opacity", (d: Node2d) => {
                return d.opacity;
            })
        // .attr("font-size", (d: Node2d) => `${(d.layoutNode.parent?.sizeFactor ?? 1)}rem`)

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