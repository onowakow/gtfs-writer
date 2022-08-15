const axios = require('axios');
const fs = require('fs/promises');
const OpenLocationCode = require('open-location-code').OpenLocationCode;
const openLocationCode = new OpenLocationCode();

const completePacketURL =
  'https://www.smalltowntransit.com/api/use-complete-packet';
const ROUTE_TYPE = 3; // ENUM https://developers.google.com/transit/gtfs/reference#routestxt meaning 'bus'
const LARAMIE_LAT = 41.3;
const LARAMIE_LON = -105.6;
const FEED_URI = '../my_feed/';
const COORDINATE_ONE_METER_ACCURACY_DECIMAL_PLACE = 6;

const handleError = (err) => {
  console.error('Caught in promise: ', err);
};

const fetchInUseCompletePacket = async () => {
  try {
    const { data: completePacket } = await axios(completePacketURL);
    return completePacket;
  } catch (err) {
    handleError(err);
  }
};

const rowListToCSVList = (rowList) =>
  rowList.map((row) => {
    const CSVRow = row.join(',');
    return CSVRow;
  });

const CSVListToCSVTable = (CSVList) => {
  const CSVTable = CSVList.join('\n');
  return CSVTable;
};

const addTitleToCSVTable = (columnTitlesCSV, CSVTable) => {
  const completeCSVTable = columnTitlesCSV + '\n' + CSVTable;
  return completeCSVTable;
};

const createCSVTable = (rowList, columnTitlesCSV) => {
  const CSVList = rowListToCSVList(rowList);
  const CSVNoTitles = CSVListToCSVTable(CSVList);
  const CSV = addTitleToCSVTable(columnTitlesCSV, CSVNoTitles);
  return CSV;
};

// A GTFS 'Route' is a SmallTown Transit 'Service'
const formatServicesToGTFSRouteCSV = async (services) => {
  const routeColumnTitles = ['route_id', 'route_long_name', 'route_type'];
  const routeColumnTitlesCSV = routeColumnTitles.join(',');

  const routeRowList = services.map((service) => {
    const { title: serviceTitle, id: serviceId } = service;
    const routeId = serviceId;
    const routeLongName = serviceTitle;
    const routeType = ROUTE_TYPE;
    return [routeId, routeLongName, routeType];
  });

  const routeCSV = createCSVTable(routeRowList, routeColumnTitlesCSV);
  return routeCSV;
};

const getCenterCoordinatesFromShortPlusCode = (shortPlusCode) => {
  shortPlusCode = shortPlusCode.trim();

  const nearestFullCode = openLocationCode.recoverNearest(
    shortPlusCode,
    LARAMIE_LAT,
    LARAMIE_LON
  );
  const coordinates = openLocationCode.decode(nearestFullCode);
  const { latitudeCenter, longitudeCenter } = coordinates;
  const toFixedSixDigits = (number) =>
    number.toFixed(COORDINATE_ONE_METER_ACCURACY_DECIMAL_PLACE);

  return {
    latitudeCenter: toFixedSixDigits(latitudeCenter),
    longitudeCenter: toFixedSixDigits(longitudeCenter),
  };
};

const formatDestinationsToGTFSStopsCSV = async (destinations) => {
  const stopColumnTitles = ['stop_id', 'stop_name', 'stop_lat', 'stop_lon'];
  const stopColumnTitlesCSV = stopColumnTitles.join(',');

  const stopRowList = destinations.map((destination) => {
    const { text: destinationName, _id, plusCode } = destination;
    const stopName = destinationName;
    const stop_id = _id;
    const { latitudeCenter: stopLat, longitudeCenter: stopLon } =
      getCenterCoordinatesFromShortPlusCode(plusCode);
    return [stop_id, stopName, stopLat, stopLon];
  });

  const stopCSV = createCSVTable(stopRowList, stopColumnTitlesCSV);
  return stopCSV;
};

const write = async () => {
  const completePacket = await fetchInUseCompletePacket();
  const { services, destinations } = completePacket;

  const routeCSV = await formatServicesToGTFSRouteCSV(services);
  const stopCSV = await formatDestinationsToGTFSStopsCSV(destinations);

  await fs.writeFile(FEED_URI + 'routes.txt', routeCSV);
  await fs.writeFile(FEED_URI + 'stops.txt', stopCSV);
  console.log('Success.');
};

write();
