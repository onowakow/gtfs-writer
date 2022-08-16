require('dotenv').config();
const fs = require('fs');
const apiKey = process.env.GOOGLE_MAPS_API_KEY;
const { PolyUtil } = require('node-geometry-library');
const { Client } = require('@googlemaps/google-maps-services-js');

const client = new Client({});

const originA = '8C6C+VH5 Laramie WY USA';
const originB = '8C7H+FV4 Laramie WY USA';

const fetchDirections = async (origin, destination) => {
  const directionsResponse = await client.directions({
    params: {
      origin,
      destination,
      key: apiKey,
    },
  });
  return directionsResponse;
};

const writeRoutesToFile = async () => {
  const directions = await fetchDirections(originA, originB);
  const route = directions.data.routes[0];
  const routeJSON = JSON.stringify(route);
  fs.writeFileSync('test.json', routeJSON);

  const encodedPolyline = route.overview_polyline.points;
  const latLngPolyline = PolyUtil.decode(encodedPolyline);
  const latLngPolylineJSON = JSON.stringify(latLngPolyline);
  fs.writeFileSync('latLngPolyline.json', latLngPolylineJSON);
};

writeRoutesToFile();
