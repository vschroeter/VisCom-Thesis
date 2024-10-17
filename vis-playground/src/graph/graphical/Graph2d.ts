import { CommunicationGraph, CommunicationLink, CommunicationNode } from "../commGraph";
import { GraphLayouter } from "../layouter/layouter";
import { GraphLayouterSettings } from "../layouter/settings/settings";
import { MouseEvents } from "../visualizations/interactions";
import { Connection2d, Connection2dData } from "./Connection2d";
import { Node2d } from "./Node2d";

import * as d3 from 'd3';

export class Graph2d {

    layouter?: GraphLayouter<GraphLayouterSettings>;

    nodes: Node2d[] = [];
    links: Connection2d[] = [];
    // labels: AbstractLabel2d[] = [];

    mapIdToNode2d: Map<string, Node2d> = new Map();

    constructor(layouter?: GraphLayouter<GraphLayouterSettings>) {
        this.layouter = layouter;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Static graph creation methods
    ////////////////////////////////////////////////////////////////////////////

    static createEmptyGraph(): Graph2d {
        return new Graph2d();
    }

    static createFromCommGraph(commGraph: CommunicationGraph, layouter?: GraphLayouter<any>): Graph2d {
        return this.createFromCommNodes(commGraph, commGraph.nodes, layouter);
    }

    static createFromCommNodes(commGraph: CommunicationGraph, commNodes: CommunicationNode[], layouter?: GraphLayouter<any>): Graph2d {
        const graph = new Graph2d(layouter);

        // Create nodes
        commNodes.forEach(node => graph.createNode2d(node));

        // Create links
        commGraph.getAllInternalLinksOfNodes(commNodes).forEach(link => graph.createLink2d(link));

        return graph;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Render methods
    ////////////////////////////////////////////////////////////////////////////


    renderNodes(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>, events?: MouseEvents<Node2d>) {
        const communitiesColorScheme = d3.interpolateSinebow;
        const nodeRankingColorScheme = d3.interpolateRdYlGn;

        const scoreExtent = d3.extent(this.nodes, d => d.score) as [number, number];

        const nodes = selection.selectAll('circle')
            .data(this.nodes)
            .join('circle')
            .attr('cx', (d: Node2d) => d.x)
            .attr('cy', (d: Node2d) => d.y)
            .attr('r', d => d.radius)
            // .attr('fill', d => this.commonSettings.nodeColor.getValue(d) ?? "red")
            .attr('fill', d => {
                if (Math.abs(scoreExtent[0]) == Infinity || Math.abs(scoreExtent[1]) == Infinity || scoreExtent[0] == scoreExtent[1]) {
                    return this.layouter?.commonSettings.nodeColor.getValue(d) ?? "red";
                }

                const scale = d3.scaleLinear().domain(scoreExtent).range([0, 1]);

                return nodeRankingColorScheme(scale(d.score));

            })
            // .attr('stroke', 'white')
            .attr('stroke', d => {

                if (!d.communities) {
                    return 'white';
                }

                const communities = d.communities.getCommunitiesOfNode(d.id);

                if (communities.length === 0) {
                    return 'white';
                }

                const totalCommunityCount = d.communities.countOfCommunities;
                if (totalCommunityCount === 0) {
                    return 'white';
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
            .attr('stroke-width', 2)
            .attr('opacity', d => {

                if (this.layouter?.userInteractions.somethingIsSelectedOrFocusedOrHovered) {

                    // if (this.userInteractions.)) {
                    //     return 1;
                    // }

                    if (this.layouter?.userInteractions.isHovered(d)) {
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

        const layouter = this.layouter;

        if (layouter == undefined) {
            return;
        }

        const weightOfLink = (l: Connection2d) => {
            return l.data?.weight ?? 1;
        }

        const opacityGetter = (d: Connection2d) => {
            const weight = weightOfLink(d);
            // const adaptedWeight = Math.max(0.2, Math.sqrt(weight));
            const adaptedWeight = Math.max(0.05, weight);
            if (layouter?.userInteractions.somethingIsSelectedOrFocusedOrHovered) {

                const startNode = d.source;
                const endNode = d.target;
                // if (this.userInteractions.)) {
                //     return 1;
                // }

                if (layouter.userInteractions.isHovered(startNode) || layouter.userInteractions.isHovered(endNode)) {
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

        selection.selectAll('path.arrow')
            // .data(this.graph2d?.links)
            .data(layouter.getFilteredLinks())
            .join('path')
            .classed('arrow', true)
            .attr('d', (d: Connection2d) => d.getArrowPath())
            .attr('stroke', (l) => layouter.commonSettings.linkColor.getValue(l) ?? "black")
            .attr('stroke-width', (l) => {
                return getWidth(l);
            })
            .attr('fill', 'none')
            .attr('opacity', opacityGetter)

        selection.selectAll('path.link')
            // .data(this.graph2d?.links)
            .data(layouter.getFilteredLinks())
            .join('path')
            .classed('link', true)
            .attr('d', (d: Connection2d) => d.getSvgPath())
            .attr('stroke', (l) => layouter.commonSettings.linkColor.getValue(l) ?? "black")
            .attr('stroke-width', (l) => {
                return getWidth(l);
            })
            .attr('fill', 'none')
            .attr('opacity', opacityGetter)

    }

    renderLabels(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>, events?: MouseEvents<Node2d>) {
        selection.selectAll('text')
            .data(this.nodes)
            .join('text')
            .attr('x', (d: Node2d) => d.x + 10)
            .attr('y', (d: Node2d) => d.y)
            .text((d: Node2d) => d.data?.id ?? "")
    }

    render() {

    }

    ////////////////////////////////////////////////////////////////////////////
    // Node and link creation
    ////////////////////////////////////////////////////////////////////////////

    createNode2d(node: CommunicationNode): Node2d {
        const node2d = new Node2d(node);
        // node2d.score = commGraph.ranking.getScoreOfNode(node) ?? 0;
        node2d.score = node.score ?? 0;
        this.mapIdToNode2d.set(node.id, node2d);
        this.nodes.push(node2d);

        return node2d;
    }

    createLink2d(link: Connection2dData): Connection2d {
        const source = this.mapIdToNode2d.get(link.fromId);
        const target = this.mapIdToNode2d.get(link.toId);

        if (!source || !target) {
            throw new Error("Source or target not found");
        }

        const conn = new Connection2d(source, target, link);
        this.links.push(conn);
        return conn;
    }


    getNodeID(node: string | Node2d): string {
        return typeof node === "string" ? node : (node.data.id ?? "");
    }

    getNode(nodeID: string | Node2d): Node2d | undefined {
        if (typeof nodeID === "string") {
            return this.mapIdToNode2d.get(nodeID);
        }
        return nodeID;
    }
}
