const axios = require('axios');
const fs = require('fs/promises');
const OpenLocationCode = require('open-location-code').OpenLocationCode;
const openLocationCode = new OpenLocationCode();

/**
 * Nomenclature mapping between SmallTown and GTFS
 * SmallTown            GTFS
 * service -----------> route
 * agency/subagency --> service
 * destination -------> stop
 * stopId ------------> stopSequence
 * destinationId -----> stop_id
 */

const completePacketURL =
  'https://www.smalltowntransit.com/api/use-complete-packet';
const ROUTE_TYPE = 3; // ENUM https://developers.google.com/transit/gtfs/reference#routestxt meaning 'bus'
const LARAMIE_LAT = 41.3;
const LARAMIE_LON = -105.6;
const FEED_URI = '../my_feed/';
const COORDINATE_ONE_METER_ACCURACY_DECIMAL_PLACE = 6;
const SERVICE_ID = 'normaloperations';
const INDEX_OF_NOT_FOUND = -1;
const STOP_TYPE_TIMED = 1;
const STOP_TYPE_STOPANDGO = 2;
const STOP_TYPE_BYREQUEST = 3;
const STOP_TYPE_DROPOFFONLY = 4;
const GTFS_NO_PICKUP_AVAILABLE = 1;
const GTFS_REGULARLY_SCHEDULED_PICKUP = 0;

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

const listToCSV = (list) => {
  const CSV = list.join(',');
  return CSV;
};

const rowListToCSVList = (rowList) =>
  rowList.map((row) => {
    const CSVRow = listToCSV(row);
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
const formatServicesToGTFSRouteCSV = (services) => {
  const routeColumnTitles = ['route_id', 'route_long_name', 'route_type'];
  const routeColumnTitlesCSV = listToCSV(routeColumnTitles);

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

const formatDestinationsToGTFSStopsCSV = (destinations) => {
  const stopColumnTitles = ['stop_id', 'stop_name', 'stop_lat', 'stop_lon'];
  const stopColumnTitlesCSV = listToCSV(stopColumnTitles);

  const stopRowList = destinations.map((destination) => {
    const { text: destinationName, id, plusCode } = destination;
    const stopName = destinationName;
    const stop_id = id;
    const { latitudeCenter: stopLat, longitudeCenter: stopLon } =
      getCenterCoordinatesFromShortPlusCode(plusCode);
    return [stop_id, stopName, stopLat, stopLon];
  });

  const stopCSV = createCSVTable(stopRowList, stopColumnTitlesCSV);
  return stopCSV;
};

const createUniqueTripId = (serviceId, routeId, tripId) => {
  const id = `S${serviceId}_R${routeId}_T${tripId}`;
  return id;
};

const formatStopsToGTFSTripsCSV = (stops) => {
  const tripColumnTitles = ['route_id', 'service_id', 'trip_id'];
  const tripColumnTitlesCSV = listToCSV(tripColumnTitles);

  const checkForValueInArray = (value, array) => {
    const indexOfFound = array.indexOf(value);

    if (indexOfFound === INDEX_OF_NOT_FOUND) {
      return false;
    }
    return true;
  };

  const createUniqueTripIdsList = () => {
    const tripIds = [];
    stops.forEach((stop) => {
      const { serviceId, routeId, tripId } = stop;
      const id = createUniqueTripId(serviceId, routeId, tripId);
      const isValueInArray = checkForValueInArray(id, tripIds);

      if (!isValueInArray) {
        tripIds.push(id);
      }
    });

    tripIds.sort();
    return tripIds;
  };

  const tripIds = createUniqueTripIdsList();

  const splitServiceRouteTripId = (serviceRouteTripId) => {
    return serviceRouteTripId.split('_');
  };

  const sliceServiceFromServiceRouteTripIdArr = (serviceRouteTripIdArr) => {
    return serviceRouteTripIdArr[0];
  };

  const tripRowList = tripIds.map((tripId) => {
    const getGTFSRouteIdFromServiceRouteTripId = (tripId) => {
      const serviceRouteTripIdArr = splitServiceRouteTripId(tripId);
      const service = sliceServiceFromServiceRouteTripIdArr(
        serviceRouteTripIdArr
      );
      const serviceId = service.slice(1, 2);
      const gtfsRouteId = serviceId;
      return gtfsRouteId;
    };

    const gtfsRouteId = getGTFSRouteIdFromServiceRouteTripId(tripId);
    return [gtfsRouteId, SERVICE_ID, tripId];
  });

  const tripsCSV = createCSVTable(tripRowList, tripColumnTitlesCSV);

  return tripsCSV;
};

const formatStopsToGTFSStopTimesCSV = (stops, signBeforeArrivals) => {
  const stopTimesColumnTitles = [
    'trip_id',
    'arrival_time',
    'departure_time',
    'stop_id',
    'stop_sequence',
    'stop_headsign',
    'pickup_type',
  ];
  const stopTimesColumnTitlesCSV = listToCSV(stopTimesColumnTitles);

  const stopTimesRowList = stops.map((stop, i) => {
    const {
      serviceId,
      routeId,
      tripId,
      leaveTimeStringhhmm,
      stopTypeId,
      signBeforeArrivalId,
      destinationId: stop_id,
      stopId: stopSequence, // Used for GTFS stop_sequence. Must increase over a trip, so this value will be sufficient.
    } = stop;
    const addSecondsTohhmmTimeFormat = (hhmm) => {
      return hhmm + ':00';
    };

    const gtfsTripId = createUniqueTripId(serviceId, routeId, tripId);
    const arrivalTime = addSecondsTohhmmTimeFormat(leaveTimeStringhhmm);
    const departureTime = arrivalTime;
    const signBeforeArrival = signBeforeArrivals.find(
      (sign) => sign.id === signBeforeArrivalId
    );
    if (!signBeforeArrival)
      throw new Error(
        `Sign by id ${signBeforeArrivalId} was not found while generating stopTimes.txt`
      );

    const stopHeadsign = signBeforeArrival.text;
    const pickupType =
      stopTypeId === STOP_TYPE_DROPOFFONLY
        ? GTFS_NO_PICKUP_AVAILABLE
        : GTFS_REGULARLY_SCHEDULED_PICKUP;

    return [
      gtfsTripId,
      arrivalTime,
      departureTime,
      stop_id,
      stopSequence,
      stopHeadsign,
      pickupType,
    ];
  });

  const stopTimesCSV = createCSVTable(
    stopTimesRowList,
    stopTimesColumnTitlesCSV
  );

  return stopTimesCSV;
};

const write = async () => {
  try {
    const completePacket = await fetchInUseCompletePacket();
    const { services, destinations, stops, signBeforeArrivals } =
      completePacket;
    const routeCSV = formatServicesToGTFSRouteCSV(services);
    const stopCSV = formatDestinationsToGTFSStopsCSV(destinations);
    const tripsCSV = formatStopsToGTFSTripsCSV(stops);
    const stopTimesCSV = formatStopsToGTFSStopTimesCSV(
      stops,
      signBeforeArrivals
    );

    await fs.writeFile(FEED_URI + 'routes.txt', routeCSV);
    await fs.writeFile(FEED_URI + 'stops.txt', stopCSV);
    await fs.writeFile(FEED_URI + 'trips.txt', tripsCSV);
    await fs.writeFile(FEED_URI + 'stop_times.txt', stopTimesCSV);

    console.log('Successfully wrote to all files.');
  } catch (err) {
    console.log('An error occured while running Writer: ', err);
  } finally {
    console.log('Script complete.');
  }
};

write();
