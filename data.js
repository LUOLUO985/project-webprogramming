const PXWEB_BASE = "https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/";

//send a request to the API and return the response as JSON
async function fetchPxwebData(tablePath, query) {
  const response = await fetch(PXWEB_BASE + tablePath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
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
            label: categories.label,
        };
    }
    return dimensions;
}

//给维度坐标加下标的，因为不能用一堆数组取值，所以要给下标，自己写有bug 给dimensions起下标
function addIndexToDimensions(dimensions) {
    let indexedDimensions = 0;
    for (let i = 0; i < ids.length; i++) {
        const position = dimensions[ids[i]].index[dimensions[ids[i]]];
        if (position === undefined) return -1;
        offset = offset*sizes[i] + position;

    }
    return offset;
}
return {
    get: function (coord) {
      const offset = offsetOf(coord);
      if (offset < 0) return null;
      const value = data.value[offset];
      return value === undefined ? null : value;
        },
    };
//catch the emplpyment data
//拉取数据 就业率 方便地图 ，去除掉KU 这个字符 不然 太混乱了 为了匹配多边形
const EMPLOYMENT_TABLE_PATH = "tyokay/115x.px";
async function loadEmploymentData(year) {
    const query = [
        {
            code: "alue_23_20250101",
            selection: {
                filter: "item",
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
    const areaDim = data["alue_23_20250101"];
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