
import { ROUTE_DATA, ALL_STATIONS, evaluatePosition } from './stations.js';

// Constants and Mappings
const WS_URL = 'wss://suzumiya-nas.tail61b99.ts.net/ws';
const WS_HEARTBEAT_INTERVAL_MS = 10000;
const REMOTE_URL = 'https://suzumiya-nas.tail61b99.ts.net/';

const AR_TYPES = {
    default: { id: 'oo', name: '回送', class: 'type-oos' },
    7: { id: 'lo', name: '各停', class: 'type-local' },
    8: { id: 'se', name: '区快', class: 'type-sect-rapid' },
    9: { id: 'co', name: '通快', class: 'type-comm-rapid' },
    10: { id: 'ra', name: '快速', class: 'type-rapid' },
    11: { id: 'ne', name: '新快', class: 'type-new-rapid' },
    12: { id: 'sp', name: '特快', class: 'type-spec-rapid' }
};

const AR_DISTS = {
    1: "有田",
    2: "有電高柳",
    3: "蹄光寺坂",
    4: "本涼瀬",
    5: "十全",
    6: "須賀浦",
    7: "想掛",
    8: "桜地",
    9: "東島",
    10: "北河原",
    11: "高見浜",
    12: "新須賀浦",
    13: "松森川",
    14: "金城",
    15: "糸里",
    16: "島見が丘",
    17: "鴫野華瀬",
    18: "城川芝浦"
};

const KHR_TYPES = {
    default: { id: 'oo', name: '回送', class: 'type-oos' },
    17: { id: 'lo', name: '各停', class: 'type-local' },
    18: { id: 'se', name: '区快', class: 'type-sect-rapid' },
    19: { id: 'co', name: '通快', class: 'type-comm-rapid' },
    20: { id: 'ra', name: '快速', class: 'type-rapid' },
    21: { id: 'ne', name: '新快', class: 'type-new-rapid' },
    22: { id: 'sp', name: '特快', class: 'type-spec-rapid' }
};
const KHR_DISTS = {
    14: "金城",
    15: "松森川",
    16: "北海王",
    17: "新須賀浦",
    19: "城川芝浦",
    20: "春海",
    21: "島見が丘",
    22: "金城",
    24: "東島",
    25: "芝向",
    26: "桜地",
    27: "高見浜",
    28: "須賀浦",
    29: "八重川",
    30: "十全",
    31: "本涼瀬",
    32: "有電高柳",
    33: "有田",
};

