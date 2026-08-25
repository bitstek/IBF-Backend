import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

const recipientEmail = process.env.RECIPIENT_EMAIL || 'ms@ibf.com.sa'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

// Verify SMTP connection configuration on startup
transporter.verify((error) => {
  if (error) {
    console.warn('⚠️ SMTP Transporter Warning:', error.message)
    console.warn('Please check your backend/.env SMTP credentials.')
  } else {
    console.log('✅ SMTP Server connected successfully & ready to send emails.')
  }
})

/**
 * Send Contact Direct Message Email
 */
export async function sendContactEmail(formData) {
  const { fullName, email, companyName, phone, serviceTopic, message } = formData

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #0b1c3d; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">
        📬 New Website Direct Inquiry
      </h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <tr>
          <td style="padding: 8px; font-weight: bold; width: 35%; color: #555;">Full Name:</td>
          <td style="padding: 8px;">${fullName || 'N/A'}</td>
        </tr>
        <tr style="background-color: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold; color: #555;">Business Email:</td>
          <td style="padding: 8px;"><a href="mailto:${email}">${email}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #555;">Company:</td>
          <td style="padding: 8px;">${companyName || 'N/A'}</td>
        </tr>
        <tr style="background-color: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold; color: #555;">Phone Number:</td>
          <td style="padding: 8px;">${phone || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #555;">Service Topic:</td>
          <td style="padding: 8px; font-weight: bold; color: #0b1c3d;">${serviceTopic || 'N/A'}</td>
        </tr>
      </table>
      <div style="margin-top: 20px; padding: 15px; background-color: #f4f6f9; border-left: 4px solid #0b1c3d; border-radius: 4px;">
        <h4 style="margin-top: 0; color: #0b1c3d;">Message Details:</h4>
        <p style="white-space: pre-wrap; color: #333;">${message || 'No details provided.'}</p>
      </div>
      <p style="font-size: 12px; color: #888; margin-top: 25px; text-align: center;">
        This email was automatically dispatched from the IBF Website Contact Form.
      </p>
    </div>
  `

  const mailOptions = {
    from: `"${fullName || 'IBF Inquiry'}" <${process.env.SMTP_USER || 'alerts@ibf.com.sa'}>`,
    replyTo: email,
    to: recipientEmail,
    subject: `[IBF Contact] ${serviceTopic || 'Inquiry'} - ${fullName || email}`,
    html: htmlContent,
  }

  return await transporter.sendMail(mailOptions)
}

/**
 * Send RFQ Quote Request Email
 */
export async function sendRfqEmail(formData) {
  const {
    contactName,
    company,
    email,
    mobile,
    country,
    city,
    projectName,
    customerRfqRef,
    deliveryCountry,
    deliveryCity,
    submissionDeadline,
    requiredDeliveryDate,
    deliveryBasis,
    currency,
    deliveryAddress,
    approvedVendorListRequired,
    certificationRequirements,
    technicalNotes,
    commercialNotes,
  } = formData

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #0b1c3d; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">
        📄 New Commercial RFQ Request
      </h2>

      <h3 style="color: #d4af37; margin-top: 20px; margin-bottom: 10px;">👤 Customer Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; font-weight: bold; width: 35%; color: #555;">Contact Name:</td>
          <td style="padding: 8px;">${contactName || 'N/A'}</td>
        </tr>
        <tr style="background-color: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold; color: #555;">Company:</td>
          <td style="padding: 8px;"><strong>${company || 'N/A'}</strong></td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #555;">Email:</td>
          <td style="padding: 8px;"><a href="mailto:${email}">${email}</a></td>
        </tr>
        <tr style="background-color: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold; color: #555;">Mobile:</td>
          <td style="padding: 8px;">${mobile || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #555;">Location:</td>
          <td style="padding: 8px;">${city ? `${city}, ` : ''}${country || ''}</td>
        </tr>
      </table>

      <h3 style="color: #d4af37; margin-top: 25px; margin-bottom: 10px;">📋 Project Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background-color: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold; width: 35%; color: #555;">Project Name:</td>
          <td style="padding: 8px;">${projectName || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #555;">Customer RFQ Ref:</td>
          <td style="padding: 8px;">${customerRfqRef || 'N/A'}</td>
        </tr>
        <tr style="background-color: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold; color: #555;">Delivery Location:</td>
          <td style="padding: 8px;">${deliveryCity ? `${deliveryCity}, ` : ''}${deliveryCountry || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #555;">Submission Deadline:</td>
          <td style="padding: 8px;">${submissionDeadline || 'N/A'}</td>
        </tr>
        <tr style="background-color: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold; color: #555;">Required Delivery Date:</td>
          <td style="padding: 8px;">${requiredDeliveryDate || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #555;">Delivery Basis:</td>
          <td style="padding: 8px;">${deliveryBasis || 'NOT SPECIFIED'}</td>
        </tr>
        <tr style="background-color: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold; color: #555;">Preferred Currency:</td>
          <td style="padding: 8px;">${currency || 'SAR'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #555;">Approved Vendor List (AVL) Required:</td>
          <td style="padding: 8px;">${approvedVendorListRequired ? '✅ Yes' : 'No'}</td>
        </tr>
      </table>

      ${deliveryAddress ? `
        <div style="margin-top: 15px; padding: 10px 15px; background-color: #f9f9f9; border-radius: 4px;">
          <strong>Delivery Address:</strong> ${deliveryAddress}
        </div>
      ` : ''}

      ${certificationRequirements ? `
        <div style="margin-top: 15px; padding: 10px 15px; background-color: #f9f9f9; border-radius: 4px;">
          <strong>Certification Requirements:</strong><br />${certificationRequirements}
        </div>
      ` : ''}

      ${technicalNotes ? `
        <div style="margin-top: 15px; padding: 12px 15px; background-color: #f4f6f9; border-left: 4px solid #0b1c3d; border-radius: 4px;">
          <strong style="color: #0b1c3d;">Technical Notes & Specifications:</strong><br />
          <p style="white-space: pre-wrap; margin-top: 5px; color: #333;">${technicalNotes}</p>
        </div>
      ` : ''}

      ${commercialNotes ? `
        <div style="margin-top: 15px; padding: 12px 15px; background-color: #fff9e6; border-left: 4px solid #d4af37; border-radius: 4px;">
          <strong style="color: #b8860b;">Commercial Notes & Payment Terms:</strong><br />
          <p style="white-space: pre-wrap; margin-top: 5px; color: #333;">${commercialNotes}</p>
        </div>
      ` : ''}

      <p style="font-size: 12px; color: #888; margin-top: 25px; text-align: center;">
        This RFQ email was automatically dispatched from the IBF Website Request a Quote Desk.
      </p>
    </div>
  `

  const mailOptions = {
    from: `"${contactName || 'IBF RFQ Desk'}" <${process.env.SMTP_USER || 'alerts@ibf.com.sa'}>`,
    replyTo: email,
    to: recipientEmail,
    subject: `[IBF RFQ] Request from ${company || contactName || email}`,
    html: htmlContent,
  }

  return await transporter.sendMail(mailOptions)
}
