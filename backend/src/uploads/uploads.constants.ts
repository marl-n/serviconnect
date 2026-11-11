import { join } from 'path';
import { mkdirSync } from 'fs';

/** backend/uploads — resolved from the working directory the server is started in (backend/). */
export const UPLOADS_DIR = join(process.cwd(), 'uploads');
mkdirSync(UPLOADS_DIR, { recursive: true });
