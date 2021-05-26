@file:Suppress("unused")

package com.xerini.interview.server.api

import java.net.URI
import java.util.concurrent.CopyOnWriteArrayList
import javax.ws.rs.*
import javax.ws.rs.core.MediaType.APPLICATION_JSON
import javax.ws.rs.core.Response

@Path("/geo-json")
class GeoJsonService {
    private val allCoordinates = CopyOnWriteArrayList<List<Double>>()

    @GET
    @Produces(APPLICATION_JSON)
    fun getGeoJson(): GeoJsonObject {
        val features = allCoordinates
            .map { GeometryData(it) }
            .map { GeoJsonFeature(it) }
        return GeoJsonObject(features)
    }

    @Path("/add")
    @POST
    @Consumes(APPLICATION_JSON)
    fun addPoint(coordinates: List<Double>): Response = if (coordinates.validCoordinates()) {
        allCoordinates.add(coordinates)
        Response.created(URI.create("/geo-json/add")).build()
    } else Response.status(400, "Invalid Coordinates").build()

}

fun List<Double>.validCoordinates(): Boolean {
    return this.size == 2
}

data class GeoJsonObject(val features: List<GeoJsonFeature>) {
    val type: String = "FeatureCollection"
}

data class GeoJsonFeature(val geometry: GeometryData?, val properties: Map<String, Any?> = emptyMap()) {
    val type: String = "Feature"
}

data class GeometryData(val coordinates: List<Double>) {
    val type: String = "Point"
}
