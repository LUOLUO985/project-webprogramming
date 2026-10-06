//address of the GeoJSON data for Finnish municipalities
const GEOJSON_URL =
  "https://geo.stat.fi/geoserver/wfs?service=WFS&version=2.0.0" +
  "&request=GetFeature&typeName=tilastointialueet:kunta4500k" +
  "&outputFormat=json&srsName=EPSG:4326";


const FIRST_YEAR = 2000;
const LAST_YEAR = 2024;
let currentyear = LAST_YEAR;
//data container for employment data, used to store the data
let employment = {};   //帮我把写错的地方修改了 ，一开始 没有设置成全局变量 别的函数读不到
//做到了 全局保护数据。把信息存起来了

let map;
let layer;
let currentIndicator = "employment"; 

const indicators = {
    // 就业率：越高越好  从低到高是 红 → 绿
    employment: {
        cuts: [65, 68, 71, 74, 77, 80],
        colors: ["#d73027", "#fc8d59", "#fee08b", "#ffffbf", "#d9ef8b", "#91cf60", "#1a9850"],
    },
    // 失业率：越高越差 从低到高是 绿 → 红
    unemployment: {
        cuts: [5, 7, 9, 11, 13, 16],
        colors: ["#1a9850", "#91cf60", "#d9ef8b", "#ffffbf", "#fee08b", "#fc8d59", "#d73027"],
    },
    // 抚养比：同样越高越差
    dependency: {
        cuts: [115, 135, 150, 165, 180, 200],
        colors: ["#1a9850", "#91cf60", "#d9ef8b", "#ffffbf", "#fee08b", "#fc8d59", "#d73027"],
    },
};
const INDICATOR_LABELS = {
    employment: "Employment Rate %",
    unemployment: "Unemployment Rate %",
    dependency: "Dependency Ratio"
};

document.addEventListener("DOMContentLoaded", init);
//draw the map
async function init() {
    map = L.map("map");
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
    }).addTo(map);
    const results = await Promise.all([
        fetch(GEOJSON_URL).then((res) => res.json()),
        loadEmploymentData(currentyear),
    ]);
    const geoJsonData = results[0];
    employment = results[1];
    layer = L.geoJSON(geoJsonData, {
        style: townStyle,
        //add name
        onEachFeature: showTownInfo,
    }).addTo(map);
    map.fitBounds(layer.getBounds());

    //在加一个监听器 用于切换不同的什么生育率 之类的
    document.getElementById("indicator").addEventListener("change", changeIndicator);
    //add a lisener for import exportpng
    document.getElementById("export").addEventListener("click", exportPng);

    //enter the year message into pull-down box
    const yearSelect = document.getElementById("year");

    for (let i = FIRST_YEAR; i<= LAST_YEAR; i++){
        const option = document.createElement("option");
        option.value = i;
        option.textContent = i;
        yearSelect.append(option);
    }

    yearSelect.value = currentyear;
    yearSelect.addEventListener("change", changeYear);
}
//等待网络请求 重新获取年份数据
async function changeYear(event){
    currentyear = Number(event.target.value);
    employment = await loadEmploymentData(currentyear);
    updateMap();

}
function townStyle(feature) {
    const info = employment[feature.properties.kunta];
    const value = info ? info[currentIndicator] : null;
    return {
        color: "#ffffff",
        weight: 1,
        fillColor: rateColor(value),
        fillOpacity: 0.85,
    };
}

function rateColor(value) {
    if (value === null || value === undefined) return "#e5e7eb";
    const conf = indicators[currentIndicator];
    if (value < conf.cuts[0]) return conf.colors[0];
    if (value < conf.cuts[1]) return conf.colors[1];
    if (value < conf.cuts[2]) return conf.colors[2];
    if (value < conf.cuts[3]) return conf.colors[3];
    if (value < conf.cuts[4]) return conf.colors[4];
    if (value < conf.cuts[5]) return conf.colors[5];
    return conf.colors[6]
}

function showTownInfo(feature, townLayer) {
    const info = employment[feature.properties.kunta];

    if (!info) {
        townLayer.bindTooltip(feature.properties.name);
        return;
    }

    townLayer.bindTooltip(`${info.name} ${INDICATOR_LABELS[currentIndicator]}: ${info[currentIndicator]}`);
    townLayer.bindPopup(
        `<b>${info.name}</b><br>
         Employment Rate: ${info.employment} %<br>
         Unemployment Rate: ${info.unemployment} %<br>
         Dependency Ratio: ${info.dependency}`
    );
}
//做到现在 已经可以看到颜色 包括 可以通过点击看到 就业率失业率这些信息

// 用户改变了下拉框
function changeIndicator(event) {
    currentIndicator = event.target.value;
    updateMap();
}

// 让地图重新上色，并更新提示框
//make the map update when the indicator changes
function updateMap() {
    layer.eachLayer(function (townLayer) {
        townLayer.setStyle(townStyle(townLayer.feature));
        showTownInfo(townLayer.feature, townLayer);
    });
}

//take the map export into a png
//把地图到处成为图片 借助智能体
function exportPng() {
    const mapElement = document.getElementById("map");

    html2canvas(mapElement, { useCORS: true }).then(function (canvas) {
        const link = document.createElement("a");
        link.download = "finland-" + currentIndicator + ".png";
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
}