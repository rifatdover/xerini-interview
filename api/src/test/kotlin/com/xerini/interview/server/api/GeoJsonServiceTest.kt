package com.xerini.interview.server.api

import com.typesafe.config.ConfigFactory
import org.junit.Test
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class GeoJsonServiceTest {

    @Test
    fun `coordinate is valid`() {
        assertFalse { (listOf(80.0, 90.0, 100.0).validCoordinates()) }
        assertTrue { (listOf(80.0, 90.0).validCoordinates()) }
    }

    @Test
    fun `test json serializer`() {
        val path = "./test.json"
        File(path).deleteOnExit()
        val serializer = JsonSerializer(path)
        val lock = CountDownLatch(1)
        serializer.addPoint(listOf(80.0, 90.0))

        val future = serializer.addPoint(listOf(60.0, 70.0), "a1")
        assertFalse {future.isDone}

        lock.await(100, TimeUnit.MILLISECONDS)
        assert(future.isDone)

        serializer.updatePoint("a1", "test")
        val first = serializer.getGeoJson().features.first { it.properties["id"] == "a1" }
        assert(first.properties["name"] == "test")

    }

    @Test
    fun `stores and retrieves geo-json coordinate data`() {
        val service = GeoJsonService()
        val fail = service.addPoint(listOf(80.0, 90.0, 100.0))
        assert(fail.status == 400)
        assert(fail.statusInfo.reasonPhrase == "Invalid Coordinates")

        val success = service.addPoint(listOf(80.0, 90.0))
        assert(success.status == 201)
        assert(success.statusInfo.reasonPhrase == "Created")

        val geoJson = service.getGeoJson()
        assert(geoJson.features.isNotEmpty())
        assert(geoJson.features.size == 1)

        val update = service.updatePoint(geoJson.features[0].properties["id"] as String, "test")
        assert(update.status == 200)

        val updateFail = service.updatePoint(geoJson.features[0].properties["id"] as String, "")
        assert(updateFail.status == 400)


        val config = ConfigFactory.defaultApplication()
        val path = "${System.getProperty("java.io.tmpdir")}/${config.getString("app.cache")}"
        File(path).delete()
    }
}
