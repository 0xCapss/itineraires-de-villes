"""Configuration des villes ajoutées : zone couverte, repères, flux de transport, aéroports, tarifs (saisis de mémoire, non vérifiés)."""
import math

def kx(lat):
    return int(round(111320 * math.cos(math.radians(lat))))

FERIES_US = None   # repris de New York dans patch_villes

# id: (nom, bbox, centre, dc, zoom, devise, code devise, pays)
BASE = {
    "lax": ("Los Angeles", (-118.52, 33.98, -118.18, 34.14), (-118.2437, 34.0522), 0.2, 11.6),
    "las": ("Las Vegas", (-115.30, 36.04, -115.06, 36.22), (-115.1728, 36.1147), 0.25, 12.0),
    "chi": ("Chicago", (-87.82, 41.74, -87.58, 41.99), (-87.6298, 41.8781), 0.26, 11.8),
    "mia": ("Miami", (-80.32, 25.70, -80.10, 25.90), (-80.1918, 25.7617), 0.25, 11.8),
    "was": ("Washington", (-77.20, 38.80, -76.90, 39.00), (-77.0369, 38.9072), 0.3, 12.0),
    "bos": ("Boston", (-71.20, 42.28, -70.98, 42.42), (-71.0589, 42.3601), 0.25, 12.2),
    "sea": ("Seattle", (-122.45, 47.52, -122.20, 47.72), (-122.3321, 47.6062), 0.25, 12.0),
}

CITES_NEW = {}
for cid, (nom, bbox, centre, dc, zoom) in BASE.items():
    CITES_NEW[cid] = dict(nom=nom, bbox=bbox, centre=centre, dc=dc, zoom=zoom, kx=kx(centre[1]), pays="US",
                          devise="dollars américains", devise_code="USD", depart=[])

CITES_NEW["lax"]["depart"] = ["Griffith Observatory", "Grand Central Market", "Walt Disney Concert Hall"]
CITES_NEW["las"]["depart"] = ["Bellagio", "The Mob Museum", "Caesars Palace"]
CITES_NEW["chi"]["depart"] = ["Art Institute of Chicago", "Lou Malnati's Pizzeria", "Cloud Gate"]
CITES_NEW["mia"]["depart"] = ["Pérez Art Museum Miami", "Versailles", "Vizcaya Museum and Gardens"]
CITES_NEW["was"]["depart"] = ["National Air and Space Museum", "Founding Farmers", "Lincoln Memorial"]
CITES_NEW["bos"]["depart"] = ["Faneuil Hall", "Union Oyster House", "Museum of Fine Arts"]
CITES_NEW["sea"]["depart"] = ["Space Needle", "Pike Place Market", "Chihuly Garden and Glass"]

