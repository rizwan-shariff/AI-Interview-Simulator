import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { email, name, company, pdfBase64, score } = req.body;
  const smtpEmail = process.env.SMTP_EMAIL;
  const smtpPassword = process.env.SMTP_PASSWORD;

  if (!smtpEmail || !smtpPassword) {
    return res.status(500).json({ message: 'SMTP credentials not configured in Vercel environment variables.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpEmail,
        pass: smtpPassword,
      },
    });

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    const mailOptions = {
      from: smtpEmail,
      to: email,
      subject: `Your Interview Results - ${company}`,
      text: `Hi ${name},\n\nThank you for completing your AI mock interview for ${company}.\n\nYou scored ${score}/100. Please find your detailed Performance Dashboard attached as a PDF.\n\nBest,\nAI Interview Simulator Team`,
      attachments: [
        {
          filename: `${name}_Interview_Results.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    return res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Email Error:', error);
    return res.status(500).json({ message: 'Error sending email', error: error.toString() });
  }
}
