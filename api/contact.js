// /api/contact - Send contact form emails via Resend API
// Free: 3000 emails/month, no limits for normal use
// Setup: Add RESEND_API_KEY in Vercel Environment Variables

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, email, subject, message } = req.body;

    // Validate
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    // Simple email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
        return res.status(500).json({ error: 'Email service not configured. Add RESEND_API_KEY in Vercel settings.' });
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + RESEND_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Sleep Songs Contact <onboarding@resend.dev>',
                to: ['galalemad75@gmail.com'],
                subject: 'Sleep Songs: ' + (subject || 'New Message') + ' - from ' + name,
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                        <h2 style="color:#7C3AED;">🌙 New Contact Message</h2>
                        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:12px 8px;font-weight:bold;color:#555;width:100px;">👤 Name</td>
                                <td style="padding:12px 8px;">${name}</td>
                            </tr>
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:12px 8px;font-weight:bold;color:#555;">📧 Email</td>
                                <td style="padding:12px 8px;"><a href="mailto:${email}">${email}</a></td>
                            </tr>
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:12px 8px;font-weight:bold;color:#555;">📝 Subject</td>
                                <td style="padding:12px 8px;">${subject || 'No subject'}</td>
                            </tr>
                            <tr>
                                <td style="padding:12px 8px;font-weight:bold;color:#555;vertical-align:top;">💬 Message</td>
                                <td style="padding:12px 8px;white-space:pre-wrap;">${message}</td>
                            </tr>
                        </table>
                        <p style="color:#999;font-size:12px;margin-top:30px;">Sent from Sleep Songs website contact form</p>
                    </div>
                `
            })
        });

        const data = await response.json();

        if (response.ok) {
            return res.status(200).json({ success: true, message: 'Email sent successfully' });
        } else {
            console.error('Resend error:', data);
            return res.status(500).json({ error: 'Failed to send email', details: data.message });
        }
    } catch (error) {
        console.error('Contact API error:', error);
        return res.status(500).json({ error: 'Server error', message: error.message });
    }
}
