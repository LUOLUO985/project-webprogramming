const PXWEB_BASE = "https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/";

//send a request to the API and return the response as JSON
async function fetchPxwebData(tablePath, query) {
  const response = await fetch(PXWEB_BASE + tablePath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    //现在这个返回不出来，我直接强制转换成json-stat2格式
    body: JSON.stringify({
        query: query,
        response: {
            format: "json-stat2"
        }
    }),
  });


  //the security check for the response
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}

//When extracting values and organizing them, used a bit ai
//就这个地方 把数据转换 存到dimensions对象中 
function decodeJsonStat(data) {
    const ids = data.id;
    const sizes = data.size;
//each value  of the dimensions, sort the data
    const dimensions = {};
    for (let i = 0; i < ids.length; i++) {
        const name = ids[i];
        const categories = data.dimension[name].category;
        dimensions[name] = {
            index: categories.index,
            labels: categories.label,
        };
    }
    


//给维度坐标加下标的，因为不能用一堆数组取值，所以要给下标，自己写有bug 给dimensions起下标
    function offsetOf(coord) {
    let offset = 0;
    for (let i = 0; i < ids.length; i++) {
        const position = dimensions[ids[i]].index[coord[ids[i]]];
        if (position === undefined) return -1;
        offset = offset*sizes[i] + position;

        }
        return offset;
    }
    return {
        dimensions: dimensions,
        get: function (coord) {
        const offset = offsetOf(coord);
        if (offset < 0) return null;
        const value = data.value[offset];
        return value === undefined ? null : value;
        },
    };
}
//catch the emplpyment data
//拉取数据 就业率 方便地图 ，去除掉KU 这个字符 不然 太混乱了 为了匹配多边形
const EMPLOYMENT_TABLE_PATH = "tyokay/115x.px";
async function loadEmploymentData(year) {
    const query = [
        {
            code: "alue_23_20250101",
            selection: {
                filter: "all",
                values: ["*"],
            },
        },
        {
            code: "timeperiod_y",
            selection: {
                filter: "item",
                values: [year.toString()],
            },
        },
        {
            code: "contentscode",
            selection: {
                filter: "all",
                values: ["*"],
            },
        },
    ];
    const data = decodeJsonStat(await fetchPxwebData(EMPLOYMENT_TABLE_PATH, query));
    const areaDim = data.dimensions["alue_23_20250101"];
    const table = {};
    //next step ,collext data
    //遍历每个市镇的代码，跳过全国、省份等非市镇的代码
    //最终 table里面装了 市镇的名字，就业率 ，失业率， 经济抚养比值
    for (const areaCode of Object.keys(areaDim.index)) {
    if (!areaCode.startsWith("KU")) continue;  // 跳过全国、省份等非市镇

    const id = areaCode.replace("KU", "");     // "KU091" → "091"
    table[id] = {
      name: areaDim.labels[areaCode],
      employment: data.get({
        alue_23_20250101: areaCode,
        timeperiod_y: String(year),
        contentscode: "tyokay-tyollisyysaste",
      }),
      unemployment: data.get({
        alue_23_20250101: areaCode,
        timeperiod_y: String(year),
        contentscode: "tyokay-tyottomyysaste",
      }),
      dependency: data.get({
        alue_23_20250101: areaCode,
        timeperiod_y: String(year),
        contentscode: "taloudellinenhuoltosuhde",
      }),
    };
  }

  return table;
}
//就是给折线图 提供 一个市镇 全部年份的信息功能
async function loadTownSeries(townCode) {
    const areaCode = "KU" + townCode;

    const query = [
        { code: "alue_23_20250101", selection: { filter: "item", values: [areaCode] } },
        { code: "timeperiod_y", selection: { filter: "all", values: ["*"] } },
        { code: "contentscode", selection: { filter: "all", values: ["*"] } },
    ];

    const data = decodeJsonStat(await fetchPxwebData(EMPLOYMENT_TABLE_PATH, query));

    // 年份都是四位数字，按字符串从小到大排，刚好就是从早到晚
    const years = Object.keys(data.dimensions["timeperiod_y"].index).sort();

    // pick把某一个指标的所有年份取成一个数组
    //避免循环三遍的函数。太复杂 通过pick函数 直接做到这个对象里装了四样东西 年份+ 3个指标
    function pick(contentCode) {
        const result = [];
        for (const year of years) {
            result.push(data.get({
                alue_23_20250101: areaCode,
                timeperiod_y: year,
                contentscode: contentCode,
            }));
        }
        return result;
    }

    return {
        years: years,
        employment: pick("tyokay-tyollisyysaste"),
        unemployment: pick("tyokay-tyottomyysaste"),
        dependency: pick("taloudellinenhuoltosuhde"),
    };
}


