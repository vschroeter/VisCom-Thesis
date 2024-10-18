import { CommunicationGraph, CommunicationNode, NodeToNodeConnection } from "../commGraph";
import { Connection2d, Node2d, Point2D } from "../graphical";
import { Graph2d } from "../graphical/Graph2d";
import { MouseEvents, UserInteractions } from "../visualizations/interactions";
import { CommonSettings } from "./settings/commonSettings";
import { GraphLayouterSettings } from "./settings/settings";

import * as d3 from 'd3';

export interface GraphLayouterArgs<T extends GraphLayouterSettings> {
    // nodes: Node2d[];
    nodes: CommunicationNode[];
    // links: Connection2d[];
    settings: T;
    commGraph: CommunicationGraph;
    commonSettings: CommonSettings;
    userInteractions: UserInteractions;
}

export class GraphLayouter<T extends GraphLayouterSettings> {

    settings: T;
    commonSettings: CommonSettings;
    userInteractions: UserInteractions;
    commGraph: CommunicationGraph;
    graph2d: Graph2d;
    nodes: CommunicationNode[] = [];

    center: Point2D = new Point2D(0, 0);

    // nodes: Node2d[] = [];
    // links: Connection2d[] = [];
    calculateMetrics: boolean = true;

    protected events: { [key: string]: ((this: GraphLayouter<any>) => void) } = {};

    constructor(layouterArgs: GraphLayouterArgs<T>) {
        this.commGraph = layouterArgs.commGraph;
        this.settings = layouterArgs.settings;
        // this.graph2d = new Graph2d(this.commGraph);
        this.commonSettings = layouterArgs.commonSettings;
        this.userInteractions = layouterArgs.userInteractions;
        this.nodes = layouterArgs.nodes;
        // this.links = layouterArgs.links;

        this.graph2d = Graph2d.createFromCommNodes(this.commGraph, this.nodes, this);
    }

    get nodes2d(): Node2d[] {
        return this.graph2d.nodes;
    }

    get connections2d(): Connection2d[] {
        return this.graph2d.links;
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
        this.nodes2d.forEach(node => {
            node.radius = this.commonSettings.nodeSize.getValue(node) ?? 10;
        });
    }

    updateLayout(isUpdate: boolean = false): void {
        this.updateGraphByCommonSettings();
        this.layout(isUpdate);
    }

    layout(isUpdate = false): void {
        throw new Error("Method not implemented.");
    }

    getFilteredLinks() {
        console.log("Filtering links", this.commonSettings.hideLinksThreshold.getValue());
        const filteredLinks = this.graph2d.links.filter(l => {
            const weight = l.data?.weight ?? 1;
            return weight > (this.commonSettings.hideLinksThreshold.getValue() ?? 0.25);
        })
        // console.log("Filtered links", filteredLinks);
        return filteredLinks;
    }

