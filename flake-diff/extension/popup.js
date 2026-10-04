// MV3 popup — CSP forbids inline script, so separate file
document.getElementById('openFull').addEventListener('click', () => {
  const url = chrome.runtime.getURL('app.html');
  chrome.tabs.create({ url });
});
document.getElementById('openDemo').addEventListener('click', () => {
  const url = chrome.runtime.getURL('app.html') + '?demo=1';
  chrome.tabs.create({ url });
});
