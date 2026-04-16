(async () => {
  return {
    localStorage: JSON.stringify(localStorage),
    cookies: document.cookie,
    sessionStorage: JSON.stringify(sessionStorage)
  };
})()