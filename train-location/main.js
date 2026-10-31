
import { ROUTE_DATA, ALL_STATIONS, evaluatePosition } from './stations.js';

// Constants and Mappings
const WS_URL = 'wss://suzumiya-nas.tail61b99.ts.net/ws';
const REMOTE_URL = 'https://suzumiya-nas.tail61b99.ts.net/';

const TYPES = {
    0: "回送", 1: "回送", 2: "回送", 3: "臨時", 4: "回送", 5: "回送", 6: "回送",
    7: "各駅停車", 8: "区間快速", 9: "通勤快速", 10: "快速", 11: "新快速", 12: "特別快速"
};

const DESTINATIONS = {
    0: "", 1: "", 2: "有田", 3: "有電高柳", 4: "蹄光寺坂", 5: "本涼瀬", 6: "十全",
    7: "須賀浦", 8: "桜地", 9: "東島", 10: "北河原", 11: "高見浜",
    12: "新須賀浦", 13: "松森川", 14: "金城", 15: "糸里",
    16: "島見が丘", 17: "鴫野華瀬", 18: "城川芝浦"
};

const AR_TYPES = {
    default: { id: 'oo', name: '回送', class: 'type-oos' },
    7: { id: 'lo', name: '各停', class: 'type-local' },
    8: { id: 'se', name: '区快', class: 'type-sect-rapid' },
    9: { id: 'co', name: '通快', class: 'type-comm-rapid' },
    10: { id: 'ra', name: '快速', class: 'type-rapid' },
    11: { id: 'ne', name: '新快', class: 'type-new-rapid' },
    12: { id: 'sp', name: '特快', class: 'type-spec-rapid' },
    15: { id: 'le', name: '特急', class: 'type-ltd-exp' },
};

const AR_DISTS = {
    2: "有田",
    6: "十全",
    7: "須賀浦",
    8: "桜地",
    9: "東島",
    10: "北河原",
    11: "高見浜",
    12: "新須賀浦"
};

const STOP_TYPES = [
    { key: 'lo', name: '各停', color: '#757575' },
    { key: 'ne', name: '新快', color: '#8bc34a' },
    { key: 'se', name: '区快', color: '#00bcd4' },
    { key: 'co', name: '通快', color: '#ff8c00' },
    { key: 'ra', name: '快速', color: '#ff0000' },
    { key: 'sp', name: '特快', color: '#9c27b0' },
    { key: 'le', name: '特急', color: '#e91e63' }
];

// Application State
let ws = null;
let wsConnected = false;
let currentAuthStatus = 'offline'; // offline, password_required, authenticated
let currentPlayerData = null;
let assistPiPWindow = null;
let remoteFormations = [];
let activeTooltipMarker = null;
let activeTooltipFormationId = null;
let currentLineId = 'AR';

function generateStopBadgesHTML(st) {
    if (!st) return '';
    const badges = STOP_TYPES.filter(type => st[type.key] === 0 || st[type.key] === 2)
        .map(type => {
            const isPartial = st[type.key] === 2;
            if (isPartial) {
                const note = "平日朝9:00までの須賀浦・新須賀浦方面行のみ停車";
                return `<span class="stop-badge partial-stop" tabindex="0" style="background-color:${type.color};">${type.name}<span class="badge-tooltip">${note}</span></span>`;
            }
            return `<span class="stop-badge" style="background-color:${type.color};">${type.name}</span>`;
        })
        .join('');
    const transfers = generateTransfersHTML(st);
    if (!badges && !transfers) return '';
    return `<div class="station-stop-badges">${badges}${transfers}</div>`;
}

function generateTransfersHTML(st) {
    if (!st || !st.transfers || !st.transfers.length) return '';
    return st.transfers.map(tr => `
        <div class="station-transfer-group">
            <span class="transfer-label">乗換/Transfer：</span>
            <div class="transfer-badge" style="background-color: ${tr.color || '#005bac'};">
                <span class="transfer-prefix">${tr.prefix}</span>
                <span class="transfer-number">${tr.number}</span>
            </div>
            <span class="transfer-line-name">${tr.lineName}</span>
        </div>
    `).join('');
}

// クリックで一部停車バッジの注意書きポップアップをトグル表示（ドラッグ干渉防止）
document.addEventListener('click', (e) => {
    const badge = e.target.closest('.stop-badge.partial-stop');
    document.querySelectorAll('.stop-badge.partial-stop.active').forEach(b => {
        if (b !== badge) b.classList.remove('active');
    });
    if (badge) {
        e.stopPropagation();
        badge.classList.toggle('active');
    }
});

document.addEventListener('mousedown', (e) => {
    const badge = e.target.closest('.stop-badge.partial-stop');
    if (badge) {
        e.stopPropagation();
    }
});

const NON_REVENUE_MAX_TYPE = 6;
const ROUTE_MAP_SCROLL_KEY = 'aruden_route_map_scroll';
const REMOTE_TYPE_VALUES = new Set(Object.keys(TYPES).map(Number));
const REMOTE_DEST_VALUES = new Set([
    ...Object.keys(DESTINATIONS).map(Number),
    ...Object.keys(AR_DISTS).map(Number)
]);
const REMOTE_TYPE_LABEL_TO_VALUE = new Map(
    Object.entries(TYPES).map(([value, label]) => [label, Number(value)])
);
const REMOTE_DEST_LABEL_TO_VALUE = new Map(
    [...Object.entries(DESTINATIONS), ...Object.entries(AR_DISTS)].map(([value, label]) => [label, Number(value)])
);

const TRAIN_PRIORITY = {
    'type-ltd-exp': 100,
    'type-spec-rapid': 90,
    'type-rapid': 80,
    'type-comm-rapid': 70,
    'type-sect-rapid': 60,
    'type-new-rapid': 50,
    'type-local': 10,
    'type-oos': 0
};
let mapPanX = 0;
let mapPanY = 0;
let isDragging = false;
let dragStartX, dragStartY;

