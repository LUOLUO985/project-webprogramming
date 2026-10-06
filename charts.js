let chart = null;

//折线函数 
function drawtrendchart(townname, years, values){
    //to save the space ,need judge wether there has excited a chart
    //所以这部还是很有用的 没有的话 会浪费很多内存 而且每次都需要加在一个新图表
    if (chart === null){
        chart = echarts.init(document.getElementById("chart"));

    }

    chart.setOption({
        title:{
            text: townname,
            left:"center",
            textStyle:{fontSize: 15},


        },
        tooltip: { trigger: "axis" },
        grid: { left: 45, right: 15, top: 40, bottom: 25 },
        xAxis: {
            type: "category",
            data: years,
        },
        yAxis: {
            type: "value",
            scale: true,
        },
        series: [{
            type: "line",
            data: values,
            smooth: true,
            symbolSize: 4,
        }],
    })
}