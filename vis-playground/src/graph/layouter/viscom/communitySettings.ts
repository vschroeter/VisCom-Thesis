import { useApiStore } from "src/stores/api-store";
import { Param, ParamChoice, Setting } from "../settings/settings";
import { ApiGeneratorMethods, GeneratorMethods } from "src/api/generatorApi";
import { computed, ComputedRef, Ref, ref } from "vue";
import { VisGraph } from "src/graph/visGraph/visGraph";
import { visGraphToNodeLinkData } from "src/api/graphDataApi";

export class ApiSetting extends Setting {

}


export class CommunitySettings extends ApiSetting {

    // generatorMethods: Ref<GeneratorMethods> = ref(new GeneratorMethods({})) as Ref<GeneratorMethods>
    // generatorMethodNames: ComputedRef<string[]> = computed(() => {
    //     const a = [...Array.from(this.generatorMethods.value.generators.keys()), "None"]
    //     console.log("Setting generator method names", a, this)
    //     this.communityDetectionMethod.choices = a
    //     this.updateParamsStatus();
    //     return a
    // })

    generatorMethods: GeneratorMethods = new GeneratorMethods({})
    generatorMethodNames: string[] = [];

    communityDetectionMethod = new ParamChoice<string>({
        key: "communityDetectionMethod",
        label: "Community Detection Method",
        description: "The method used to detect communities.",
        optional: false,
        defaultValue: "None",
        choices: ["None", "louvain"],
    })

    addVirtualNodes = new Param<boolean>({
        key: "addVirtualNodes",
        label: "Add Virtual Nodes",
        description: "Add virtual nodes to other communities.",
        optional: false,
        defaultValue: false,
        type: "boolean",
    })


    // static getCommunityDetectionMethodChoices() {
    //     return CommunitySettings.fetchCommunityDetectionMethods().then(methods => {
    //         return [...Array.from(methods.generators.keys()), "None"]
    //     })
    // }

    static fetchCommunityDetectionMethods() {
        console.log("Fetching community detection methods")
        const generatorApiUrl = useApiStore().generatorApiUrl

        return fetch(`${generatorApiUrl}/analyze/communities/methods`)
            .then(response => response.json())
            .then((data: ApiGeneratorMethods) => {
                return new GeneratorMethods(data);
                // const methods = reactive(new GeneratorMethods(data)) as GeneratorMethods
                // communityDetectionMethods.value = methods
                // console.log(communityDetectionMethods)
            })
    }

    fetchCommunities(visGraph: VisGraph): Promise<string[][]> {
        const genId = this.communityDetectionMethod.getValue();
        if (!genId || genId === "None") {
            return Promise.resolve([])
        }
        const generatorApiUrl = useApiStore().generatorApiUrl
        const url = `${generatorApiUrl}/analyze/communities/${genId}`
    
        const params = new URLSearchParams()
        // selectedCommunityDetection.value?.paramList.forEach((param) => {
        //     params.append(param.key, param.value.toString())
        // })
    
        const urlWithParams = `${url}?${params.toString()}`
    
        // Fetch a POST request with the parameters
        return fetch(urlWithParams, {
            method: 'POST',
            body: JSON.stringify(visGraphToNodeLinkData(visGraph)),
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            // .then((data) => {
            //     console.log(data)
            //     graph?.communities.setCommunitiesByList(data)
            // })

    }

}
