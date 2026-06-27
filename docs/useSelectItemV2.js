// 共通ロジック V2（既存ソースを壊さないため新しい呼び出し名で提供）
export function createSelectItemV2({
    axios,
    router,
    selectedWire,    // ref or 値
    selectedPhase,   // ref or 値
    continuousMode,  // ref or 値
    useAppStore,     // () => useAppStore()
    useUnitStore,    // () => useUnitStore()
}) {
    const formdata = useAppStore();
    const DeviceData = formdata.input.device;
    const UnitData = useUnitStore();

    const val = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x);
    const dcopy = (v) => JSON.parse(JSON.stringify(v));
    const isPlaceholder = (s) => typeof s === 'string' && s.trim().startsWith('@');
    const isSameBlockUnit = (rec, blk, uni) => {
        const rb = rec.block ?? rec.block_no ?? rec.b ?? rec.blockKey ?? rec.block_key;
        const ru = rec.unit ?? rec.subunit_no ?? rec.unit_no ?? rec.u ?? rec.subunit;
        return rb === blk && ru === uni;
    };

    // ★ ここに追記
    const placeDevices_v2 = async (rawDevices) => {
        const done = new Set();
        for (const rec of (Array.isArray(rawDevices) ? rawDevices : [])) {
            const blk = rec.block;
            const uni = rec.unit;
            if (!blk || !uni) continue;

            const key = `${blk}::${uni}`;
            if (done.has(key)) continue;

            const Device = (Array.isArray(rec.default_device) && rec.default_device.length)
                ? rec.default_device
                : (Array.isArray(rec.over_device) ? rec.over_device : []);
            const validDevices = Device.filter(d => !isPlaceholder(d));
            if (validDevices.length === 0) { done.add(key); continue; }

            const placeReq = { q: { subunit_no: uni, block_no: blk }, Device: validDevices, d: '-' };
            const placeRes = await axios.post('/api/postUnitPlaceOnly', placeReq);

            const lmap = Array.isArray(placeRes.data?.lmap) ? placeRes.data.lmap : [];
            const devicesPlaced = Array.isArray(placeRes.data?.device)
                ? placeRes.data.device
                : (Array.isArray(placeRes.data?.devices) ? placeRes.data.devices : []);

            DeviceData.list = DeviceData.list.map(r =>
                isSameBlockUnit(r, blk, uni)
                    ? { ...r, lmap: dcopy(lmap), devices: dcopy(devicesPlaced) }
                    : r
            );

            done.add(key);
        }
    };

    // /api/getUnitDevice の配列に対して配置→DeviceData更新
    const placeAndUpdateByRawDevices = async (rawDevices) => {
        const done = new Set();

        for (const rec of rawDevices) {
            const blk = rec.block;   // postUnitPlaceOnly: block_no
            const uni = rec.unit;    // postUnitPlaceOnly: subunit_no（実体は subunit_no）
            if (!blk || !uni) continue;

            const key = `${blk}::${uni}`;
            if (done.has(key)) continue;

            const Device = (Array.isArray(rec.default_device) && rec.default_device.length)
                ? rec.default_device
                : (Array.isArray(rec.over_device) ? rec.over_device : []);

            // 「@〜」だけならスキップ（API呼ばない・更新しない）
            const validDevices = Device.filter(d => !isPlaceholder(d));
            if (validDevices.length === 0) {
                console.log(`[skip placement] block=${blk} unit=${uni} Device=${JSON.stringify(Device)}`);
                done.add(key);
                continue;
            }

            const placeReq = {
                q: { subunit_no: uni, block_no: blk }, // ★ block→block_no / unit→subunit_no
                Device: validDevices,
                d: "-", // SubUnitList.placement（virtical/horizonal）を利用
            };
            console.log("[postUnitPlaceOnly] req =", placeReq);

            const placeRes = await axios.post('/api/postUnitPlaceOnly', placeReq);
            const lmap = Array.isArray(placeRes.data?.lmap) ? placeRes.data.lmap : [];
            const devicesPlaced = Array.isArray(placeRes.data?.device)
                ? placeRes.data.device
                : (Array.isArray(placeRes.data?.devices) ? placeRes.data.devices : []);

            // 同 (block, unit) の全行（block_key違い含む）を一括上書き
            DeviceData.list = DeviceData.list.map(r =>
                isSameBlockUnit(r, blk, uni)
                    ? { ...r, lmap: dcopy(lmap), devices: dcopy(devicesPlaced) }
                    : r
            );

            done.add(key);
        }
    };

    // —— V2: 直接 item から処理（旧 selectitem に相当）——
    const selectitem_v2 = async (item) => {
        try {
            console.log("currentID", UnitData.currentID);
            const wire = val(selectedWire);
            const phase = val(selectedPhase);

            // GTR
            const gtr = await axios.get(`/api/getUnitGtr?u=${item.unit_no}&w=${wire}`);

            // 採番＆item拡張
            const newId = UnitData.currentID;
            const itemC = {
                ...item,
                id: newId,
                wire,
                i_north: gtr.data.i_north,
                i_south: gtr.data.i_south,
            };

            // 生デバイス取得 → まず DeviceData.list に push
            const devRes = await axios.get(`/api/getUnitDevice?k=${item.unit_key}&p=${phase}`);
            const rawDevices = Array.isArray(devRes.data) ? devRes.data : [];
            rawDevices.forEach(o => DeviceData.list.push({ ...o, id: newId }));

            // (block, unit) ごとに配置→DeviceData更新
            await placeAndUpdateByRawDevices(rawDevices);

            // 後処理
            UnitData.currentID++;
            UnitData.list.push(itemC);
            formdata.input.unit.newflag = 1;

            if (!val(continuousMode)) router.push('/UnitList');
        } catch (e) {
            console.error('selectitem_v2 failed:', e);
        }
    };

    // —— V2: 先に /api/getUnitSearchByID を使う版（list_unit_no ループ）——
    const selectitemFromSearchList_v2 = async (item) => {
        try {
            const wire = val(selectedWire);
            const phase = val(selectedPhase);

            for (const s of (item.list_unit_no || [])) {
                if (Number(s)) continue; // 既存仕様踏襲：数値はスキップ

                // 検索 → itemC
                const resSearch = await axios.get(`/api/getUnitSearchByID?n=${s}`);
                const found = Array.isArray(resSearch.data) ? resSearch.data[0] : null;
                if (!found) continue;

                // GTR
                const resGtr = await axios.get(`/api/getUnitGtr?u=${s}&w=${wire}`);

                // 採番＆itemC拡張
                const newId = UnitData.currentID;
                const itemC = {
                    ...found,
                    id: newId,
                    wire,
                    i_north: resGtr.data.i_north,
                    i_south: resGtr.data.i_south,
                };
                console.log("itemC (search)", itemC);

                // 生デバイス取得（k に s）→ DeviceData.list に push
                const resDev = await axios.get(`/api/getUnitDevice?k=${s}&p=${phase}`);
                const rawDevices = Array.isArray(resDev.data) ? resDev.data : [];
                rawDevices.forEach(obj => DeviceData.list.push({ ...obj, id: newId }));

                // 配置→DeviceData更新
                await placeAndUpdateByRawDevices(rawDevices);

                // UnitData 更新
                UnitData.currentID++;
                UnitData.list.push(itemC);
            }

            formdata.input.unit.newflag = 1;
            router.push('/UnitList');
        } catch (e) {
            console.error('selectitemFromSearchList_v2 failed:', e);
        }
    };

    return { selectitem_v2, selectitemFromSearchList_v2,placeDevices_v2 };
}
