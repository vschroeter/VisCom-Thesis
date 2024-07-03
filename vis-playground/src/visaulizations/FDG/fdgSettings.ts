import { VisualizationSetting, VisualizationSettingParam, VisualizationSettings } from "../visualizationSettings";
import * as d3 from 'd3';

type FdgSettingParamMapping = {
    // forceCenter: "x" | "y" | "strength",
    forceCenter: "strength",
    forceLink: "distance" | "strength",
    forceManyBody: "strength",
    forceCollide: "radius" | "strength"
};



export class FdgVisSettings extends VisualizationSettings<FdgSettingParamMapping> {

    constructor() {
        super({
            settings: [
                new VisualizationSetting<FdgSettingParamMapping["forceManyBody"]>({
                    key: "forceManyBody",
                    optional: true,
                    active: true,
                    method: d3.forceManyBody,
                    params: [
                        new VisualizationSettingParam({
                            key: "strength",
                            optional: false,
                            default: -20,
                        }),
                    ]
                }),
                new VisualizationSetting<FdgSettingParamMapping["forceCenter"]>({
                    key: "forceCenter",
                    optional: true,
                    method: d3.forceCenter,
                    params: [
                        // new VisualizationSettingParam({
                        //     key: "x",
                        //     optional: true,
                        //     default: 0,
                        // }),
                        // new VisualizationSettingParam({
                        //     key: "y",
                        //     optional: true,
                        //     default: 0,
                        // }),
                        new VisualizationSettingParam({
                            key: "strength",
                            optional: false,
                            default: 1,
                        }),
                    ]
                }),
                new VisualizationSetting<FdgSettingParamMapping["forceLink"]>({
                    key: "forceLink",
                    optional: true,
                    method: d3.forceLink,
                    params: [
                        new VisualizationSettingParam({
                            key: "distance",
                            optional: true,
                            default: 30,
                        }),
                        new VisualizationSettingParam({
                            key: "strength",
                            optional: true,
                            default: 1,
                        }),
                    ]
                }),

                new VisualizationSetting<FdgSettingParamMapping["forceCollide"]>({
                    key: "forceCollide",
                    optional: true,
                    method: d3.forceCollide,
                    params: [
                        new VisualizationSettingParam({
                            key: "radius",
                            optional: true,
                            default: 5,
                        }),
                        new VisualizationSettingParam({
                            key: "strength",
                            optional: true,
                            default: 0.5,
                        }),
                    ]
                }),
            ]
        });
    }

}