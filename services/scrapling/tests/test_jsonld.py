from extractors.jsonld import extract_jsonld


class TestSingleRestaurantBlock:
    def test_extracts_name(self, restaurant_jsonld_html):
        result = extract_jsonld(restaurant_jsonld_html)
        assert result["name"] == "Havfruen Fiskerestaurant"

    def test_extracts_description(self, restaurant_jsonld_html):
        result = extract_jsonld(restaurant_jsonld_html)
        assert result["description"] == "Trondheims beste sjømatrestaurant siden 1952"

    def test_extracts_telephone(self, restaurant_jsonld_html):
        result = extract_jsonld(restaurant_jsonld_html)
        assert result["telephone"] == "+47 73 87 40 70"

    def test_extracts_email(self, restaurant_jsonld_html):
        result = extract_jsonld(restaurant_jsonld_html)
        assert result["email"] == "post@havfruen.no"

    def test_extracts_address_fields(self, restaurant_jsonld_html):
        result = extract_jsonld(restaurant_jsonld_html)
        addr = result["address"]
        assert addr["street"] == "Kjøpmannsgata 7"
        assert addr["postalCode"] == "7013"
        assert addr["city"] == "Trondheim"
        assert addr["country"] == "NO"

    def test_extracts_opening_hours_iso(self, restaurant_jsonld_html):
        result = extract_jsonld(restaurant_jsonld_html)
        hours = result["openingHours"]
        assert "Mo-Fr 11:00-22:00" in hours
        assert "Sa 12:00-23:00" in hours
        assert "Su 13:00-20:00" in hours

    def test_extracts_cuisine(self, restaurant_jsonld_html):
        result = extract_jsonld(restaurant_jsonld_html)
        assert result["cuisine"] == "Seafood"

    def test_extracts_price_range(self, restaurant_jsonld_html):
        result = extract_jsonld(restaurant_jsonld_html)
        assert result["priceRange"] == "$$$"

    def test_extracts_logo_url(self, restaurant_jsonld_html):
        result = extract_jsonld(restaurant_jsonld_html)
        assert result["logo"] == "https://havfruen.no/logo.png"

    def test_extracts_same_as(self, restaurant_jsonld_html):
        result = extract_jsonld(restaurant_jsonld_html)
        assert "https://www.facebook.com/havfruen" in result["sameAs"]
        assert "https://www.instagram.com/havfruen" in result["sameAs"]


class TestGraphArray:
    def test_most_specific_type_wins_for_name(self, yoast_graph_html):
        result = extract_jsonld(yoast_graph_html)
        # LocalBusiness (priority 4) beats Organization (priority 5)
        assert result["name"] == "Example Bistro"

    def test_address_from_local_business(self, yoast_graph_html):
        result = extract_jsonld(yoast_graph_html)
        assert result["address"]["street"] == "Karl Johans gate 1"
        assert result["address"]["city"] == "Oslo"

    def test_phone_from_local_business(self, yoast_graph_html):
        result = extract_jsonld(yoast_graph_html)
        assert result["telephone"] == "+47 22 33 44 55"

    def test_same_as_merged_from_organization(self, yoast_graph_html):
        result = extract_jsonld(yoast_graph_html)
        assert "https://www.facebook.com/examplecorp" in result["sameAs"]
        assert "https://www.linkedin.com/company/examplecorp" in result["sameAs"]

    def test_logo_from_organization_image_object(self, yoast_graph_html):
        result = extract_jsonld(yoast_graph_html)
        assert result["logo"] == "https://example.com/org-logo.png"

    def test_opening_hours_extraction(self, yoast_graph_html):
        result = extract_jsonld(yoast_graph_html)
        assert "Mo-Fr 10:00-18:00" in result["openingHours"]


class TestMultipleBlocks:
    def test_restaurant_wins_for_cuisine(self, multiple_blocks_html):
        result = extract_jsonld(multiple_blocks_html)
        assert result["cuisine"] == "Norwegian, French"

    def test_hotel_provides_address(self, multiple_blocks_html):
        result = extract_jsonld(multiple_blocks_html)
        assert result["address"]["street"] == "Storgata 10"
        assert result["address"]["city"] == "Oslo"

    def test_restaurant_provides_price_range(self, multiple_blocks_html):
        result = extract_jsonld(multiple_blocks_html)
        assert result["priceRange"] == "$$$$"

    def test_opening_hours_from_simple_strings(self, multiple_blocks_html):
        result = extract_jsonld(multiple_blocks_html)
        assert "Mo-Fr 07:00-22:00" in result["openingHours"]
        assert "Sa 09:00-23:00" in result["openingHours"]
        assert "Su 10:00-20:00" in result["openingHours"]


class TestMalformedInput:
    def test_skips_broken_json(self, malformed_jsonld_html):
        result = extract_jsonld(malformed_jsonld_html)
        assert result["name"] == "Recovered Restaurant"

    def test_returns_empty_for_no_jsonld(self, og_only_html):
        result = extract_jsonld(og_only_html)
        assert result["name"] is None
        assert result["openingHours"] == []
        assert result["sameAs"] == []

    def test_handles_empty_string(self):
        result = extract_jsonld("")
        assert result["name"] is None

    def test_handles_none(self):
        result = extract_jsonld(None)
        assert result["name"] is None


class TestNestedLogo:
    def test_extracts_url_from_image_object(self, nested_logo_jsonld_html):
        result = extract_jsonld(nested_logo_jsonld_html)
        assert result["logo"] == "https://logocorp.com/brand-logo.png"


class TestOpeningHoursFormats:
    def test_simple_string_array(self, opening_hours_string_html):
        result = extract_jsonld(opening_hours_string_html)
        assert "Mo-Fr 08:00-16:00" in result["openingHours"]
        assert "Sa 10:00-14:00" in result["openingHours"]
