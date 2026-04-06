function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders') || SpreadsheetApp.getActiveSpreadsheet().insertSheet('Orders');
    const data = JSON.parse(e.postData.contents);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp',
        'Full Name',
        'Phone / WhatsApp',
        'Email',
        'Location',
        'Model',
        'Color',
        'Payment Method',
        'Fulfillment',
        'Notes',
        'Source'
      ]);
    }

    sheet.appendRow([
      data.timestamp || '',
      data.fullName || '',
      data.phone || '',
      data.email || '',
      data.location || '',
      data.model || '',
      data.color || '',
      data.paymentMethod || '',
      data.fulfillment || '',
      data.notes || '',
      data.source || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