// DOM Elements
const eStatus = document.getElementById('ws-status');
const routeContainer = document.getElementById('route-container');
const stationsContainer = document.getElementById('stations-container');
const trainsContainer = document.getElementById('trains-container');
const routeMap = document.getElementById('route-map');
const authInit = document.getElementById('auth-initial');
const authSetPwd = document.getElementById('auth-set-password');
const authSuccess = document.getElementById('auth-success');
const authError = document.getElementById('auth-error-msg');
const loggedInPlayerMsg = document.getElementById('logged-in-player');

// Route settings
const STATION_SPACING = 125; // pixels between stations (+25% height increase)

// Map elements
const trainElements = new Map();

// --- Initialization ---
function init() {
    renderStations();
    restoreRouteMapScroll();
    setupWebSocket();
    setupEventListeners();

    // Auto populate saved ID
    if (localStorage.getItem('aruden_player_id')) {
        document.getElementById('player-id-input').value = localStorage.getItem('aruden_player_id');
    }

    // Start periodic remote fetch
    fetchRemoteTrains();
    setInterval(fetchRemoteTrains, 5000);
}

function normalizeRemoteButtonText(text) {
    return typeof text === 'string' ? text.trim().replace(/行$/, '') : '';
}

function readNumericButtonValue(button) {
    const value = Number(button?.value);
    return Number.isFinite(value) ? value : null;
}

function findRemoteButtonValue(customButtons, allowedValues, labelToValue, fallbackIndex) {
    const matchedButton = (customButtons || []).find(button => {
        const value = readNumericButtonValue(button);
        if (value === null || !allowedValues.has(value)) return false;

        const normalizedText = normalizeRemoteButtonText(button.text);
        return !normalizedText || labelToValue.get(normalizedText) === value;
    });

    if (matchedButton) {
        return readNumericButtonValue(matchedButton) ?? 0;
    }

    const fallbackValue = readNumericButtonValue(customButtons?.[fallbackIndex]);
    return fallbackValue !== null && allowedValues.has(fallbackValue) ? fallbackValue : 0;
}

function getRemoteDestinationText(customButtons, destinationValue, fallbackIndex = 1) {
    const mappedDestination = DESTINATIONS[destinationValue] || AR_DISTS[destinationValue];
    if (mappedDestination) return mappedDestination;

    return normalizeRemoteButtonText(customButtons?.[fallbackIndex]?.text);
}

function isNonRevenueType(type) {
    return type >= 0 && type <= NON_REVENUE_MAX_TYPE;
}

function getTypeInfo(type) {
    if (isNonRevenueType(type)) {
        return { id: `nr-${type}`, name: TYPES[type] || AR_TYPES.default.name, class: AR_TYPES.default.class };
    }

    return AR_TYPES[type] || { id: 'lo', name: '各停', class: 'type-local' };
}

function formatTrainTypeDestination(typeInfo, destinationName, hideDestination = false) {
    if (hideDestination || !destinationName) {
        return typeInfo.name;
    }

    return `${typeInfo.name} ${destinationName}行`;
}

function getHudDestination(type, destination) {
    if (isNonRevenueType(type)) {
        return '---';
    }

    return DESTINATIONS[destination] || AR_DISTS[destination] || '---';
}

function getTrainMarkerOffset(dir, index, groupSize) {
    if (groupSize <= 1) {
        return dir === 'up' ? -44 : 30;
    }

    const step = 32;
    const outerBase = dir === 'up' ? -76 : 62;
    return outerBase + (dir === 'up' ? -step * index : step * index);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildTrainTooltip(item) {
    const { formation: f, typeInfo, company, rollingStock, finalDestName, SZ_type, SZ_dist } = item;
    const isOOS = isNonRevenueType(SZ_type);
    const destinationText = isOOS ? '表示なし' : `${finalDestName || getHudDestination(SZ_type, SZ_dist) || '不明'}行`;
    const driverText = f.driver || '---';
    const speedText = `${Math.round(f.speedKmh || 0)} km/h`;
    const notchText = `${f.notch ?? '---'}`;
    const signalText = `${f.signal ?? '---'}`;

    return `
        <div class="train-tooltip" role="dialog" aria-label="列車情報">
            <div class="tooltip-header">
                <span class="t-company">${escapeHtml(company.name)}</span>
                <span class="t-stock">${escapeHtml(rollingStock || '形式不明')}</span>
            </div>
            <div class="tooltip-main">
                <span class="t-type ${typeInfo.class}">${escapeHtml(typeInfo.name)}</span>
                <span class="t-arrow">→</span>
                <span class="t-dest">${escapeHtml(destinationText)}</span>
            </div>
            ${isOOS ? '<div class="oos-notice">回送系統のため行先は非表示です</div>' : ''}
            <div class="tooltip-stops">
                <div class="stop-row"><span class="stop-name">列車番号</span><span class="stop-time">${escapeHtml(f.trainNumber || '---')}</span></div>
                <div class="stop-row"><span class="stop-name">速度</span><span class="stop-time">${escapeHtml(speedText)}</span></div>
                <div class="stop-row"><span class="stop-name">ノッチ</span><span class="stop-time">${escapeHtml(notchText)}</span></div>
                <div class="stop-row"><span class="stop-name">信号</span><span class="stop-time">${escapeHtml(signalText)}</span></div>
                <div class="stop-row"><span class="stop-name">運転士</span><span class="stop-time">${escapeHtml(driverText)}</span></div>
            </div>
        </div>
    `;
}

function closeActiveTooltip() {
    if (activeTooltipMarker) {
        activeTooltipMarker.classList.remove('active');
        activeTooltipMarker.setAttribute('aria-expanded', 'false');
    }

    activeTooltipMarker = null;
    activeTooltipFormationId = null;
}

function setActiveTooltip(marker, formationId) {
    if (activeTooltipMarker && activeTooltipMarker !== marker) {
        activeTooltipMarker.classList.remove('active');
        activeTooltipMarker.setAttribute('aria-expanded', 'false');
    }

    activeTooltipMarker = marker;
    activeTooltipFormationId = String(formationId);
    marker.classList.add('active');
    marker.setAttribute('aria-expanded', 'true');
}

function toggleTooltip(marker, formationId) {
    if (activeTooltipMarker === marker) {
        closeActiveTooltip();
        return;
    }

    setActiveTooltip(marker, formationId);
}

function saveRouteMapScroll() {
    if (!routeMap) return;

    localStorage.setItem(ROUTE_MAP_SCROLL_KEY, JSON.stringify({
        left: routeMap.scrollLeft,
        top: routeMap.scrollTop
    }));
}

function centerStationNode() {
    if (!routeMap) return;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const mainTrackCenter = ROUTE_DATA.lines[0]?.trackCenter ?? 960;
            const targetLeft = mainTrackCenter - (routeMap.clientWidth / 2);
            routeMap.scrollLeft = Math.max(0, targetLeft);
        });
    });
}

