onmessage = function (event) {
    const { trainData, odjazd, przyjazd } = event.data;

    console.log("Worker received data:", trainData, odjazd, przyjazd);

    let transferConnectionsSet = new Set();
    let departureTrains = [];
    let arrivalTrains = [];
    let stationsMap = new Map();
    let originalNamesMap = new Map();

    function transliteracja(słowo) {
        const polskie = ['ą', 'ć', 'ę', 'ł', 'ń', 'ó', 'ś', 'ź', 'ż'];
        const english = ['a', 'c', 'e', 'l', 'n', 'o', 's', 'z', 'z'];

        return słowo.toLowerCase().split("").map(litera => {
            let index = polskie.indexOf(litera);
            return index !== -1 ? english[index] : litera;
        }).join("");
    }

    const normOdjazd = transliteracja(odjazd);
    const normPrzyjazd = transliteracja(przyjazd);

    trainData.forEach((train, trainIndex) => {
        const stations = train.route.stations;

        stations.forEach((station, stationIndex) => {
            const stationName = station.name;
            const normStationName = transliteracja(stationName);
            const depTime = station.dep;
            const arrTime = station.arr;
            
            if (!originalNamesMap.has(normStationName)) {
                originalNamesMap.set(normStationName, stationName);
            }

            if (!stationsMap.has(normStationName)) {
                stationsMap.set(normStationName, []);
            }
            stationsMap.get(normStationName).push({
                trainIndex,
                stationIndex,
                depTime,
                arrTime
            });

            if (normStationName === normOdjazd) {
                departureTrains.push({ trainIndex, stationIndex, depTime });
            }
            if (normStationName === normPrzyjazd) {
                arrivalTrains.push({ trainIndex, stationIndex, arrTime });
            }
        });
    });

    console.log("Departure trains:", departureTrains);
    console.log("Arrival trains:", arrivalTrains);

    stationsMap.forEach((trains, transferStationNorm) => {
        let firstLegCandidates = [];
        let secondLegCandidates = [];

        const transferStation = originalNamesMap.get(transferStationNorm) || transferStationNorm;

        trains.forEach((entry) => {
            let matchingDeparture = departureTrains.find(d => d.trainIndex === entry.trainIndex && d.stationIndex < entry.stationIndex);
            if (matchingDeparture) {
                firstLegCandidates.push({ 
                    trainIndex: entry.trainIndex, 
                    depTime: matchingDeparture.depTime, 
                    arrTime: entry.arrTime 
                });
            }

            let matchingArrival = arrivalTrains.find(a => a.trainIndex === entry.trainIndex && a.stationIndex > entry.stationIndex);
            if (matchingArrival) {
                secondLegCandidates.push({ 
                    trainIndex: entry.trainIndex, 
                    depTime: entry.depTime, 
                    arrTime: matchingArrival.arrTime 
                });
            }
        });

        if (firstLegCandidates.length > 0 && secondLegCandidates.length > 0) {
            firstLegCandidates.forEach((firstLeg) => {
                secondLegCandidates.forEach((secondLeg) => {
                    if (firstLeg.arrTime < secondLeg.depTime) {
                        const transferKey = `${transferStation}|${firstLeg.depTime}-${firstLeg.arrTime}|${secondLeg.depTime}-${secondLeg.arrTime}`;
                        transferConnectionsSet.add(transferKey);
                    }
                });
            });
        }
    });

    let transferConnections = Array.from(transferConnectionsSet).map(entry => {
        const [transferStation, firstLeg, secondLeg] = entry.split("|");
        return { 
            transferStation, 
            firstLeg: `${firstLeg.split("-")[0]} - ${firstLeg.split("-")[1]}`,
            secondLeg: `${secondLeg.split("-")[0]} - ${secondLeg.split("-")[1]}`
        };
    });

    console.log("Unique transfer connections found by worker:", transferConnections);

    postMessage({ transferConnections });
};