REPERES_NEW = {
    "lax": ["Hollywood Sign", "Griffith Observatory", "Getty Center", "Hollywood Walk of Fame", "TCL Chinese Theatre", "Santa Monica Pier", "Venice Beach",
            "Walt Disney Concert Hall", "The Broad", "Los Angeles County Museum of Art", "La Brea Tar Pits", "Natural History Museum of Los Angeles",
            "California Science Center", "Union Station", "Grand Central Market", "Olvera Street", "Dodger Stadium", "Hollywood Bowl", "The Grove",
            "Petersen Automotive Museum", "Bradbury Building", "Los Angeles City Hall", "Angels Flight", "Griffith Park", "Third Street Promenade",
            "Los Angeles Zoo", "Runyon Canyon", "Venice Canals", "Museum of Contemporary Art", "Hollywood Forever"],
    "las": ["Bellagio", "Fountains of Bellagio", "The Venetian", "Caesars Palace", "Welcome to Fabulous Las Vegas", "Fremont Street", "High Roller",
            "The STRAT", "The Mirage", "Luxor", "MGM Grand", "Paris Las Vegas", "New York-New York", "Mandalay Bay", "Wynn Las Vegas", "Springs Preserve",
            "Neon Museum", "Mob Museum", "Madame Tussauds", "Sphere", "Container Park", "Shark Reef", "Cosmopolitan", "Flamingo", "Treasure Island",
            "LINQ Promenade", "Allegiant Stadium", "Pinball Hall of Fame", "Discovery Children's Museum", "Eiffel Tower"],
    "chi": ["Cloud Gate", "Art Institute of Chicago", "Millennium Park", "Willis Tower", "Navy Pier", "Field Museum", "Shedd Aquarium", "Adler Planetarium",
            "Museum of Science and Industry", "Lincoln Park Zoo", "Wrigley Field", "Soldier Field", "Chicago Water Tower", "875 North Michigan",
            "Buckingham Fountain", "Grant Park", "Chicago Riverwalk", "Chicago Theatre", "Museum of Contemporary Art", "Garfield Park Conservatory",
            "Crown Fountain", "Chicago Cultural Center", "Lurie Garden", "The 606", "Oak Street Beach", "North Avenue Beach", "Harold Washington Library",
            "Pritzker Pavilion", "Chicago Botanic", "Frederick C. Robie House"],
    "mia": ["Vizcaya Museum", "Wynwood Walls", "Lincoln Road", "Ocean Drive", "Pérez Art Museum", "Frost Science", "Bayfront Park", "Freedom Tower",
            "Domino Park", "Bill Baggs Cape Florida", "Miami Seaquarium", "Jungle Island", "Fairchild Tropical", "Kaseya Center", "loanDepot park",
            "Bayside Marketplace", "Brickell City Centre", "Miami Beach Botanical Garden", "Holocaust Memorial", "Bass Museum", "The Wolfsonian",
            "Española Way", "Lummus Park", "Venetian Pool", "Coral Gables", "Little Havana", "South Pointe Park", "Art Deco Welcome Center", "Lowe Art Museum",
            "Museum of Graffiti"],
    "was": ["Lincoln Memorial", "Washington Monument", "United States Capitol", "White House", "National Air and Space Museum", "National Museum of Natural History",
            "National Gallery of Art", "National Museum of African American History", "National Museum of American History", "Vietnam Veterans Memorial",
            "Jefferson Memorial", "Martin Luther King Jr. Memorial", "Library of Congress", "Supreme Court", "Ford's Theatre", "Kennedy Center",
            "National Zoo", "Arlington National Cemetery", "Union Station", "Eastern Market", "Hirshhorn", "Renwick Gallery", "National Archives",
            "Holocaust Memorial Museum", "International Spy Museum", "Dumbarton Oaks", "Washington National Cathedral", "Franklin Delano Roosevelt Memorial",
            "World War II Memorial", "Korean War Veterans Memorial", "Smithsonian Institution Building", "United States Botanic Garden", "National Portrait Gallery"],
    "bos": ["Boston Common", "Public Garden", "Faneuil Hall", "Quincy Market", "Fenway Park", "Boston Public Library", "Old North Church", "Paul Revere House",
            "USS Constitution", "Bunker Hill Monument", "New England Aquarium", "Museum of Fine Arts", "Isabella Stewart Gardner Museum", "Boston Tea Party",
            "Massachusetts State House", "Trinity Church", "Prudential Center", "Harvard Yard", "MIT Museum", "Harvard Art Museums", "Acorn Street",
            "Symphony Hall", "TD Garden", "Institute of Contemporary Art", "Museum of Science", "Charles River Esplanade", "Arnold Arboretum",
            "Old State House", "Copp's Hill", "Harvard Museum of Natural History", "Boston Athenaeum"],
    "sea": ["Space Needle", "Pike Place Market", "Chihuly Garden and Glass", "Museum of Pop Culture", "Seattle Art Museum", "Seattle Aquarium", "Olympic Sculpture Park",
            "Kerry Park", "Gas Works Park", "Seattle Center", "Pioneer Square", "Smith Tower", "Seattle Central Library", "Museum of History and Industry",
            "Woodland Park Zoo", "Lumen Field", "T-Mobile Park", "Fremont Troll", "Discovery Park", "Washington Park Arboretum", "Seattle Great Wheel",
            "Hiram M. Chittenden Locks", "Pacific Science Center", "Volunteer Park", "Frye Art Museum", "Burke Museum", "Henry Art Gallery", "Alki Beach",
            "Columbia Center", "Climate Pledge Arena", "Gum Wall"],
}

