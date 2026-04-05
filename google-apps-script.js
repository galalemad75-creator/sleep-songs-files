// Google Apps Script - Contact Form Email Handler
// Deploy this as a Web App to get a URL to use in the contact form
//
// SETUP STEPS:
// 1. Go to https://script.google.com
// 2. Click "New Project"
// 3. Delete the default code and paste ALL of this
// 4. Click "Deploy" → "New Deployment"
// 5. Click "Deploy" → "Authorize access" → Allow
// 6. Copy the Web App URL (looks like: https://script.google.com/macros/s/AKfyc.../exec)
// 7. Paste the URL in app.v4.js → CONTACT_SCRIPT_URL variable

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var name = data.name || 'Unknown';
    var email = data.email || 'No email';
    var subject = data.subject || 'No subject';
    var message = data.message || '';
    
    var htmlBody = 
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">' +
        '<h2 style="color:#7C3AED;">🌙 New Contact Message - Sleep Songs</h2>' +
        '<table style="width:100%;border-collapse:collapse;margin:20px 0;">' +
          '<tr style="border-bottom:1px solid #eee;">' +
            '<td style="padding:12px 8px;font-weight:bold;color:#555;width:100px;">👤 Name</td>' +
            '<td style="padding:12px 8px;">' + name + '</td>' +
          '</tr>' +
          '<tr style="border-bottom:1px solid #eee;">' +
            '<td style="padding:12px 8px;font-weight:bold;color:#555;">📧 Email</td>' +
            '<td style="padding:12px 8px;"><a href="mailto:' + email + '">' + email + '</a></td>' +
          '</tr>' +
          '<tr style="border-bottom:1px solid #eee;">' +
            '<td style="padding:12px 8px;font-weight:bold;color:#555;">📝 Subject</td>' +
            '<td style="padding:12px 8px;">' + subject + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding:12px 8px;font-weight:bold;color:#555;vertical-align:top;">💬 Message</td>' +
            '<td style="padding:12px 8px;white-space:pre-wrap;">' + message + '</td>' +
          '</tr>' +
        '</table>' +
        '<p style="color:#999;font-size:12px;">Reply directly to: ' + email + '</p>' +
      '</div>';
    
    MailApp.sendEmail({
      to: 'emadh5156@gmail.com',
      replyTo: email,
      subject: '🌙 Sleep Songs: ' + subject + ' - from ' + name,
      htmlBody: htmlBody
    });
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, message: 'Email sent' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle CORS preflight
function doOptions() {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}
