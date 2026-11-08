/**
 * 有田電鉄 路線・駅設定ファイル（複数路線対応）
 *
 * 停車パターン: 0：停車 1：通過 2：平日朝の須賀浦/新須賀浦方面に向かう電車のみ停車 -1：運転なし
 * lo: 各停, ne: 新快, se: 区快, co: 通快, ra: 快速, sp: 特快, le: 特急
 */

import { STATION_COORDS } from './waypoint_coordinates.js';

function withCoords(id, stationDef) {
    const c = STATION_COORDS[id] || { x: 0, y: 64, z: 0 };
    return { id, ...stationDef, x: c.x, y: c.y, z: c.z };
}

export const ROUTE_DATA = {
    lines: [
        {
            lineId: 'AR',
            lineName: '有田本線',
            color: '#28baa5',
            trackBgColor: '#bfe4eb',
            trackCenter: 960,
            stations: [
                withCoords('AR01', { name: '有田', en: 'Aruda', zh: '有田', ko: '알다', lo: 0, ne: 0, se: 0, co: 0, ra: 0, sp: 0, le: -1 }),
                withCoords('AR02', { name: '有田新都心', en: 'Aruda-Shintoshin', zh: '有田新都心', ko: '알다신토신', lo: 0, ne: 0, se: 0, co: 0, ra: 0, sp: 0, le: -1 }),
                withCoords('AR03', { name: '向日町', en: 'Mukaimachi', zh: '向日町', ko: '무코마치', lo: 0, ne: 0, se: 0, co: 0, ra: 0, sp: 1, le: -1 }),
                withCoords('AR04', { name: '深目白宮', en: 'Fukame-Shiromiya', zh: '深目白宫', ko: '후카메시로미야', lo: 0, ne: 0, se: 0, co: 0, ra: 0, sp: 1, le: -1 }),
                withCoords('AR05', { name: '有電高柳', en: 'Arden-Takayanagi', zh: '有电高柳', ko: '알덴타카야나기', lo: 0, ne: 0, se: 0, co: 0, ra: 0, sp: 1, le: -1 }),
                withCoords('AR06', { name: '有田紗川', en: 'Aruda-Sagawa', zh: '有田纱川', ko: '알다사카와', lo: 0, ne: 0, se: 1, co: 1, ra: 1, sp: 1, le: -1 }),
                withCoords('AR07', { name: '蹄光寺坂', en: 'Teikōjizaka', zh: '蹄光寺坂', ko: '테이코지자카', lo: 0, ne: 0, se: 2, co: 0, ra: 1, sp: 1, le: -1 }),
                withCoords('AR08', { name: '飛龍原', en: 'Hiryūbara', zh: '飞龙原', ko: '히류바라', lo: 0, ne: 0, se: 1, co: 1, ra: 1, sp: 1, le: -1 }),
                withCoords('AR09', { name: '本涼瀬', en: 'Hon-Suzuse', zh: '本凉濑', ko: '혼스즈세', lo: 0, ne: 0, se: 0, co: 0, ra: 0, sp: 1, le: -1 }),
                withCoords('AR10', { name: '西涼瀬', en: 'Nishi-Suzuse', zh: '西凉濑', ko: '니시스즈세', lo: 0, ne: 1, se: 0, co: 1, ra: 1, sp: 1, le: -1 }),
                withCoords('AR11', { name: '光差学園前', en: 'Hikasashi-Gakuenmae', zh: '光差学园前', ko: '히카사시학원앞', lo: 0, ne: 0, se: 0, co: 0, ra: 1, sp: 1, le: -1 }),
                withCoords('AR12', { name: '高馬ノ宮', en: 'Takamanomiya', zh: '高马之宫', ko: '타카마노미야', lo: 0, ne: 1, se: 1, co: 1, ra: 1, sp: 1, le: -1 }),
                withCoords('AR13', { name: '土手口', en: 'Doteguchi', zh: '土手口', ko: '도테구치', lo: 0, ne: 1, se: 1, co: 1, ra: 1, sp: 1, le: -1 }),
                withCoords('AR14', { name: '十全', en: 'Jūzen', zh: '十全', ko: '쥬젠', lo: 0, ne: 0, se: 0, co: 0, ra: 0, sp: 0, le: -1 }),
                withCoords('AR15', { name: '小栗坂', en: 'Ogurizaka', zh: '小栗坂', ko: '오구리자카', lo: 0, ne: 0, se: 2, co: 1, ra: 1, sp: 1, le: -1 }),
                withCoords('AR16', { name: '有電会沢', en: 'Arden-Aizawa', zh: '有电会泽', ko: '알덴아이자와', lo: 0, ne: 0, se: 0, co: 0, ra: 1, sp: 1, le: -1 }),
                withCoords('AR17', { name: '中藤井', en: 'Naka-Fujii', zh: '中藤井', ko: '나카후지이', lo: 0, ne: 1, se: 1, co: 1, ra: 1, sp: 1, le: -1 }),
                withCoords('AR18', { name: '八重川', en: 'Yaegawa', zh: '八重川', ko: '야에가와', lo: 0, ne: 1, se: 1, co: 0, ra: 1, sp: 1, le: -1 }),
                withCoords('AR19', { name: '北八重', en: 'Kita-Yae', zh: '北八重', ko: '키타야에', lo: 0, ne: 0, se: 0, co: 0, ra: 0, sp: 1, le: -1 }),
                withCoords('AR20', { name: '須賀浦', en: 'Sugaura', zh: '须贺浦', ko: '스가우라', lo: 0, ne: 0, se: 0, co: 0, ra: 0, sp: 0, le: 0, transfers: [{ prefix: 'K', number: '16', lineName: 'KR線/KR Lines', color: '#0088ffff' }] }),
                withCoords('AR21', { name: '有電内浦', en: 'Arden-Uchiura', zh: '有电内浦', ko: '알덴우치우라', lo: 0, ne: 1, se: 1, co: 1, ra: 1, sp: 1, le: 1, transfers: [{ prefix: 'K', number: '17', lineName: 'KR島浜線(内浦駅)/KR-Tohin Line(Uchiura Sta.)', color: '#0088ffff' }] }),
                withCoords('AR22', { name: '想掛', en: 'Omoikake', zh: '想挂', ko: '오모이카케', lo: 0, ne: 0, se: 0, co: 0, ra: 0, sp: 1, le: 1 }),
                withCoords('AR23', { name: '東想掛', en: 'Higashi-Omoikake', zh: '东想挂', ko: '히가시오모이카케', lo: 0, ne: 0, se: 0, co: 0, ra: 1, sp: 1, le: 1 }),
                withCoords('AR24', { name: '有電美山', en: 'Aruden-Miyama', zh: '有电美山', ko: '알덴미야마', lo: 0, ne: 0, se: 1, co: 1, ra: 1, sp: 1, le: 1 }),
                withCoords('AR25', { name: '桜地メジロの森', en: 'Sakuraji-Mejironomori', zh: '樱地繡眼鳥之森', ko: '사쿠라지 동박새의 숲', lo: 0, ne: 1, se: 1, co: 1, ra: 1, sp: 1, le: 1 }),
                withCoords('AR26', { name: '桜地', en: 'Sakuraji', zh: '樱地', ko: '사쿠라지', lo: 0, ne: 0, se: 0, co: 0, ra: 0, sp: 0, le: 0, junction: 'AH03' }),
            ]
        },
        {
            lineId: 'AH',
            lineName: '東島線',
            color: '#49ce8f',
            trackBgColor: '#cff5e3',
            trackCenter: 1360,
            junctionOffset: 23,
            stations: [
                withCoords('AH01', { name: '高見浜', en: 'Takamihama', zh: '高见滨', ko: '타카미하마', lo: 0, ne: -1, se: -1, co: -1, ra: -1, sp: -1, le: -1 }),
                withCoords('AH02', { name: '東桜地', en: 'Higashi-Sakuraji', zh: '东樱地', ko: '히가시사쿠라지', lo: 0, ne: -1, se: -1, co: -1, ra: -1, sp: -1, le: -1 }),
                withCoords('AH03', { name: '桜地', en: 'Sakuraji', zh: '樱地', ko: '사쿠라지', lo: 0, ne: 0, se: 0, co: 0, ra: 0, sp: 0, le: 0, junction: 'AR26' }),
                withCoords('AH04', { name: '本広岡', en: 'Homhirōka', zh: '本广冈', ko: '혼히로오카', lo: 0, ne: 0, se: 0, co: 1, ra: 1, sp: 1, le: 1 }),
                withCoords('AH05', { name: '芝向', en: 'Shibanomukō', zh: '芝向', ko: '시바무카이', lo: 0, ne: 0, se: 0, co: 1, ra: 1, sp: 1, le: 1 }),
                withCoords('AH06', { name: '東島栄町', en: 'Higashijima-Sakaemachi', zh: '东岛荣町', ko: '히가시지마사카에마치', lo: 0, ne: 0, se: 0, co: 1, ra: 1, sp: 1, le: 1 }),
                withCoords('AH07', { name: '東島', en: 'Higashijima', zh: '东岛', ko: '히가시지마', lo: 0, ne: 0, se: 0, co: 0, ra: 0, sp: 0, le: 0 }),
                withCoords('AH08', { name: '東島河原', en: 'Higashijima-Gawara', zh: '东岛河岸', ko: '히가시지마카와라', lo: 0, ne: 0, se: 0, co: 0, ra: 0, sp: 0, le: -1 }),
                withCoords('AH09', { name: '北河原', en: 'Kitagawara', zh: '北河岸', ko: '키타가와라', lo: 0, ne: 0, se: 0, co: 0, ra: 0, sp: 0, le: -1 }),
            ]
        }
    ],
    branches: [
        {
            branchId: 'AR61',
            lineName: '新須賀浦支線',
            color: '#28baa5',
            parentLine: 'AR',
            parentStationId: 'AR19',
            station: withCoords('AR61', { name: '新須賀浦', en: 'Shin-Sugaura', zh: '新须贺浦', ko: '신스가우라', lo: 0, ne: 0, se: 0, co: 0, ra: 0, sp: 0, le: 0 })
        }
    ]
};