//municipal election
const ELECTION_TABLE_PATH = "kvaa/152l.px";
const ELECTION_YEAR ="2025";

async function loadElectionData() {
    const query = [
        { code: "timeperiod_y", selection: { filter: "item", values: [ELECTION_YEAR] } },
        { code: "puolue_35_20250101", selection: { filter: "all", values: ["*"] } },
        { code: "sukupuoli_9_20180101", selection: { filter: "item", values: ["SSS"] } },
        { code: "kunta_130_20250101", selection: { filter: "all", values: ["*"] } },
        { code: "contentscode", selection: { filter: "item", values: ["kvaa-osuus_val"] } },
    ];
    const data = decodeJsonStat(await fetchPxwebData(ELECTION_TABLE_PATH, query));
    const areaDim = data.dimensions["kunta_130_20250101"];
    const partyDim = data.dimensions["puolue_35_20250101"];
     
    const table={};
    //循环遍历每一个市镇 然后对比得票占比，把第一名的编码 正当名字 得票比例 存进table
    //这一步被指导完成 有点困难。。。
    const parties =[];
    for (const partyCode of Object.keys(partyDim.index)){
        if(partyCode === "SSS") continue;
        parties.push(partyCode);
    }
    for (const areaCode of Object.keys(areaDim.index)){
        if (areaCode === "SSS")continue;
        if (areaCode.startsWith("VP")) continue;
        const list=[];
        for (const partyCode of parties){
            list.push({
                partyCode: partyCode,
                partyName: partyDim.labels[partyCode],
                share: data.get({
                    timeperiod_y: ELECTION_YEAR,
                    puolue_35_20250101: partyCode,
                    sukupuoli_9_20180101: "SSS",
                    kunta_130_20250101: areaCode,
                    contentscode: "kvaa-osuus_val",
                }),
            });

        }
        const winner = findWinner(list);
        if (winner !== null){
            table[areaCode]=winner;

        }
    }
    return table;
}    
function findWinner(list){
    let winner = null;
    for(const i of list){
        if (i.share ===null) continue;
        if (winner ===null || i.share > winner.share){
            winner = i;
        }

    }
    return winner;
}

//catch the population data
//catch the people agr struture population change
const POPULATION_TABLE_PATH = "vaerak/11ra.px";
const POPULATION_YEAR ="2025";

async function loadpopulationdata() {
    const query = [
        { code: "alue_23_20260101", selection: { filter: "all", values: ["*"] } },
        { code: "contentscode", selection: { filter: "item", values: ["vaerak-vaesto", "vaesto_yli64_p", "kokmuutos_p"] } },
        { code: "timeperiod_y", selection: { filter: "item", values: [POPULATION_YEAR] } },
    ];

    const data = decodeJsonStat(await fetchPxwebData(POPULATION_TABLE_PATH, query));

    const areaDim = data.dimensions["alue_23_20260101"];
    const table = {};
    for (const areaCode of Object.keys(areaDim.index)){
        //only keep the data in town
        if (!areaCode.startsWith("KU")) continue;
        const id = areaCode.replace("KU", "")
        table[id] = {
            population: data.get({
                alue_23_20260101: areaCode,
                contentscode: "vaerak-vaesto",
                timeperiod_y: POPULATION_YEAR,
            }),
            over65: data.get({
                alue_23_20260101: areaCode,
                contentscode: "vaesto_yli64_p",
                timeperiod_y: POPULATION_YEAR,
            }),
            popChange: data.get({
                alue_23_20260101: areaCode,
                contentscode: "kokmuutos_p",
                timeperiod_y: POPULATION_YEAR,
            }),
        };
    }

    return table;
    

    
}