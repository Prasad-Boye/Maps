const _memoryCache = {};
const allowedPolygonTypes = ["Polygon", "MultiPolygon"];
const HEAVY_COUNTRIES = [];
/**
 * Fetch with cache. Uses memory and optionally localStorage for GET requests.
 * @param {string} url - The request URL (must be a string).
 * @param {object} [options] - Fetch options (only GET is cached).
 * @param {object} [cacheOptions] - { persist: boolean, ttl: number (ms, only for memory) }
 * @returns {Promise<any>} - Resolves with response data (parsed JSON)
 */
export const fetchWithCache = async (url, options = {}, cacheOptions = { persist: false, ttl: 0 }) => {
  const isGet = !options.method || options.method.toUpperCase() === 'GET';
  if (!isGet) return fetch(url, options).then(r => r.json());

  const cacheKey = url;
  const now = Date.now();

  if (_memoryCache[cacheKey]) {
    const { value, expiry } = _memoryCache[cacheKey];
    if (!expiry || now < expiry) return value;
    delete _memoryCache[cacheKey];
  }

  if (cacheOptions.persist && typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem('fwc_' + cacheKey);
    if (raw) {
      try {
        const { value, expiry } = JSON.parse(raw);
        if (!expiry || now < expiry) {
          _memoryCache[cacheKey] = { value, expiry };
          return value;
        } else {
          localStorage.removeItem('fwc_' + cacheKey);
        }
      } catch {}
    }
  }

  const response = await fetch(url, options);
  const data = await response.json();
  const expiry = cacheOptions.ttl ? now + cacheOptions.ttl : 0;
  _memoryCache[cacheKey] = { value: data, expiry };
  if (cacheOptions.persist && typeof localStorage !== 'undefined') {
    localStorage.setItem('fwc_' + cacheKey, JSON.stringify({ value: data, expiry }));
  }
  return data;
}


export const convertToPolygonFeatures = (geometry, properties) => {
    if (!geometry) return [];
    
    if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.map((polygonCoords, index) => ({
        type: 'Feature',
        properties: { ...properties, id: `${index}` },
        geometry: {
          type: 'Polygon',
          coordinates: polygonCoords
        }
      }));
    } else if (geometry.type === 'Polygon') {
      return [{
        type: 'Feature',
        properties: { ...properties, id: '0' },
        geometry: {
          type: 'Polygon',
          coordinates: geometry.coordinates
        }
      }];
    }
    return [];
  };


  export const fetchMapData = async (countryCode, demography, setLoadingMapData, setBounds ) => {
    setLoadingMapData(true);
    if (!demography || !countryCode) {
      setLoadingMapData(false);
      return;
    }
    
    let endpoint = `https://www.geoboundaries.org/data/geoBoundaries-3_0_0/${countryCode}/ADM1/geoBoundaries-3_0_0-${countryCode}-ADM1.geojson`;
    if (HEAVY_COUNTRIES.includes(countryCode)) {
      endpoint = `https://www.geoboundaries.org/data/geoBoundaries-3_0_0/${countryCode}/ADM0/geoBoundaries-3_0_0-${countryCode}-ADM0.geojson`;
    }
    
    try {
      const data = await fetchWithCache(endpoint, {}, { persist: false, ttl: 1000 * 60 * 10 }); // 10 min memory cache
      
      if (data.features && data.features.length) {
        const colorPalette = [
          '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6',
          '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3',
          '#808000', '#ffd8b1', '#000075', '#808080', '#ffffff', '#000000'
        ];
        let colorIdx = 0;
        const allFeatures = data.features.flatMap((feature, idx) => {
          const geometry = feature.geometry;
          const properties = { ...feature.properties, color: colorPalette[colorIdx % colorPalette.length] };
          colorIdx++;
          if (allowedPolygonTypes.includes(geometry.type)) {
            return convertToPolygonFeatures(geometry, properties);
          }
          return [];
        });
        setBounds({
          type: "FeatureCollection",
          features: allFeatures
        });
      }
    } catch (error) {
      console.error("Error fetching map data:", error);
      window.alert("Error fetching map data");
    } finally {
      setLoadingMapData(false);
    }
  };

  export const getDetailedPlaces = async (lng, lat, categories = 'tourism,entertainment') => {
    const accessToken = 'pk.eyJ1IjoicHJhc2FkLWJveWUiLCJhIjoiY21kNmFpN2Y0MDZhczJpczQwN21ieDJ5MSJ9.noHpg7EZy44fCuw1lUp1IQ';
    const baseUrl = 'https://api.mapbox.com/search/searchbox/v1/category';
    
    try {
      const url = `${baseUrl}/${categories}?` +
      `&proximity=${lng},${lat}` +
      `&limit=10` +
      `&access_token=${accessToken}`;
      const data = await fetchWithCache(url, {}, { persist: false, ttl: 1000 * 60 * 5 });
      return data.features.map(feature => ({
        name: feature.properties.name,
        type: feature.properties.category,
        coordinates: feature.geometry.coordinates,
        address: feature.properties.full_address
      }));
      
    } catch (error) {
      console.error("Error fetching places:", error);
      window.alert("Error fetching places");
      return [];
    }
  }