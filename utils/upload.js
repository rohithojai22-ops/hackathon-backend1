import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const upl = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(upl)) fs.mkdirSync(upl, { recursive: true });
    cb(null, upl);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

export const upload = multer({ storage });