function restoreRouteMapScroll() {
    if (!routeMap) return;

    const raw = localStorage.getItem(ROUTE_MAP_SCROLL_KEY);
    if (!raw) {
        centerStationNode();
        return;
    }

    try {
        const saved = JSON.parse(raw);
        const left = Number(saved?.left);
        const top = Number(saved?.top);
        if (!Number.isFinite(left) && !Number.isFinite(top)) {
            centerStationNode();
            return;
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                routeMap.scrollTo(
                    Number.isFinite(left) ? left : routeMap.scrollLeft,
                    Number.isFinite(top) ? top : routeMap.scrollTop
                );
            });
        });
    } catch (error) {
        console.warn('Failed to restore route map scroll:', error);
        centerStationNode();
    }
}

// --- Render Stations ---
function renderStations() {
    if (!routeContainer || !stationsContainer) return;
    stationsContainer.innerHTML = '';
    const oldBgs = routeContainer.querySelectorAll('.route-line-bg');
    oldBgs.forEach(bg => bg.remove());

    // 画面幅の 1/4 (25%) 点を現在選択中の路線の trackCenter に設定
    const viewWidth = routeMap ? routeMap.clientWidth : window.innerWidth;
    const mainTrackCenter = Math.max(350, Math.round(viewWidth * 0.25));

    // 現在選択されている路線のみを取得
    const activeLines = ROUTE_DATA.lines.filter(l => l.lineId === currentLineId);

    let maxVisualIdx = 0;
    activeLines.forEach(line => {
        line.trackCenter = mainTrackCenter;
        const lineStationCount = line.stations.length;
        if (lineStationCount - 1 > maxVisualIdx) maxVisualIdx = lineStationCount - 1;
    });

    // 支線のチェック
    const activeBranches = ROUTE_DATA.branches.filter(br => br.parentLine === currentLineId);

    const totalHeight = (maxVisualIdx + 4) * STATION_SPACING;
    routeContainer.style.height = `${totalHeight}px`;

    // 1) 支線の描画 (本線の背後に配置するため先にレンダリング)
    activeBranches.forEach(br => {
        const parentLine = activeLines.find(l => l.lineId === br.parentLine);
        if (!parentLine) return;
        const parentIdx = parentLine.stations.findIndex(s => s.id === br.parentStationId);
        if (parentIdx === -1) return;

        const parentYPos = parentIdx * STATION_SPACING; // 北八重 (1800px)
        const nextYPos = (parentIdx + 2) * STATION_SPACING; // 須賀浦 (2000px)
        const branchYPos = (parentIdx + 1) * STATION_SPACING; // 新須賀浦 (1900px)

        // 本線側の分岐点(1750px)・合流点(2050px)は固定
        const topStartY = parentYPos - 0.5 * STATION_SPACING; // 1750px
        const bottomEndY = nextYPos + 0.5 * STATION_SPACING; // 2050px

        // 支線ノード(1800px / 2000px)から 1/4駅分(25px) だけ上・下に垂直直線延伸
        const quarterOffset = 0.25 * STATION_SPACING; // 25px
        const branchTopY = parentYPos - quarterOffset; // 1775px
        const branchBottomY = nextYPos + quarterOffset; // 2025px

        const mainX = parentLine.trackCenter;
        const branchX = mainX + 150;
        const parentLineColor = parentLine.color;
        const trackBgColor = parentLine.trackBgColor || '#bfe4eb';

        const idMatch = br.branchId.match(/^([A-Z]+)(\d+)$/);
        const prefix = idMatch ? idMatch[1] : '';
        const number = idMatch ? idMatch[2] : br.branchId;
        const st = br.station;
        const zhKo = [st.zh, st.ko].filter(s => s).join(' / ') || '';

        const startX = mainX + 2;

        const containerDiv = document.createElement('div');
        containerDiv.className = 'branch-bypass-group';

        containerDiv.innerHTML = `
            <!-- 一体成形 SVG 支線トラック (本線幅 7px と完全統一・本線左側へのはみ出し完全排除) -->
            <svg style="position:absolute; left:0; top:0; width:100%; height:100%; pointer-events:none; z-index:1; overflow:visible;">
                <!-- 外側枠線 (全幅 7px) -->
                <path d="M ${startX} ${topStartY} L ${branchX} ${branchTopY} L ${branchX} ${branchBottomY} L ${startX} ${bottomEndY}" stroke="${parentLineColor}33" stroke-width="7" stroke-linejoin="round" stroke-linecap="butt" fill="none" />
                <!-- 内側線路背景 (内幅 3px) -->
                <path d="M ${startX} ${topStartY} L ${branchX} ${branchTopY} L ${branchX} ${branchBottomY} L ${startX} ${bottomEndY}" stroke="${trackBgColor}" stroke-width="3" stroke-linejoin="round" stroke-linecap="butt" fill="none" />
            </svg>

            <!-- 支線ノード -->
            <div class="station-node" style="left:${branchX}px; top:${parentYPos}px; border-color:${parentLineColor}; z-index:100; background-color:#ffffff;"></div>
            <div class="station-node" style="left:${branchX}px; top:${nextYPos}px; border-color:${parentLineColor}; z-index:100; background-color:#ffffff;"></div>

            <!-- 新須賀浦 (AR61) マーカ -->
            <div class="station-marker branch-station" style="top:${branchYPos}px;">
                <div class="station-connector" style="left:${branchX}px; width:460px; background-color:${parentLineColor}; top:6px; z-index:0;"></div>
                <div class="station-node" style="left:${branchX}px; top:0; border-color:${parentLineColor}"></div>
                <div class="station-name-main-group" style="left:${branchX + 230}px">
                    <div class="station-name">${st.name}</div>
                    <div class="station-en-name">${st.en || ''}</div>
                </div>
                <div class="station-id-box" style="left:${branchX + 470}px; top:-20px; border-color:${br.color}">
                    <div class="station-id-prefix">${prefix}</div>
                    <div class="station-id-number">${number}</div>
                    ${generateStopBadgesHTML(st)}
                </div>
                <div class="station-sub-name-group" style="left:${branchX + 230}px; width:230px; text-align:right; top:8px;">
                    <div class="station-zh-ko-name">${zhKo}</div>
                </div>
            </div>
        `;
        stationsContainer.appendChild(containerDiv);
    });

    // 2) アクティブな本線の描画 (z-index: 2 で支線の斜め線の上にかぶさる)
    activeLines.forEach(line => {
        const lineStationCount = line.stations.length + (line.lineId === 'AR' ? 1 : 0);

        // Track line background
        const trackBg = document.createElement('div');
        trackBg.className = 'route-line-bg';
        trackBg.style.left = `${line.trackCenter}px`;
        trackBg.style.top = `0px`;
        trackBg.style.height = `${(lineStationCount - 1) * STATION_SPACING}px`;
        trackBg.style.borderColor = line.color + '33';
        trackBg.style.backgroundColor = line.trackBgColor || '#bfe4eb';
        routeContainer.appendChild(trackBg);

        // Stations
        line.stations.forEach((st, idx) => {
            let visualIdx = idx;
            if (line.lineId === 'AR' && idx >= 19) {
                visualIdx = idx + 1;
            }
            const yPos = visualIdx * STATION_SPACING;
            const stDiv = document.createElement('div');
            stDiv.className = `station-marker line-${line.lineId}`;
            stDiv.style.top = `${yPos}px`;

            const idMatch = st.id.match(/^([A-Z]+)(\d+)$/);
            const prefix = idMatch ? idMatch[1] : '';
            const number = idMatch ? idMatch[2] : st.id;
            const zhKo = [st.zh, st.ko].filter(s => s).join(' / ') || '';

            // Line-specific positioning
            const nodeLeft = line.trackCenter;
            const labelLeft = 30;
            const isExtended = (st.id === 'AR19' || st.id === 'AR20');
            const targetX = isExtended ? (nodeLeft + 150) : nodeLeft;
            const connectorWidth = targetX - (labelLeft + 54);
            const idBoxLeft = labelLeft;

            stDiv.innerHTML = `
                <div class="station-id-box" style="left:${idBoxLeft}px; border-color:${line.color}">
                    <div class="station-id-prefix">${prefix}</div>
                    <div class="station-id-number">${number}</div>
                    ${generateStopBadgesHTML(st)}
                </div>
                <div class="station-name-main-group" style="left:${labelLeft + 54}px">
                    <div class="station-name">${st.name}</div>
                    <div class="station-en-name">${st.en || ''}</div>
                </div>
                <div class="station-sub-name-group" style="left:${labelLeft + 54}px">
                    <div class="station-zh-ko-name">${zhKo}</div>
                </div>
                <div class="station-connector" style="left:${labelLeft + 54}px; width:${connectorWidth}px; background-color:${line.color}; top:6px; z-index:0;"></div>
                <div class="station-node" style="left:${nodeLeft}px; top:0; border-color:${line.color}"></div>
            `;
            stationsContainer.appendChild(stDiv);
        });
    });
}