const SR_TYPES = {
    default: { id: 'oo', name: '回送', class: 'type-oos' },
    11: { id: 'lo', name: '各停', class: 'type-local' },
    12: { id: 'se', name: '区快', class: 'type-sect-rapid' },
    13: { id: 'co', name: '通快', class: 'type-comm-rapid' },
    14: { id: 'ra', name: '快速', class: 'type-rapid' },
    15: { id: 'ne', name: '新快', class: 'type-new-rapid' },
    16: { id: 'sp', name: '特快', class: 'type-spec-rapid' }
};
const SR_DISTS = {
    1: "城川芝浦",
    2: "葛海中央",
    3: "糸里",
    4: "金城",
    9: "金城",
    10: "松森川",
    11: "新須賀浦",
    12: "有田",
    13: "有電高柳",
    14: "蹄光寺坂",
    15: "本涼瀬",
    16: "十全",
    17: "須賀浦",
    18: "桜地",
    19: "東島",
    20: "北河原",
    21: "高見浜",
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

const AR_NOTE_DESTINATIONS = {
    ForSugauraAt0120: new Set(['須賀浦', '想掛', '桜地', '東島', '北河原', '高見浜', "芝向"]),
    ForArudaAt2026AH: new Set(['有田', '有電高柳', '蹄光寺坂', '本涼瀬', '十全', '須賀浦', "八重川"]),
    TerminateAtShinSugaura: '新須賀浦',
    HigashijimaLineDirect: new Set(['東島', '北河原', '高見浜', "芝向"]),
    beyondShinSugaura: new Set(['松森川', "北海王", '金城', '糸里', '葛海中央', '城川芝浦', "島見が丘", "春海", '鴫野華瀬'])
};

// Application State
let ws = null;
let wsConnected = false;
let wsHeartbeatTimer = null;
let currentAuthStatus = 'offline'; // offline, password_required, authenticated
let currentPlayerData = null;
let assistPiPWindow = null;
let remoteFormations = [];
let activeTrainFormationId = null;
let currentLineId = 'AR';

function generateStopBadgesHTML(st) {
    if (!st) return '';
    const badges = STOP_TYPES.filter(type => st[type.key] === 0)
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
const REMOTE_TYPE_VALUES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const REMOTE_DEST_VALUES = new Set(Object.keys(AR_DISTS).map(Number));
const REMOTE_TYPE_LABEL_TO_VALUE = new Map(
    [['回送', 6], ['臨時', 3], ['各駅停車', 7], ['区間快速', 8], ['通勤快速', 9], ['快速', 10], ['新快速', 11], ['特別快速', 12]]
);
const REMOTE_DEST_LABEL_TO_VALUE = new Map(
    Object.entries(AR_DISTS).map(([value, label]) => [label, Number(value)])
);

function getCompanyTypes(companyCode) {
    if (companyCode === 'KK') return KHR_TYPES;
    if (companyCode === 'SK') return SR_TYPES;
    return AR_TYPES;
}

function getCompanyDestinations(companyCode) {
    if (companyCode === 'KK') return KHR_DISTS;
    if (companyCode === 'SK') return SR_DISTS;
    return AR_DISTS;
}

function getRemoteCompanyButtonConfig(companyCode, kind) {
    if (companyCode === 'AR') {
        return kind === 'type'
            ? { values: REMOTE_TYPE_VALUES, labels: REMOTE_TYPE_LABEL_TO_VALUE }
            : { values: REMOTE_DEST_VALUES, labels: REMOTE_DEST_LABEL_TO_VALUE };
    }

    const map = kind === 'type' ? getCompanyTypes(companyCode) : getCompanyDestinations(companyCode);
    const entries = Object.entries(map).filter(([key]) => Number.isInteger(Number(key)));
    const labels = kind === 'type'
        ? new Map(entries.filter(([, value]) => value?.name).map(([key, value]) => [value.name, Number(key)]))
        : new Map(entries.map(([key, value]) => [value, Number(key)]));
    return { values: new Set(entries.map(([key]) => Number(key))), labels };
}

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
const TRAIN_TYPE_LABELS = {
    0: '回送', 1: '回送', 2: '回送', 3: '回送', 4: '回送', 5: '回送', 6: '回送',
    7: '各駅停車', 8: '区間快速', 9: '通勤快速', 10: '快速', 11: '新快速', 12: '特別快速', 15: '特急'
};
const TRAIN_TYPE_COLORS = {
    'type-oos': '#777777', 'type-local': '#757575', 'type-sect-rapid': '#00bcd4',
    'type-comm-rapid': '#ff8c00', 'type-rapid': '#d32f2f', 'type-new-rapid': '#8bc34a',
    'type-spec-rapid': '#a020f0', 'type-ltd-exp': '#ff69b4'
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
    const labeledButton = (customButtons || []).find(button =>
        labelToValue.has(normalizeRemoteButtonText(button.text))
    );
    if (labeledButton) {
        return labelToValue.get(normalizeRemoteButtonText(labeledButton.text));
    }

    const matchedButton = (customButtons || []).find(button => {
        const value = readNumericButtonValue(button);
        return value !== null && allowedValues.has(value);
    });

    if (matchedButton) {
        return readNumericButtonValue(matchedButton) ?? 0;
    }

    const fallbackValue = readNumericButtonValue(customButtons?.[fallbackIndex]);
    return fallbackValue !== null && allowedValues.has(fallbackValue) ? fallbackValue : 0;
}

function getCompanyTypeValueFromLabel(companyCode, customButtons) {
    const buttonText = normalizeRemoteButtonText(customButtons?.[0]?.text)
        .replace(/^\[[^\]]*\]/, '')
        .replace(/^【[^】]*】/, '')
        .replace(/^[\[【「『(（]+/, '')
        .trim();
    const classByLabel = [
        [/^(各停|各駅停車)/, 'type-local'],
        [/^(区快|区間快速)/, 'type-sect-rapid'],
        [/^(通快|通勤快速)/, 'type-comm-rapid'],
        [/^快速/, 'type-rapid'],
        [/^(新快|新快速)/, 'type-new-rapid'],
        [/^(特快|特別快速)/, 'type-spec-rapid'],
        [/^特急/, 'type-ltd-exp'],
        [/^回送/, 'type-oos']
    ];
    const matchedClass = classByLabel.find(([pattern]) => pattern.test(buttonText))?.[1];
    if (!matchedClass) return null;

    const entry = Object.entries(getCompanyTypes(companyCode))
        .find(([, type]) => type?.class === matchedClass);
    return entry ? Number(entry[0]) : null;
}

function getRemoteDestinationText(customButtons, destinationValue, companyCode = 'AR', fallbackIndex = 1) {
    const mappedDestination = getCompanyDestinations(companyCode)[destinationValue];
    if (mappedDestination) return mappedDestination;

    return normalizeRemoteButtonText(customButtons?.[fallbackIndex]?.text);
}

function isNonRevenueType(type, companyCode = 'AR') {
    if (companyCode !== 'AR') {
        const companyType = getCompanyTypes(companyCode)[type];
        return companyType ? companyType.class === 'type-oos' || companyType.nonRevenue === true : false;
    }
    return type >= 0 && type <= NON_REVENUE_MAX_TYPE;
}

function getTypeInfo(type, companyCode = 'AR') {
    const companyTypes = getCompanyTypes(companyCode);
    const configuredType = companyTypes[type];
    if (companyCode !== 'AR' && configuredType && typeof configuredType === 'object') {
        return configuredType;
    }
    if (isNonRevenueType(type, companyCode)) {
        const defaultType = companyTypes.default || AR_TYPES.default || { id: 'oo', name: '回送', class: 'type-oos' };
        return { id: `nr-${type}`, name: defaultType.name, class: defaultType.class };
    }

    return configuredType || { id: 'lo', name: '各停', class: 'type-local' };
}

function getHudDestination(type, destination, companyCode = 'AR') {
    if (isNonRevenueType(type, companyCode)) {
        return '---';
    }

    return getCompanyDestinations(companyCode)[destination] || '---';
}

function getDestinationStation(destinationId, destinationName, companyCode = 'AR') {
    const HigashijimaLineDirectTerminusByDestination = { 9: 'AH07', 10: 'AH09', 11: 'AH01' };
    const HigashijimaLineDirectStationId = companyCode === 'AR' ? HigashijimaLineDirectTerminusByDestination[Number(destinationId)] : null;
    if (HigashijimaLineDirectStationId) {
        return ALL_STATIONS.find(station => station.id === HigashijimaLineDirectStationId) || null;
    }
    return ALL_STATIONS.find(station => station.name === destinationName) || null;
}

function getTrainMarkerOffset(dir, index, groupSize) {
    const innerOffset = dir === 'up' ? -32 : 14;
    const trainSlotWidth = groupSize > 1 ? 24 : 0;
    return dir === 'up'
        ? innerOffset - trainSlotWidth * index
        : innerOffset + trainSlotWidth * index;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getFormationNumber(formation, customButtons) {
    const readDigit = (buttonNumber, buttonIndex) => {
        const rawValue = formation.dataMap?.[`Button${buttonNumber}`] ?? customButtons?.[buttonIndex]?.value;
        if (rawValue === undefined || rawValue === null || rawValue === '') return null;
        const digit = Number(rawValue);
        return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
    };

    const tens = readDigit(7, 7);
    const ones = readDigit(8, 8);
    return tens !== null && ones !== null ? `${tens}${ones}` : '';
}

function getRemoteTrainNumber(formation, customButtons) {
    const modelName = String(formation.modelName || '').trim().toLowerCase();
    if (!/^shirokawa_(?:3000|3070)/.test(modelName)) return formation.name && formation.name !== 'no_name' ? formation.name : '';

    const readButton = buttonNumber => {
        const rawValue = formation.dataMap?.[`Button${buttonNumber}`] ?? formation[`Button${buttonNumber}`] ?? customButtons?.[buttonNumber]?.value;
        const value = Number(rawValue);
        return Number.isInteger(value) && value >= 1 && value <= 10 ? value - 1 : null;
    };
    const digits = [5, 6, 7, 8].map(readButton);
    const symbolId = Number(formation.dataMap?.Button9 ?? formation.Button9 ?? customButtons?.[9]?.value);
    const symbols = { 1: 'H', 2: 'Y', 3: 'R', 4: 'N', 5: 'S' };
    if (digits.some(digit => digit === null) || !symbols[symbolId]) return '';
    return `${digits.join('')}${symbols[symbolId]}`;
}

function getTrainStopRows(item) {
    const stationId = station => station.branchId || station.id;
    const destinationId = Number(item.SZ_dist);
    const destinationName = getCompanyDestinations(item.company.code)[destinationId] || item.finalDestName || '';
    const isShinSugauraDestination = item.lineId === 'AR' && (
        destinationName === AR_NOTE_DESTINATIONS.shinSugauraTerminus ||
        AR_NOTE_DESTINATIONS.beyondShinSugaura.has(destinationName)
    );
    const currentId = item.evalPos.type === 'station'
        ? item.evalPos.stationId
        : (item.evalPos.toStationId || item.evalPos.fromStationId);
    const nearestStationIndex = stations => {
        const progress = Number(item.evalPos.progress);
        if (!Number.isFinite(progress)) return -1;
        let nearestIndex = -1;
        let nearestDistance = Infinity;
        stations.forEach((station, index) => {
            const distance = Math.abs(station.visualIndex - progress);
            if (distance < nearestDistance) {
                nearestIndex = index;
                nearestDistance = distance;
            }
        });
        return nearestIndex;
    };
    const HigashijimaLineDirectTerminusByDestination = { 9: 'AH07', 10: 'AH09', 11: 'AH01' };
    const isHigashijimaLineDirectDestination = ['AH05', 'AH07', 'AH09'].includes(item.destStationId);
    const HigashijimaLineDirectTerminusId = item.company.code === 'AR'
        ? HigashijimaLineDirectTerminusByDestination[destinationId]
        : (isHigashijimaLineDirectDestination ? item.destStationId : null);
    let visibleStations;

    if (HigashijimaLineDirectTerminusId && (item.lineId === 'AR' || item.lineId === 'AH')) {
        const eastStations = ALL_STATIONS
            .filter(station => station.lineId === 'AH')
            .sort((a, b) => a.visualIndex - b.visualIndex);
        const junctionIndex = eastStations.findIndex(station => stationId(station) === 'AH03');
        const terminusIndex = eastStations.findIndex(station => stationId(station) === HigashijimaLineDirectTerminusId);

        if (item.lineId === 'AR') {
            const arStations = ALL_STATIONS
                .filter(station => station.lineId === 'AR' && stationId(station) !== 'AR61')
                .sort((a, b) => a.visualIndex - b.visualIndex);
            let currentIndex = arStations.findIndex(station => stationId(station) === currentId);
            if (currentIndex < 0) currentIndex = nearestStationIndex(arStations);
            const arJunctionIndex = arStations.findIndex(station => stationId(station) === 'AR26');
            let arPath = [];
            if (currentIndex >= 0 && arJunctionIndex >= 0) {
                const first = Math.min(currentIndex, arJunctionIndex);
                const last = Math.max(currentIndex, arJunctionIndex);
                arPath = arStations.slice(first, last + 1);
                if (currentIndex > arJunctionIndex) arPath.reverse();
            }

            let eastPath = [];
            if (junctionIndex >= 0 && terminusIndex >= 0) {
                const first = Math.min(junctionIndex, terminusIndex);
                const last = Math.max(junctionIndex, terminusIndex);
                eastPath = eastStations.slice(first, last + 1);
                if (terminusIndex < junctionIndex) eastPath.reverse();
                eastPath = eastPath.filter(station => stationId(station) !== 'AH03');
            }
            visibleStations = [...arPath, ...eastPath];
        } else {
            let currentIndex = eastStations.findIndex(station => stationId(station) === currentId);
            if (currentIndex < 0) currentIndex = nearestStationIndex(eastStations);
            if (currentIndex >= 0 && terminusIndex >= 0) {
                const first = Math.min(currentIndex, terminusIndex);
                const last = Math.max(currentIndex, terminusIndex);
                visibleStations = eastStations.slice(first, last + 1);
                if (currentIndex > terminusIndex) visibleStations.reverse();
            } else {
                visibleStations = eastStations;
            }
        }
    } else {
        const routeStations = ALL_STATIONS
            .filter(station => station.lineId === item.lineId)
            .sort((a, b) => a.visualIndex - b.visualIndex);
        let destinationStationId = isShinSugauraDestination ? 'AR61' : item.destStationId;
        const destinationStation = ALL_STATIONS.find(station => stationId(station) === destinationStationId);
        if (destinationStation && destinationStation.lineId !== item.lineId) {
            destinationStationId = item.lineId === 'AR' ? 'AR26' : 'AH03';
        }
        let startIndex = routeStations.findIndex(station => stationId(station) === currentId);
        if (startIndex < 0) startIndex = nearestStationIndex(routeStations);
        const destinationIndex = routeStations.findIndex(station => stationId(station) === destinationStationId);

        visibleStations = routeStations;
        if (startIndex >= 0 && destinationIndex >= 0) {
            const first = Math.min(startIndex, destinationIndex);
            const last = Math.max(startIndex, destinationIndex);
            visibleStations = routeStations.slice(first, last + 1);
            if (startIndex > destinationIndex) visibleStations.reverse();
        } else if (isShinSugauraDestination && destinationIndex >= 0) {
            visibleStations = routeStations.filter(station => station.visualIndex <= routeStations[destinationIndex].visualIndex);
        }
    }

    const stopKey = getCompanyTypes(item.company.code)[item.SZ_type]?.id;
    return visibleStations
        .filter(station => stationId(station) !== 'AR61' || isShinSugauraDestination)
        .filter(station => !stopKey || station[stopKey] !== -1)
        .map(station => ({
            station,
            isCurrent: stationId(station) === currentId,
            stops: stopKey ? station[stopKey] === 0 : false
        }));
}

function getTrainDirectionNote(item) {
    if (item.lineId !== 'AR') return '';

    const visualIndexFor = id => ALL_STATIONS.find(station => station.id === id)?.visualIndex;
    const aruda = visualIndexFor('AR01');
    const kitaGawara = visualIndexFor('AR19');
    const sugaura = visualIndexFor('AR20');
    const shinSugaura = visualIndexFor('AR61');
    const progress = Number(item.evalPos.progress);
    const destinationName = getCompanyDestinations(item.company.code)[Number(item.SZ_dist)] || item.finalDestName || '';
    if (!Number.isFinite(progress)) return '';

    const isBetween = (start, end) => start !== undefined && end !== undefined &&
        progress >= Math.min(start, end) && progress <= Math.max(start, end);

    if (item.dir === 'down' && isBetween(aruda, sugaura) && AR_NOTE_DESTINATIONS.ForSugauraAt0120.has(destinationName)) {
        return '須賀浦駅（KR線乗換）方面｜新須賀浦駅方面には行きません。';
    }
    if (item.dir === 'up' && isBetween(kitaGawara, sugaura) && AR_NOTE_DESTINATIONS.ForArudaAt2026AH.has(destinationName)) {
        return '須賀浦駅（KR線乗換）方面｜新須賀浦駅方面には行きません。';
    }
    if (item.dir === 'down' && isBetween(aruda, shinSugaura) && destinationName === AR_NOTE_DESTINATIONS.TerminateAtShinSugaura) {
        return '新須賀浦駅行｜須賀浦駅方面には行きません。';
    }
    if (item.dir === 'down' && isBetween(aruda, shinSugaura) && AR_NOTE_DESTINATIONS.beyondShinSugaura.has(destinationName)) {
        return '新須賀浦・京北線・城川線方面｜須賀浦駅方面には行きません。';
    }

    return '';
}

function renderTrainDetail(item, focusClose = false) {
    const modal = document.getElementById('train-detail-modal');
    if (!modal || !item) return;
    const scrollArea = modal.querySelector('.train-detail-scroll');
    const previousScrollTop = scrollArea?.scrollTop || 0;
    const typeLabel = item.company.code === 'AR'
        ? TRAIN_TYPE_LABELS[item.SZ_type] || item.typeInfo.name
        : item.typeInfo.name;
    const iconColor = TRAIN_TYPE_COLORS[item.typeInfo.class] || '#555';
    const hideDestination = Number(item.rawButton1) === 0;
    const isDeadhead = isNonRevenueType(item.SZ_type, item.company.code) || item.typeInfo.class === 'type-oos';
    const directionNote = isDeadhead
        ? '回送電車です、ご利用頂けません。'
        : (hideDestination ? '' : getTrainDirectionNote(item));
    const arDestinationName = getCompanyDestinations(item.company.code)[Number(item.SZ_dist)] || item.finalDestName || '';
    const HigashijimaLineDirectDirectNote = !isDeadhead && !hideDestination && item.lineId === 'AR' && AR_NOTE_DESTINATIONS.HigashijimaLineDirect.has(arDestinationName);
    const hasShinSugauraThroughService = !isDeadhead && !hideDestination && item.lineId === 'AR' && AR_NOTE_DESTINATIONS.beyondShinSugaura.has(arDestinationName);
    const hasKnownType = item.company.code === 'AR'
        ? Object.prototype.hasOwnProperty.call(TRAIN_TYPE_LABELS, item.SZ_type)
        : Object.prototype.hasOwnProperty.call(getCompanyTypes(item.company.code), item.SZ_type);
    const hasTrainInfoError = !isDeadhead && (!item.rollingStock || !hasKnownType || !item.formation.trainNumber || (!hideDestination && !item.finalDestName));
    const supportsFormationNumber = !['KK', 'SK'].includes(item.company.code);
    const carCount = item.formation.carCount ?? item.formation.cars?.length ?? item.formation.cars ??
        item.formation.formationLength ?? item.formation.trainLength;
    const arLineColor = ROUTE_DATA.lines.find(line => line.lineId === 'AR')?.color || '#28baa5';
    const ahLineColor = ROUTE_DATA.lines.find(line => line.lineId === 'AH')?.color || '#49ce8f';
    const stopRowItems = getTrainStopRows(item);
    const stopRows = stopRowItems.map(({ station, isCurrent, stops }) => {
        const lineColor = ROUTE_DATA.lines.find(line => line.lineId === station.lineId)?.color || '#28baa5';
        const stationNumber = station.branchId || station.id;
        const isHigashijimaLineDirectJunction = stationNumber === 'AR26' && stopRowItems.some(({ station: rowStation }) => rowStation.lineId === 'AH');
        const displayedStationNumber = isHigashijimaLineDirectJunction
            ? `<span>AR26</span><span style="color:${ahLineColor}">AH03</span>`
            : escapeHtml(stationNumber);
        const passingNumberColor = station.lineId === 'AH' ? '#c8ead8' : '#bfe4eb';
        return `
        <li class="train-stop-row ${stops ? 'stopping' : 'passing'} ${isCurrent ? 'current' : ''} ${isHigashijimaLineDirectJunction ? 'interline-junction' : ''}" data-station-id="${escapeHtml(station.branchId || station.id)}" data-line-id="${escapeHtml(station.lineId)}" style="--station-line-color:${lineColor}; --junction-line-color:${ahLineColor}; --passing-number-color:${passingNumberColor}">
            <span class="train-stop-station">
                <span class="train-stop-number ${isHigashijimaLineDirectJunction ? 'interline' : ''}">${displayedStationNumber}</span>
                <span class="train-stop-name">${escapeHtml(station.name)}</span>
            </span>
            <span class="train-stop-status ${stops ? 'stopping' : 'passing'}">${stops ? '停車' : '通過'}</span>
        </li>
    `;
    }).join('');
    const firstEastLineRow = stopRowItems.findIndex(({ station }) => station.lineId === 'AH');
    const eastLineStartPercent = Math.max(0, (firstEastLineRow - 0.4) / stopRowItems.length * 100);
    const stopLineGradient = firstEastLineRow < 0
        ? `linear-gradient(${arLineColor}, ${arLineColor})`
        : firstEastLineRow === 0
            ? `linear-gradient(${ahLineColor}, ${ahLineColor})`
            : `linear-gradient(to bottom, ${arLineColor} 0%, ${arLineColor} ${eastLineStartPercent}%, ${ahLineColor} ${eastLineStartPercent}%, ${ahLineColor} 100%)`;

    modal.querySelector('.train-detail-content').innerHTML = `
        ${hasTrainInfoError ? '<div class="train-detail-error">列車情報を取得できませんでした</div>' : ''}
        <div class="train-detail-summary">
            <div class="train-detail-icon-wrap ${item.typeInfo.class}">
                <div class="train-icon train-icon-large" style="--train-icon-color:${iconColor}">
                </div>
                <span class="train-detail-series">${escapeHtml(item.rollingStock || '')}</span>
            </div>
            <div class="train-detail-heading">
                ${HigashijimaLineDirectDirectNote ? '<div class="train-detail-service-note">東島線直通</div>' : ''}
                <div class="train-detail-destination-row">
                    <span class="train-detail-type ${item.typeInfo.class}" style="--service-type-color:${iconColor}">${escapeHtml(typeLabel)}</span>
                    <span class="train-detail-destination"${hideDestination ? ' style="visibility:hidden"' : ''}>${escapeHtml(item.finalDestName || '行先不明')}行</span>
                    <span class="train-detail-cars">${carCount !== undefined && carCount !== null && carCount !== '' ? `${escapeHtml(carCount)}両` : '両数不明'}</span>
                </div>
                <div class="train-detail-identifiers">
                    <span>列車番号 ${escapeHtml(item.formation.trainNumber || '---')}</span>
                    ${supportsFormationNumber ? `<span>編成番号 ${escapeHtml(item.formation.formationNumber || '---')}</span>` : ''}
                </div>
                ${directionNote ? `<div class="train-detail-direction-note">${escapeHtml(directionNote)}</div>` : ''}
            </div>
        </div>
        ${isDeadhead ? '' : `
            <div class="train-stop-heading"><span>停車駅</span><span>停車区分</span></div>
            <ol class="train-stop-list" style="--stop-line-gradient:${stopLineGradient}">
                ${stopRows || '<li class="train-stop-empty">停車駅情報がありません</li>'}
                ${hasShinSugauraThroughService ? '<li class="train-through-service-note">新須賀浦から京北線・城川線へ直通</li>' : ''}
            </ol>
        `}
    `;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    if (firstEastLineRow > 0) {
        const stopList = modal.querySelector('.train-stop-list');
        const junctionRow = stopList?.querySelector('[data-station-id="AR26"]');
        if (junctionRow) {
            const listTop = stopList.getBoundingClientRect().top;
            const junctionRect = junctionRow.getBoundingClientRect();
            const transitionY = Math.max(0, junctionRect.top + junctionRect.height / 2 + 7 - listTop);
            stopList.style.setProperty('--stop-line-gradient', `linear-gradient(to bottom, ${arLineColor} 0px, ${arLineColor} ${transitionY}px, ${ahLineColor} ${transitionY}px, ${ahLineColor} 100%)`);
        }
    }
    const summary = modal.querySelector('.train-detail-summary');
    modal.style.setProperty('--train-detail-summary-height', `${summary.offsetHeight}px`);
    modal.querySelector('.train-detail-scroll').scrollTop = previousScrollTop;
    if (focusClose) modal.querySelector('.train-detail-close').focus();
}

function closeTrainDetail() {
    const modal = document.getElementById('train-detail-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('.train-marker[aria-expanded="true"]').forEach(marker => {
        marker.setAttribute('aria-expanded', 'false');
    });
    activeTrainFormationId = null;
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
    const mainTrackCenter = Math.max(350, Math.round(viewWidth * 0.25)) + 55;

    // 現在選択されている路線のみを取得
    const activeLines = ROUTE_DATA.lines.filter(l => l.lineId === currentLineId);

    let maxVisualIdx = 0;
    activeLines.forEach(line => {
        line.trackCenter = mainTrackCenter;
        const lineStationCount = line.stations.length;
        if (lineStationCount - 1 > maxVisualIdx) maxVisualIdx = lineStationCount - 1;
    });

    // 支線のチェック
    // evaluatePosition uses ALL_STATIONS, whose track centers were copied at module load.
    // Keep those centers in sync with the positions used to render the current route.
    ALL_STATIONS.forEach(station => {
        const line = ROUTE_DATA.lines.find(item => item.lineId === station.lineId);
        if (!line) return;
        const isBranch = ROUTE_DATA.branches.some(branch => branch.branchId === station.branchId);
        station.trackCenter = line.trackCenter + (isBranch ? 150 : 0);
    });

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
        const sendHeartbeat = () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: 'ping' }));
            }
        };
        sendHeartbeat();
        wsHeartbeatTimer = setInterval(sendHeartbeat, WS_HEARTBEAT_INTERVAL_MS);
        // Auto-login if we have session data
        const savedId = sessionStorage.getItem('aruden_session_id');
        const savedPwd = sessionStorage.getItem('aruden_session_pwd');
        if (savedId && savedPwd) {
            ws.send(JSON.stringify({ action: 'auth_login', playerId: savedId, password: savedPwd }));
        }
    };

    ws.onclose = (e) => {
        wsConnected = false;
        if (wsHeartbeatTimer !== null) {
            clearInterval(wsHeartbeatTimer);
            wsHeartbeatTimer = null;
        }
        setStatus('Offline', 'offline');
        console.log(`❌ WebSocket Disconnected (code: ${e.code}). Retrying in 5s...`);
        setTimeout(setupWebSocket, 5000); // Reconnect
    };

    ws.onerror = (e) => {
        console.warn(`⚠️ WebSocket Connection Error:`, e);
    };

    ws.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            if (data.type === 'pong') return;
            console.log(`📩 WebSocket Received:`, e.data);
            if (data.type === 'auth_response') handleAuthResponse(data);
            else if (data.type === 'driver_assist' || data.type === 'driver_assist_v2') handleDriverAssist(data);
        } catch (err) {
            console.error('JSON parse error:', err);
        }
    };
}

