import Tesseract from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

/**
 * Extract text from uploaded files (PDFs, images, scans)
 */
export const extractTextFromFile = async (file) => {
  const fileType = file.type

  try {
    if (fileType === 'application/pdf') {
      return await extractFromPDF(file)
    } else if (fileType.startsWith('image/')) {
      return await extractFromImage(file)
    } else {
      console.warn('Unsupported file type:', fileType)
      return null
    }
  } catch (error) {
    console.error('Error extracting text from file:', error)
    return null
  }
}

/**
 * Extract text from PDF using pdfjs-dist (browser-compatible)
 */
const extractFromPDF = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        
        let fullText = ''
        
        // Extract text from each page
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum)
          const textContent = await page.getTextContent()
          const pageText = textContent.items.map(item => item.str).join(' ')
          fullText += pageText + '\n\n'
        }
        
        resolve({
          text: fullText.trim(),
          pages: pdf.numPages,
          info: pdf.fingerprints
        })
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Extract text from images using Tesseract OCR
 */
const extractFromImage = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const result = await Tesseract.recognize(
          e.target.result,
          'eng',
          {
            logger: (m) => console.log('OCR Progress:', m)
          }
        )
        resolve({
          text: result.data.text,
          confidence: result.data.confidence
        })
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Extract text from files stored in Supabase
 */
export const extractTextFromSupabaseFile = async (fileUrl) => {
  try {
    const response = await fetch(fileUrl)
    const blob = await response.blob()
    const file = new File([blob], 'temp', { type: blob.type })
    return await extractTextFromFile(file)
  } catch (error) {
    console.error('Error extracting text from Supabase file:', error)
    return null
  }
}

