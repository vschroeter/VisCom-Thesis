export class NodeCommunity {
    nodeIds: string[] = [];

    nodeIsInCommunity(nodeId: string): boolean {
        return this.nodeIds.includes(nodeId);
    }
}

export class NodeCommunities {
    communities: NodeCommunity[] = [];

    getCommunitiesOfNode(nodeId?: string): number[] {
        if (!nodeId) {
            return [];
        }
        
        return this.communities
            .map((community, index) => {
                return community.nodeIsInCommunity(nodeId) ? index : -1;
            })
            .filter((index) => index >= 0);
    }

    setCommunitiesByList(communitiesIds: string[][]) {
        this.communities = communitiesIds.map((communityIds) => {
            const community = new NodeCommunity();
            community.nodeIds = communityIds;
            return community;
        });
    }

    get countOfCommunities(): number {
        return this.communities.length;
    }
}