// --- Handlers ---
async function fetchRemoteTrains() {
    try {
        const response = await fetch(REMOTE_URL, { cache: 'no-store' });
        if (!response.ok) {
            console.warn(`Train API returned HTTP ${response.status}`);
            return;
        }

        const json = await response.json();

        // Map to our internal format
        const rawData = Array.isArray(json) ? json : (json.data || []);
        const formationCarCounts = new Map();
        rawData.forEach(car => {
            if (car.formation === undefined || car.formation === null) return;
            const formationKey = String(car.formation);
            formationCarCounts.set(formationKey, (formationCarCounts.get(formationKey) || 0) + 1);
        });

        remoteFormations = rawData.map(f => {
            const customButtons = Array.isArray(f.customButton) ? f.customButton : [];
            const companyCode = getTrainCompany(f.name, f.modelName).code;
            const typeButtonConfig = getRemoteCompanyButtonConfig(companyCode, 'type');
            const destinationButtonConfig = getRemoteCompanyButtonConfig(companyCode, 'destination');

            let szTypeValue = findRemoteButtonValue(customButtons, typeButtonConfig.values, typeButtonConfig.labels, 0);
            let szDistValue = findRemoteButtonValue(customButtons, destinationButtonConfig.values, destinationButtonConfig.labels, 1);

            if (companyCode !== 'AR') {
                const typeFromLabel = getCompanyTypeValueFromLabel(companyCode, customButtons);
                if (typeFromLabel !== null) {
                    szTypeValue = typeFromLabel;
                } else {
                    const companyTypes = getCompanyTypes(companyCode);
                    const configuredTypeValue = [f.dataMap?.SZ_type, f.dataMap?.Button0]
                        .map(Number)
                        .find(value => Object.prototype.hasOwnProperty.call(companyTypes, value));
                    if (configuredTypeValue !== undefined) szTypeValue = configuredTypeValue;
                }
            }

            // 有電ではSZ_typeを優先し、他社車は上記で会社別の種別値を解決する。
            if (companyCode === 'AR' && f.dataMap) {
                if (f.dataMap.SZ_type !== undefined && Number.isFinite(Number(f.dataMap.SZ_type))) szTypeValue = Number(f.dataMap.SZ_type);
                else if (f.dataMap.Button0 !== undefined && Number.isFinite(Number(f.dataMap.Button0))) szTypeValue = Number(f.dataMap.Button0);
            }

            if (f.dataMap) {
                if (f.dataMap.SZ_dist !== undefined && Number.isFinite(Number(f.dataMap.SZ_dist))) szDistValue = Number(f.dataMap.SZ_dist);
                else if (f.dataMap.Button1 !== undefined && Number.isFinite(Number(f.dataMap.Button1))) szDistValue = Number(f.dataMap.Button1);
            }

            return {
                formationId: f.formation,
                trainNumber: getRemoteTrainNumber(f, customButtons),
                modelName: f.modelName,
                rawButton0: f.dataMap?.Button0 ?? f.Button0,
                rawButton1: f.dataMap?.Button1 ?? f.Button1,
                formationNumber: getFormationNumber(f, customButtons),
                carCount: formationCarCounts.get(String(f.formation)) ?? null,
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
                remoteDestText: getRemoteDestinationText(customButtons, szDistValue, companyCode),
                trainStateData: f.trainStateData,
                isRemote: true
            };
        });

        renderTrains(remoteFormations);
    } catch (err) {
        console.error('Failed to load train location data:', err);
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
function getTrainCompany(trainName, modelName = '') {
    const model = String(modelName).trim().toLowerCase();
    if (model.startsWith('sz')) return { code: 'AR', name: '有田電鉄' };
    if (model.startsWith('khr')) return { code: 'KK', name: '京北鉄道' };
    if (model.startsWith('shirokawa')) return { code: 'SK', name: '城川電鉄' };
    if (!trainName) return { code: 'AR', name: '有田電鉄' };
    const lower = String(trainName).toLowerCase();
    if (lower.startsWith('sz')) return { code: 'AR', name: '有田電鉄' };
    if (lower.startsWith('khr')) return { code: 'KK', name: '京北鉄道' };
    if (lower.startsWith('kk')) return { code: 'KK', name: '京北鉄道' };
    if (lower.startsWith('shirokawa')) return { code: 'SK', name: '城川電鉄' };
    if (lower.startsWith('sk')) return { code: 'SK', name: '城川電鉄' };
    if (lower.startsWith('mk')) return { code: 'MK', name: '三川電鉄' };
    if (lower.startsWith('mn')) return { code: 'MN', name: '美菜丘鉄道' };
    return { code: 'AR', name: '有田電鉄' };
}

function getRollingStock(trainName, company, modelName = '') {
    const model = String(modelName).trim().toLowerCase();
    if (company.code === 'AR') {
        if (model.startsWith('sz1')) return '有電1000系';
        if (model.startsWith('sz2')) return '有電2000系';
        if (model.startsWith('sz3')) return '有電3000系';
    }
    if (company.code === 'KK' && model.startsWith('khr4000')) return '京北4000系';
    if (company.code === 'SK') {
        if (['shirokawa_3000', 'shirokawa_3070'].some(prefix => model.startsWith(prefix))) return '城川3000系';
        if (['shirokawa_3500', 'shirokawa_3550'].some(prefix => model.startsWith(prefix))) return '城川3500系';
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
        const company = getTrainCompany(trainName, f.modelName);
        const rollingStock = getRollingStock(trainName, company, f.modelName);
        const modelName = String(f.modelName || '').trim().toLowerCase();
        const allowedModelPrefix = {
            AR: 'sz',
            KK: 'khr',
            SK: 'shirokawa'
        }[company.code];
        if (allowedModelPrefix && !modelName.startsWith(allowedModelPrefix)) return;
        const rawButton0 = f.rawButton0;
        if (company.code === 'AR' && rawButton0 !== undefined && rawButton0 !== null && rawButton0 !== '') {
            const rawButton0Value = Number(rawButton0);
            if ((rawButton0Value >= 0 && rawButton0Value <= 6) || rawButton0Value >= 13) return;
        }

        // 行先駅IDを取得
        const destName = getCompanyDestinations(company.code)[SZ_dist] || f.remoteDestText;
        const destStation = getDestinationStation(SZ_dist, destName, company.code);
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

        const finalDestName = normalizeRemoteButtonText(destName || f.remoteDestText || '不明');
        const trackCenter = evalPos.trackCenter || 960;

        const lineId = evalPos.lineId || (destStation ? destStation.lineId : 'AR');
        if (lineId !== currentLineId) return;

        // 線路図の左右レーンと矢印は、列車データの座標方向ではなく行先への駅順で決める。
        // 他路線行きは現在路線の接続駅を目標にする。
        let dir = evalPos.direction || 'down';
        const routeStations = ALL_STATIONS
            .filter(station => station.lineId === lineId)
            .sort((a, b) => a.visualIndex - b.visualIndex);
        let routeDestinationId = destStationId;
        const routeDestination = ALL_STATIONS.find(station =>
            (station.branchId || station.id) === routeDestinationId
        );
        if (lineId === 'AR' && (
            finalDestName === AR_NOTE_DESTINATIONS.shinSugauraTerminus ||
            AR_NOTE_DESTINATIONS.beyondShinSugaura.has(finalDestName)
        )) {
            routeDestinationId = 'AR61';
        } else if (routeDestination && routeDestination.lineId !== lineId) {
            routeDestinationId = lineId === 'AR' ? 'AR26' : 'AH03';
        }
        const currentStationId = evalPos.type === 'station'
            ? evalPos.stationId
            : (evalPos.toStationId || evalPos.fromStationId);
        let currentIndex = routeStations.findIndex(station => (station.branchId || station.id) === currentStationId);
        let destinationIndex = routeStations.findIndex(station => (station.branchId || station.id) === routeDestinationId);
        if (currentIndex < 0 && Number.isFinite(Number(evalPos.progress))) {
            currentIndex = routeStations.reduce((nearest, station, index) =>
                Math.abs(station.visualIndex - Number(evalPos.progress)) < Math.abs(routeStations[nearest]?.visualIndex - Number(evalPos.progress)) ? index : nearest, 0);
        }
        if (currentIndex >= 0 && destinationIndex >= 0 && currentIndex !== destinationIndex) {
            dir = destinationIndex < currentIndex ? 'up' : 'down';
        }

        const key = `${evalPos.stationId || evalPos.segment}_${dir}_${lineId}`;
        if (!groups[key]) groups[key] = [];

        const typeInfo = getTypeInfo(SZ_type, company.code);
        groups[key].push({
            formation: f,
            typeInfo,
            evalPos,
            dir,
            SZ_type,
            SZ_dist,
            finalDestName,
            destStationId,
            lineId,
            trackCenter,
            company,
            rawButton1: f.rawButton1,
            rollingStock
        });
    });

    container.innerHTML = '';
    let restoredTrainDetail = false;

    Object.values(groups).forEach(group => {
        group.sort((a, b) => (TRAIN_PRIORITY[b.typeInfo.class] || 0) - (TRAIN_PRIORITY[a.typeInfo.class] || 0));

        group.forEach((item, index) => {
            const { formation: f, typeInfo, evalPos, dir, SZ_type, SZ_dist, finalDestName, trackCenter } = item;
            const el = document.createElement('div');
            const isOOS = isNonRevenueType(SZ_type, item.company.code);
            const markerOffset = getTrainMarkerOffset(dir, index, group.length);

            const topPos = evalPos.progress * STATION_SPACING;
            const leftPos = trackCenter;

            el.className = `train-marker ${isOOS ? 'non-commercial' : 'commercial'} dir-${dir} ${typeInfo.class}`;
            el.style.top = `${topPos}px`;
            el.style.left = `${leftPos}px`;
            el.style.transform = `translate(${markerOffset}px, -50%)`;
            el.setAttribute('role', 'button');
            el.setAttribute('tabindex', '0');
            el.setAttribute('aria-expanded', 'false');
            el.setAttribute('aria-haspopup', 'dialog');

            el.innerHTML = '<div class="train-icon" aria-hidden="true"></div>';

            el.addEventListener('click', (event) => {
                event.stopPropagation();
                activeTrainFormationId = String(f.formationId);
                el.setAttribute('aria-expanded', 'true');
                renderTrainDetail(item, true);
            });
            el.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activeTrainFormationId = String(f.formationId);
                    el.setAttribute('aria-expanded', 'true');
                    renderTrainDetail(item, true);
                }
            });

            if (activeTrainFormationId && String(f.formationId) === activeTrainFormationId) {
                el.setAttribute('aria-expanded', 'true');
                renderTrainDetail(item);
                restoredTrainDetail = true;
            }

            container.appendChild(el);

            if (currentPlayerData && ((f.uuid && f.uuid === currentPlayerData.uuid) || (f.driver && f.driver === currentPlayerData.name))) {
                updateHUD({
                    speed: f.speedKmh,
                    notch: f.notch,
                    signal: f.signal,
                    destination: getHudDestination(SZ_type, SZ_dist, item.company.code),
                    dataMap: f.dataMap
                });
            }
        });
    });

    if (activeTrainFormationId && !restoredTrainDetail) {
        closeTrainDetail();
    }
}

