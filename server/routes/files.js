import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import { createRequire } from 'node:module';
import { buildDocx } from '../export/docx.js';
import { buildPdf } from '../export/pdf.js';

const require = createRequire(import.meta.url);
// Import the library file directly (the package index runs debug code).
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

const router = Router();

// Uploads are held in memory only and discarded after text extraction.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(pdf|docx|txt)$/i.test(file.originalname);
    cb(ok ? null : Object.assign(new Error('Please upload a PDF, DOCX or TXT file.'), { status: 400 }), ok);
  },
});

router.post('/extract', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 5 MB.' : err.message;
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    try {
      const name = req.file.originalname.toLowerCase();
      const buf = req.file.buffer;
      // Verify the real file type from its first bytes, not just the extension.
      const isPdf = buf.subarray(0, 5).toString('latin1') === '%PDF-';
      const isZip = buf[0] === 0x50 && buf[1] === 0x4b; // DOCX is a ZIP container
      const looksText = !buf.subarray(0, 4000).includes(0);
      if ((name.endsWith('.pdf') && !isPdf) || (name.endsWith('.docx') && !isZip) || (name.endsWith('.txt') && !looksText)) {
        return res.status(400).json({ error: 'That file does not look like a real PDF, DOCX or TXT file.' });
      }
      let text = '';
      if (name.endsWith('.pdf')) text = (await pdfParse(req.file.buffer)).text;
      else if (name.endsWith('.docx')) text = (await mammoth.extractRawText({ buffer: req.file.buffer })).value;
      else text = req.file.buffer.toString('utf8');
      text = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
      if (text.length < 40) {
        return res.status(422).json({ error: 'No readable text found. If this is a scanned/image PDF, ATS systems may not read it either — try a text-based file.' });
      }
      res.json({ text: text.slice(0, 20000), chars: text.length });
    } catch (e) {
      console.error('[extract]', e.message);
      res.status(422).json({ error: 'Could not read that file. Try another PDF or DOCX.' });
    }
  });
});

router.post('/export/docx', async (req, res) => {
  try {
    const resume = req.body?.resume;
    if (!resume?.personal) return res.status(400).json({ error: 'Missing resume.' });
    const buf = await buildDocx(resume);
    const fname = String(req.body.fileName || 'resume').replace(/[^\w\- ]+/g, '').trim() || 'resume';
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fname}.docx"`,
    });
    res.send(buf);
  } catch (e) {
    console.error('[docx]', e);
    res.status(500).json({ error: 'Could not create the DOCX file.' });
  }
});

router.post('/export/pdf', async (req, res) => {
  try {
    const resume = req.body?.resume;
    if (!resume?.personal) return res.status(400).json({ error: 'Missing resume.' });
    const buf = await buildPdf(resume);
    const fname = String(req.body.fileName || 'resume').replace(/[^\w\- ]+/g, '').trim() || 'resume';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fname}.pdf"`,
    });
    res.send(buf);
  } catch (e) {
    console.error('[pdf]', e);
    res.status(500).json({ error: 'Could not create the PDF file.' });
  }
});

router.post('/export/cover-letter', async (req, res) => {
  try {
    const { letter = '', name = '' } = req.body || {};
    const { Document, Packer, Paragraph, TextRun } = await import('docx');
    const doc = new Document({
      styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
      sections: [{ children: String(letter).split(/\n/).map((l) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun(l)] })) }],
    });
    const buf = await Packer.toBuffer(doc);
    const fname = (`${name} Cover Letter`).replace(/[^\w\- ]+/g, '').trim() || 'cover-letter';
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fname}.docx"`,
    });
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: 'Could not create the DOCX file.' });
  }
});

export default router;