// --- WebSocket ---
function setupWebSocket() {
    setStatus('connecting...');
    console.log(`🔌 Attempting WebSocket connection to ${WS_URL}...`);
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        wsConnected = true;
        setStatus('Online', 'online');
        console.log(`✅ WebSocket Connected to ${WS_URL}`);
        // Auto-login if we have session data
        const savedId = sessionStorage.getItem('aruden_session_id');
        const savedPwd = sessionStorage.getItem('aruden_session_pwd');
        if (savedId && savedPwd) {
            ws.send(JSON.stringify({ action: 'auth_login', playerId: savedId, password: savedPwd }));
        }
    };

    ws.onclose = (e) => {
        wsConnected = false;
        setStatus('Offline', 'offline');
        console.log(`❌ WebSocket Disconnected (code: ${e.code}). Retrying in 5s...`);
        setTimeout(setupWebSocket, 5000); // Reconnect
    };

    ws.onerror = (e) => {
        console.warn(`⚠️ WebSocket Connection Error:`, e);
    };

    ws.onmessage = (e) => {
        try {
            console.log(`📩 WebSocket Received:`, e.data);
            const data = JSON.parse(e.data);
            if (data.type === 'auth_response') handleAuthResponse(data);
            else if (data.type === 'driver_assist' || data.type === 'driver_assist_v2') handleDriverAssist(data);
        } catch (err) {
            console.error('JSON parse error:', err);
        }
    };
}

