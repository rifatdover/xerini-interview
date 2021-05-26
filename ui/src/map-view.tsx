import * as React from "react"
import {useEffect, useState} from "react"
import {Feature, Map, MapBrowserEvent, View} from "ol";
import {fromLonLat} from "ol/proj";
import TileLayer from "ol/layer/Tile";
import {Cluster, OSM, Vector} from "ol/source";

import "ol/ol.css";
import {FeatureLike} from "ol/Feature";
import VectorLayer from "ol/layer/Vector";
import {GeoJSON} from "ol/format";
import {Fill, Icon, Stroke, Style, Text} from "ol/style";
import CircleStyle from "ol/style/Circle";

const geoJson = new GeoJSON()
const styleCache: any = {};

const mapPinStyle = (feature: Feature) => {

    const size = feature.get('features').length;

    let style = styleCache[size];
    if (style) return style;

    if (feature.get("features").length === 1)
        return new Style({
            image: new Icon({
                src: "/img/map-pin-blue.png",
                scale: 25 / 50,
                anchor: [0.5, 1.0]
            })
        });
    else {
        const text = new Text({
            text: size.toString(),
            fill: new Fill({
                color: '#fff',
            }),
        });
        style = new Style({
            image: new CircleStyle({
                radius: 10,
                stroke: new Stroke({
                    color: '#fff',
                }),
                fill: new Fill({
                    color: '#3399CC',
                }),
            }),
            text: text
        });
    }

    styleCache[size] = style;
    return style;
};


export const MapView: React.FC = () => {
    const [map, setMap] = useState<Map | undefined>(undefined)
    const [featureLayer, setFeatureLayer] = useState<VectorLayer | undefined>()
    const [features, setFeatures] = useState<FeatureLike[]>([])
    const [distance, setDistance] = useState<number>()

    useEffect(() => {
        const map = new Map({
            target: "map",
            layers: [
                new TileLayer({
                    source: new OSM()
                })
            ],
            view: new View({
                center: fromLonLat([-0.023758, 51.547504]),
                zoom: 13,
                minZoom: 6,
                maxZoom: 18
            })
        })
        map.on("singleclick", onMapClick);

        setMap(map)
        loadFeatureData()
    }, [])

    useEffect(() => {
        if (map) {
            setFeatureLayer(addFeatureLayer(featureLayer, features))
        }
    }, [map, features, distance])

    const loadFeatureData = () => {
        fetch("/api/geo-json")
            .then(response => response.json())
            .then(json => setFeatures(geoJson.readFeatures(json)))
    }

    const addFeatureLayer = (previousLayer: VectorLayer, features: FeatureLike[]): VectorLayer => {
        const newLayer = previousLayer ? previousLayer : new VectorLayer({
            style: mapPinStyle
        });

        if (previousLayer != undefined) {
            previousLayer.getSource().clear();
        } else {
            map.addLayer(newLayer);
        }

        (newLayer as any).tag = "features";

        const source = new Vector({
            format: geoJson,
            features: features as Feature<any>[]
        });

        const clusterSource = new Cluster({
            distance,
            source: source,
        });


        newLayer.setSource(clusterSource);

        return newLayer
    }

    const onMapClick = (e: MapBrowserEvent) => {
        fetch("/api/geo-json/add", {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            method: "POST",
            body: JSON.stringify(e.coordinate)
        })
            .catch(e => alert(`Error adding point: ${e.message}`))
            .then(loadFeatureData)
    }
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const parse = parseInt(event.target.value, 10)
        if (parse > 0) setDistance(parse);
    }
    useEffect(console.log, [distance])
    return <div>
        <div id="map" style={{height: "500px", width: "500px"}}/>
        <form>
            <label htmlFor="distance">cluster distance</label>
            <input value={String(distance)} onChange={handleChange} type="range" min="0" max="100" step="1"/>
        </form>
    </div>
}
