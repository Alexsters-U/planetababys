/** Destination coordinates resolved from the owner's Google Maps link. */
export const storeLocation = {
  label: "Planeta Baby’s Pañalera",
  city: "Mocoa, Putumayo",
  mapsUrl: "https://maps.app.goo.gl/PTmZaGLgVhycLrp48",
  latitude: 1.1464015,
  longitude: -76.6470404,
};
export const directionsUrl = "https://www.google.com/maps/dir/?" + new URLSearchParams({
  api: "1", destination: `${storeLocation.latitude},${storeLocation.longitude}`,
}).toString();