// --- Handlers ---
async function fetchRemoteTrains() {
    if (wsConnected) return; // Skip if WebSocket is connected

    try {
        const response = await fetch(REMOTE_URL);
        if (!response.ok) return;

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            // HTML等が返ってきた場合（API未接続・プロキシ未起動・エラーページ）はパースせずに安全に終了
            return;
        }

        const json = await response.json();

        // Map to our internal format
        const rawData = Array.isArray(json) ? json : (json.data || []);
        remoteFormations = rawData.map(f => {
            const customButtons = Array.isArray(f.customButton) ? f.customButton : [];

            let szTypeValue = findRemoteButtonValue(customButtons, REMOTE_TYPE_VALUES, REMOTE_TYPE_LABEL_TO_VALUE, 0);
            let szDistValue = findRemoteButtonValue(customButtons, REMOTE_DEST_VALUES, REMOTE_DEST_LABEL_TO_VALUE, 1);

            // Override with dataMap if available for more reliable parsing
            if (f.dataMap) {
                if (f.dataMap.SZ_type !== undefined) szTypeValue = Number(f.dataMap.SZ_type) || szTypeValue;
                else if (f.dataMap.Button0 !== undefined) szTypeValue = Number(f.dataMap.Button0) || szTypeValue;

                if (f.dataMap.SZ_dist !== undefined) szDistValue = Number(f.dataMap.SZ_dist) || szDistValue;
                else if (f.dataMap.Button1 !== undefined) szDistValue = Number(f.dataMap.Button1) || szDistValue;
            }

            return {
                formationId: f.formation,
                trainNumber: f.name,
                posX: f.pos.x,
                posY: f.pos.y,
                posZ: f.pos.z,
                speedKmh: f.speed,
                notch: f.notch,
                signal: f.signal,
                driver: f.driver,
                uuid: f.uuid, // Pass uuid if available
                dataMap: f.dataMap, // Keep dataMap for HUD resolution
                buttons: {
                    Button0: szTypeValue,
                    Button1: szDistValue
                },
                remoteDestText: getRemoteDestinationText(customButtons, szDistValue),
                trainStateData: f.trainStateData,
                isRemote: true
            };
        });

        renderTrains(remoteFormations);
    } catch (err) {
        // パースエラーや接続不可の時はコンソールを汚さず静かに無視
    }
}

/**
 * Fetch Minecraft player name from UUID via Mojang API.
 * Uses a CORS proxy since Mojang's sessionserver doesn't allow browser requests.
 * Falls back to cached name in localStorage.
 */
async function fetchPlayerNameFromUUID(uuid) {
    // Check localStorage cache first
    const cacheKey = `aruden_name_${uuid}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;

    // Strip dashes from UUID for Mojang API
    const cleanUUID = uuid.replace(/-/g, '');

    // 1) Try Mojang sessionserver via CORS proxy
    try {
        const mojangUrl = `https://sessionserver.mojang.com/session/minecraft/profile/${cleanUUID}`;
        const resp = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(mojangUrl)}`);
        if (resp.ok) {
            const profile = await resp.json();
            if (profile && profile.name) {
                localStorage.setItem(cacheKey, profile.name);
                return profile.name;
            }
        }
    } catch (e) {
        console.warn('Mojang sessionserver (via proxy) failed:', e);
    }

    // 2) Fallback: mc-heads API (CORS-friendly)
    try {
        const resp = await fetch(`https://mc-heads.net/minecraft/profile/${cleanUUID}`);
        if (resp.ok) {
            const profile = await resp.json();
            if (profile && profile.name) {
                localStorage.setItem(cacheKey, profile.name);
                return profile.name;
            }
        }
    } catch (e) {
        console.warn('mc-heads API also failed:', e);
    }

    return null;
}

function handleAuthResponse(data) {
    if (data.status === 'error') {
        showAuthError(data.message);
        currentPlayerData = null;
        localStorage.removeItem('aruden_player_id');
        sessionStorage.removeItem('aruden_session_id');
        sessionStorage.removeItem('aruden_session_pwd');
        checkAuthStatus();
        return;
    }

    currentPlayerData = {
        uuid: data.uuid,
        name: data.name,
        playerId: data.playerId,
        status: data.status
    };

    localStorage.setItem('aruden_player_id', data.playerId);

    // If successfully authenticated, store for session persistence
    if (data.status === 'authenticated' || data.status === 'password_set') {
        const pwd = document.getElementById('password-input').value ||
            document.getElementById('new-password-input').value ||
            sessionStorage.getItem('aruden_session_pwd');

        if (pwd) {
            sessionStorage.setItem('aruden_session_id', data.playerId);
            sessionStorage.setItem('aruden_session_pwd', pwd);
        }
    }

    showAuthError('');

    if (data.status === 'password_required') {
        authInit.style.display = 'none';
        authSetPwd.style.display = 'block';
        authSuccess.style.display = 'none';
    } else if (data.status === 'authenticated' || data.status === 'password_set') {
        // If name is missing/Unknown, try to resolve it from UUID before updating UI
        if ((!data.name || data.name === 'Unknown') && data.uuid) {
            fetchPlayerNameFromUUID(data.uuid).then(resolvedName => {
                if (resolvedName && currentPlayerData) {
                    currentPlayerData.name = resolvedName;
                }
                checkAuthStatus();
            });
        } else {
            checkAuthStatus();
        }
    }
}