// ============================================================
// 全駅のフラットリスト（座標検索用）
// ============================================================
function buildAllStations() {
    const all = [];
    ROUTE_DATA.lines.forEach(line => {
        line.stations.forEach((st, idx) => {
            let vIdx = (line.junctionOffset || 0) + idx;
            if (line.lineId === 'AR' && idx >= 19) {
                vIdx += 1;
            }
            all.push({
                ...st,
                lineId: line.lineId,
                lineIndex: idx,
                trackCenter: line.trackCenter,
                visualIndex: vIdx
            });
        });
    });
    // 支線
    ROUTE_DATA.branches.forEach(br => {
        const parentLine = ROUTE_DATA.lines.find(l => l.lineId === br.parentLine);
        const parentIdx = parentLine?.stations.findIndex(s => s.id === br.parentStationId) ?? -1;
        let vIdx = parentIdx >= 0 ? parentIdx + 0.5 : 0;
        if (br.parentLine === 'AR' && parentIdx >= 18) {
            vIdx = parentIdx + 1.0;
        }
        all.push({
            ...br.station,
            lineId: br.parentLine,
            branchId: br.branchId,
            lineIndex: -1,
            trackCenter: parentLine?.trackCenter ? parentLine.trackCenter + 150 : 1110,
            visualIndex: vIdx
        });
    });
    return all;
}

