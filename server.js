import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { sendContactEmail, sendRfqEmail } from './emailService.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

// CORS setup
const allowedOrigin = process.env.FRONTEND_URL || 'http://127.0.0.1:5173'
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl) or matching dev server
      if (!origin || origin.includes('127.0.0.1') || origin.includes('localhost') || origin === allowedOrigin) {
        callback(null, true)
      } else {
        callback(null, true) // permissive for local development
      }
    },
    credentials: true,
  })
)

app.use(express.json())

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'IBF Nodemailer Backend Service is running' })
})

// Contact Form submission endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const formData = req.body
    if (!formData.email || !formData.message) {
      return res.status(400).json({ success: false, message: 'Email and message are required.' })
    }

    console.log('📬 Received Contact Form Submission:', formData.email)
    const result = await sendContactEmail(formData)
    console.log('✅ Contact Email sent successfully. Message ID:', result.messageId)

    return res.status(200).json({
      success: true,
      message: 'Message dispatched successfully to ms@ibf.com.sa',
      messageId: result.messageId,
    })
  } catch (error) {
    console.error('❌ Error sending Contact email:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to send email. Please check server SMTP configuration.',
      error: error.message,
    })
  }
})

// RFQ Request Form submission endpoint
app.post('/api/request-quote', async (req, res) => {
  try {
    const formData = req.body
    if (!formData.email || !formData.contactName || !formData.company) {
      return res.status(400).json({
        success: false,
        message: 'Contact name, company, and email are required.',
      })
    }

    console.log('📄 Received RFQ Request Submission:', formData.email, 'Company:', formData.company)
    const result = await sendRfqEmail(formData)
    console.log('✅ RFQ Email sent successfully. Message ID:', result.messageId)

    return res.status(200).json({
      success: true,
      message: 'RFQ request dispatched successfully to ms@ibf.com.sa',
      messageId: result.messageId,
    })
  } catch (error) {
    console.error('❌ Error sending RFQ email:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to send RFQ email. Please check server SMTP configuration.',
      error: error.message,
    })
  }
})

app.listen(PORT, () => {
  console.log(`=================================================`)
  console.log(`🚀 IBF Email Backend running at http://localhost:${PORT}`)
  console.log(`📧 Target Recipient: ${process.env.RECIPIENT_EMAIL || 'ms@ibf.com.sa'}`)
  console.log(`=================================================`)
})