/**
 * Train company/stock classification helpers
 */
function getTrainCompany(trainName) {
    if (!trainName) return { code: 'AR', name: '有田電鉄' };
    const lower = trainName.toLowerCase();
    if (lower.startsWith('sz')) return { code: 'AR', name: '有田電鉄' };
    if (lower.startsWith('kk')) return { code: 'KK', name: '京北鉄道' };
    if (lower.startsWith('sk')) return { code: 'SK', name: '城川電鉄' };
    if (lower.startsWith('mk')) return { code: 'MK', name: '三川電鉄' };
    if (lower.startsWith('mn')) return { code: 'MN', name: '美菜丘鉄道' };
    return { code: 'AR', name: '有田電鉄' };
}

function getRollingStock(trainName, company) {
    if (!trainName) return '';
    const match = trainName.match(/\d+/);
    if (!match) return '';
    const num = parseInt(match[0]);
    if (company.code === 'AR') {
        const series = Math.floor(num / 1000) * 1000;
        return `${series}系`;
    }
    return '';
}

/**
 * Render all train markers on the route map (multi-line)
 */
function renderTrains(formations) {
    const container = document.getElementById('trains-container');
    const groups = {};

    // 同じformationIdのformationを1つにまとめる（trainStateData[10] === 0 のものを優先）
    const uniqueFormations = new Map();
    formations.forEach(f => {
        const current = uniqueFormations.get(f.formationId);
        const isPreferred = f.trainStateData && f.trainStateData[10] === 0;
        const currentPreferred = current && current.trainStateData && current.trainStateData[10] === 0;

        if (!current || (isPreferred && !currentPreferred)) {
            uniqueFormations.set(f.formationId, f);
        }
    });
    const processedFormations = Array.from(uniqueFormations.values());

    // 駅間判定のため、各編成ごとに前回の駅IDを保持する（簡易: formationIdごとにメモリ）
    const lastStationMap = new Map();
    processedFormations.forEach(f => {
        const SZ_type = f.buttons?.Button0 || 0;
        const SZ_dist = f.buttons?.Button1 || 0;
        const trainName = f.trainNumber || f.formationId;

        // --- Company & Filtering ---
        const company = getTrainCompany(trainName);
        const rollingStock = getRollingStock(trainName, company);
        if (company.code === 'AR' && SZ_type >= 13) return;

        // 行先駅IDを取得
        const destName = DESTINATIONS[SZ_dist] || AR_DISTS[SZ_dist];
        const destStation = ALL_STATIONS.find(s => s.name === destName);
        const destStationId = destStation ? (destStation.branchId || destStation.id) : null;

        // 前回の駅IDを編成ごとに記憶
        let prevStationId = lastStationMap.get(f.formationId) || null;

        // 位置判定
        const evalPos = evaluatePosition(f.posX, f.posY, f.posZ, prevStationId, destStationId);

        // 駅に入ったらprevStationIdを更新
        if (evalPos.type === 'station') {
            lastStationMap.set(f.formationId, evalPos.stationId);
        }

        // 駅・駅間以外は描画しない
        if (!evalPos.stationId && evalPos.type !== 'transit') return;

        // 進行方向
        let dir = 'down';
        if (evalPos.direction) {
            dir = evalPos.direction;
        } else if (destStation && evalPos.stationId) {
            const currentStation = ALL_STATIONS.find(s => s.id === evalPos.stationId);
            if (destStation && currentStation) {
                if (destStation.visualIndex < currentStation.visualIndex) {
                    dir = 'up';
                }
            }
        }

        const finalDestName = normalizeRemoteButtonText(destName || f.remoteDestText || '不明');
        const trackCenter = evalPos.trackCenter || 960;

        const lineId = evalPos.lineId || (destStation ? destStation.lineId : 'AR');
        if (lineId !== currentLineId) return;

        const key = `${evalPos.stationId || evalPos.segment}_${dir}_${lineId}`;
        if (!groups[key]) groups[key] = [];

        const typeInfo = getTypeInfo(SZ_type);
        groups[key].push({
            formation: f,
            typeInfo,
            evalPos,
            dir,
            SZ_type,
            SZ_dist,
            finalDestName,
            trackCenter,
            company,
            rollingStock
        });
    });

    container.innerHTML = '';
    let restoredTooltip = false;

    Object.values(groups).forEach(group => {
        group.sort((a, b) => (TRAIN_PRIORITY[b.typeInfo.class] || 0) - (TRAIN_PRIORITY[a.typeInfo.class] || 0));

        group.forEach((item, index) => {
            const { formation: f, typeInfo, evalPos, dir, SZ_type, SZ_dist, finalDestName, trackCenter } = item;
            const el = document.createElement('div');
            const isOOS = isNonRevenueType(SZ_type);
            const markerOffset = getTrainMarkerOffset(dir, index, group.length);
            const typeDestinationText = formatTrainTypeDestination(typeInfo, finalDestName, isOOS);

            const topPos = evalPos.progress * STATION_SPACING;
            const leftPos = trackCenter;

            el.className = `train-marker ${isOOS ? 'non-commercial' : 'commercial'} dir-${dir} ${typeInfo.class}`;
            el.style.top = `${topPos}px`;
            el.style.left = `${leftPos}px`;
            el.style.transform = `translate(${markerOffset}px, -50%)`;
            el.setAttribute('role', 'button');
            el.setAttribute('tabindex', '0');
            el.setAttribute('aria-expanded', 'false');

            el.innerHTML = `
                <div class="train-icon"></div>
                <div class="train-label-info">
                    <div class="train-name">${f.trainNumber || ''}</div>
                    <div class="train-type-dest">${typeDestinationText}</div>
                </div>
                ${buildTrainTooltip(item)}
            `;

            el.addEventListener('click', (event) => {
                event.stopPropagation();
                toggleTooltip(el, f.formationId);
            });
            el.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleTooltip(el, f.formationId);
                }
            });

            if (activeTooltipFormationId && String(f.formationId) === activeTooltipFormationId) {
                setActiveTooltip(el, f.formationId);
                restoredTooltip = true;
            }

            container.appendChild(el);

            if (currentPlayerData && ((f.uuid && f.uuid === currentPlayerData.uuid) || (f.driver && f.driver === currentPlayerData.name))) {
                updateHUD({
                    speed: f.speedKmh,
                    notch: f.notch,
                    signal: f.signal,
                    destination: getHudDestination(SZ_type, SZ_dist),
                    dataMap: f.dataMap
                });
            }
        });
    });

    if (activeTooltipFormationId && !restoredTooltip) {
        closeActiveTooltip();
    }
}

