(async () => {
  const result = [];
  const bodyText = document.body.innerText;
  if (bodyText.includes('宝塔') || bodyText.includes('BT-Panel') || bodyText.includes('终端')) {
    result.push({
      url: window.location.href,
      title: document.title,
      found: true
    });
  }
  return result;
})()
