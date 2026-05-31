import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { saveWork } from '../api/saveWork'

export default function RouteChangeSync() {
    const location = useLocation()
    const isFirst = useRef(true)

    useEffect(() => {
        if (isFirst.current) {
            isFirst.current = false
            return
        }

        saveWork()
            .then(() => {
                console.log('[送信] ストアデータをサーバーへ送信しました')
            })
            .catch((err) => {
                console.warn('[警告] ストア送信失敗:', err)
            })

    }, [location.pathname, location.search, location.hash])

    return null
}