function handleDriverAssist(data) {
    let szType = data.szType || 0;
    let szDist = data.szDist || 0;

    if (data.dataMap) {
        if (data.dataMap.SZ_type !== undefined) szType = Number(data.dataMap.SZ_type) || szType;
        else if (data.dataMap.Button0 !== undefined) szType = Number(data.dataMap.Button0) || szType;

        if (data.dataMap.SZ_dist !== undefined) szDist = Number(data.dataMap.SZ_dist) || szDist;
        else if (data.dataMap.Button1 !== undefined) szDist = Number(data.dataMap.Button1) || szDist;
    }

    // Update HUD in PiP window
    updateHUD({
        speed: (data.speedKmh / 20),
        notch: data.notch,
        signal: data.signal,
        trainNumber: (data.trainNumber && data.trainNumber !== 'no_name') ? data.trainNumber : '---',
        type: TYPES[szType] || '---',
        destination: getHudDestination(szType, szDist),
        dataMap: data.dataMap
    });
}

// --- UI Helpers ---
function createTrainMarker(f) {
    const div = document.createElement('div');
    div.className = 'train-marker';
    div.innerHTML = `
        <div class="train-icon"></div>
        <div class="train-label">
            <div class="train-name"></div>
            <div class="train-dest"></div>
        </div>
    `;
    return div;
}

function setStatus(text, className = '') {
    eStatus.textContent = text;
    eStatus.className = className;
}

function showAuthError(msg) {
    authError.textContent = msg;
}

function checkAuthStatus() {
    if (currentPlayerData && (currentPlayerData.status === 'authenticated' || currentPlayerData.status === 'password_set')) {
        document.getElementById('auth-initial').style.display = 'none';
        document.getElementById('auth-set-password').style.display = 'none';
        document.getElementById('auth-success').style.display = 'block';

        // Determine display name: use resolved name, skip 'Unknown' and raw UUIDs
        let dispName = currentPlayerData.name;
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!dispName || dispName === 'Unknown' || isUUID.test(dispName)) {
            // Check localStorage cache as last resort
            const cached = currentPlayerData.uuid ? localStorage.getItem(`aruden_name_${currentPlayerData.uuid}`) : null;
            dispName = cached || 'Loading...';

            // If still unknown, trigger async lookup
            if (!cached && currentPlayerData.uuid) {
                fetchPlayerNameFromUUID(currentPlayerData.uuid).then(name => {
                    if (name && currentPlayerData) {
                        currentPlayerData.name = name;
                        loggedInPlayerMsg.textContent = name;
                    } else {
                        loggedInPlayerMsg.textContent = 'ID: ' + (currentPlayerData.playerId || '---');
                    }
                });
            }
        }
        loggedInPlayerMsg.textContent = dispName;

        // Update header user icon https://minotar.net/helm/SuzumiyaTrainer/600.png
        const avatarUrl = `https://mc-heads.net/avatar/${currentPlayerData.uuid}/64.png`;
        document.getElementById('user-icon-placeholder').style.display = 'none';
        const img = document.getElementById('user-avatar-img');
        img.src = avatarUrl;
        img.style.display = 'block';

        // Update modal profile
        document.getElementById('profile-avatar').src = avatarUrl;

    } else if (currentPlayerData && currentPlayerData.status === 'password_required') {
        document.getElementById('auth-initial').style.display = 'none';
        document.getElementById('auth-set-password').style.display = 'block';
        document.getElementById('auth-success').style.display = 'none';
    }
    else {
        document.getElementById('auth-initial').style.display = 'block';
        document.getElementById('auth-set-password').style.display = 'none';
        document.getElementById('auth-success').style.display = 'none';

        // Reset header icon
        document.getElementById('user-icon-placeholder').style.display = 'flex';
        document.getElementById('user-avatar-img').style.display = 'none';
        document.getElementById('profile-avatar').src = '';
        loggedInPlayerMsg.textContent = '---';
    }
}

function handleTokenLogin() {
    const token = document.getElementById('token-input').value.trim();
    if (token && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'auth_token', token }));
    }
}

function handlePasswordLogin() {
    const playerId = document.getElementById('player-id-input').value.trim();
    const pwd = document.getElementById('password-input').value;
    if (playerId && pwd && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'auth_login', playerId, password: pwd }));
    }
}

function handleSetPassword() {
    const pwd = document.getElementById('new-password-input').value;
    if (pwd.length >= 8 && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            action: 'set_password',
            password: pwd,
            name: currentPlayerData ? currentPlayerData.name : 'Unknown'
        }));
    } else {
        showAuthError('パスワードは8文字以上必要です。');
    }
}

