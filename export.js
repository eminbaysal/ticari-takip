require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

const LOCAL_URI = 'mongodb://localhost:27017/ticari-takip';

mongoose.connect(LOCAL_URI).then(async () => {
  const firmalar = await mongoose.connection.db.collection('firmalar').find({}).toArray();
  const hizmetler = await mongoose.connection.db.collection('hizmetler').find({}).toArray();

  fs.writeFileSync('firmalar.json', JSON.stringify(firmalar, null, 2));
  fs.writeFileSync('hizmetler.json', JSON.stringify(hizmetler, null, 2));

  console.log(`firmalar.json: ${firmalar.length} kayıt`);
  console.log(`hizmetler.json: ${hizmetler.length} kayıt`);

  mongoose.disconnect();
});
