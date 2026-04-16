(async () => {
  const rows = Array.from(document.querySelectorAll('.file-table tr'));
  const row = rows.find(r => r.innerText.includes('deploy-missing-files.tar.gz'));
  if (row) {
    const deleteBtn = row.querySelector('a[onclick*="DeleteFile"]');
    if (deleteBtn) {
      deleteBtn.click();
      return { success: true, message: 'Delete button clicked' };
    } else {
        // Try right click or context menu
        return { success: false, message: 'Delete button not found in row' };
    }
  }
  return { success: false, message: 'File not found' };
})()