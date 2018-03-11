/* globals gapi */

const GOOGLE_API_URL = 'https://apis.google.com/js/api.js';
const SCOPES = 'https://www.googleapis.com/auth/calendar';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'];

class GoogleApi {
  load() {
    return new Promise((resolve, reject) => {
      var script = document.createElement('script');

      script.onreadystatechange = () => {
        if (this.readyState === 'complete') this.onload();
      };

      script.onload = function() {
        gapi.load('client', {
          callback: () => {
            gapi.client
              .init({
                discoveryDocs: DISCOVERY_DOCS,
                scopes: SCOPES
              })
              .then(resolve)
              .catch(reject);
          },
          onerror: reject,
          ontimeout: reject,
          timeout: 5000 // 5 seconds
        });
      };

      script.src = GOOGLE_API_URL;
      document.head.appendChild(script);
    });
  }

  set authToken(token) {
    gapi.client.setToken({ access_token: token });
  }

  fetchCalendarEntries(calendarId, start, until) {
    return gapi.client.calendar.events
      .list({
        calendarId,
        timeMin: start.toISOString(),
        timeMax: until.toISOString(),
        showDeleted: false,
        singleEvents: true,
        maxResults: 2500, // api max
        orderBy: 'startTime'
      })
      .then(response => response.result.items);
  }

  getCalendars() {
    const request = gapi.client.calendar.calendarList.list({
      minAccessRole: 'writer'
    });
    return new Promise((resolve, reject) => {
      request.execute(resp => {
        if (resp.items) {
          resp.items.sort((a, b) => {
            if (a.summary < b.summary) return -1;
            if (a.summary > b.summary) return 1;
            return 0;
          });
          resolve(resp.items);
        } else {
          reject(resp.error);
        }
      });
    });
  }

  createCalendarEntries(calendarId, entries) {
    const batch = gapi.client.newBatch();
    entries.forEach(entry => {
      batch.add(
        gapi.client.calendar.events.import({
          calendarId,
          resource: entry
        })
      );
    });
    return new Promise(resolve => batch.execute(resolve));
  }

  deleteCalendarEntries(calendarId, ids) {
    const batch = gapi.client.newBatch();
    ids.forEach(id => {
      batch.add(
        gapi.client.calendar.events.delete({
          calendarId,
          eventId: id
        })
      );
    });
    return new Promise(resolve => batch.execute(resolve));
  }
}

window.GoogleApi = GoogleApi;
