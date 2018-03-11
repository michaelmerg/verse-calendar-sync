function saveOptions() {
  const calendarId = document.getElementById('calendar-id').value;
  const verseBaseUrl = document.getElementById('verse-base-url').value;
  let daysToSync = document.getElementById('days-to-sync').value;
  if (daysToSync < 1) daysToSync = 1;
  if (daysToSync > 90) daysToSync = 90;

  chrome.storage.sync.set(
    {
      calendarId,
      verseBaseUrl,
      daysToSync
    },
    function() {
      const status = document.getElementById('status');
      const oldStatus = status.textContent;
      status.textContent = 'Options saved.';
      setTimeout(() => {
        status.textContent = oldStatus;
      }, 750);
    }
  );
}

function makeLastSyncDate(date) {
  const lastSync = new Date(date);
  let minutes = String(lastSync.getMinutes());
  if (minutes.length === 1) minutes = '0' + minutes;
  let seconds = String(lastSync.getSeconds());
  if (seconds.length === 1) seconds = '0' + seconds;
  return lastSync.getHours() + ':' + minutes + ':' + seconds;
}

function restoreOptions() {
  chrome.storage.sync.get(
    {
      calendarId: '',
      verseBaseUrl: defaults.VERSE_BASE_URL_DEFAULT,
      daysToSync: defaults.DAYS_TO_SYNC_DEFAULT,
      lastSync: null
    },
    function(items) {
      document.getElementById('calendar-id').value = items.calendarId;
      document.getElementById('verse-base-url').value = items.verseBaseUrl;
      document.getElementById('days-to-sync').value = items.daysToSync;
      document.getElementById('status').textContent =
        items.lastSync && 'Last sync: ' + makeLastSyncDate(items.lastSync);
      setDisabledForOptions(false);
    }
  );
}

function syncNow() {
  chrome.runtime.sendMessage({ type: 'SYNC_NOW' });
  document.getElementById('status').textContent = 'Syncing...';
}

function updateSyncResult() {
  chrome.storage.sync.get({ lastSync: null, lastError: null }, function(items) {
    document.getElementById('status').textContent = items.lastSync && 'Last sync: ' + makeLastSyncDate(items.lastSync);
    if (items.lastError) {
      document.getElementById('sync-error').textContent = 'Sync error: ' + items.lastError;
    } else {
      document.getElementById('sync-error').textContent = '';
    }
  });
}

async function authorize() {
  document.getElementById('auth-error').textContent = '';
  const btn = document.getElementById('grant-access');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Loading...';

  try {
    await utils.getAuthToken(true);
  } catch (error) {
    document.getElementById('auth-error').textContent = 'Auth error: ' + error.message;
  }

  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = label;
    initialize();
  }, 250);
}

async function initialize() {
  setDisabledForOptions(true);
  const hasAccess = await checkGoogleCalendarAccess();
  if (hasAccess) {
    hideGrantAccessPanel();

    let calendars;
    try {
      calendars = await getCalendars();
    } catch (error) {
      showGrantAccessPanel();
      return;
    }

    const calendarsSelect = document.getElementById('calendar-id');
    calendarsSelect.innerHTML = '';

    const selectOption = document.createElement('option');
    selectOption.disabled = true;
    selectOption.selected = true;
    selectOption.innerHTML = 'Select...';

    calendars.forEach(calendar => {
      const option = document.createElement('option');
      option.value = calendar.id;
      option.innerHTML = calendar.summary;
      calendarsSelect.appendChild(option);
    });

    restoreOptions();
  } else {
    showGrantAccessPanel();
  }
}

async function checkGoogleCalendarAccess() {
  let hasAccess = false;
  try {
    const token = await utils.getAuthToken();
    hasAccess = true;
    chrome.identity.removeCachedAuthToken({ token });
  } catch (error) {
    console.debug(error);
  }
  return hasAccess;
}

function getCalendars() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'GET_CALENDARS' }, resp => {
      if (resp) {
        resolve(resp.calendars);
      } else {
        reject();
      }
    });
  });
}

function hideGrantAccessPanel() {
  document.getElementById('missing-permission').style.display = 'none';
  document.getElementById('options').style.display = 'block';
}

function showGrantAccessPanel() {
  document.getElementById('missing-permission').style.display = 'block';
  document.getElementById('options').style.display = 'none';
}

function setDisabledForOptions(disabled) {
  document.getElementById('calendar-id').disabled = disabled;
  document.getElementById('verse-base-url').disabled = disabled;
  document.getElementById('days-to-sync').disabled = disabled;
  document.getElementById('save').disabled = disabled;
}

document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('sync-now').addEventListener('click', syncNow);
document.getElementById('grant-access').addEventListener('click', authorize);
chrome.storage.onChanged.addListener(updateSyncResult);

initialize();