export const ALL_STATIONS = buildAllStations();

/**
 * 座標から現在の状態を判定（複数路線対応）
 */
// 前回の駅IDを引数で受け取ることで、進行方向・駅間判定を強化できるようにする（次ステップで実装）
/**
 * 座標から現在の状態を判定（複数路線対応）
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {string|null} prevStationId 直前にいた駅ID（なければnull）
 * @param {string|null} destStationId 行先駅ID（なければnull）
 * @returns {object} 駅 or 駅間 or unknown
 */
export function evaluatePosition(x, y, z, prevStationId = null, destStationId = null) {
    const XZ_RADIUS = 175;
    const Y_RADIUS = 5;
    const TRACK_CORRIDOR_RADIUS = 175;
    const TRACK_Y_TOLERANCE = 50;

    const projectToSegment = (from, to) => {
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const lengthSquared = dx * dx + dz * dz;
        if (!lengthSquared) return null;
        const progress = ((x - from.x) * dx + (z - from.z) * dz) / lengthSquared;
        if (progress < 0 || progress > 1) return null;
        const projectedX = from.x + dx * progress;
        const projectedZ = from.z + dz * progress;
        const distanceXZ = Math.hypot(x - projectedX, z - projectedZ);
        const projectedY = from.y + (to.y - from.y) * progress;
        if (distanceXZ > TRACK_CORRIDOR_RADIUS || Math.abs(y - projectedY) > TRACK_Y_TOLERANCE) return null;
        return { progress, distanceXZ };
    };

    // 1. 全駅から最寄りを検索
    let bestMatch = null;
    let bestDist = Infinity;
    for (const st of ALL_STATIONS) {
        const dx = x - st.x;
        const dy = y - st.y;
        const dz = z - st.z;
        const distXZ = Math.sqrt(dx * dx + dz * dz);
        if (distXZ <= XZ_RADIUS && Math.abs(dy) <= Y_RADIUS) {
            if (distXZ < bestDist) {
                bestDist = distXZ;
                bestMatch = st;
            }
        }
    }

    // 駅範囲内なら駅として返す
    if (bestMatch) {
        return {
            type: 'station',
            stationId: bestMatch.branchId || bestMatch.id,
            lineId: bestMatch.lineId,
            progress: bestMatch.visualIndex,
            trackCenter: bestMatch.trackCenter
        };
    }

    // 2. 駅範囲外の場合、前いた駅と行先IDから進行方向を判定し、駅間を返す
    if (prevStationId && destStationId) {
        const prevIdx = ALL_STATIONS.findIndex(s => (s.branchId || s.id) === prevStationId);
        const destIdx = ALL_STATIONS.findIndex(s => (s.branchId || s.id) === destStationId);
        if (prevIdx !== -1 && destIdx !== -1) {
            // 進行方向: prev→dest
            // prevIdx < destIdx なら下り、prevIdx > destIdx なら上り
            const direction = destIdx > prevIdx ? 1 : -1;
            // 駅間区間の進捗を計算（prevIdxとdestIdxの間のどこにいるか）
            const prevSt = ALL_STATIONS[prevIdx];
            const destSt = ALL_STATIONS[destIdx];
            // 線形補間で進捗を出す
            const dx = destSt.x - prevSt.x;
            const dz = destSt.z - prevSt.z;
            const totalDist = Math.sqrt(dx * dx + dz * dz);
            const dxTrain = x - prevSt.x;
            const dzTrain = z - prevSt.z;
            // 駅間の進捗（0=prev駅, 1=dest駅）
            let progress = 0;
            if (totalDist > 0) {
                progress = (dx * dxTrain + dz * dzTrain) / (totalDist * totalDist);
                progress = Math.max(0, Math.min(1, progress));
            }
            const projectedX = prevSt.x + dx * progress;
            const projectedZ = prevSt.z + dz * progress;
            const projectedY = prevSt.y + (destSt.y - prevSt.y) * progress;
            if (Math.hypot(x - projectedX, z - projectedZ) <= TRACK_CORRIDOR_RADIUS &&
                Math.abs(y - projectedY) <= TRACK_Y_TOLERANCE) {
            // 画面上の位置
            const visualProgress = prevSt.visualIndex + (destSt.visualIndex - prevSt.visualIndex) * progress;
            return {
                type: 'transit',
                fromStationId: prevStationId,
                toStationId: destStationId,
                progress: visualProgress,
                trackCenter: prevSt.trackCenter,
                direction: direction > 0 ? 'down' : 'up',
                segment: `${prevSt.name} 〜 ${destSt.name}`
            };
            }
        }
    }

    // 3. それ以外は従来通り最寄り2駅で駅間判定
    let closestSegment = null;
    for (const line of ROUTE_DATA.lines) {
        const stations = ALL_STATIONS
            .filter(station => station.lineId === line.lineId)
            .sort((a, b) => a.visualIndex - b.visualIndex);
        for (let i = 0; i < stations.length - 1; i++) {
            const from = stations[i];
            const to = stations[i + 1];
            const projection = projectToSegment(from, to);
            if (!projection || (closestSegment && projection.distanceXZ >= closestSegment.distanceXZ)) continue;
            closestSegment = {
                type: 'transit',
                lineId: line.lineId,
                fromStationId: from.branchId || from.id,
                toStationId: to.branchId || to.id,
                segment: `${from.name} 〜 ${to.name}`,
                progress: from.visualIndex + (to.visualIndex - from.visualIndex) * projection.progress,
                trackCenter: from.trackCenter,
                distanceXZ: projection.distanceXZ
            };
        }
    }
    if (closestSegment) {
        delete closestSegment.distanceXZ;
        return closestSegment;
    }
    return { type: 'unknown', progress: -1 };
}
