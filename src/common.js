window.defaults = {
  VERSE_BASE_URL_DEFAULT: 'https://mail.notes.na.collabserv.com',
  DAYS_TO_SYNC_DEFAULT: 30
};

window.utils = {
  getAuthToken: interactive => {
    return new Promise((resolve, reject) =>
      chrome.identity.getAuthToken({ interactive }, token => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      })
    );
  }
};
