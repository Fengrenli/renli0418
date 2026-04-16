(() => {
  const rows = Array.from(document.querySelectorAll('.xterm-rows div'));
  if (rows.length === 0) {
    // Fallback to searching all text if no rows found
    return { text: document.body.innerText.substring(0, 5000) };
  }
  return { text: rows.map(r => r.innerText).join('\n') };
})()