# (fichier du miroir mdb-latest, libellé du flux, principal, champs supplémentaires des lignes)
FEEDS_NEW = {
    "lax": [("us-california-los-angeles-county-metropolitan-transportation-authority-gtfs-29.zip", "Métro et bus de LA Metro", True, {})],
    "las": [("us-nevada-regional-transportation-commission-of-southern-nevada-rtc-gtfs-110.zip", "Bus de la RTC du sud du Nevada", True, {})],
    "chi": [("us-illinois-chicago-transit-authority-cta-gtfs-389.zip", "Métro (L) et bus de la CTA", True, {})],
    "mia": [("us-florida-miami-dade-transit-gtfs-331.zip", "Metrorail, Metromover et bus de Miami-Dade Transit", True, {})],
    "was": [("us-district-of-columbia-washington-wmata-gtfs-1847.zip", "Métro de WMATA", True, {"tf": None}),
            ("us-district-of-columbia-washington-wmata-gtfs-1846.zip", "Bus de WMATA", False, {})],
    "bos": [("us-massachusetts-massachusetts-bay-transportation-authority-mbta-gtfs-437.zip", "Métro, tramways, bus et trains de la MBTA", True, {})],
    "sea": [("us-washington-king-county-metro-gtfs-1330.zip", "Bus de King County Metro", True, {}),
            ("us-washington-sound-transit-gtfs-268.zip", "Link, Sounder et Express de Sound Transit", False, {"tf": None})],
}

# aéroports : code, nom, lon, lat, minutes jusqu'au centre
AERO_NEW = {
    "lax": [("LAX", "Los Angeles International", -118.4085, 33.9416, 35), ("BUR", "Hollywood Burbank", -118.3587, 34.2007, 30)],
    "las": [("LAS", "Harry Reid International", -115.1537, 36.0840, 20)],
    "chi": [("ORD", "O'Hare International", -87.9048, 41.9742, 50), ("MDW", "Midway International", -87.7524, 41.7868, 35)],
    "mia": [("MIA", "Miami International", -80.2870, 25.7959, 25), ("FLL", "Fort Lauderdale-Hollywood", -80.1527, 26.0726, 40)],
    "was": [("DCA", "Reagan National", -77.0402, 38.8512, 20), ("IAD", "Dulles International", -77.4565, 38.9531, 45), ("BWI", "Baltimore-Washington", -76.6683, 39.1774, 50)],
    "bos": [("BOS", "Logan International", -71.0052, 42.3656, 25)],
    "sea": [("SEA", "Seattle-Tacoma International", -122.3088, 47.4502, 35)],
}
IATA_NEW = {"lax": "LAX", "las": "LAS", "chi": "CHI", "mia": "MIA", "was": "WAS", "bos": "BOS", "sea": "SEA"}
TRIP_NEW = {"lax": ("Los Angeles, CA, USA", "Los Angeles"), "las": ("Las Vegas, NV, USA", "Las Vegas"), "chi": ("Chicago, IL, USA", "Chicago"),
            "mia": ("Miami, FL, USA", "Miami"), "was": ("Washington, DC, USA", "Washington"), "bos": ("Boston, MA, USA", "Boston"),
            "sea": ("Seattle, WA, USA", "Seattle")}
# (tarif de base transport, prise en charge taxi, prix du km taxi, minute de lenteur)
TARIFS_NEW = {"lax": (1.75, 3.10, 1.70, 0.60), "las": (2.00, 3.50, 1.70, 0.60), "chi": (2.50, 3.25, 1.40, 0.60), "mia": (2.25, 2.75, 1.50, 0.50),
              "was": (2.25, 3.50, 1.35, 0.55), "bos": (2.40, 2.60, 1.75, 0.60), "sea": (2.75, 2.60, 1.70, 0.60)}
NOTES_NEW = {
    "lax": ("LA Metro", "Sont couverts le métro, les lignes de bus et les lignes légères de LA Metro. Les bus municipaux (DASH), Metrolink et les réseaux des villes voisines ne sont pas couverts."),
    "las": ("RTC", "Sont couverts les bus de la RTC du sud du Nevada, dont la ligne de la Strip. Le monorail et les navettes des casinos ne sont pas couverts."),
    "chi": ("CTA", "Sont couverts le métro (L) et les bus de la CTA. Pace et Metra ne sont pas couverts."),
    "mia": ("Miami-Dade Transit", "Sont couverts Metrorail, Metromover et les bus de Miami-Dade Transit. Brightline, Tri-Rail et les navettes de Miami Beach ne sont pas couverts."),
    "was": ("WMATA", "Sont couverts le métro et les bus de WMATA. Le métro a un tarif selon la distance, non compté. Les bus de DC Circulator et les trains MARC et VRE ne sont pas couverts."),
    "bos": ("MBTA", "Sont couverts le métro, les tramways, les bus et les trains de banlieue de la MBTA."),
    "sea": ("King County Metro et Sound Transit", "Sont couverts les bus de King County Metro, ainsi que Link, Sounder et les bus Express de Sound Transit (tarif selon la distance, non compté). Le monorail et le tramway de South Lake Union ne sont pas toujours couverts."),
}
