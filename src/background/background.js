(async function(window, VerseApi, GoogleApi) {
  /* eslint no-console: 0 */
  const verseApi = new VerseApi();
  const googleApi = new GoogleApi();
  await googleApi.load();

  // register message listener for options UI
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SYNC_NOW') {
      sync();
    } else if (request.type === 'GET_CALENDARS') {
      chrome.identity.getAuthToken({}, authToken => {
        if (chrome.runtime.lastError) {
          sendResponse();
        } else {
          googleApi.authToken = authToken;
          googleApi.getCalendars().then(calendars => sendResponse({ calendars }));
        }
      });
      return true;
    }
  });

  sync();
  setInterval(sync, 5 * 60 * 1000); // sync every 5 min

  async function sync() {
    chrome.storage.sync.set({ lastError: null });
    try {
      await executeSync();
    } catch (error) {
      console.warn(error.message);
      chrome.storage.sync.set({ lastError: error.message });
    } finally {
      chrome.storage.sync.set({ lastSync: Date.now() });
    }
  }

  async function executeSync() {
    const config = await getConfig();
    if (!config.calendarId) {
      console.warn('No calendar ID set in extension options. Select a calendar to enable sync.');
      return;
    }

    let authToken;
    try {
      authToken = await utils.getAuthToken();
    } catch (error) {
      console.warn('Access to Google Calendar not allowed. Open extension options to allow access.');
      return;
    }

    googleApi.authToken = authToken;
    verseApi.baseUrl = config.verseBaseUrl;

    console.debug('Start sync...');
    const start = makeDate(0); // now
    const until = makeDate(config.daysToSync);
    console.debug('Sync events from ' + start + ' to ' + until);

    let verseEntries;
    try {
      verseEntries = await verseApi.fetchCalendarEntries(start, until);
    } catch (error) {
      console.debug(error);
      throw new Error('Unable to fetch Verse entries. Ensure that you are logged into Verse.');
    }
    console.debug(verseEntries.length + ' events found in Verse');

    let googleEntires;
    try {
      googleEntires = await googleApi.fetchCalendarEntries(config.calendarId, start, until);
    } catch (error) {
      console.debug(error);
      chrome.identity.removeCachedAuthToken({ token: authToken });
      throw new Error('Unable to fetch Google Calendar entries. Renewing auth token for next sync.');
    }

    console.debug(googleEntires.length + ' events found in Google');

    const convertedEntries = verseEntries.map(convertToGoogleEntry);

    console.debug('Importing events to Google');
    await googleApi.createCalendarEntries(config.calendarId, convertedEntries);

    const verseEntryIds = verseEntries.map(e => e.syncId);
    const orphanedGoogleEntryIds = googleEntires.reduce((acc, entry) => {
      if (verseEntryIds.indexOf(entry.iCalUID) === -1 && entry.iCalUID.indexOf(verseApi.uidPrefix) === 0) {
        acc.push(entry.id);
      }
      return acc;
    }, []);

    if (orphanedGoogleEntryIds.length > 0) {
      console.debug('Remove ' + orphanedGoogleEntryIds.length + ' events from Google');
      await googleApi.deleteCalendarEntries(config.calendarId, orphanedGoogleEntryIds);
    }

    console.debug('Sync done.');
  }

  function makeDate(plusDays) {
    const date = new Date(new Date().getTime() + plusDays * 24 * 60 * 60 * 1000);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function getConfig() {
    return new Promise(resolve =>
      chrome.storage.sync.get(
        { calendarId: null, verseBaseUrl: defaults.VERSE_BASE_URL_DEFAULT, daysToSync: defaults.DAYS_TO_SYNC_DEFAULT },
        resolve
      )
    );
  }

  function convertToGoogleEntry(entry) {
    const startDateTime = luxon.DateTime.fromFormat(entry.$StartDateTime, 'yyyyMMddTHHmmss,00ZZZ');
    const endDateTime = startDateTime.plus({ seconds: Number(entry.$Duration) });
    const start = {};
    const end = {};
    let description;

    if (entry.$AppointmentType === VerseApi.ENTRY_TYPE_ALL_DAY) {
      start.date = startDateTime.toISODate();
      end.date = endDateTime.toISODate();
    } else {
      start.dateTime = startDateTime.toISO();
      end.dateTime = endDateTime.toISO();
    }

    if (entry.$OnlineMeeting) {
      description = 'Online Meeting: ' + entry.$OnlineMeeting;
      if (entry.$OnlineMeetingCode) {
        description += '\nCode:' + entry.$OnlineMeetingCode;
      }
    }

    return {
      iCalUID: entry.syncId,
      summary: entry.$Subject,
      start,
      end,
      location: entry.$Location,
      description,
      sequence: Math.floor(Date.now() / 1000)
    };
  }
})(window, window.VerseApi, window.GoogleApi);
