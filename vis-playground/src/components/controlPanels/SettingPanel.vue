<template>
    <div class="q-pa-sm">

        <div ref="refDivCommonSettingsRoot" class="row">
            <!-- <span class="text-h4">Common Settings</span> -->
            <q-expansion-item v-model="showCommonSettings" label="Common Settings" icon="settings" class="col">

                <div v-for="param in commonSettings.parameters" :key="param.key" class="q-mb-md">
                    <!-- :rules="['anyColor']" -->

                    <ParamInput v-model="commonSettings.parameterMap[param.key]" outlined />


                </div>
            </q-expansion-item>
        </div>


        <div ref="refDivSelectedSettingsRoot" class="row">
            <div class="col">

                <span class="text-h6">Selected Settings</span>


                <div class="row" v-if="currentSettings">
                    <q-input borderless v-model="currentSettings.name" label="Visualization Name" />
                </div>
                <!-- For each setting add a row -->
                <!-- <div v-for="setting in settingList" :key="setting.settingName"> -->
                <div v-for="setting in currentSettings?.settings" :key="setting.key" class="row">

                    <!-- <div class="row"> -->
                    <div class="col">
                        <div v-if="false" class="row">
                            <div class="text-h6">{{ setting.label || setting.key }}</div>

                        </div>
                        <!-- Param Row -->
                        <div class="row q-mb-md" v-if="true">
                            <!-- For each item in params map in value add a combined form containing:
                             - the key as name
                             - a checkbox if it is optional
                             - a text input with the value
                        -->
                            <div class="col">
                                <q-table dense hide-pagination :pagination="{ rowsPerPage: 0 }"
                                    :title="setting.label || setting.key" :row-key="row => row.key" :key="updated"
                                    :rows="setting.enabledParameters" :columns="getSettingTableColumns(setting)">

                                    <!-- If the setting is optional, add a toggle at the top altering the setting.active flag -->
                                    <template v-slot:top="props">
                                        <div class="text-h6">{{ setting.label ?? setting.key }}</div>
                                        <q-space />
                                        <q-toggle v-if="setting.optional" v-model="setting.active" dense size="sm" />

                                        <q-tooltip :delay="1000" v-if="true || (setting.description?.length ?? 0) > 0">
                                            {{ setting.description }}
                                        </q-tooltip>

                                    </template>

                                    <!-- Toggle for the active flag of a paremeter -->
                                    <template v-slot:body-cell-activated="props">
                                        <q-td key="activated" :props="props">
                                            <q-toggle v-model="props.row.active" dense :disable="!props.row.optional"
                                                :color="props.row.optional ? `primary` : `grey-5`" size="sm" />
                                        </q-td>
                                    </template>

                                    <!-- Input field for the value -->
                                    <template v-slot:body-cell-value="props">
                                        <q-td key="value" :props="props">

                                            <!-- If the param is of type 'boolean', add a toggle  -->
                                            <q-toggle v-if="props.row.type == 'boolean'" v-model="props.row.textValue"
                                                size="sm" />

                                            <!-- If the param is of type 'color', add a color picker -->
                                            <q-input v-else-if="props.row.type == 'color'" v-model="props.row.textValue"
                                                dense borderless>
                                                <template v-slot:append>
                                                    <q-icon name="colorize" class="cursor-pointer">
                                                        <q-popup-proxy cover transition-show="scale"
                                                            transition-hide="scale">
                                                            <q-color v-model="props.row.textValue" :palette="palette" />
                                                        </q-popup-proxy>
                                                    </q-icon>
                                                </template>
                                                <template v-slot:prepend>
                                                    <div
                                                        :style="{ backgroundColor: props.row.textValue, width: '20px', height: '20px', borderRadius: '50%', border: '1px solid black' }">
                                                    </div>
                                                </template>
                                            </q-input>

                                            <!-- If the param is of type 'number', add a number input -->
                                            <q-input v-else-if="props.row.type == 'number'"
                                                v-model="props.row.textValue" dense borderless type="number" />

                                            <!-- If the param is of type 'choice', add a select input -->
                                            <q-select v-else-if="props.row.type == 'choice'"
                                                v-model="props.row.textValue" dense borderless
                                                :options="props.row.choices" />


                                            <!-- If the param is of type 'string', add a text input -->
                                            <q-input v-else v-model="props.row.textValue" dense borderless />


                                        </q-td>


                                        <q-tooltip :delay="1000" v-if="true || (props.row.tooltip?.length ?? 0) > 0">
                                            <!-- If tooltip is a string, just display it -->
                                            <template v-if="typeof props.row.tooltip === 'string'">
                                                {{ props.row.tooltip }}
                                            </template>

                                            <!-- If tooltip is an array, display a list of elements -->
                                            <template v-else-if="Array.isArray(props.row.tooltip)">
                                                <q-list dense>
                                                    <q-item v-for="i in props.row.tooltip.length" :key="i">
                                                        <q-item-section>
                                                            {{ props.row.tooltip[i - 1] }}
                                                        </q-item-section>
                                                    </q-item>
                                                </q-list>
                                            </template>
                                        </q-tooltip>
                                    </template>

                                </q-table>
                            </div>

                            <!-- <div class="col-auto">{{ setting.value }}</div> -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">

