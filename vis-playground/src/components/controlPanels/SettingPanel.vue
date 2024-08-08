<template>
    <div>
        <div class="row" v-if="currentSettings">
            <q-input borderless v-model="currentSettings.name" label="Visualization Name" />
        </div>
        <!-- For each setting add a row -->
        <!-- <div v-for="setting in settingList" :key="setting.settingName"> -->
        <div v-for="setting in currentSettings?.settings" :key="setting.key">

            <div class="row">
                <div class="col">
                    <div v-if="false" class="row">
                        <div class="text-h6">{{ setting.key }}</div>

                    </div>
                    <!-- Param Row -->
                    <div class="row q-mb-md" v-if="true">
                        <!-- For each item in params map in value add a combined form containing:
                             - the key as name
                             - a checkbox if it is optional
                             - a text input with the value 
                        -->
                        <div class="col">
                            <q-table
                                dense
                                hide-pagination
                                :pagination="{ rowsPerPage: 0 }"
                                :title="setting.key"
                                :row-key="row => row.key"
                                :rows="setting.parameters"
                                :columns="settingTableColumns">

                                <!-- If the setting is optional, add a toggle at the top altering the setting.active flag -->
                                <template v-slot:top="props">
                                    <div class="text-h6">{{ setting.key }}</div>
                                    <q-space />
                                    <q-toggle
                                        v-model="setting.active"
                                        dense
                                        size="sm" />

                                </template>

                                <!-- Toggle for the active flag of a paremeter -->
                                <template v-slot:body-cell-activated="props">
                                    <q-td key="activated" :props="props">
                                        <q-toggle
                                            v-model="props.row.active"
                                            dense
                                            :disable="!props.row.optional"
                                            size="sm" />
                                    </q-td>
                                </template>

                                <!-- Input field for the value -->
                                <template v-slot:body-cell-value="props">
                                    <q-td key="value" :props="props">
                                        <q-input
                                            v-model="props.row.textValue"

                                            dense
                                            borderless />

                                    </q-td>


                                    <q-tooltip :delay="500" v-if="props.row.tooltip.length > 0">

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
</template>

<script setup lang="ts">

import { QTableColumn } from 'quasar';
import { useGraphStore } from 'src/stores/graph-store';
import { VisualizationSettingParam } from 'src/visaulizations/visualizationSettings';
import { computed, onMounted, onUpdated, ref, watch, type Ref } from 'vue'

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

// class AdjustableParam<T> {
//     paramName: string;
//     paramValue: T;
// }

// class AdjustableSetting {
//     settingName: string;
//     setting: VisualizationSettings;
//     params:

// }

const currentSettings = computed(() => store.currentSettings)

// const settingList = computed(() => {
//     return Object.keys(store.currentSettings).map((key) => {
//         return {
//             settingName: key,
//             setting: store.currentSettings[key]
//         }
//     })
// })



const settingTableColumns: QTableColumn<VisualizationSettingParam<any>>[] = [
    {
        name: 'activated',
        required: true,
        label: 'Activated',
        align: 'left',
        field: 'active',
        sortable: false
    },
    {
        name: 'name',
        label: 'Param',
        required: true,
        align: 'left',
        field: 'key',
        sortable: false
    },
    {
        name: 'value',
        required: true,
        label: 'Value',
        align: 'left',
        field: 'value',
        sortable: false
    },
];

const selectedRows = ref<VisualizationSettingParam<any>[]>([])

// const settingParamsMap = computed(() => {
//     const params = new Map<string, Map<string, VisualizationSettingParam<any>>>()

//     settingList.value.map((s) => {
//         const paramMap = new Map<string, VisualizationSettingParam<any>>()

//         s.setting.params.forEach((paramValue, paramKey) => {
//             paramMap.set(paramKey, paramValue)
//         })

//         params.set(s.settingName, paramMap)
//     })

//     console.log("New setting params map: ", params)
//     return params
// })

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

watch(() => store.currentSettings, (newSettings) => {
    // console.log("New settings: ", store.currentSettings)
})


</script>

<style scoped></style>