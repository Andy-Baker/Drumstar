"use strict";
// Start: läuft als letzte Datei, wenn alle Funktionen geladen sind.
setPatternGroup(patternGroup,false);
restoreSampleAssignments();
nbDefault=collectPatternData('Neuer Beat', null); // „Leer, Standard“ = Zustand beim ersten Start
restoreLastOpenedOrSeed().then(restoreLastSong);
