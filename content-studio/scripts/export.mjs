import { exportData } from '../db.mjs';
import { writeFileSync } from 'node:fs';
const file=process.argv[2]||`maios-content-export-${new Date().toISOString().slice(0,10)}.json`;
writeFileSync(file,JSON.stringify(exportData(),null,2));
console.log(`Export written to ${file}`);
