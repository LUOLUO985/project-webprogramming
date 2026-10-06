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
let selectedTownCode = null;
let selectedTownSeries = null;
let electionResults = {};
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

//查了一下芬兰媒体常用的政治色
const PARTY_COLORS = {
    "04": "#2e9e4f",   // KESK 中间党 —— 绿
    "03": "#e11926",   // SDP 社会民主党 —— 红
    "01": "#0f5c9e",   // KOK 民族联合党 —— 深蓝
    "02": "#f5c542",   // PS 芬兰人党 —— 黄
    "05": "#7ac143",   // VIHR 绿党 —— 浅绿
    "06": "#e5007d",   // VAS 左翼联盟 —— 品红
    "07": "#3fb0dd",   // RKP 瑞典族人民党 —— 天蓝
    "08": "#6a3d9a",   // KD 基督教民主党 —— 紫
    "09": "#f28e1c",   // LIIKE 运动党 —— 橙
    "99": "#94a3b8",   // 其他
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
        loadElectionData(),
    ]);
    const geoJsonData = results[0];
    employment = results[1];
    electionResults = results[2];
    layer = L.geoJSON(geoJsonData, {
        style: townStyle,
        //add name
        onEachFeature: setupTown,
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
    const code = feature.properties.kunta;
    let fill ="#878787"
    if (currentIndicator === "election"){
        const result = electionResults[code];
        if(result){
            fill = PARTY_COLORS[result.partyCode] || "#94a3b8";

        }
    }else{
        const info = employment[code];
        if (info){
            fill = rateColor(info[currentIndicator]);
        }
    }
    return {
        color: "#ffffff",
        weight: 1,
        fillColor: fill,
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

// 每个市镇画好之后调用一次：绑提示框 + 绑点击
function setupTown(feature, townLayer) {
    const code = feature.properties.kunta;

    // 提示框的内容这里给的是一个"函数"，
    // 意思是：每次鼠标移到这个市镇上，才去算要显示什么文字。
    // 所以换了年份或指标之后，显示的就是最新的，不用重新绑定。
    townLayer.bindTooltip(function () {
        if (currentIndicator === "election") {
            const result = electionResults[code];
            if (!result) return feature.properties.name;
            return feature.properties.name + " - " + result.partyName + " " + result.share + " %";
        }

        const info = employment[code];
        if (!info) return feature.properties.name;
        return info.name + "-" + INDICATOR_LABELS[currentIndicator] + ":" + info[currentIndicator];
    });
    townLayer.bindPopup(function () {
        const info = employment[code];
        const result =electionResults[code];
        let text = "<b>" + feature.properties.name + "</b>";
        //修改之后市镇有两个数据了 一次性看个全
        if (info) {
            text += "<br>Employment Rate: " + info.employment + " %";
            text += "<br>Unemployment Rate: " + info.unemployment + " %";
            text += "<br>Dependency Ratio: " + info.dependency;
        }

        if (result) {
            text += "<br>Election " + ELECTION_YEAR + ": " + result.partyName + " " + result.share + " %";
        }

        return text;
    });

    // 点击这个市镇 画它的历年趋势图
    townLayer.on("click", function () {
        openTownChart(code);
    });
}
//做到现在 已经可以看到颜色 包括 可以通过点击看到 就业率失业率这些信息

// 用户改变了下拉框
function changeIndicator(event) {
    currentIndicator = event.target.value;
    updateMap();
    updateChart()
}

// 让地图重新上色，并更新提示框
//make the map update when the indicator changes
function updateMap() {
    layer.eachLayer(function (townLayer) {
        townLayer.setStyle(townStyle(townLayer.feature));
        
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

async function openTownChart(townCode){
    selectedTownCode = townCode;
    selectedTownSeries = await loadTownSeries(townCode);
    const info = employment[townCode];
    document.getElementById("panel-title").innerText=info.name;
    updateChart();

}
//draw the chart that the city be selected
function updateChart(){
    if (selectedTownSeries===null) return;
    //切到选举后 再回到市镇 会一片空白 所以加了这个保护
    if (currentIndicator === "election") return;
    const name = employment[selectedTownCode].name;

    drawtrendchart(
        name,
        selectedTownSeries.years,
        selectedTownSeries[currentIndicator]
    );
}

//adjust the width when the windows size change
window.addEventListener("resize", function () {
    if (chart !== null) {
        chart.resize();
    }
});