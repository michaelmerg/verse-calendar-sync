const VERSION = 1;

function toDateString(date) {
  return luxon.DateTime.fromJSDate(date)
    .setZone('utc')
    .toFormat("yyyyMMdd'T'HHmmss,00'Z'"); //  eslint-disable-line quotes
}

class VerseApi {
  constructor() {
    this.uidPrefix = 'VCS';
  }

  makeSyncId(entry) {
    return this.uidPrefix + btoa(encodeURIComponent(VERSION + '-' + entry.$UID + '-' + entry.$StartDateTime));
  }

  filterAndConvertEntries(entries) {
    const convertedEntries = [];

    entries.forEach(entry => {
      const convertedEntry = {};
      entry.entrydata.forEach(data => {
        convertedEntry[data['@name']] =
          (data.text && data.text[0]) ||
          (data.textlist && data.textlist.text && data.textlist.text[0]) ||
          (data.number && data.number[0]) ||
          (data.numberlist && data.numberlist.number && data.numberlist.number[0][0]) ||
          (data.datetime && data.datetime[0]) ||
          (data.datetimelist && data.datetimelist.datetime && data.datetimelist.datetime[0][0]);
      });

      convertedEntry.syncId = this.makeSyncId(convertedEntry);

      if (convertedEntry.$NoticeType !== VerseApi.NOTICETYPE_STATUSUPDATE) {
        convertedEntries.push(convertedEntry);
      }
    });

    return convertedEntries;
  }

  fetchCalendarEntries(start, until) {
    return fetch(
      this.baseUrl +
        '/livemail/iNotes/Proxy/?OpenDocument&Form=s_ReadViewEntries_JSON&Count=-1&KeyType=time&StartKey=' +
        decodeURIComponent(toDateString(start)) +
        '&UntilKey=' +
        decodeURIComponent(toDateString(until)) +
        '&PresetFields=FolderName%3B(%24CSAPIs)&xhr=1&sq=1',
      { credentials: 'same-origin' }
    )
      .then(res => res.json())
      .then(responseBody => {
        if (responseBody.entries && responseBody.entries.viewentry) {
          return this.filterAndConvertEntries(responseBody.entries.viewentry);
        } else {
          return [];
        }
      });
  }
}

VerseApi.ENTRY_TYPE_ANNIVERSARY = '1';
VerseApi.ENTRY_TYPE_ALL_DAY = '2';
VerseApi.ENTRY_TYPE_MEETING = '3';
VerseApi.ENTRY_TYPE_REMINDER = '4';
VerseApi.NOTICETYPE_ACCEPT = 'A';
VerseApi.NOTICETYPE_COUNTERACCEPT = 'B';
VerseApi.NOTICETYPE_CANCEL = 'C';
VerseApi.NOTICETYPE_DELEGATING = 'D';
VerseApi.NOTICETYPE_REFRESHINFO = 'E';
VerseApi.NOTICETYPE_COMPLETED = 'F';
VerseApi.NOTICETYPE_ADDTOCALENDAR = 'G';
VerseApi.NOTICETYPE_DELETE = 'H';
VerseApi.NOTICETYPE_INVITE = 'I';
VerseApi.NOTICETYPE_COUNTERDECLINE = 'J';
VerseApi.NOTICETYPE_UPDATEINFO = 'K';
VerseApi.NOTICETYPE_DELEGATE = 'L';
VerseApi.NOTICETYPE_CONFIRMATION = 'N';
VerseApi.NOTICETYPE_PENCILIN = 'P';
VerseApi.NOTICETYPE_DECLINE = 'R';
VerseApi.NOTICETYPE_STATUSUPDATE = 'S';
VerseApi.NOTICETYPE_COUNTER = 'T';
VerseApi.NOTICETYPE_RESCHEDULE = 'U';
VerseApi.NOTICETYPE_WAITING = 'W';
VerseApi.NOTICETYPE_EXTENSION = 'X';
VerseApi.NOTICETYPE_REMOVERESOURCES = 'Y';
VerseApi.NOTICETYPE_REMOVED = 'Z';
VerseApi.NOTICETYPE_STATUSREQUIRED = '2';
VerseApi.NOTICETYPE_STATUSREMOVE = '5';

window.VerseApi = VerseApi;
