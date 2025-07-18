import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './App.css';
import { Autocomplete, Button, TextField } from '@mui/material';
import Country from './components/Locations/Country';
import locations from './components/Locations/MarkerLocations';
import { convertToPolygonFeatures, fetchMapData, getDetailedPlaces } from './components/utils';

const INITIAL_CENTER = [0.0, 0.0];
const INITIAL_ZOOM = 1.25;
const MAP_TYPES = ['Standard', 'Satellite', 'Population'];

function App() {
  const [loadingMapData, setLoadingMapData] = useState(false);
  const mapRef = useRef();
  const mapContainerRef = useRef();
  const detailedMarkersRef = useRef([]);

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  const [center, setCenter] = useState(INITIAL_CENTER);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [selectedMaptype, setSelectedMaptype] = useState(MAP_TYPES[0]);
  const [bounds, setBounds] = useState(null);
  const [demography, setDemography] = useState(null);
  const [countryCode, setCountryCode] = useState(null);
  const [demoGraphInfo, setDemoGraphInfo] = useState(null);
  
  const handleResetView = () => {
    mapRef.current?.flyTo({
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM
    });
    if (mapRef.current) {
      const clear = mapRef.current.__clearDetailedMarkers || (() => {});
      clear();
    }
  };

  useEffect(() => {
    mapboxgl.accessToken = 'pk.eyJ1IjoicHJhc2FkLWJveWUiLCJhIjoiY21kNmFpN2Y0MDZhczJpczQwN21ieDJ5MSJ9.noHpg7EZy44fCuw1lUp1IQ';
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      center: center,
      zoom: zoom,
      style: 'mapbox://styles/mapbox/streets-v9'
    });

    mapRef.current.on('move', () => {
      const { lng, lat } = mapRef.current.getCenter();
      setCenter([lng, lat]);
      setZoom(mapRef.current.getZoom());
    });

    const debouncedZoomHandler = debounce(async () => {
      const currentZoom = mapRef.current.getZoom();
      const center = mapRef.current.getCenter();
      if (selectedMaptype === 'Standard') {
        if (currentZoom > 15) {
          await showDetailedMarkers(center.lng, center.lat);
        } else {
          clearDetailedMarkers();
        }
      } else {
        clearDetailedMarkers();
      }
    }, 400);

    mapRef.current.on('zoomend', debouncedZoomHandler);

    function clearDetailedMarkers() {
      detailedMarkersRef.current.forEach(marker => marker.remove());
      detailedMarkersRef.current = [];
    }

    async function showDetailedMarkers(lng, lat) {
      clearDetailedMarkers();
      if (mapRef.current.getZoom() <= 15) return;
      const places = await getDetailedPlaces(lng, lat);
      if (places && places.length) {
        places.forEach(place => {
          const marker = new mapboxgl.Marker({ color: '#0080ff' })
            .setLngLat(place.coordinates)
            .addTo(mapRef.current);
          const popup = new mapboxgl.Popup({ offset: 25, closeButton: false, closeOnClick: false })
            .setHTML(`<div><b>${place.name}</b><br/>${place.address || ''}</div>`);
          marker.getElement().addEventListener('mouseenter', () => {
            popup.addTo(mapRef.current);
            popup.setLngLat(place.coordinates);
          });
          marker.getElement().addEventListener('mouseleave', () => {
            popup.remove();
          });
          detailedMarkersRef.current.push(marker);
        });
      }
    }

    let mainMarkersRef = [];
    function renderMainMarkers(selectedIdx = null) {
      mainMarkersRef.forEach(m => m.remove());
      mainMarkersRef = [];
      locations.forEach((location, idx) => {
        const color = idx === selectedIdx ? 'red' : '#0080ff';
        const marker = new mapboxgl.Marker({ color })
          .setLngLat([location.lng, location.lat])
          .addTo(mapRef.current);
        mainMarkersRef.push(marker);
        marker.getElement().addEventListener('click', async () => {
          renderMainMarkers(idx);
          mapRef.current.flyTo({ center: [location.lng, location.lat], zoom: 16 });
        });
      });
    }
    mapRef.current.on('load', () => {
      if (selectedMaptype === 'Standard') {
        renderMainMarkers();
      }
    });

    let detailedMarkersShown = false;
    let lastZoom = mapRef.current.getZoom();
    mapRef.current.on('zoomend', async () => {
      const currentZoom = mapRef.current.getZoom();
      const center = mapRef.current.getCenter();

      if (lastZoom >= 14 && currentZoom < 14) {
        detailedMarkersShown = true;
      } else if (lastZoom < 14 && currentZoom >= 14) {
        clearDetailedMarkers();
        detailedMarkersShown = false;
      }
      lastZoom = currentZoom;
    });

    return () => {
      clearDetailedMarkers();
      mapRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    
    const styleMap = {
      'Satellite': 'mapbox://styles/mapbox/satellite-v9',
      'Population': 'mapbox://styles/mapbox/light-v10',
      'Standard': 'mapbox://styles/mapbox/streets-v11'
    };
    
    mapRef.current.setStyle(styleMap[selectedMaptype]);
  }, [selectedMaptype]);

  useEffect(() => {
    fetchMapData(countryCode, demography, setLoadingMapData, setBounds);
  }, [countryCode]);

  const prevSourceIdRef = useRef(null);

  useEffect(() => {
    if (!bounds || !demography || !mapRef.current) return;
    
    const map = mapRef.current;
    const sourceId = demography;

    if (prevSourceIdRef.current && map.getSource(prevSourceIdRef.current)) {
      const prevSourceId = prevSourceIdRef.current;
      const layers = map.getStyle().layers;
      if (layers) {
        layers.forEach(layer => {
          if (layer.source === prevSourceId) {
            map.removeLayer(layer.id);
          }
        });
      }
      map.removeSource(prevSourceId);
    }
    prevSourceIdRef.current = sourceId;

    if (bounds.features && bounds.features.length > 0) {
      let allCoords = [];
      bounds.features.forEach(f => {
        if (f.geometry.type === 'Polygon') {
          allCoords = allCoords.concat(f.geometry.coordinates.flat());
        } else if (f.geometry.type === 'MultiPolygon') {
          f.geometry.coordinates.forEach(poly => {
            allCoords = allCoords.concat(poly.flat());
          });
        }
      });
      if (allCoords.length > 0) {
        let minLng = allCoords[0][0], maxLng = allCoords[0][0];
        let minLat = allCoords[0][1], maxLat = allCoords[0][1];
        allCoords.forEach(([lng, lat]) => {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        });
        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 40, duration: 1200 });
      }
    }

    if (!map.getStyle()) {
      map.on('load', () => handleBoundsChange());
      return;
    }
    
    handleBoundsChange();
    
    function handleBoundsChange() {
      if (map.getSource(sourceId)) {
        map.getStyle().layers.forEach(layer => {
          if (layer.source === sourceId) map.removeLayer(layer.id);
        });
        map.removeSource(sourceId);
      }
      map.addSource(sourceId, {
        type: 'geojson',
        data: bounds.type === "FeatureCollection" ? bounds : {
          type: 'FeatureCollection',
          features: convertToPolygonFeatures({
            type: bounds.type,
            coordinates: bounds.coordinates
          })
        }
      });
      
      map.addLayer({
        id: `${sourceId}-fill`,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            '#ff0000',
            ['get', 'color']
          ],
          'fill-opacity': 0.5,
          'fill-outline-color': '#000'
        }
      });
      
      map.addLayer({
        id: `${sourceId}-outline`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#000',
          'line-width': 2
        }
      });
      
      let hoveredStateId = null;
      
      let popup;
      map.on('mousemove', `${sourceId}-fill`, (e) => {
        if (selectedMaptype !== 'Population') return;
        if (e.features.length > 0) {
          if (hoveredStateId !== null) {
            map.setFeatureState(
              { source: sourceId, id: sourceId },
              { hover: false }
            );
          }
          hoveredStateId = e.features[0].id;
          map.setFeatureState(
            { source: sourceId, id: sourceId },
            { hover: true }
          );

          const props = e.features[0].properties;
          const html = `<div>
          <b>${props.shapeName || 'Region'}</b><br/>
          <b>${`Country: ${demoGraphInfo?.country}`}</b><br/>
            ${demoGraphInfo?.population ? 'Population: ' + demoGraphInfo.population + '<br/>' : ''}
            ${demoGraphInfo?.year ? 'Year: ' + demoGraphInfo.year + '<br/>' : ''}
          </div>`;
          if (!popup) {
            popup = new mapboxgl.Popup({ offset: 25, closeButton: false, closeOnClick: false });
          }
          popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
        }
      });
      
      map.on('mouseleave', `${sourceId}-fill`, () => {
        if (hoveredStateId !== null) {
          map.setFeatureState(
            { source: sourceId, id: sourceId },
            { hover: false }
          );
        }
        hoveredStateId = null;
        if (popup) {
          popup.remove();
        }
      });
    }
  }, [bounds, demoGraphInfo]);

  return (
    <>
      <div style={{ position: 'fixed', width: '100vw', height: '100vh', top: 0, left: 0, zIndex: 1 }}>
        {loadingMapData && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(255,255,255,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}>
            <div className="loader" style={{
              border: '6px solid #f3f3f3',
              borderTop: '6px solid #3498db',
              borderRadius: '50%',
              width: 48,
              height: 48,
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        <div style={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 20,
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 8,
          boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          alignItems: 'stretch',
          minWidth: 180,
          maxWidth: 250,
          fontSize: '0.6rem',
        }}>
          <Button variant="contained" onClick={handleResetView} sx={{ mb: 1, fontSize: '0.7rem', padding: '4px 10px', minWidth: 0, minHeight: 0 }}>Reset View</Button>
          <Autocomplete
            options={MAP_TYPES}
            value={selectedMaptype}
            onChange={(_, value) => setSelectedMaptype(value)}
            sx={{ width: '100%', fontSize: '0.8rem', '.MuiInputBase-root': { fontSize: '0.8rem', minHeight: '32px' }, '.MuiAutocomplete-input': { fontSize: '0.8rem' }, '.MuiAutocomplete-option': { fontSize: '0.8rem', minHeight: '28px' } }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Map Style"
                size="small"
                sx={{ fontSize: '0.8rem' }}
                InputLabelProps={{ sx: { fontSize: '0.8rem' } }}
              />
            )}
          />
          {selectedMaptype === 'Population' && (
            <Country setDemography={setDemography} setCountryCode={setCountryCode} selectedMaptype={selectedMaptype} setDemoGraphInfo={setDemoGraphInfo} small />
          )}
        </div>
          <Autocomplete
            options={MAP_TYPES}
            value={selectedMaptype}
            onChange={(_, value) => setSelectedMaptype(value)}
            sx={{ width: '100%' }}
            renderInput={(params) => <TextField {...params} label="Map Style" />}
          />
          {selectedMaptype === 'Population' && (
            <Country setDemography={setDemography} setCountryCode={setCountryCode} selectedMaptype={selectedMaptype} setDemoGraphInfo={setDemoGraphInfo} />
          )}
        </div>
      {selectedMaptype === 'Population' && (
        <style>{`.mapboxgl-marker.mapboxgl-marker-anchor-center { display: none !important; }`}</style>
      )}
    </>
  );
}

export default App;