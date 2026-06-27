<template>
    <v-card title="機能追加(UnitNo)" variant="outlined">
        <v-row align="center" justify="start">
            <v-col cols="6"> <!-- Adjust column size as needed -->
                <v-text-field v-model="UnitNo" label="UnitNo" @keyup.enter="fetchUnitListByUnit"></v-text-field>
            </v-col>
            <v-col cols="3" class="d-flex align-center">
                <v-btn @click="fetchUnitListByUnit" elevation="20" color="primary" class="mr-2">
                    検索
                    <v-icon icon="mdi-checkbox-marked-circle" end></v-icon>
                </v-btn>
                <v-checkbox v-model="continuousMode" label="Stay" hide-details density="compact"
                    style="margin-top: -10px;"></v-checkbox>
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
                <v-btn @click="selectitem_v2(item)" color="primary">選択</v-btn>
            </template>
            <template v-slot:item.actions2="{ item }">
                <v-btn @click="selectitem2(item)" color="secondary">{{ item.list_subunit_no }}</v-btn>
            </template>
        </v-data-table>
    </v-card>
    <deviceinfoDialog v-model="dialogDevice" :items="deviceInfo" />
</template>
<script setup>
import { ref, reactive } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { useAppStore } from '../stores/app';
import deviceinfoDialog from '../components/deviceInfoDialog.vue';
import { createSelectItemV2 } from '../composables/useSelectItemV2';

const router = useRouter();

const dialogDevice = ref(false);
const deviceInfo = ref([]);

const search = ref('');
const filteredItems = ref([]);
const items = ref([]);
const UnitNo = ref('');
const formdata = useAppStore();
const UnitData = formdata.input.unit;
const DeviceData = formdata.input.device;

import { useConfig } from '../stores/config';
const continuousMode = ref(false);
const selectedPhase = ref(null);
const selectedWire = ref(null);
const config = useConfig();
const uitem = config.config.UnitAddOption;
const phase = uitem.Phase;
const wire = uitem.wire;

const headers = [
    { title: 'UnitNo', key: 'unit_no' },
    { title: '選択', key: 'actions' },
    { title: 'Cap', key: 'i_cap' },
    { title: '縦', key: 'i_unit_h' },
    { title: '横', key: 'list_W' },
    { title: '内規高さ', key: 'list_d' },
    { title: '構造１', key: 'structure1' },
    { title: '構造２', key: 'structure2' },
    { title: '機器確認', key: 'actions2' },
];

const { selectitem_v2, selectitemFromSearchList_v2 } = createSelectItemV2({
    axios,
    router,
    selectedWire,
    selectedPhase,
    continuousMode,
    // 既に作ってあるインスタンスを“関数で返す”形で渡せばOK
    useAppStore: () => formdata,
    useUnitStore: () => UnitData,
});

const fetchUnitListByUnit = async () => {
    try {
        const unitParam = UnitNo.value.replace(/-/g, '_');
        const response = await axios.get(`/api/getUnitSearchByID?n=${unitParam}`);
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
    try {
        console.log("currentID", UnitData.currentID);

        // 1) GTR
        const gtr = await axios.get(`/api/getUnitGtr?u=${item.unit_no}&w=${selectedWire.value}`);

        // 2) item コピー & 採番固定
        const newId = UnitData.currentID;
        const itemC = {
            ...item,
            id: newId,
            wire: selectedWire.value,
            i_north: gtr.data.i_north,
            i_south: gtr.data.i_south,
        };

        // 3) /api/getUnitDevice の生配列をそのまま DeviceData.list に投入
        const devRes = await axios.get(`/api/getUnitDevice?k=${item.unit_key}&p=${selectedPhase.value}`);
        const rawDevices = Array.isArray(devRes.data) ? devRes.data : [];
        rawDevices.forEach(o => DeviceData.list.push({ ...o, id: newId }));

        // 4) (block, unit) ごとに処理
        const done = new Set();

        // 先頭が空（"@"始まり）か判定
        const isPlaceholder = (s) => typeof s === 'string' && s.trim().startsWith('@');

        // 同じ (block, unit) か
        const isSameBlockUnit = (rec, blk, uni) => {
            const rb = rec.block ?? rec.block_no ?? rec.b ?? rec.blockKey ?? rec.block_key;
            const ru = rec.unit ?? rec.subunit_no ?? rec.unit_no ?? rec.u ?? rec.subunit;
            return rb === blk && ru === uni;
        };

        const dcopy = (v) => JSON.parse(JSON.stringify(v));

        for (const rec of rawDevices) {
            const blk = rec.block;  // postUnitPlaceOnly の block_no に入れる値
            const uni = rec.unit;   // postUnitPlaceOnly の subunit_no に入れる値（実体は subunit_no）
            if (!blk || !uni) continue;

            const key = `${blk}::${uni}`;
            if (done.has(key)) continue;

            // デバイス配列（既定は default_device、無ければ over_device）
            const Device = (Array.isArray(rec.default_device) && rec.default_device.length)
                ? rec.default_device
                : (Array.isArray(rec.over_device) ? rec.over_device : []);

            // ＝＝＝ ここが追加ポイント ＝＝＝
            // 有効デバイス（"@" で始まらないもの）のみ抽出
            const validDevices = Device.filter(d => !isPlaceholder(d));
            // すべてが "@..." なら → 配置 API を呼ばず＆DeviceData の lmap/devices も未更新のままスキップ
            if (validDevices.length === 0) {
                console.log(`[skip placement] block=${blk} unit=${uni} Device=${JSON.stringify(Device)}`);
                done.add(key);
                continue;
            }
            // ＝＝＝ ここまで ＝＝＝

            const placeReq = {
                q: { subunit_no: uni, block_no: blk },
                Device: validDevices,   // プレースホルダは送らない
                d: "-",                 // SubUnitList.placement（virtical/horizonal）を使用
            };

            console.log("[postUnitPlaceOnly] req =", placeReq);
            const placeRes = await axios.post('/api/postUnitPlaceOnly', placeReq);

            const lmap = Array.isArray(placeRes.data?.lmap) ? placeRes.data.lmap : [];
            const devicesPlaced = Array.isArray(placeRes.data?.device)
                ? placeRes.data.device
                : (Array.isArray(placeRes.data?.devices) ? placeRes.data.devices : []);

            // 同じ (block, unit) の全レコードを更新（重複OK）
            DeviceData.list = DeviceData.list.map(r =>
                isSameBlockUnit(r, blk, uni)
                    ? { ...r, lmap: dcopy(lmap), devices: dcopy(devicesPlaced) }
                    : r
            );

            done.add(key);
        }

        // 5) 後処理（元の流れ）
        UnitData.currentID++;
        UnitData.list.push(itemC);
        formdata.input.unit.newflag = 1;

        if (!continuousMode.value) {
            router.push('/UnitList');
        }
    } catch (e) {
        console.error('selectitem failed:', e);
    }
};

const selectitem2 = async (item) => {
    try {
        console.log(item.unit_key, selectedPhase.value)
        const response = await axios.get(`/api/getUnitDevice?k=${item.unit_key}&p=${selectedPhase.value}`)
        deviceInfo.value = response.data;
        dialogDevice.value = true
        console.log(response.data.placement)
    } catch (error) {
        console.error('取得エラー:', error)
        deviceInfo.value = [];
        dialogDevice.value = true
    }
};

onMounted(() => {
    selectedPhase.value = phase[0].value;;
    selectedWire.value = wire[0].value;;
});
</script>
