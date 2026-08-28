export const normalizeCity = (city) => ({
  city: city.name,
  state: city.region,
  stateCode: city.regionCode,
});
