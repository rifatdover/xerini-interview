package com.xerini.interview.server.api

import org.junit.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class GeoJsonServiceTest {
    private val service = GeoJsonService()

    @Test
    fun `coordinate is valid`() {
        assertFalse { (listOf(80.0, 90.0, 100.0).validCoordinates()) }
        assertTrue { (listOf(80.0, 90.0).validCoordinates()) }
    }

    @Test
    fun `stores and retrieves geo-json coordinate data`() {
        val fail = service.addPoint(listOf(80.0, 90.0, 100.0))
        assert(fail.status == 400)
        assert(fail.statusInfo.reasonPhrase == "Invalid Coordinates")

        val success = service.addPoint(listOf(80.0, 90.0))
        assert(success.status == 201)
        assert(success.statusInfo.reasonPhrase == "Created")

        val geoJson = service.getGeoJson()
        assert(geoJson.features.isNotEmpty())
        assert(geoJson.features.size == 1)
    }
}
