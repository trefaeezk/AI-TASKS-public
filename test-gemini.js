// node test-gemini.js

import https from 'https';

const apiKey = 'AIzaSyDFaWvmPmOnQQYHhf16d6Xz3LiCoWAXVxo';
const url = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent';

const data = JSON.stringify({
  contents: [
    {
      parts: [
        {
          text: "انا اسمي طه ممكن تديني نصيحة?"
        }
      ]
    }
  ]
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey
  }
};

const req = https.request(url, options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('Response body:');
    console.log(responseData);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();


