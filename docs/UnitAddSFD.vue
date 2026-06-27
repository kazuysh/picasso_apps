<template>
    <v-card title="機能追加(SFDコード)" variant="outlined">
        <v-row align="center" justify="start">
            <v-col cols="6"> <!-- Adjust column size as needed -->
                <v-text-field v-model="SFDNo" label="SFD番号" @keyup.enter="fetchUnitListBySFD"></v-text-field>
            </v-col>
            <v-col cols="3"> <!-- Adjust column size as needed -->
                <v-btn @click="fetchUnitListBySFD" elevation="20" color="primary">
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
const SFDNo = ref('');
const formdata = useAppStore();
const UnitData = formdata.input.unit;
const DeviceData = formdata.input.device;

import { useConfig } from '../stores/config';
const selectedPhase = ref(null);
const selectedWire = ref(null);
const config = useConfig();
const uitem = config.config.UnitAddOption;
const phase = uitem.Phase;
const wire = uitem.wire;

// Composable 初期化（既存の参照をそのまま渡す）
const { selectitemFromSearchList_v2 } = createSelectItemV2({
    axios,
    router,
    selectedWire,
    selectedPhase,
    continuousMode,
    useAppStore: () => formdata,  // 既存の formdata をそのまま渡す
    useUnitStore: () => UnitData, // 既存の UnitData をそのまま渡す（currentID / list を利用）
});

const headers = [
    { title: 'SFDNo', key: 'sfd_no' },
    { title: 'UnitNo', key: 'list_unit_no' },
    { title: 'アクション', key: 'actions' }
];

const fetchUnitListBySFD = async () => {
    try {
        const response = await axios.get(`/api/getSFDList?n=${SFDNo.value}`);
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
            const response2 = await axios.get(`/api/getUnitGtr?u=${s}&w=${selectedWire.value}`);
            let itemC = response.data[0];
            itemC['id'] = UnitData.currentID;
            itemC['wire'] = selectedWire.value;
            itemC['i_north'] = response2.data.i_north;
            itemC['i_south'] = response2.data.i_south;
            console.log(itemC);
            let response3 = await axios.get(`/api/getUnitDevice?k=${s}&p=${selectedPhase.value}`);
            response3.data.forEach(obj => {
                obj['id'] = UnitData.currentID;
                DeviceData.list.push(obj);
            });
            UnitData.currentID++;
            UnitData.list.push(itemC);
        }
    }
    formdata.input.unit.newflag = 1;
    router.push('/UnitList');
};
onMounted(() => {
    selectedPhase.value = phase[0].value;;
    selectedWire.value = wire[0].value;;
});
</script>