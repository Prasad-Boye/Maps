import { Autocomplete, Box, TextField } from "@mui/material";
import { useState, useEffect } from "react";
import { fetchWithCache } from "../utils";

const Country = ({ setDemography, selectedMaptype, setCountryCode, setDemoGraphInfo, onCountrySelect }) => {
  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState(null)

  const handleCountryClick = async () => {
    const data = await fetchWithCache("https://countriesnow.space/api/v0.1/countries", {}, { persist: false, ttl: 1000 * 60 * 60 }); // 1 hour memory cache
    setCountries(data.data);
  };

  useEffect(() => {
    setCountry(null);
    setDemography(null);
  }, [selectedMaptype]);

  const handleCountryChange = async (event, value) => {
    if(!value?.country) return;
    setCountry(value?.country || null);
    setCountryCode(value?.['iso3']);
    setDemography(value?.country || null);
    const peopleData = await fetch(
      `https://countriesnow.space/api/v0.1/countries/population`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: value.country })
      }
    );
    const populationData = await peopleData.json();
    console.log(populationData, "Pop")
    const dataLen = populationData.data.populationCounts.length;
    const population = populationData.data.populationCounts[dataLen - 1].value;
    const year = populationData.data.populationCounts[dataLen - 1].year;
    console.log(population, year, "Pop")
    setDemoGraphInfo({ population, year, country: value.country });

    if (onCountrySelect && value?.country) {
      try {
        const geoData = await fetchWithCache(
          `https://nominatim.openstreetmap.org/search?country=${encodeURIComponent(value.country)}&format=json&limit=1`,
          {},
          { persist: false, ttl: 1000 * 60 * 60 }
        );
        if (geoData && geoData[0]) {
          const lat = parseFloat(geoData[0].lat);
          const lon = parseFloat(geoData[0].lon);
          // Use a reasonable zoom for country view
          onCountrySelect([lon, lat], 5);
        }
      } catch (err) {
        // fail silently
      }
    }
  };

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Autocomplete
        id="select-country"
        loading={countries.length === 0}
        loadingText="Loading..."
        size="small"
        sx={{ width: '100%', fontSize: '0.8rem', '.MuiInputBase-root': { fontSize: '0.8rem', minHeight: '32px', padding: '0 8px' }, '.MuiAutocomplete-input': { fontSize: '0.8rem', padding: '8.5px 4px' }, '.MuiAutocomplete-option': { fontSize: '0.8rem', minHeight: '28px' } }}
        options={countries}
        clearOnBlur
        clearOnEscape
        value={countries.find(c => c.country === country) || null}
        onChange={handleCountryChange}
        autoHighlight
        getOptionLabel={(option) => option.country || ''}
        onOpen={handleCountryClick}
        renderOption={(props, option) => {
          const { key, ...optionProps } = props;
          return (
            <Box
              key={key}
              component="li"
              sx={{ '& > img': { mr: 2, flexShrink: 0 } }}
              {...optionProps}
            >
              {option.country}
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Choose a country"
            size="small"
            sx={{ fontSize: '0.8rem' }}
            InputLabelProps={{ sx: { fontSize: '0.8rem' } }}
            slotProps={{
              htmlInput: {
                ...params.inputProps,
                autoComplete: 'new-password',
              },
            }}
          />
        )}
      />
    </Box>
  );
}

export default Country;