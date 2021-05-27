import * as React from "react"
import {useCallback, useEffect, useState} from "react"
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

import {Select} from "ol/interaction";
import {click} from "ol/events/condition";

const geoJson = new GeoJSON()
const getNamedStyle = (name: string) => {
    const text = new Text({
        text: name,
        fill: new Fill({
            color: '#fff',
        }),
    });
    return new Style({
        image: new CircleStyle({
            radius: 20,
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
const mapPinStyle = (feature: Feature) => {
    let style;
    const size = feature.get('features').length;

    if (feature.get("features").length === 1) {
        const featName = feature.getProperties()["features"][0].getProperties()["name"];
        let nameText = undefined;
        if (featName) {
            style = getNamedStyle(featName)
        } else {
            style = new Style({
                image: new Icon({
                    src: "/img/map-pin-blue.png",
                    scale: 25 / 50,
                    anchor: [0.5, 1.0]
                }),
                text: nameText
            });
        }
    } else {
        style = getNamedStyle(size.toString())
    }
    return style;
};


export const MapView: React.FC = () => {
    const [map, setMap] = useState<Map | undefined>(undefined)
    const [featureLayer, setFeatureLayer] = useState<VectorLayer | undefined>()
    const [features, setFeatures] = useState<FeatureLike[]>([])
    const [distance, setDistance] = useState<number>()
    const [editMode, setEditMode] = useState<boolean>(false)
    const [selected, setSelected] = useState<FeatureLike | null>(null)
    const [name, setName] = useState<string | null>("")

    const onMapClick = useCallback((e: MapBrowserEvent) => {
        if (!editMode)
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
    }, [editMode])


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


    const updateName = () => {
        let id = selected.getProperties()["id"];
        if (!id) {
            alert(`Error id is undefined`)
            return;
        }
        fetch("/api/geo-json/" + id + "/name", {
            headers: {
                'Content-Type': 'text/plain',
                'Accept': 'text/plain',
            },
            method: "PUT",
            body: name
        })
            .catch(e => alert(`Error adding name: ${e.message}`))
            .then(loadFeatureData)
    }

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const parse = parseInt(event.target.value, 10)
        if (parse > 0) setDistance(parse);
    }

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

        const select = new Select({
            condition: function (mapBrowserEvent) {
                return click(mapBrowserEvent);
            }
        });

        map.addInteraction(select)

        select.on("select", evt => {
            if (!evt.selected[0]) {
                setSelected(null);
                return;
            }
            let feats = evt.selected[0].getProperties()["features"];
            if (feats.length === 1) {
                setSelected(feats[0]);
            }
        })

        setMap(map)
        loadFeatureData()
    }, [])

    useEffect(() => {
        if (map)
            map.on("click", onMapClick);
        return () => {
            if (map)
                map.un("click", onMapClick);
        }
    }, [map, onMapClick])

    useEffect(() => {
        setName("")
    }, [selected])

    useEffect(() => {
        if (map) {
            setFeatureLayer(addFeatureLayer(featureLayer, features))
            setSelected(null);
        }
    }, [map, features, distance])

    return <div>
        <div id="map" style={{height: "500px", width: "500px"}}/>
        <div>
            <label>Update Mode:
                <input defaultChecked={editMode} onChange={() => setEditMode(!editMode)} type="checkbox"/>
            </label>
            <br/>
            <label> Cluster Distance: </label>
            <input value={String(distance)} onChange={handleChange} type="range" min="0" max="100" step="1"/>
        </div>
        <br/>
        {selected ? (
            <div>
                <label htmlFor="distance">Update Name: </label>
                <input value={String(name)} onChange={e => setName(e.target.value)} type="text"/>
                <button onClick={updateName}>Update</button>
            </div>
        ) : undefined}
    </div>
}
