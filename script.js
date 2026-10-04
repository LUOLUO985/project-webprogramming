//address of the GeoJSON data for Finnish municipalities
const GEOJSON_URL =
  "https://geo.stat.fi/geoserver/wfs?service=WFS&version=2.0.0" +
  "&request=GetFeature&typeName=tilastointialueet:kunta4500k" +
  "&outputFormat=json&srsName=EPSG:4326";


const EMPLOYMENT_YEAR = 2024;
let employment = {};   //帮我把写错的地方修改了 ，一开始 没有设置成全局变量 别的函数读不到

document.addEventListener("DOMContentLoaded", init);
//draw the map
async function init() {
    const map = L.map("map");
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
    }).addTo(map);
    const results = await Promise.all([
        fetch(GEOJSON_URL).then((res) => res.json()),
        loadEmploymentData(EMPLOYMENT_YEAR),
    ]);
    const geoJsonData = results[0];
    employment = results[1];
    const layer = L.geoJSON(geoJsonData, {
        style: townStyle,
        //add name
        onEachFeature: showTownInfo,
    }).addTo(map);
    map.fitBounds(layer.getBounds());
}
function townStyle(feature) {
    const info = employment[feature.properties.kunta];

    return {
        color: "#ffffff",
        weight: 1,
        fillColor: info ? rateColor(info.employment) : "#e5e7eb",
        fillOpacity: 0.85,
    };
}

function rateColor(rate) {
    if (rate === null || rate === undefined) return "#e5e7eb";
    if (rate < 65) return "#d73027";
    if (rate < 68) return "#fc8d59";
    if (rate < 71) return "#fee08b";
    if (rate < 74) return "#ffffbf";
    if (rate < 77) return "#d9ef8b";
    if (rate < 80) return "#91cf60";
    return "#1a9850";
}

function showTownInfo(feature, townLayer) {
    const info = employment[feature.properties.kunta];

    if (!info) {
        townLayer.bindTooltip(feature.properties.name);
        return;
    }

    townLayer.bindTooltip(`${info.name} ${info.employment} %`);
    townLayer.bindPopup(
        `<b>${info.name}</b><br>
         Employment rate: ${info.employment} %<br>
         Unemployment rate: ${info.unemployment} %<br>
         Dependency ratio: ${info.dependency}`
    );
}
//做到现在 已经可以看到颜色 包括 可以通过点击看到 就业率失业率这些信息
