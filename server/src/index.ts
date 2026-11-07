import dotenv from 'dotenv';
dotenv.config();

import { app } from './app.js';

const PORT = parseInt(process.env.PORT || '8080', 10);

app.listen(PORT, () => {
  console.log(`🚀 Pangtao server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

