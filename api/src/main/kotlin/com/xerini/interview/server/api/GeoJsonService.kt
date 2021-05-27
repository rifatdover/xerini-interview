@file:Suppress("unused")

package com.xerini.interview.server.api

import com.typesafe.config.Config
import com.typesafe.config.ConfigFactory
import com.xerini.interview.util.GsonUtil
import org.slf4j.LoggerFactory
import java.io.File
import java.net.URI
import java.nio.charset.Charset
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.attribute.PosixFilePermission
import java.nio.file.attribute.PosixFilePermissions
import java.util.*
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CopyOnWriteArrayList
import javax.ws.rs.*
import javax.ws.rs.core.MediaType.APPLICATION_JSON
import javax.ws.rs.core.MediaType.TEXT_PLAIN
import javax.ws.rs.core.Response


@Path("/geo-json")
class GeoJsonService {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val config: Config = ConfigFactory.defaultApplication()
    val path = "${System.getProperty("java.io.tmpdir")}/${config.getString("app.cache")}"
    private val serializer: JsonSerializer = JsonSerializer(path)

    init {
        logger.info("Cache Path:$path")
    }

    @GET
    @Produces(APPLICATION_JSON)
    fun getGeoJson(): GeoJsonObject {
        return serializer.getGeoJson()
    }

    @Path("/add")
    @POST
    @Consumes(APPLICATION_JSON)
    fun addPoint(coordinates: List<Double>): Response = if (coordinates.validCoordinates()) {
        serializer.addPoint(coordinates)
        Response.created(URI.create("/geo-json/add")).build()
    } else Response.status(400, "Invalid Coordinates").build()

    @Path("/{id}/name")
    @PUT
    @Consumes(TEXT_PLAIN)
    fun updatePoint(@PathParam("id") id: String, name: String?): Response = if (!name.isNullOrEmpty()) {
        serializer.updatePoint(id, name)
        Response.ok().build()
    } else Response.status(400, "Invalid Name").build()


}

fun List<Double>.validCoordinates(): Boolean = this.size == 2

data class GeoJsonObject(val features: List<GeoJsonFeature>) {
    val type: String = "FeatureCollection"
}

data class GeoJsonFeature(val geometry: GeometryData?, val properties: Map<String, Any?> = emptyMap()) {
    val type: String = "Feature"
}

data class GeometryData(val coordinates: List<Double>) {
    val type: String = "Point"
}

class JsonSerializer(private val path: String) {
    private val allCoordinates = CopyOnWriteArrayList<GeoJsonFeature>()
    private val logger = LoggerFactory.getLogger(javaClass)

    init {
        val file = File(this.path)
        if (file.isDirectory) throw InternalError("Invalid file ${this.path}")

        if (!file.exists()) {
            val perms: MutableSet<PosixFilePermission> = HashSet()
            perms.add(PosixFilePermission.OWNER_READ)
            perms.add(PosixFilePermission.OWNER_WRITE)

            val fileAttributes = PosixFilePermissions.asFileAttribute(perms)

            Files.createFile(Paths.get(this.path), fileAttributes)
        } else {
            val string = file.readText(Charset.forName("UTF8"))
            val data = GsonUtil.gson.fromJson(string, GeoJsonObject::class.java)
            data?.features?.let { allCoordinates.addAll(it) }
        }
    }

    fun addPoint(coord: List<Double>, id: String = UUID.randomUUID().toString()): CompletableFuture<Boolean> {
        val properties: Map<String, Any?> = mapOf("id" to id)
        allCoordinates.add(GeoJsonFeature(GeometryData(coord), properties))
        return save()
    }
    fun updatePoint(id: String, name: String? = null): CompletableFuture<Boolean> {
        val properties: Map<String, Any?> = mapOf("name" to name, "id" to id)
        val data = allCoordinates.firstOrNull { id == it.properties["id"] }
        if(data?.geometry != null) allCoordinates.remove(data) else return CompletableFuture.completedFuture(false)
        allCoordinates.add(GeoJsonFeature(GeometryData(data.geometry.coordinates), properties))
        return save()
    }

    fun getGeoJson(): GeoJsonObject {
        return GeoJsonObject(allCoordinates)
    }

    private fun save(): CompletableFuture<Boolean> {
        return CompletableFuture<Boolean>().completeAsync {

            val json = GsonUtil.gson.toJson(getGeoJson())
            try {
                val file = File(this.path)
                file.writeText(json, Charsets.UTF_8)
                return@completeAsync true
            } catch (error: Error) {
                logger.error("Error writing file", error)
            }
            return@completeAsync false
        }
    }

}
