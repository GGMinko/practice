const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const mime = require('mime-types');
const axios = require('axios');

const wss = new WebSocket.Server({ noServer: true });

const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

const keywords = {
  word: [
    'https://images6.alphacoders.com/759/thumb-1920-759619.jpg',
    'https://mirpozitiva.ru/wp-content/uploads/2019/11/1476889932_zakat-derevo.jpg',
    'https://i.pinimg.com/originals/0f/01/32/0f013262a5c22790214ded3e067e8cad.jpg'
  ]
}

async function downloadFile(url, destinationPath) {
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(destinationPath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    throw new Error(`Error downloading file from ${url}: ${error.message}`);
  }
}

function fileToDataUri(filePath, callback) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      return callback(err);
    }

    const dataUri = `data:${getMimeType(filePath)};base64,${data.toString('base64')}`;
    callback(null, dataUri);
  });
}

function getMimeType(filePath) {
  const extension = path.extname(filePath);
  const mimeType = mime.lookup(extension);
  return mimeType;
}

function extractDestinationPath(link) {
  const parts = link.split('/');
  const filename = parts[parts.length - 1];
  const destinationPath = path.join('files', filename);
  return destinationPath;
}

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const parsedMessage = JSON.parse(message);

      if (parsedMessage.type === 'requestFile') {
        handleFileSend(ws, parsedMessage.link);
      } 
      else if (parsedMessage.type === 'requestKeyword') {
        const keyword = parsedMessage.keyword;

        if (keywords[keyword]) {
          const links = keywords[keyword];
          const responseMessage = {
            type: 'responseKeyword',
            links: links,
          };
          ws.send(JSON.stringify(responseMessage));
        } else {
          const responseMessage = {
            type: 'responseKeyword',
            links: [],
          };
          ws.send(JSON.stringify(responseMessage));
        }
      } 
      else {
        console.log('Received unknown message type:', parsedMessage.type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
});

function handleFileSend(ws, link) {
  const destinationPath = extractDestinationPath(link);

  downloadFile(link, destinationPath)
    .then(() => {
      console.log('File downloaded successfully!');

      fileToDataUri(destinationPath, (err, data) => {
        console.log('Sending file')
        console.log(data.length)

        if (err) {
          console.error('Error reading file:', err);
          return;
        }

        const chunkSize = 8000;
        const totalChunks = Math.ceil(data.length / chunkSize);

        for (let i = 0; i < totalChunks; i++) {
          const start = i * chunkSize;
          const end = (i + 1) * chunkSize;
          const chunkData = data.substring(start, end);

          const message = {
            type: 'responseFile',
            link: link,
            filename: path.basename(destinationPath),
            part: i + 1,
            count: totalChunks,
            data: chunkData,
          };

          ws.send(JSON.stringify(message));
        }
      });
    })
    .catch((error) => {
      console.error(error.message);
    });
}

// Создаем несколько потоков
if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
}
else {
  const httpServer = require('http').createServer();
  httpServer.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  httpServer.listen(3000, () => {
    console.log('Server is listening on port 3000');
  });
}