function handleDriverAssist(data) {
    const company = getTrainCompany(data.trainNumber, data.modelName);
    let szType = data.szType || 0;
    let szDist = data.szDist || 0;

    if (data.dataMap) {
        if (data.dataMap.SZ_type !== undefined && Number.isFinite(Number(data.dataMap.SZ_type))) szType = Number(data.dataMap.SZ_type);
        else if (data.dataMap.Button0 !== undefined && Number.isFinite(Number(data.dataMap.Button0))) szType = Number(data.dataMap.Button0);

        if (data.dataMap.SZ_dist !== undefined && Number.isFinite(Number(data.dataMap.SZ_dist))) szDist = Number(data.dataMap.SZ_dist);
        else if (data.dataMap.Button1 !== undefined && Number.isFinite(Number(data.dataMap.Button1))) szDist = Number(data.dataMap.Button1);
    }
    const driverAssistType = getTypeInfo(szType, company.code);

    // Update HUD in PiP window
    updateHUD({
        speed: (data.speedKmh / 20),
        notch: data.notch,
        signal: data.signal,
        trainNumber: (data.trainNumber && data.trainNumber !== 'no_name') ? data.trainNumber : '---',
        type: company.code === 'AR' ? TRAIN_TYPE_LABELS[szType] || '---' : driverAssistType.name,
        destination: getHudDestination(szType, szDist, company.code),
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

    const trainDetailModal = document.getElementById('train-detail-modal');
    trainDetailModal.querySelector('.train-detail-close').addEventListener('click', closeTrainDetail);
    trainDetailModal.addEventListener('click', event => {
        if (event.target === trainDetailModal) closeTrainDetail();
    });

    document.getElementById('menu-toggle').addEventListener('click', toggleAssistPiP);

    document.getElementById('btn-token-login').addEventListener('click', handleTokenLogin);
    document.getElementById('btn-password-login').addEventListener('click', handlePasswordLogin);
    document.getElementById('btn-set-password').addEventListener('click', handleSetPassword);
    document.getElementById('btn-logout').addEventListener('click', handleLogout);

    if (routeMap) {
        routeMap.addEventListener('scroll', saveRouteMapScroll, { passive: true });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeTrainDetail();
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