import { QTableColumn } from 'quasar';
import { GraphLayouterSettings, Param, Setting } from 'src/graph/layouter/settings/settings';
import { useGraphStore } from 'src/stores/graph-store';
import { computed, onMounted, onUpdated, ref, watch, type Ref } from 'vue'

import * as d3 from 'd3'
import ParamInput from '../elements/ParamInput.vue';
import { CommonSettings } from 'src/graph/layouter/settings/commonSettings';

////////////////////////////////////////////////////////////////////////////
// Props
////////////////////////////////////////////////////////////////////////////

// const props = defineProps()

////////////////////////////////////////////////////////////////////////////
// Stores
////////////////////////////////////////////////////////////////////////////

const store = useGraphStore()

////////////////////////////////////////////////////////////////////////////
// Template Refs
////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////
// Refs and Computed values
////////////////////////////////////////////////////////////////////////////

// const currentSettings = computed(() => store.currentSettings)
const currentSettings: Ref<GraphLayouterSettings | undefined> = ref(store.currentSettings) as Ref<GraphLayouterSettings | undefined>
const commonSettings = computed(() => store.settingsCollection.commonSettings as CommonSettings)
const showCommonSettings = ref(false);

const palette = computed(() => {
    const ranges = [
        d3.schemeCategory10,
        d3.schemeAccent
    ]
    return ranges.flat(1);
})


const settingTableColumns: QTableColumn<Param>[] = [
    {
        name: 'activated',
        required: true,
        label: 'Active',
        align: 'left',
        field: 'active',
        sortable: false
    },
    {
        name: 'name',
        label: 'Param',
        required: true,
        align: 'left',
        field: 'label',
        sortable: false
    },
    {
        name: 'value',
        required: true,
        label: 'Value',
        align: 'left',
        field: 'textValue',
        sortable: false
    },
];

// All but the first column
const settingTableColumnsWithoutActivation: QTableColumn<Param>[] = settingTableColumns.slice(1)

function getSettingTableColumns(setting: Setting): QTableColumn<Param>[] {
    // If no param in the setting is optional, return the columns without the activation column
    if (setting.enabledParameters.filter(p => p.optional).length == 0) {
        return settingTableColumnsWithoutActivation
    }
    return settingTableColumns
}

////////////////////////////////////////////////////////////////////////////
// Helper functions
////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////
// Lifecycle hooks
////////////////////////////////////////////////////////////////////////////

onMounted(() => {

})

onUpdated(() => {

})

const updated = ref(0)

watch(() => store.currentSettings, (newSettings) => {
    // console.log("New settings: ", store.currentSettings)

    if (currentSettings.value) {
        currentSettings.value.emitter.off("updatedSettingStatus")
    }

    currentSettings.value = store.currentSettings as GraphLayouterSettings
    if (currentSettings.value) {
        currentSettings.value.emitter.on("updatedSettingStatus", () => {
            updated.value += 1
        });
    }
})


</script>

<style scoped></style>
