import * as d3 from 'd3';

export class VisualizationSettings {
    
}

export class VisualizationSetting {
    
    callback: Function;
    params: any;
    builderMethods: any;
    
    constructor({
        callback,
        params,
        builderMethods
    }: {
        callback: Function,
        params: any,
        builderMethods: any
    
    }) {
        this.callback = callback;
        this.params = params;
        this.builderMethods = builderMethods;
    
    }

}

export const FdgSettingPossibities = {
    "center": new VisualizationSetting({
        callback: d3.forceCenter,
        params: {
            x: 0,
            y: 0
        },
        builderMethods: {
            strength: {
                params: {
                    value: 0.5
                }
            }
        }    
    })
}

export class FdgVisSettings extends VisualizationSettings {

    chargeStrength: number = -20;


}
