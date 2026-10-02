//address of the GeoJSON data for Finnish municipalities
const GEOJSON_URL =
  "https://geo.stat.fi/geoserver/wfs?service=WFS&version=2.0.0" +
  "&request=GetFeature&typeName=tilastointialueet:kunta4500k" +
  "&outputFormat=json&srsName=EPSG:4326";

document.addEventListener("DOMContentLoaded", init);
//draw the map
async function init() {
    const map = L.map("map");
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
    }).addTo(map);
    const geoJsonData = await fetch(GEOJSON_URL).then((res) => res.json());
    const layer = L.geoJSON(geoJsonData, {
        style:{
            color: "#94a3b8",
            weight: 1,
            fillColor: "#e2e8f0",
            fillOpacity: 0.7,
        },
        //add name
        onEachFeature: (feature, townlayer) => {
            townlayer.bindTooltip(feature.properties.name);
        }
    }).addTo(map);
    map.fitBounds(layer.getBounds());
}