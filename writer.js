const axios = require('axios');
const fs = require('fs/promises');

const completePacketURL =
  'https://www.smalltowntransit.com/api/use-complete-packet';
const ROUTE_TYPE = 3; // ENUM https://developers.google.com/transit/gtfs/reference#routestxt meaning 'bus'

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

// A GTFS 'Route' is a SmallTown Transit 'Service'
const formatServicesToGTFSRouteCSV = async (services) => {
  try {
    const routeColumnTitles = ['route_id', 'route_long_name', 'route_type'];
    const routeColumnTitlesCSV = routeColumnTitles.join(',');

    const routeRowList = services.map((service) => {
      const { title: serviceTitle, id: serviceId } = service;
      const routeId = serviceId;
      const routeLongName = serviceTitle;
      const routeType = ROUTE_TYPE;
      return [routeId, routeLongName, routeType];
    });

    const routeCSVList = routeRowList.map((row) => {
      const CSVRow = row.join(',');
      return CSVRow;
    });

    const routeCSVNoTitles = routeCSVList.join('\n');

    const routeCSV = routeColumnTitlesCSV + '\n' + routeCSVNoTitles;

    return routeCSV;
  } catch (err) {
    handleError(err);
  }
};

const formatDestinationsToGTFSStopsCSV = async (destinations) => {
  const stopColumnTitles = ['stop_id', 'stop_name', 'stop_lat', 'stop_lon'];
};

const write = async () => {
  const completePacket = await fetchInUseCompletePacket();
  const { services } = completePacket;
  const routeCSV = await formatServicesToGTFSRouteCSV(services);

  await fs.writeFile('../my_feed/routes.txt', routeCSV);
  console.log("Successfully wrote to 'routes.txt'");
};

write();
