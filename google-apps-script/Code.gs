/**
 * Life OS — passerelle Google Agenda (lecture seule).
 *
 * Ce script tourne sur ton compte Google, gratuitement. Il renvoie à l'app
 * la liste de tes événements (titre, horaires, couleur) au format JSON.
 * Il ne modifie jamais ton agenda.
 *
 * Installation : voir le README du projet, étape « Google Agenda ».
 */

var JOURS_PASSES = 60;   // historique consultable dans l'app
var JOURS_A_VENIR = 180; // horizon des échéances

function doGet() {
  var out;
  try {
    out = { generatedAt: new Date().toISOString(), events: lireEvenements() };
  } catch (err) {
    out = { error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function lireEvenements() {
  var now = new Date();
  var debut = new Date(now.getFullYear(), now.getMonth(), now.getDate() - JOURS_PASSES);
  var fin = new Date(now.getFullYear(), now.getMonth(), now.getDate() + JOURS_A_VENIR);
  var events = [];

  CalendarApp.getAllCalendars().forEach(function (cal) {
    if (cal.isHidden() || !cal.isSelected()) return; // seulement les agendas cochés dans Google Agenda
    var tz = cal.getTimeZone();
    var calColor = cal.getColor();
    var calName = cal.getName();

    cal.getEvents(debut, fin).forEach(function (ev) {
      var allDay = ev.isAllDayEvent();
      events.push({
        id: ev.getId(),
        title: ev.getTitle() || '(Sans titre)',
        allDay: allDay,
        // Journée entière : dates « AAAA-MM-JJ » (fin exclusive). Sinon : horodatage ISO.
        start: allDay ? Utilities.formatDate(ev.getAllDayStartDate(), tz, 'yyyy-MM-dd') : ev.getStartTime().toISOString(),
        end: allDay ? Utilities.formatDate(ev.getAllDayEndDate(), tz, 'yyyy-MM-dd') : ev.getEndTime().toISOString(),
        color: ev.getColor() || '',   // « 11 » = rouge (Tomate)
        calColor: calColor,
        calendar: calName,
        location: ev.getLocation() || ''
      });
    });
  });
  return events;
}

/** À lancer une fois depuis l'éditeur (bouton ▶ Exécuter) pour accorder l'accès à l'agenda. */
function autoriser() {
  Logger.log(lireEvenements().length + ' événements lus. Tout fonctionne.');
}
