# SpatialMaps

A modern interactive map application with fast API caching, dynamic country and city selection, and multiple map types.

## Features
- **Multiple Map Types:** Standard, Satellite, and Population maps.
- **Country Selection:** Easily select and zoom to any country. Population map requires country selection.
- **City Markers:** Hover over markers to see city names. Click to zoom in.
- **Details Popups:** Hover/click on markers to see details. Popups have close buttons and auto-dismiss on zoom or blur.
- **API Caching:** Fast data loading with in-memory cache for map and population data.
- **Loader Overlay:** Visible loader while fetching map data.
- **Responsive UI:** All map controls are in a compact vertical tray overlay.
- **Consistent Styling:** All dropdowns and controls have a unified, compact look.

## How to Use

### 1. Map Types
- Use the **Map Style** dropdown at the top-right overlay tray to switch between:
  - **Standard:** Default street map.
  - **Satellite:** Satellite imagery.
  - **Population:** Population overlays (requires country selection).

### 2. Country Selection
- When you select **Population** map type, you must pick a country from the **Choose a country** dropdown.
- An alert will appear if you try to use Population map without selecting a country.
- The map will automatically zoom and center on the selected country.

### 3. City Markers
- Blue markers show major cities. Hover to see the city name.
- Click a marker to zoom in for more details.
- Some markers may show a detailed popup with a close (×) button.
- All popups close automatically on map zoom or click.

### 4. Loader
- When map or population data is loading, a spinner overlay will appear.

### 5. Caching
- All major API calls for map data and country population are cached in memory for fast repeat access.
- Cache TTL is set per endpoint (10 minutes for map data, 1 hour for country data).

### 6. Controls Overlay
- All controls (reset, map style, country selection) are in a vertical tray at the top-right of the map.
- Controls are compact and styled for clarity.

## Code Structure
- **src/App.jsx**: Main app logic, map initialization, loader, overlay tray, and marker logic.
- **src/components/utils.js**: API utility functions, caching logic.
- **src/components/Locations/Country.jsx**: Country dropdown, population data fetch, and country selection logic.

## Development
- Install dependencies: `npm install`
- Run the app: `npm start`
- Edit marker locations in `src/components/Locations/MarkerLocations.js`.

## Notes
- Mapbox token is required for map display (see App.jsx).
- All popups and overlays are styled for usability and performance.

---

For more details, see the code in the referenced files or contact the maintainer.