function handleLogout() {
    currentPlayerData = null;
    localStorage.removeItem('aruden_player_id');
    sessionStorage.removeItem('aruden_session_id');
    sessionStorage.removeItem('aruden_session_pwd');
    checkAuthStatus();
    document.getElementById('password-input').value = '';
    document.getElementById('token-input').value = '';
    document.getElementById('new-password-input').value = '';
}

// --- Event Listeners ---
function setupEventListeners() {
    // Modal & Menu Event Listeners
    document.getElementById('user-toggle').addEventListener('click', () => {
        document.getElementById('login-modal').style.display = 'flex';
    });

    document.getElementById('modal-close').addEventListener('click', () => {
        document.getElementById('login-modal').style.display = 'none';
    });

    document.getElementById('menu-toggle').addEventListener('click', toggleAssistPiP);

    document.getElementById('btn-token-login').addEventListener('click', handleTokenLogin);
    document.getElementById('btn-password-login').addEventListener('click', handlePasswordLogin);
    document.getElementById('btn-set-password').addEventListener('click', handleSetPassword);
    document.getElementById('btn-logout').addEventListener('click', handleLogout);

    if (routeMap) {
        routeMap.addEventListener('scroll', saveRouteMapScroll, { passive: true });
    }

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.train-marker')) {
            closeActiveTooltip();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeActiveTooltip();
        }
    });
    window.addEventListener('beforeunload', saveRouteMapScroll);
    window.addEventListener('pagehide', saveRouteMapScroll);
    window.addEventListener('resize', () => {
        renderStations();
        if (remoteFormations && remoteFormations.length > 0) {
            renderTrains(remoteFormations);
        }
    });

    document.querySelectorAll('.line-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.line-tab').forEach(t => t.classList.remove('active'));
            const targetBtn = e.target.closest('.line-tab');
            if (!targetBtn) return;
            targetBtn.classList.add('active');
            currentLineId = targetBtn.getAttribute('data-line-id');
            renderStations();
            if (remoteFormations && remoteFormations.length > 0) {
                renderTrains(remoteFormations);
            }
        });
    });

    // Initial check for existing login
    checkAuthStatus();
}

/** 
 * Document Picture-in-Picture Logic
 */
async function toggleAssistPiP() {
    if (assistPiPWindow && !assistPiPWindow.closed) {
        assistPiPWindow.close();
        assistPiPWindow = null;
        return;
    }

    // Open PiP window or fallback to standard popup
    if (window.documentPictureInPicture) {
        try {
            assistPiPWindow = await window.documentPictureInPicture.requestWindow({
                width: 300,
                height: 200,
            });
        } catch (e) {
            console.warn("PiP failed, falling back to popup", e);
            assistPiPWindow = window.open("", "AssistHUD", "width=300,height=200,menubar=no,toolbar=no,location=no,status=no");
        }
    } else {
        assistPiPWindow = window.open("", "AssistHUD", "width=300,height=200,menubar=no,toolbar=no,location=no,status=no");
    }

    if (!assistPiPWindow) {
        alert("ポップアップがブロックされました。ポップアップを許可してください。");
        return;
    }

    // Copy styles
    [...document.styleSheets].forEach((styleSheet) => {
        try {
            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join("");
            const style = document.createElement("style");
            style.textContent = cssRules;
            assistPiPWindow.document.head.appendChild(style);
        } catch (e) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = styleSheet.href;
            assistPiPWindow.document.head.appendChild(link);
        }
    });

    // Initial HUD content
    assistPiPWindow.document.body.className = "hud-body";
    assistPiPWindow.document.body.innerHTML = `
        <div id="hud-content">
            <h3 style="font-size: 14px; color: #28baa5; margin-bottom: 10px;">運転支援 HUD</h3>
            <div class="hud-data-row"><span>速度</span><span id="hud-speed" class="hud-value">0 km/h</span></div>
            <div class="hud-data-row"><span>ノッチ</span><span id="hud-notch" class="hud-value">N</span></div>
            <div class="hud-data-row"><span>信号</span><span id="hud-signal" class="hud-value">---</span></div>
            <div class="hud-data-row"><span>列車番号</span><span id="hud-train-number" class="hud-value">---</span></div>
            <div class="hud-data-row"><span>種別</span><span id="hud-type" class="hud-value">---</span></div>
            <div class="hud-data-row"><span>行先</span><span id="hud-dest" class="hud-value">---</span></div>
        </div>
    `;

    const closeHandler = () => {
        assistPiPWindow = null;
    };
    assistPiPWindow.addEventListener("pagehide", closeHandler);
    assistPiPWindow.addEventListener("unload", closeHandler);
}

function updateHUD(data) {
    if (!assistPiPWindow) return;
    const doc = assistPiPWindow.document;
    if (doc.getElementById('hud-speed')) {
        doc.getElementById('hud-speed').textContent = `${Math.round(data.speed || 0)} km/h`;
        doc.getElementById('hud-notch').textContent = data.notch || 'N';
        doc.getElementById('hud-signal').textContent = data.signal || '---';
        if (doc.getElementById('hud-train-number')) {
            doc.getElementById('hud-train-number').textContent = data.trainNumber || '---';
        }
        if (doc.getElementById('hud-type')) {
            doc.getElementById('hud-type').textContent = data.type || '---';
        }
        if (doc.getElementById('hud-dest')) {
            doc.getElementById('hud-dest').textContent = data.destination || '---';
        }

        // Automatically resolve dataMap values by name
        if (data.dataMap) {
            doc.querySelectorAll('[data-datamap-key]').forEach(el => {
                const key = el.getAttribute('data-datamap-key');
                if (data.dataMap[key] !== undefined) {
                    el.textContent = data.dataMap[key];
                }
            });
        }
    }
}

// Dragging is removed since we natively scroll on the Y-axis using OS scrollbar
// window.addEventListener('wheel') etc could be added for custom scrolling if wanted.

// Start app
init();