    reset() {
        this.nodes2d.forEach(node => {
            node.x = 0;
            node.y = 0;
            node.vx = 0;
            node.vy = 0;
            node.fx = null;
            node.fy = null;
        });

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
    // Render methods
    ////////////////////////////////////////////////////////////////////////////

    selectGroup(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>, className: string) {        
        selection.selectAll(`g.${className}`).data([0]).join("g").classed(className, true);
        return selection.select<SVGGElement | null>(`g.${className}`);
    }

    renderAll(selection: d3.Selection<SVGGElement | any, any, any, any>, events?: {
        nodesEvents?: MouseEvents<Node2d>,
        linksEvents?: MouseEvents<Node2d>,
        labelsEvents?: MouseEvents<Node2d>
    }) {
        this.renderLinks(this.selectGroup(selection, 'links'), events?.linksEvents);
        this.renderNodes(this.selectGroup(selection, 'nodes'), events?.nodesEvents);
        this.renderLabels(this.selectGroup(selection, 'labels'), events?.labelsEvents);
    }

    renderNodes(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>, events?: MouseEvents<Node2d>) {
        const communitiesColorScheme = d3.interpolateSinebow;
        const nodeRankingColorScheme = d3.interpolateRdYlGn;

        const scoreExtent = d3.extent(this.nodes, d => d.score) as [number, number];

        const nodes = selection.selectAll('circle')
            .data(this.graph2d.nodes)
            .join('circle')
            .attr('cx', (d: Node2d) => d.x)
            .attr('cy', (d: Node2d) => d.y)
            .attr('r', d => d.radius)
            // .attr('fill', d => this.commonSettings.nodeColor.getValue(d) ?? "red")
            .attr('fill', d => {
                if (!d.filled) {
                    return 'none';
                }

                if (Math.abs(scoreExtent[0]) == Infinity || Math.abs(scoreExtent[1]) == Infinity || scoreExtent[0] == scoreExtent[1]) {
                    return this.commonSettings.nodeColor.getValue(d) ?? "red";
                }

                const scale = d3.scaleLinear().domain(scoreExtent).range([0, 1]);

                return nodeRankingColorScheme(scale(d.score));

            })
            .attr('stroke', d => {

                const color = d.stroke ?? "white";

                if (!d.communities) {
                    return color;
                }

                const communities = d.communities.getCommunitiesOfNode(d.id);

                if (communities.length === 0) {
                    return color;
                }

                const totalCommunityCount = d.communities.countOfCommunities;
                if (totalCommunityCount === 0) {
                    return color;
                }

                const colors = communities.map(community => {
                    const positionOfNodeCommunity = community / totalCommunityCount;
                    return d3.hsl(communitiesColorScheme(positionOfNodeCommunity));
                });

                // console.log(colors);
                // Get the average color of all communities
                const averageColor = d3.hsl(d3.mean(colors, c => c.h)!, d3.mean(colors, c => c.s)!, d3.mean(colors, c => c.l)!);
                return averageColor.formatRgb();

                // // Position on color scheme between 0 and 1
                // const positionOfNodeCommunity = communities[0] / totalCommunityCount;

                // return communitiesColorScheme(positionOfNodeCommunity);
            })
            .attr('stroke-width', d => d.strokeWidth)
            .attr('stroke-opacity', d => d.strokeOpacity ?? 1)
            .attr('opacity', d => {

                if (this.userInteractions.somethingIsSelectedOrFocusedOrHovered) {

                    // if (this.userInteractions.)) {
                    //     return 1;
                    // }

                    if (this.userInteractions.isHovered(d)) {
                        return 1;
                    }

                    return 0.2;
                }

                return 1;

            })
        // .on('mouseenter', (e, d) => {
        //     console.log("Mouse enter", d, e);
        // })

        if (events?.click) nodes.on("click", (e, d) => events.click?.(d, e))
        if (events?.mouseleave) nodes.on("mouseleave", (e, d) => events.mouseleave?.(d, e))
        if (events?.mouseenter) nodes.on("mouseenter", (e, d) => events.mouseenter?.(d, e))
    }

    renderLinks(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>, events?: MouseEvents<Node2d>) {

        const weightOfLink = (l: Connection2d) => {
            return l.data?.weight ?? 1;
        }

        const opacityGetter = (d: Connection2d) => {
            const weight = weightOfLink(d);
            // const adaptedWeight = Math.max(0.2, Math.sqrt(weight));
            const adaptedWeight = Math.max(0.05, weight);
            if (this.userInteractions.somethingIsSelectedOrFocusedOrHovered) {

                const startNode = d.source;
                const endNode = d.target;
                // if (this.userInteractions.)) {
                //     return 1;
                // }

                if (this.userInteractions.isHovered(startNode) || this.userInteractions.isHovered(endNode)) {
                    return 1;
                }

                return 0.4 * adaptedWeight;
            }

            return adaptedWeight;
        }


        const getWidth = (l: Connection2d) => {
            const minW = 0.1;
            const maxW = 3;
            const wMultiplier = 2;
            // const weight = NodeToNodeConnection.getCombinedWeight(this.commGraph.getConnectionsBetweenNodes(l.source.data?.id, l.target.data?.id));
            const weight = weightOfLink(l);

            return Math.min(maxW, Math.max(minW, weight * wMultiplier));
        }

        // TODO: Rendering is done twice on user interaction

        const filteredLinks = this.getFilteredLinks();

        selection.selectAll('path.arrow')
            // .data(this.graph2d?.links)
            .data(filteredLinks)
            .join('path')
            .classed('arrow', true)
            .attr('d', (d: Connection2d) => d.getArrowPath())
            .attr('stroke', (l) => this.commonSettings.linkColor.getValue(l) ?? "black")
            .attr('stroke-width', (l) => {
                return getWidth(l);
            })
            .attr('fill', 'none')
            .attr('opacity', opacityGetter)

        selection.selectAll('path.link')
            // .data(this.graph2d?.links)
            .data(filteredLinks)
            .join('path')
            .classed('link', true)
            .attr('d', (d: Connection2d) => d.getSvgPath())
            .attr('stroke', (l) => this.commonSettings.linkColor.getValue(l) ?? "black")
            .attr('stroke-width', (l) => {
                return getWidth(l);
            })
            .attr('fill', 'none')
            .attr('opacity', opacityGetter)

    }

    renderLabels(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>, events?: MouseEvents<Node2d>) {
        selection.selectAll('text')
            .data(this.graph2d.nodes)
            .join('text')
            .attr('x', (d: Node2d) => d.x + 10)
            .attr('y', (d: Node2d) => d.y)
            .text((d: Node2d) => d.data?.id ?? "")
    }
}