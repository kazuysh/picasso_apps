<template>
    <v-card title="機能追加(Productコード)" variant="outlined">
        <v-row align="center" justify="start">
            <v-col cols="6"> <!-- Adjust column size as needed -->
                <v-text-field v-model="ProductNo" label="プロダクト番号" @keyup.enter="fetchUnitListByProduct"></v-text-field>
            </v-col>
            <v-col cols="3"> <!-- Adjust column size as needed -->
                <v-btn @click="fetchUnitListByProduct" elevation="20" color="primary">
                    検索
                    <v-icon icon="mdi-checkbox-marked-circle" end></v-icon>
                </v-btn>
            </v-col>
            <v-col cols="1">
                <v-btn @click="$router.push('/UnitList')" elevation="20" color="primary">戻る</v-btn>
            </v-col>
        </v-row>
        <v-row>
            <v-col cols="2">
                <v-select :items="phase" item-title="title" item-value="value" label="Phase"
                    v-model="selectedPhase"></v-select>
            </v-col>
            <v-col cols="2">
                <v-select :items="wire" item-title="title" item-value="value" label="wire"
                    v-model="selectedWire"></v-select>
            </v-col>
        </v-row>
        <v-text-field v-model="search" label="Search" @input="performSearch" prepend-inner-icon="mdi-magnify"
            variant="outlined" hide-details single-line>
        </v-text-field>
        <v-data-table :items="filteredItems" :headers="headers" item-value="unit_no"
            :items-per-page-options="[10, 25, 50]">
            <template v-slot:item.actions="{ item }">
                <v-btn @click="selectitemFromSearchList_v2(item)" color="secondary">選択</v-btn>
            </template>
        </v-data-table>
    </v-card>
</template>
<script setup>
import { ref, reactive } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { useAppStore } from '../stores/app';
import { createSelectItemV2 } from '../composables/useSelectItemV2';

const router = useRouter();
const continuousMode = ref(false);

const search = ref('');
const filteredItems = ref([]);
const items = ref([]);
const ProductNo = ref('');
const formdata = useAppStore();
const cabinfo = formdata.input.cabinfo;
const UnitData = formdata.input.unit;
const DeviceData = formdata.input.device;

import { useConfig } from '../stores/config';
const selectedPhase = ref(null);
const selectedWire = ref(null);
const config = useConfig();
const uitem = config.config.UnitAddOption;
const phase = uitem.Phase;
const wire = uitem.wire;

const headers = [
    { title: 'ProductNo', key: 'product_no' },
    { title: 'BoxNo', key: 'box_no' },
    { title: 'BoxH', key: 'box_h' },
    { title: 'BoxW', key: 'box_w' },
    { title: 'BoxColor', key: 'box_color' },
    { title: 'BoxDoor', key: 'box_door' },
    { title: 'BoxLocation', key: 'box_Location' },
    { title: 'BoxPurpose', key: 'box_purpose' },
    { title: 'BoxInput', key: 'box_input' },
    { title: 'BoxOutput', key: 'box_output' },
    { title: 'アクション', key: 'actions' }
];

// Composable 初期化（既存の参照をそのまま渡す）
const { selectitem_v2, selectitemFromSearchList_v2 } = createSelectItemV2({
    axios,
    router,
    selectedWire,
    selectedPhase,
    continuousMode,
    useAppStore: () => formdata,  // 既存の formdata をそのまま
    useUnitStore: () => UnitData, // 既存の UnitData をそのまま（currentID / list を利用）
});

const fetchUnitListByProduct = async () => {
    try {
        const response = await axios.get(`/api/getProductList?n=${ProductNo.value}`);
        items.value = response.data;
        filteredItems.value = items.value;
    } catch (error) {
        console.error("Error fetching unit list: ", error);
    }
};

const performSearch = () => {
    const keywords = search.value.split(' ').filter(Boolean);
    filteredItems.value = items.value.filter(item =>
        keywords.every(keyword =>
            Object.values(item).some(value =>
                String(value).toLowerCase().includes(keyword.toLowerCase())
            )
        )
    );
};

const selectitem = async (item) => {
    console.log(item);
    for (const s of item.list_unit_no) {
        console.log(s);
        if (!Number(s)) {
            const response = await axios.get(`/api/getUnitSearchByID?n=${s}`);
            if (s != "") {
                let item = response.data[0];
                const response2 = await axios.get(`/api/getUnitGtr?u=${s}&w=${selectedWire.value}`);
                item['id'] = UnitData.currentID;
                item['wire'] = selectedWire.value;
                item['i_north'] = response2.data.i_north;
                item['i_south'] = response2.data.i_south;
                console.log(item);
                let response3 = await axios.get(`/api/getUnitDevice?k=${s}&p=${selectedPhase.value}`);
                response3.data.forEach(obj => {
                    obj['id'] = UnitData.currentID;
                    DeviceData.list.push(obj);
                });
                UnitData.currentID++;
                UnitData.list.push(item);
            }
        }
    }
    cabinfo.boxwidth = item.box_w
    cabinfo.boxheight = item.box_h
    cabinfo.boxdepth = item.box_d
    cabinfo.outer_color = item.box_color
    cabinfo.material = item.box_material
    cabinfo.input_wire = item.box_input
    cabinfo.output_wire = item.box_output
    cabinfo.structure = item.box_structure
    cabinfo.format2 = item.box_purpose
    cabinfo.format = item.box_Location
    formdata.input.unit.newflag = 1;
    router.push('/UnitList');
};

onMounted(() => {
    selectedPhase.value = phase[0].value;;
    selectedWire.value = wire[0].value;;
});
</script>